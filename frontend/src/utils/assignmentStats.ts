/**
 * Facts the overview states about a plan, all derived from the assignments
 * themselves — no endpoint computes any of this.
 */
import type { Assignment, Participant } from '@/types/assignments'

/**
 * Table numbers arrive as object keys, so they are strings.
 *
 * Exported because this was pasted a third time (SessionCard) and three copies
 * is worse than an imperfect home. A stats module owning a shape helper an
 * edits module also needs is the wrong dependency direction in the abstract,
 * but a neutral fourth module for six lines is the clever abstraction this
 * repo warns about — and every caller already imports from here or from a
 * module that does.
 */
export function tableNumbers(assignment: Assignment): number[] {
  return Object.keys(assignment.tables)
    .map(Number)
    .sort((a, b) => a - b)
}

function people(assignment: Assignment): Participant[] {
  return tableNumbers(assignment).flatMap(n =>
    assignment.tables[n].filter((p): p is Participant => !!p)
  )
}

/** Which table each person sat at in one session. */
function seatingByName(assignment: Assignment): Map<string, number> {
  const seating = new Map<string, number>()
  tableNumbers(assignment).forEach(n => {
    assignment.tables[n].forEach(p => {
      if (p) seating.set(p.name, n)
    })
  })
  return seating
}

/**
 * "6 people", "1 person" — the population of one table, said once.
 *
 * The per-table stats line and the Mark present picker both state this, and
 * strings that agree today drift silently.
 */
export function personCount(count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'}`
}

/** How many seats a session actually fills — empty chairs are not people. */
export function seatedCount(assignment: Assignment): number {
  return people(assignment).length
}

/** Unordered name pairs sharing a table, counted across the whole program. */
function pairCounts(assignments: Assignment[]): Map<string, number> {
  const counts = new Map<string, number>()
  assignments.forEach(assignment => {
    tableNumbers(assignment).forEach(n => {
      const names = assignment.tables[n]
        .filter((p): p is Participant => !!p)
        .map(p => p.name)
      for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
          const key = [names[i], names[j]].sort().join(' ')
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    })
  })
  return counts
}

/** Pairs who sat together more than once. */
function repeatPairs(assignments: Assignment[]): number {
  let repeats = 0
  pairCounts(assignments).forEach(count => {
    if (count > 1) repeats += 1
  })
  return repeats
}

/**
 * Item 8's three-clause receipt.
 *
 * The moved count answers the question a user actually has after pressing
 * shuffle — did anything happen? A globally-aware re-solve can legitimately
 * return something close to what was there, and this degrades honestly:
 * "2 of 24 moved" is the truth, and tells the user to shuffle again.
 *
 * The quality delta is reported in both directions, including when it gets
 * worse. A number that only ever appears as good news is decoration.
 */
export function shuffleReceipt(
  before: Assignment[],
  after: Assignment[],
  sessionNumber: number
): string {
  const beforeSession = before.find(a => a.session === sessionNumber)
  const afterSession = after.find(a => a.session === sessionNumber)
  if (!beforeSession || !afterSession) return `Session ${sessionNumber} shuffled.`

  const wasSeated = seatingByName(beforeSession)
  const nowSeated = seatingByName(afterSession)
  const total = people(afterSession).length
  let moved = 0
  nowSeated.forEach((table, name) => {
    if (wasSeated.get(name) !== table) moved += 1
  })

  const clauses = [`${moved} of ${total} ${total === 1 ? 'person' : 'people'} moved`]

  const untouched = after
    .map(a => a.session)
    .filter(n => n !== sessionNumber)
    .sort((a, b) => a - b)
  if (untouched.length > 0) {
    clauses.push(`sessions ${untouched.join(', ')} unchanged`)
  }

  const wasRepeats = repeatPairs(before)
  const nowRepeats = repeatPairs(after)
  clauses.push(
    `${nowRepeats} repeat ${nowRepeats === 1 ? 'pair' : 'pairs'} across the program (was ${wasRepeats})`
  )

  return `Session ${sessionNumber} shuffled. ${clauses.join(' · ')}.`
}

/** Average number of distinct people each participant sits with, to one decimal. */
export function uniqueTablematesAverage(assignments: Assignment[]): number {
  const met = new Map<string, Set<string>>()
  assignments.forEach(assignment => {
    tableNumbers(assignment).forEach(n => {
      const names = assignment.tables[n]
        .filter((p): p is Participant => !!p)
        .map(p => p.name)
      names.forEach(name => {
        const seen = met.get(name) ?? new Set<string>()
        names.forEach(other => {
          if (other !== name) seen.add(other)
        })
        met.set(name, seen)
      })
    })
  })

  if (met.size === 0) return 0
  let total = 0
  met.forEach(seen => {
    total += seen.size
  })
  return Math.round((total / met.size) * 10) / 10
}

/** Distinct linked partnerships in the roster, counted once each. */
export function linkedPairCount(assignments: Assignment[]): number {
  const pairs = new Set<string>()
  assignments.forEach(assignment => {
    people(assignment).forEach(p => {
      if (p.partner) pairs.add([p.name, p.partner].sort().join(' '))
    })
  })
  return pairs.size
}

/**
 * A mid-program rebuild keeps completed sessions and re-seats the rest. The
 * receipt names both halves so a coordinator can see nothing already run was
 * disturbed.
 */
export function rebuildReceipt(k: number, total: number): string {
  if (k <= 0) return 'Sessions rebuilt.'
  const resolvedFrom = k + 1
  const unchangedPhrase =
    k === 1 ? 'Session 1 unchanged' : `Sessions 1\u2013${k} unchanged`
  const newPhrase =
    total - k === 1
      ? `session ${resolvedFrom} has new seating`
      : `sessions ${resolvedFrom}\u2013${total} have new seating`
  return `Sessions rebuilt. ${unchangedPhrase}; ${newPhrase}.`
}
