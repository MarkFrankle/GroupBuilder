/**
 * The absence edits, as pure transforms.
 *
 * Both rewrite one session's entry and return a new whole-program array. Every
 * other entry comes back by identity: `/results/save` compares completed
 * sessions exactly (Item 2a), so a gratuitous rewrite of an untouched session
 * would be refused as tampering.
 */
import type { Assignment, Participant } from '@/types/assignments'

/** Table numbers arrive as object keys, so they are strings. */
function tableNumbers(assignment: Assignment): number[] {
  return Object.keys(assignment.tables)
    .map(Number)
    .sort((a, b) => a - b)
}

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
 */
export function markAbsent(
  assignments: Assignment[],
  sessionNumber: number,
  name: string
): Assignment[] {
  return replaceSession(assignments, sessionNumber, assignment => {
    const removed: Participant | undefined = tableNumbers(assignment)
      .flatMap(n => assignment.tables[n])
      .find((seat): seat is Participant => !!seat && seat.name === name)

    if (!removed) return assignment

    const tables: Assignment['tables'] = {}
    for (const n of tableNumbers(assignment)) {
      tables[n] = assignment.tables[n].map(seat =>
        seat && seat.name === name ? null : seat
      )
    }

    return {
      ...assignment,
      tables,
      absentParticipants: [...(assignment.absentParticipants ?? []), removed],
    }
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

    const seats = [...(assignment.tables[tableNumber] ?? [])]
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
