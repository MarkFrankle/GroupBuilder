import { markAbsent, markPresent, tablesWithOpenSeat } from '../assignmentEdits'
import type { Assignment, Participant } from '@/types/assignments'

/** jsdom does not expose `structuredClone`, and these fixtures are plain JSON. */
const deepCopy = (a: Assignment[]): Assignment[] => JSON.parse(JSON.stringify(a))

const p = (name: string): Participant => ({
  name,
  religion: 'Christian',
  gender: 'Female',
  partner: null,
})

const program = (): Assignment[] => [
  { session: 1, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara'), p('Dan')] } },
  { session: 2, tables: { 1: [p('Ann'), p('Cara')], 2: [p('Ben'), p('Dan')] } },
]

describe('markAbsent', () => {
  it('leaves a gap where the person sat', () => {
    const next = markAbsent(program(), 1, 'Cara')

    expect(next[0].tables[2]).toEqual([null, p('Dan')])
  })

  it('adds the person to that session’s absent list', () => {
    const next = markAbsent(program(), 1, 'Cara')

    expect(next[0].absentParticipants).toEqual([p('Cara')])
  })

  it('empties exactly one seat when two people share a name', () => {
    const twins: Assignment[] = [
      { session: 1, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Ann'), p('Dan')] } },
    ]

    const next = markAbsent(twins, 1, 'Ann')

    expect(next[0].tables[1]).toEqual([null, p('Ben')])
    expect(next[0].tables[2]).toEqual([p('Ann'), p('Dan')])
    expect(next[0].absentParticipants).toEqual([p('Ann')])
  })

  it('returns other sessions by identity', () => {
    const before = program()
    const next = markAbsent(before, 1, 'Cara')

    expect(next[1]).toBe(before[1])
  })

  it('leaves untouched tables in the edited session by identity', () => {
    const before = program()
    const next = markAbsent(before, 1, 'Cara')

    expect(next[0].tables[1]).toBe(before[0].tables[1])
  })

  it('does not mutate the input', () => {
    const before = program()
    const snapshot = deepCopy(before)

    markAbsent(before, 1, 'Cara')

    expect(before).toEqual(snapshot)
  })

  it('leaves every session as it was when the person is not seated there', () => {
    const before = program()

    const next = markAbsent(before, 1, 'Nobody')

    expect(next.every((a, i) => a === before[i])).toBe(true)
  })
})

describe('tablesWithOpenSeat', () => {
  it('names every table holding a gap', () => {
    const withGaps: Assignment = {
      session: 1,
      tables: { 1: [p('Ann'), null], 2: [p('Cara')], 3: [null] },
    }

    expect(tablesWithOpenSeat(withGaps)).toEqual([1, 3])
  })

  it('names nothing when every seat is filled', () => {
    const full: Assignment = {
      session: 1,
      tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara')] },
    }

    expect(tablesWithOpenSeat(full)).toEqual([])
  })
})

describe('markPresent', () => {
  const absent = (): Assignment[] => [
    {
      session: 1,
      tables: { 1: [p('Ann'), p('Ben')], 2: [null, p('Dan')] },
      absentParticipants: [p('Cara')],
    },
    { session: 2, tables: { 1: [p('Ann')], 2: [p('Ben')] } },
  ]

  it('fills the gap at the chosen table', () => {
    const next = markPresent(absent(), 1, 'Cara', 2)

    expect(next[0].tables[2]).toEqual([p('Cara'), p('Dan')])
  })

  it('appends when the chosen table has no gap left', () => {
    const next = markPresent(absent(), 1, 'Cara', 1)

    expect(next[0].tables[1]).toEqual([p('Ann'), p('Ben'), p('Cara')])
  })

  it('clears the absence record, or the next shuffle drops them again', () => {
    const next = markPresent(absent(), 1, 'Cara', 2)

    expect(next[0].absentParticipants).toEqual([])
  })

  it('leaves every session as it was when the person is not absent', () => {
    const before = absent()

    const next = markPresent(before, 1, 'Nobody', 2)

    expect(next.every((a, i) => a === before[i])).toBe(true)
  })

  it('invents no table when the chosen number does not exist', () => {
    const before = absent()

    const next = markPresent(before, 1, 'Cara', 9)

    expect(next.every((a, i) => a === before[i])).toBe(true)
  })

  it('returns other sessions by identity', () => {
    const before = absent()
    const next = markPresent(before, 1, 'Cara', 2)

    expect(next[1]).toBe(before[1])
  })

  it('does not mutate the input', () => {
    const before = absent()
    const snapshot = deepCopy(before)

    markPresent(before, 1, 'Cara', 2)

    expect(before).toEqual(snapshot)
  })
})
