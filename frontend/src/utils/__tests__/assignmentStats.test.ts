import {
  personCount,
  shuffleReceipt,
  uniqueTablematesAverage,
  linkedPairCount,
  seatedCount,
} from '../assignmentStats'
import type { Assignment, Participant } from '@/types/assignments'

const p = (name: string, partner: string | null = null): Participant => ({
  name,
  religion: 'Christian',
  gender: 'Female',
  partner,
})

/** Three sessions, two tables, four people. */
const before: Assignment[] = [
  { session: 1, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara'), p('Dan')] } },
  { session: 2, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara'), p('Dan')] } },
  { session: 3, tables: { 1: [p('Ann'), p('Cara')], 2: [p('Ben'), p('Dan')] } },
]

/** Session 2 reshuffled: Ann swaps with Cara, so two people moved table. */
const after: Assignment[] = [
  before[0],
  { session: 2, tables: { 1: [p('Ann'), p('Cara')], 2: [p('Ben'), p('Dan')] } },
  before[2],
]

describe('shuffleReceipt', () => {
  it('names the session and counts the people who moved', () => {
    expect(shuffleReceipt(before, after, 2)).toContain('Session 2 shuffled.')
    expect(shuffleReceipt(before, after, 2)).toContain('2 of 4 people moved')
  })

  it('names the sessions that did not change', () => {
    expect(shuffleReceipt(before, after, 2)).toContain('sessions 1, 3 unchanged')
  })

  it('degrades honestly when nothing moved', () => {
    expect(shuffleReceipt(before, before, 2)).toContain('0 of 4 people moved')
  })

  it('reports the repeat-pair delta', () => {
    // Before: Ann-Ben twice and Cara-Dan twice — two repeat pairs.
    // After:  Ann-Cara and Ben-Dan twice each — still two.
    expect(shuffleReceipt(before, after, 2)).toContain('2 repeat pairs across the program (was 2)')
  })

  it('reports the delta when it gets worse', () => {
    const worse: Assignment[] = [before[0], before[0] && { ...before[0], session: 2 }, before[2]]
    expect(shuffleReceipt(after, worse, 2)).toMatch(/repeat pairs across the program \(was \d+\)/)
  })

  it('omits the unchanged clause for a one-session program', () => {
    const solo: Assignment[] = [before[0]]
    expect(shuffleReceipt(solo, solo, 1)).not.toContain('unchanged')
  })

  it('does not pluralise a single mover', () => {
    const oneMoved: Assignment[] = [
      { session: 1, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara')] } },
    ]
    const moved: Assignment[] = [
      { session: 1, tables: { 1: [p('Ann')], 2: [p('Cara'), p('Ben')] } },
    ]
    expect(shuffleReceipt(oneMoved, moved, 1)).toContain('1 of 3 people moved')
  })
})

describe('uniqueTablematesAverage', () => {
  it('averages the distinct tablemates each person meets', () => {
    // Ann meets Ben (s1, s2) and Cara (s3) → 2. Same for everyone here.
    expect(uniqueTablematesAverage(before)).toBe(2)
  })

  it('is zero for an empty program', () => {
    expect(uniqueTablematesAverage([])).toBe(0)
  })
})

describe('linkedPairCount', () => {
  it('counts each partnership once', () => {
    const linked: Assignment[] = [
      { session: 1, tables: { 1: [p('Ann', 'Ben'), p('Ben', 'Ann')], 2: [p('Cara'), p('Dan')] } },
    ]

    expect(linkedPairCount(linked)).toBe(1)
  })

  it('is zero when nobody is linked', () => {
    expect(linkedPairCount(before)).toBe(0)
  })
})

describe('seatedCount', () => {
  it('counts filled seats, not table slots', () => {
    const assignment = {
      session: 1,
      tables: {
        1: [{ name: 'Ann', religion: 'Jewish', gender: 'Female', partner: null }, null],
        2: [{ name: 'Ben', religion: 'Muslim', gender: 'Male', partner: null }],
      },
    } as any

    expect(seatedCount(assignment)).toBe(2)
  })
})

describe('personCount', () => {
  it('says person for one and people for any other count', () => {
    expect(personCount(1)).toBe('1 person')
    expect(personCount(2)).toBe('2 people')
    expect(personCount(0)).toBe('0 people')
  })
})
