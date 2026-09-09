import { markAbsent, markPresent, tablesWithOpenSeat } from '../assignmentEdits'
import type { Assignment, Participant } from '@/types/assignments'

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

  it('changes no other session', () => {
    const before = program()
    const next = markAbsent(before, 1, 'Cara')

    expect(next[1]).toEqual(before[1])
  })

  it('returns the array unchanged when the person is not seated there', () => {
    const before = program()

    expect(markAbsent(before, 1, 'Nobody')).toEqual(before)
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

  it('changes no other session', () => {
    const before = absent()
    const next = markPresent(before, 1, 'Cara', 2)

    expect(next[1]).toEqual(before[1])
  })
})
