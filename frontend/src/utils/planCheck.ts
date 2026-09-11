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
  kind: 'couple' | 'keepApart' | 'facilitatorCoverage'
  session: number
  table?: number
  /** The two people, sorted — couple and keep-apart only. */
  names?: [string, string]
  /** Pre-composed, coordinator-facing. The band and the inline flags both use this. */
  message: string
}

export interface PlanCheckResult {
  verdict: 'ok' | 'attention'
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
    /** Most sessions any participant shares a table with one same facilitator. 0 = no facilitators. */
    maxFacilitatorRepeat: number
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

/** Most times any non-partner pair shares a table across the given sessions. */
function worstPairRepeat(assignments: Assignment[]): number {
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
  return worst
}

/** Most sessions any one participant shares a table with one same facilitator. */
function worstFacilitatorRepeat(assignments: Assignment[]): number {
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
  return worst
}

/**
 * True when the solver held every table, for both religion and gender, to the
 * minimum spread the roster composition allows. When it did worse the line just
 * does not appear — we do not say what is wrong, because the coordinator cannot
 * act on it (redesign notes, Part 2).
 *
 * The roster population is taken from the first incomplete session; a person
 * absent later still counts, matching the old ValidationStats. This assumes
 * session 1 is full — an absence in session 1 would shrink the floor.
 */
function balanceHeldToRosterFloor(assignments: Assignment[]): boolean {
  if (assignments.length === 0) return false
  const firstTables = seatedTables(assignments[0])
  const numTables = firstTables.length
  if (numTables === 0) return false
  const roster = firstTables.flatMap(t => t.people)

  return (['religion', 'gender'] as const).every(key => {
    const rosterCounts = countBy(roster, key)
    const values = Object.keys(rosterCounts)
    if (values.length <= 1) return true
    const floor = expectedWithinTableDeviation(rosterCounts, numTables)
    return assignments.every(a => {
      const tableMaps = seatedTables(a).map(t => countBy(t.people, key))
      return actualWithinTableDeviation(tableMaps, values) <= floor
    })
  })
}

export function checkPlan(
  incompleteAssignments: Assignment[],
  keepApart: [string, string][]
): PlanCheckResult {
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

  return {
    verdict: violations.length > 0 ? 'attention' : 'ok',
    violations,
    incompleteSessionCount: incompleteAssignments.length,
    reassurances: {
      couplesSeparated: hasCouples ? !violations.some(v => v.kind === 'couple') : undefined,
      keepApartHonored:
        keepApart.length > 0 ? !violations.some(v => v.kind === 'keepApart') : undefined,
      facilitatorCoverage: hasFacilitators
        ? !violations.some(v => v.kind === 'facilitatorCoverage')
        : undefined,
      balanceEven: balanceHeldToRosterFloor(incompleteAssignments),
      maxPairRepeat: worstPairRepeat(incompleteAssignments),
      maxFacilitatorRepeat: hasFacilitators
        ? worstFacilitatorRepeat(incompleteAssignments)
        : 0,
    },
  }
}
