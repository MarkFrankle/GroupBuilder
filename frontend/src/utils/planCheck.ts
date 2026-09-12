/**
 * The plan check behind the Assignments overview's verdict band.
 *
 * Pure and self-contained: given the incomplete sessions and the keep-apart
 * pairs the plan was built with, it returns everything the band renders. Item
 * 15's inline per-table flags render from the same `violations` array, so the
 * two surfaces never disagree.
 *
 * Deliberately quiet about quality (see the redesign notes, Part 2): only a
 * rule the user themselves stated — couples apart, keep-apart honoured, every
 * table staffed — can turn the verdict amber. The mixing and facilitator-variety
 * numbers are reassurances; they never flip it.
 */
import { expectedWithinTableDeviation, actualWithinTableDeviation } from './balanceStats'
import type { Assignment, Participant } from '@/types/assignments'

export interface Violation {
  kind: 'couple' | 'keepApart' | 'facilitatorCoverage' | 'balance'
  session: number
  table?: number
  /** The two people, sorted — couple and keep-apart only. */
  names?: [string, string]
  /** Pre-composed, coordinator-facing. The band and the inline flags both use this. */
  message: string
}

export interface PlanCheckResult {
  /**
   * 'attention' — a stated rule broke: couples together, keep-apart together,
   * a table with no facilitator, or balance worse than the roster's floor.
   * 'lessThanIdeal' — none of those, but a soft signal (pair-repeat,
   * facilitator-repeat, table-overlap) ran past its floor.
   * 'ok' — everything at floor.
   */
  verdict: 'ok' | 'lessThanIdeal' | 'attention'
  violations: Violation[]
  /** How many incomplete sessions the check covered — the band hides the
   *  repeat lines below two, where "repeat" is meaningless. */
  incompleteSessionCount: number
  reassurances: {
    /** undefined = the roster has no partner links, so there is nothing to say. */
    couplesSeparated?: boolean
    /** undefined = the program has no keep-apart pairs. */
    keepApartHonored?: boolean
    /** undefined = no participant is a facilitator. */
    facilitatorCoverage?: boolean
    /** true = every table is within the spread the roster composition allows. */
    balanceEven: boolean
    /** Most times any non-partner pair shares a table. */
    maxPairRepeat: number
    /** The floor maxPairRepeat is compared against — the caller's pairwiseFloor
     *  when given, else the default of 2. This is the solver's mathematical
     *  minimum for this roster shape, not the (possibly looser) escalated cap. */
    pairRepeatFloor: number
    /** Every non-partner pair tied for maxPairRepeat, named — empty when at or under the floor. */
    pairRepeatWorst: { names: [string, string]; count: number }[]
    /** Most sessions any participant shares a table with one same facilitator. 0 = no facilitators. */
    maxFacilitatorRepeat: number
    /** The floor maxFacilitatorRepeat is compared against. Always identical to
     *  `pairRepeatFloor` — a facilitator is just a participant to the solver,
     *  so the same pairwise-repeat floor governs both. Kept as a separate
     *  field only because PlanCheckBand.tsx reads it by this name. */
    facilitatorRepeatFloor: number
    /** Everyone tied for maxFacilitatorRepeat, named — empty when at or under the floor. */
    facilitatorRepeatWorst: { participant: string; facilitator: string; count: number }[]
    /** Most people any two tables from different sessions have in common. */
    maxTableOverlap: number
    /** The solver's real table-overlap floor, when known — null omits the
     *  overlap line entirely, matching the caller's overlapFloor argument. */
    tableOverlapCap: number | null
    /** Every pair of tables tied for maxTableOverlap, named — empty when at or under the floor. */
    tableOverlapWorst: {
      sessions: [number, number]
      tables: [number, number]
      names: string[]
    }[]
  }
}

interface CanonicalParticipant {
  name: string
  keep_apart?: string[]
}

