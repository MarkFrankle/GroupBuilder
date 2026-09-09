/**
 * The absence edits, as pure transforms.
 *
 * Both rewrite one session's entry and return a new whole-program array. Every
 * other entry comes back by identity: `/results/save` compares completed
 * sessions exactly (Item 2a), so a gratuitous rewrite of an untouched session
 * would be refused as tampering.
 */
import { tableNumbers } from '@/utils/assignmentStats'
import type { Assignment } from '@/types/assignments'

/** Rewrite one session, leaving every other entry untouched by identity. */
function replaceSession(
  assignments: Assignment[],
  sessionNumber: number,
  edit: (assignment: Assignment) => Assignment
): Assignment[] {
  return assignments.map(a => (a.session === sessionNumber ? edit(a) : a))
}

/** Which tables in this session hold an empty seat. */
export function tablesWithOpenSeat(assignment: Assignment): number[] {
  return tableNumbers(assignment).filter(n =>
    assignment.tables[n].some(seat => seat === null)
  )
}

/**
 * Remove a person from one session and record the absence.
 *
 * The seat becomes null rather than disappearing: the solver never runs without
 * an explicit user action, so the gap stays visible until someone shuffles.
 * Exactly one seat empties, so a roster holding two people of the same name
 * loses one seat rather than both.
 */
export function markAbsent(
  assignments: Assignment[],
  sessionNumber: number,
  name: string
): Assignment[] {
  return replaceSession(assignments, sessionNumber, assignment => {
    for (const n of tableNumbers(assignment)) {
      const seats = assignment.tables[n]
      const index = seats.findIndex(seat => seat?.name === name)
      if (index === -1) continue

      const person = seats[index]
      if (!person) continue

      const replaced = [...seats]
      replaced[index] = null

      return {
        ...assignment,
        tables: { ...assignment.tables, [n]: replaced },
        absentParticipants: [...(assignment.absentParticipants ?? []), person],
      }
    }
    return assignment
  })
}

/**
 * Seat an absent person at a chosen table, and clear the absence record.
 *
 * Clearing is not bookkeeping: absences are solver input and deliberately
 * survive every shuffle and rebuild, so a mark-present that only inserted a
 * chip would be undone by the next shuffle.
 */
export function markPresent(
  assignments: Assignment[],
  sessionNumber: number,
  name: string,
  tableNumber: number
): Assignment[] {
  return replaceSession(assignments, sessionNumber, assignment => {
    const absent = assignment.absentParticipants ?? []
    const person = absent.find(a => a.name === name)
    if (!person) return assignment

    const existing = assignment.tables[tableNumber]
    if (!existing) return assignment

    const seats = [...existing]
    const gap = seats.indexOf(null)
    if (gap === -1) {
      seats.push(person)
    } else {
      seats[gap] = person
    }

    return {
      ...assignment,
      tables: { ...assignment.tables, [tableNumber]: seats },
      absentParticipants: absent.filter(a => a.name !== name),
    }
  })
}
