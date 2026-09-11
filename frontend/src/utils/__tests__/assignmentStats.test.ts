import {
  personCount,
  shuffleReceipt,
  rebuildReceipt,
  uniqueTablematesAverage,
  linkedPairCount,
  seatedCount,
  personTrackingSummary,
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

  it('reports the session-scoped repeat-pair delta', () => {
    // Session 2 before: Ann-Ben, Cara-Dan — both already met in session 1, so both repeats.
    // Session 2 after: Ann-Cara, Ben-Dan — both also meet again in session 3, so still repeats.
    expect(shuffleReceipt(before, after, 2)).toContain(
      "2 pairs at session 2's tables have already met elsewhere (was 2)"
    )
  })

  it('reports the delta when it gets worse', () => {
    const worse: Assignment[] = [before[0], before[0] && { ...before[0], session: 2 }, before[2]]
    expect(shuffleReceipt(after, worse, 2)).toMatch(
      /pairs at session 2's tables have already met elsewhere \(was \d+\)/
    )
  })

  it('shows session-scoped improvement even when the program-wide count stays flat', () => {
    // Session 3 before repeats session 1's exact pairs (Ann-Ben, Cara-Dan) — both already
    // met in session 2 as well, so both are repeats going into the shuffle.
    const flatBefore: Assignment[] = [
      { session: 1, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara'), p('Dan')] } },
      { session: 2, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara'), p('Dan')] } },
      { session: 3, tables: { 1: [p('Ann'), p('Ben')], 2: [p('Cara'), p('Dan')] } },
    ]
    // Session 3 after swaps to brand-new pairs (Ann-Cara, Ben-Dan) — neither has met before,
    // so the session-scoped count drops to zero. The program-wide count (Ann-Ben and
    // Cara-Dan still repeat from sessions 1-2) stays at 2 either way.
    const flatAfter: Assignment[] = [
      flatBefore[0],
      flatBefore[1],
      { session: 3, tables: { 1: [p('Ann'), p('Cara')], 2: [p('Ben'), p('Dan')] } },
    ]
    expect(shuffleReceipt(flatBefore, flatAfter, 3)).toContain(
      "0 pairs at session 3's tables have already met elsewhere (was 2)"
    )
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

describe('personTrackingSummary', () => {
  const plane: Assignment[] = [
    { session: 1, tables: { 1: [p('A'), p('B'), p('C')], 2: [p('D'), p('E'), p('F')], 3: [p('G'), p('H'), p('I')] } },
    { session: 2, tables: { 1: [p('A'), p('D'), p('G')], 2: [p('B'), p('E'), p('H')], 3: [p('C'), p('F'), p('I')] } },
    { session: 3, tables: { 1: [p('A'), p('E'), p('I')], 2: [p('B'), p('F'), p('G')], 3: [p('C'), p('D'), p('H')] } },
    { session: 4, tables: { 1: [p('A'), p('F'), p('H')], 2: [p('B'), p('D'), p('I')], 3: [p('C'), p('E'), p('G')] } },
  ]

  it('reports no repeats when every pair meets once', () => {
    expect(personTrackingSummary('A', plane)).toContain('A · never sits with the same person twice')
  })

  it('reports full coverage', () => {
    expect(personTrackingSummary('A', plane)).toContain('sits with 8 of the other 8 participants')
  })

  it('counts repeat partners when a pair meets more than once', () => {
    const withRepeat: Assignment[] = [
      plane[0],
      { session: 2, tables: { 1: [p('A'), p('D'), p('E')], 2: [p('B'), p('H'), p('G')], 3: [p('C'), p('F'), p('I')] } },
      plane[2],
      plane[3],
    ]
    expect(personTrackingSummary('A', withRepeat)).toContain('meets 1 person more than once')
  })

  it('names the worst pair only when someone is met 3+ times', () => {
    const thrice: Assignment[] = [
      { session: 1, tables: { 1: [p('A'), p('B'), p('C')], 2: [p('D'), p('E'), p('F')] } },
      { session: 2, tables: { 1: [p('A'), p('B'), p('C')], 2: [p('D'), p('E'), p('F')] } },
      { session: 3, tables: { 1: [p('A'), p('B'), p('C')], 2: [p('D'), p('E'), p('F')] } },
    ]
    expect(personTrackingSummary('A', thrice)).toContain('meets 2 people more than once, two of them 3 times')
  })

  it('handles participants whose names contain spaces', () => {
    const spaced: Assignment[] = [
      { session: 1, tables: { 1: [p('Kathy Veit'), p('Bob Smith')], 2: [p('Al Green'), p('Di Ross')] } },
      { session: 2, tables: { 1: [p('Kathy Veit'), p('Bob Smith')], 2: [p('Al Green'), p('Di Ross')] } },
    ]
    expect(personTrackingSummary('Kathy Veit', spaced)).toBe('Kathy Veit · meets 1 person more than once · sits with 1 of the other 3 participants')
  })

  it('does not add the worst-pair clause when the max is only 2', () => {
    const twice: Assignment[] = [
      { session: 1, tables: { 1: [p('A'), p('B')], 2: [p('C'), p('D')] } },
      { session: 2, tables: { 1: [p('A'), p('B')], 2: [p('C'), p('D')] } },
    ]
    expect(personTrackingSummary('A', twice)).toBe('A · meets 1 person more than once · sits with 1 of the other 3 participants')
  })
})

describe('rebuildReceipt', () => {
  it('names what did not move', () => {
    expect(rebuildReceipt(2, 4)).toBe('Sessions rebuilt. Sessions 1\u20132 unchanged; sessions 3\u20134 have new seating.')
    expect(rebuildReceipt(1, 3)).toBe('Sessions rebuilt. Session 1 unchanged; sessions 2\u20133 have new seating.')
  })
  it('handles a single remaining session', () => {
    expect(rebuildReceipt(3, 4)).toBe('Sessions rebuilt. Sessions 1\u20133 unchanged; session 4 has new seating.')
  })
  it('degrades when nothing is frozen', () => {
    expect(rebuildReceipt(0, 4)).toBe('Sessions rebuilt.')
  })
})