/** Distinct, sorted keep-apart name pairs from the canonical roster. */
export function keepApartPairs(participants: CanonicalParticipant[]): [string, string][] {
  const seen = new Set<string>()
  const pairs: [string, string][] = []
  participants.forEach(person => {
    ;(person.keep_apart ?? []).forEach(other => {
      if (other === person.name) return
      const pair = [person.name, other].sort() as [string, string]
      const key = pair.join('\x00')
      if (seen.has(key)) return
      seen.add(key)
      pairs.push(pair)
    })
  })
  return pairs
}

function seatedTables(a: Assignment): { table: number; people: Participant[] }[] {
  return Object.keys(a.tables)
    .map(Number)
    .sort((x, y) => x - y)
    .map(table => ({
      table,
      people: a.tables[table].filter((s): s is Participant => !!s),
    }))
}

function countBy(people: Participant[], key: 'religion' | 'gender'): Record<string, number> {
  const counts: Record<string, number> = {}
  people.forEach(person => {
    counts[person[key]] = (counts[person[key]] ?? 0) + 1
  })
  return counts
}

/**
 * Most times any non-partner pair shares a table across the given sessions,
 * plus every pair tied for that worst count, named.
 */
function worstPairRepeat(assignments: Assignment[]): {
  worst: number
  details: { names: [string, string]; count: number }[]
} {
  const partnerOf = new Map<string, string>()
  const counts = new Map<string, number>()
  assignments.forEach(a =>
    seatedTables(a).forEach(({ people }) => {
      people.forEach(person => {
        if (person.partner) partnerOf.set(person.name, person.partner)
      })
      for (let i = 0; i < people.length; i += 1) {
        for (let j = i + 1; j < people.length; j += 1) {
          if (people[i].is_facilitator || people[j].is_facilitator) continue
          const key = [people[i].name, people[j].name].sort().join('\x00')
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    })
  )
  let worst = 0
  counts.forEach((count, key) => {
    const [x, y] = key.split('\x00')
    if (partnerOf.get(x) === y || partnerOf.get(y) === x) return
    worst = Math.max(worst, count)
  })
  const details: { names: [string, string]; count: number }[] = []
  counts.forEach((count, key) => {
    if (count !== worst) return
    const [x, y] = key.split('\x00') as [string, string]
    if (partnerOf.get(x) === y || partnerOf.get(y) === x) return
    details.push({ names: [x, y], count })
  })
  return { worst, details }
}

/**
 * Most sessions any one participant shares a table with one same facilitator,
 * plus everyone tied for that worst count, named.
 */
function worstFacilitatorRepeat(assignments: Assignment[]): {
  worst: number
  details: { participant: string; facilitator: string; count: number }[]
} {
  const counts = new Map<string, number>()
  assignments.forEach(a =>
    seatedTables(a).forEach(({ people }) => {
      const facilitators = people.filter(person => person.is_facilitator)
      const participants = people.filter(person => !person.is_facilitator)
      participants.forEach(person =>
        facilitators.forEach(f => {
          const key = `${person.name}\x00${f.name}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        })
      )
    })
  )
  let worst = 0
  counts.forEach(count => {
    worst = Math.max(worst, count)
  })
  const details: { participant: string; facilitator: string; count: number }[] = []
  counts.forEach((count, key) => {
    if (count !== worst) return
    const [participant, facilitator] = key.split('\x00')
    details.push({ participant, facilitator, count })
  })
  return { worst, details }
}

/**
 * Most people any two tables from different sessions have in common, plus
 * every pair of tables tied for that worst count, named. Same-session tables
 * can never overlap — a person sits at exactly one table per session — so
 * this only compares tables across distinct sessions, matching the hard cap
 * `group_builder.py` enforces server-side.
 */
function worstTableOverlap(assignments: Assignment[]): {
  worst: number
  details: { sessions: [number, number]; tables: [number, number]; names: string[] }[]
} {
  const allTables = assignments.flatMap(a =>
    seatedTables(a).map(t => ({
      session: a.session,
      table: t.table,
      names: new Set(t.people.map(p => p.name)),
    }))
  )

  let worst = 0
  const overlaps: {
    sessions: [number, number]
    tables: [number, number]
    names: string[]
  }[] = []

  for (let i = 0; i < allTables.length; i += 1) {
    for (let j = i + 1; j < allTables.length; j += 1) {
      const a = allTables[i]
      const b = allTables[j]
      if (a.session === b.session) continue
      const shared = Array.from(a.names).filter(name => b.names.has(name))
      if (shared.length === 0) continue
      if (shared.length > worst) {
        worst = shared.length
        overlaps.length = 0
      }
      if (shared.length === worst) {
        overlaps.push({
          sessions: [a.session, b.session],
          tables: [a.table, b.table],
          names: shared,
        })
      }
    }
  }

  return { worst, details: overlaps }
}

const BALANCE_KEYS = ['religion', 'gender'] as const
const BALANCE_LABEL: Record<(typeof BALANCE_KEYS)[number], string> = {
  religion: 'religion',
  gender: 'gender',
}

/**
 * Finds every incomplete session where the solver did worse than the minimum
 * spread that session's own present roster allows, for religion and/or gender.
 *
 * The floor is computed per session from who actually attends that session,
 * not from a shared full-roster count: the solver's balance constraint is
 * itself scoped to present participants per session, so a session with an
 * absence can have a genuinely different (often higher) floor than a fully
 * attended one. Comparing every session against one session's floor would
 * flag a session as unbalanced solely because someone was away, even when
 * the solver did the best possible job for who was actually there.
 */
function balanceFailures(
  assignments: Assignment[]
): { session: number; key: (typeof BALANCE_KEYS)[number] }[] {
  const failures: { session: number; key: (typeof BALANCE_KEYS)[number] }[] = []
  BALANCE_KEYS.forEach(key => {
    // The full set of attribute values across every session, so a session
    // missing a value entirely (e.g. no "Other" present) still zero-fills.
    const values = Array.from(
      new Set(assignments.flatMap(a => seatedTables(a).flatMap(t => t.people.map(p => p[key]))))
    )
    if (values.length <= 1) return
    assignments.forEach(a => {
      const tables = seatedTables(a)
      const numTables = tables.length
      if (numTables === 0) return
      const sessionRoster = tables.flatMap(t => t.people)
      const floor = expectedWithinTableDeviation(countBy(sessionRoster, key), numTables)
      const tableMaps = tables.map(t => countBy(t.people, key))
      if (actualWithinTableDeviation(tableMaps, values) > floor) {
        failures.push({ session: a.session, key })
      }
    })
  })
  return failures
}

const DEFAULT_PAIRWISE_FLOOR = 2

/**
 * How much further above the table-overlap floor is tolerated before it's
 * treated as a real problem (verdict-affecting), versus just a quiet fact.
 *
 * The floor (`compute_overlap_lower_bound`) is a pigeonhole *lower bound*,
 * not a guaranteed-achievable target - couples/keep-apart/linked pairs can
 * make it genuinely unreachable for a given roster, and a single-session
 * shuffle has strictly less freedom to approach it than a full multi-session
 * generate does. One person over floor is exactly the kind of gap that's
 * often just statistically expected for a small roster, not a sign the
 * solver did a bad job or that the user has anything to fix. Exactly
 * `floor + this` is shown as a plain fact (PlanCheckBand/PlanCheckCompactRow
 * both still surface it) but does not flip the verdict; only strictly more
 * than that does.
 */
export const TABLE_OVERLAP_ALERT_SLACK = 1

export function checkPlan(
  incompleteAssignments: Assignment[],
  keepApart: [string, string][],
  /** This roster's real pairwise-repeat floor (the solver's mathematical
   *  minimum for this program shape) — governs both the generic pair-repeat
   *  check and facilitator-repeat, since a facilitator is just a participant
   *  to the solver. Null/undefined falls back to a default of 2. */
  pairwiseFloor?: number | null,
  /** This roster's real table-overlap floor. Null/undefined means overlap
   *  never contributes to the verdict — there is no fallback floor to
   *  compare against. */
  overlapFloor?: number | null
): PlanCheckResult {
  const facilitatorRepeat = worstFacilitatorRepeat(incompleteAssignments)
  const pairRepeat = worstPairRepeat(incompleteAssignments)
  const tableOverlap = worstTableOverlap(incompleteAssignments)
  const violations: Violation[] = []
  const everyone = incompleteAssignments.flatMap(a => seatedTables(a).flatMap(t => t.people))
  const hasCouples = everyone.some(person => person.partner && !person.keep_together)
  const hasFacilitators = everyone.some(person => person.is_facilitator)

  incompleteAssignments.forEach(a => {
    seatedTables(a).forEach(({ table, people }) => {
      const names = new Set(people.map(person => person.name))

      const flaggedCouples = new Set<string>()
      people.forEach(person => {
        // `partner` also names linked pairs (must sit together, keep_together
        // true) — only a couple (must sit apart) seated together is a violation.
        if (!person.partner || person.keep_together || !names.has(person.partner)) return
        const pair = [person.name, person.partner].sort() as [string, string]
        const key = pair.join('\x00')
        if (flaggedCouples.has(key)) return
        flaggedCouples.add(key)
        violations.push({
          kind: 'couple',
          session: a.session,
          table,
          names: pair,
          message: `Session ${a.session} seats ${pair[0]} & ${pair[1]} together`,
        })
      })

      keepApart.forEach(([x, y]) => {
        if (!names.has(x) || !names.has(y)) return
        violations.push({
          kind: 'keepApart',
          session: a.session,
          table,
          names: [x, y],
          message: `Session ${a.session} seats ${x} & ${y} together — you asked to keep them apart`,
        })
      })

      if (hasFacilitators && !people.some(person => person.is_facilitator)) {
        violations.push({
          kind: 'facilitatorCoverage',
          session: a.session,
          table,
          message: `Session ${a.session}, Table ${table} has no facilitator`,
        })
      }
    })
  })

  balanceFailures(incompleteAssignments).forEach(({ session, key }) => {
    violations.push({
      kind: 'balance',
      session,
      message: `Session ${session} isn't mixed as evenly by ${BALANCE_LABEL[key]} as this roster allows`,
    })
  })

  const pairRepeatFloor = pairwiseFloor ?? DEFAULT_PAIRWISE_FLOOR
  const softOverFloor =
    pairRepeat.worst > pairRepeatFloor ||
    (hasFacilitators && facilitatorRepeat.worst > pairRepeatFloor) ||
    (overlapFloor != null && tableOverlap.worst > overlapFloor + TABLE_OVERLAP_ALERT_SLACK)

  return {
    verdict: violations.length > 0 ? 'attention' : softOverFloor ? 'lessThanIdeal' : 'ok',
    violations,
    incompleteSessionCount: incompleteAssignments.length,
    reassurances: {
      couplesSeparated: hasCouples ? !violations.some(v => v.kind === 'couple') : undefined,
      keepApartHonored:
        keepApart.length > 0 ? !violations.some(v => v.kind === 'keepApart') : undefined,
      facilitatorCoverage: hasFacilitators
        ? !violations.some(v => v.kind === 'facilitatorCoverage')
        : undefined,
      balanceEven: !violations.some(v => v.kind === 'balance'),
      maxPairRepeat: pairRepeat.worst,
      pairRepeatFloor,
      pairRepeatWorst: pairRepeat.details,
      maxFacilitatorRepeat: hasFacilitators ? facilitatorRepeat.worst : 0,
      facilitatorRepeatFloor: pairRepeatFloor,
      facilitatorRepeatWorst: hasFacilitators ? facilitatorRepeat.details : [],
      maxTableOverlap: tableOverlap.worst,
      tableOverlapCap: overlapFloor ?? null,
      tableOverlapWorst: tableOverlap.details,
    },
  }
}
