import { checkPlan, keepApartPairs } from '../planCheck'
import type { Assignment } from '@/types/assignments'

const p = (
  name: string,
  opts: Partial<{
    religion: string
    gender: string
    partner: string | null
    is_facilitator: boolean
    keep_together: boolean
  }> = {}
) => ({
  name,
  religion: opts.religion ?? 'Christian',
  gender: opts.gender ?? 'Female',
  partner: opts.partner ?? null,
  is_facilitator: opts.is_facilitator ?? false,
  keep_together: opts.keep_together ?? false,
})

/**
 * Nine identical people, three tables, four sessions — the affine plane AG(2,3),
 * where every pair shares a table exactly once. A clean plan with no repeats.
 *
 * One object per person is shared across every session on purpose: the
 * couple/facilitator mutation loops in the tests below rely on that aliasing so
 * a single write lands in every session.
 */
function cleanPlan(): Assignment[] {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  const people = Object.fromEntries(names.map(n => [n, p(n)]))
  const sessions: number[][][] = [
    [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
    [[0, 3, 6], [1, 4, 7], [2, 5, 8]],
    [[0, 4, 8], [1, 5, 6], [2, 3, 7]],
    [[0, 5, 7], [1, 3, 8], [2, 4, 6]],
  ]
  return sessions.map((tables, i) => ({
    session: i + 1,
    tables: Object.fromEntries(tables.map((idxs, t) => [t + 1, idxs.map(ix => people[names[ix]])])),
  }))
}

describe('keepApartPairs', () => {
  it('turns canonical keep_apart name arrays into distinct sorted pairs', () => {
    const pairs = keepApartPairs([
      { name: 'Ann', keep_apart: ['Bob'] },
      { name: 'Bob', keep_apart: ['Ann'] },
      { name: 'Cara', keep_apart: [] },
    ])
    expect(pairs).toEqual([['Ann', 'Bob']])
  })

  it('drops self-pairs and participants with no keep_apart field', () => {
    const pairs = keepApartPairs([{ name: 'Ann', keep_apart: ['Ann'] }, { name: 'Bob' }])
    expect(pairs).toEqual([])
  })
})

describe('checkPlan — verdict', () => {
  it('returns ok for a clean plan', () => {
    const result = checkPlan(cleanPlan(), [])
    expect(result.verdict).toBe('ok')
    expect(result.violations).toEqual([])
  })

  it('flags a couple seated together, naming the session', () => {
    const plan = cleanPlan()
    // Force A and B to be partners — session 1 table 1 seats them together.
    plan.forEach(a =>
      Object.values(a.tables).forEach(seats =>
        seats.forEach(seat => {
          if (!seat) return
          if (seat.name === 'A') seat.partner = 'B'
          if (seat.name === 'B') seat.partner = 'A'
        })
      )
    )
    const result = checkPlan(plan, [])
    expect(result.verdict).toBe('attention')
    expect(result.violations.some(v => v.kind === 'couple' && v.session === 1)).toBe(true)
    expect(result.violations[0].message).toMatch(/A & B together/)
  })

  it('does not flag linked partners seated together — they are supposed to sit together', () => {
    const plan = cleanPlan()
    // Force A and B to be linked partners (keep_together), not a couple kept apart.
    plan.forEach(a =>
      Object.values(a.tables).forEach(seats =>
        seats.forEach(seat => {
          if (!seat) return
          if (seat.name === 'A') {
            seat.partner = 'B'
            seat.keep_together = true
          }
          if (seat.name === 'B') {
            seat.partner = 'A'
            seat.keep_together = true
          }
        })
      )
    )
    const result = checkPlan(plan, [])
    expect(result.violations.some(v => v.kind === 'couple')).toBe(false)
    expect(result.verdict).toBe('ok')
  })

  it('flags a keep-apart pair seated together', () => {
    const plan = cleanPlan()
    const result = checkPlan(plan, [['A', 'B']]) // AG(2,3) seats A+B together in session 1
    expect(result.verdict).toBe('attention')
    expect(result.violations.some(v => v.kind === 'keepApart')).toBe(true)
  })

  it('flags a table with no facilitator when the roster has facilitators', () => {
    const plan = cleanPlan()
    // Make A a facilitator; every table without A now has none.
    plan.forEach(a =>
      Object.values(a.tables).forEach(seats =>
        seats.forEach(seat => {
          if (!seat) return
          if (seat.name === 'A') seat.is_facilitator = true
        })
      )
    )
    const result = checkPlan(plan, [])
    expect(result.verdict).toBe('attention')
    expect(result.violations.some(v => v.kind === 'facilitatorCoverage')).toBe(true)
    expect(result.violations.find(v => v.kind === 'facilitatorCoverage')!.message).toMatch(
      /Table \d has no facilitator/
    )
  })

  it('flags a session where balance is worse than the roster floor', () => {
    // 2 tables, roster 2 Jewish / 2 Christian → floor 0, but both Jewish at table 1.
    const plan: Assignment[] = [
      {
        session: 1,
        tables: {
          1: [p('A', { religion: 'Jewish' }), p('B', { religion: 'Jewish' })],
          2: [p('C', { religion: 'Christian' }), p('D', { religion: 'Christian' })],
        },
      },
    ]
    const result = checkPlan(plan, [])
    expect(result.verdict).toBe('attention')
    expect(
      result.violations.some(v => v.kind === 'balance' && v.session === 1)
    ).toBe(true)
    expect(result.violations.find(v => v.kind === 'balance')!.message).toMatch(
      /Session 1 isn.t mixed as evenly by religion/
    )
  })

  it('a hard violation wins over a simultaneous soft overage', () => {
    // Heavy pair-repeat (3 sessions, same trio) AND a couple seated together.
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: { 1: [p('A', { partner: 'B' }), p('B', { partner: 'A' }), p('C')] },
    }))
    const result = checkPlan(plan, [])
    expect(result.verdict).toBe('attention')
  })
})

describe('checkPlan — reassurances', () => {
  it('marks each feature undefined when the roster does not use it', () => {
    const { reassurances } = checkPlan(cleanPlan(), [])
    expect(reassurances.couplesSeparated).toBeUndefined()
    expect(reassurances.keepApartHonored).toBeUndefined()
    expect(reassurances.facilitatorCoverage).toBeUndefined()
  })

  it('reports maxPairRepeat, excluding partner pairs', () => {
    const twoSessionsSamePeople: Assignment[] = [1, 2].map(session => ({
      session,
      tables: { 1: [p('A', { partner: 'B' }), p('B', { partner: 'A' }), p('C')] },
    }))
    // A+B share a table twice but are partners → not counted.
    // A+C and B+C also share twice → counted.
    expect(checkPlan(twoSessionsSamePeople, []).reassurances.maxPairRepeat).toBe(2)
  })

  it('reports maxFacilitatorRepeat', () => {
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: { 1: [p('F', { is_facilitator: true }), p('X')] },
    }))
    expect(checkPlan(plan, []).reassurances.maxFacilitatorRepeat).toBe(3)
  })

  it('does not flag a facilitator repeat that is within the solver-provided floor', () => {
    // Same fixture as the "reports maxFacilitatorRepeat" test above, but with
    // an explicit pairwise floor of 3 — the repeat count this fixture
    // produces — proving the facilitator check now honors the real floor
    // instead of a hardcoded 2.
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: { 1: [p('F', { is_facilitator: true }), p('X')] },
    }))
    const result = checkPlan(plan, [], 3)
    expect(result.reassurances.maxFacilitatorRepeat).toBe(3)
    expect(result.reassurances.facilitatorRepeatFloor).toBe(3)
    expect(result.verdict).not.toBe('lessThanIdeal')
  })

  it('names who is tied for the worst facilitator repeat', () => {
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: {
        1: [p('F', { is_facilitator: true }), p('X')],
        2: [p('G', { is_facilitator: true }), p('Y')],
      },
    }))
    const { reassurances } = checkPlan(plan, [])
    expect(reassurances.facilitatorRepeatWorst).toEqual(
      expect.arrayContaining([
        { participant: 'X', facilitator: 'F', count: 3 },
        { participant: 'Y', facilitator: 'G', count: 3 },
      ])
    )
    expect(reassurances.facilitatorRepeatWorst).toHaveLength(2)
  })

  it('reports an empty facilitatorRepeatWorst when there is no repeat', () => {
    expect(checkPlan(cleanPlan(), []).reassurances.facilitatorRepeatWorst).toEqual([])
  })

  it('balanceEven is true when the solver holds every table to the roster floor', () => {
    // cleanPlan is all-Christian all-Female → single-value → trivially even.
    expect(checkPlan(cleanPlan(), []).reassurances.balanceEven).toBe(true)
  })

  it('balanceEven is false when a table does worse than the roster allows', () => {
    // 2 tables, roster 2 Jewish / 2 Christian → floor 0, but both Jewish at table 1.
    const plan: Assignment[] = [
      {
        session: 1,
        tables: {
          1: [p('A', { religion: 'Jewish' }), p('B', { religion: 'Jewish' })],
          2: [p('C', { religion: 'Christian' }), p('D', { religion: 'Christian' })],
        },
      },
    ]
    expect(checkPlan(plan, []).reassurances.balanceEven).toBe(false)
  })

  it('reports incompleteSessionCount', () => {
    expect(checkPlan(cleanPlan(), []).incompleteSessionCount).toBe(4)
  })
})

describe('checkPlan — soft signals move the verdict to lessThanIdeal', () => {
  it('flips to lessThanIdeal on a heavy pair repeat past the default floor, with no hard violations', () => {
    // Same three non-partnered people together three sessions running (default floor 2).
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: { 1: [p('A'), p('B'), p('C')] },
    }))
    const result = checkPlan(plan, [])
    expect(result.verdict).toBe('lessThanIdeal')
    expect(result.violations).toEqual([])
    expect(result.reassurances.maxPairRepeat).toBe(3)
  })

  it('stays ok when a pairwiseCap raises the floor to cover the repeat', () => {
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: { 1: [p('A'), p('B'), p('C')] },
    }))
    const result = checkPlan(plan, [], 3)
    expect(result.verdict).toBe('ok')
  })

  it('flips to lessThanIdeal when table overlap exceeds a given overlapCap', () => {
    const plan: Assignment[] = [1, 2].map(session => ({
      session,
      tables: { 1: [p('A'), p('B'), p('C')] },
    }))
    const result = checkPlan(plan, [], null, 1)
    expect(result.verdict).toBe('lessThanIdeal')
  })

  it('stays ok when overlapCap is not provided, even though the tables overlap heavily', () => {
    const plan: Assignment[] = [1, 2].map(session => ({
      session,
      tables: { 1: [p('A'), p('B'), p('C')] },
    }))
    const result = checkPlan(plan, [])
    expect(result.verdict).toBe('ok')
  })
})

describe('checkPlan — pair-repeat worst-case names', () => {
  it('names the pair(s) tied for the worst repeat', () => {
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: { 1: [p('A'), p('B'), p('C')] },
    }))
    const { reassurances } = checkPlan(plan, [])
    // A+B, A+C, B+C all repeat 3 times.
    expect(reassurances.pairRepeatWorst).toEqual(
      expect.arrayContaining([
        { names: ['A', 'B'], count: 3 },
        { names: ['A', 'C'], count: 3 },
        { names: ['B', 'C'], count: 3 },
      ])
    )
    expect(reassurances.pairRepeatWorst).toHaveLength(3)
  })

  it('excludes partner pairs from the named worst case', () => {
    const twoSessionsSamePeople: Assignment[] = [1, 2].map(session => ({
      session,
      tables: { 1: [p('A', { partner: 'B' }), p('B', { partner: 'A' }), p('C')] },
    }))
    // A+B share twice but are partners; A+C and B+C also share twice and should be named.
    const { reassurances } = checkPlan(twoSessionsSamePeople, [])
    expect(reassurances.pairRepeatWorst).toEqual(
      expect.arrayContaining([
        { names: ['A', 'C'], count: 2 },
        { names: ['B', 'C'], count: 2 },
      ])
    )
    expect(reassurances.pairRepeatWorst).toHaveLength(2)
  })

  it('reports an empty pairRepeatWorst when nobody ever shares a table', () => {
    expect(checkPlan([], []).reassurances.pairRepeatWorst).toEqual([])
  })
})

describe('checkPlan — pair-repeat excludes facilitators', () => {
  it('does not count a participant sitting with the same facilitator every session', () => {
    const plan: Assignment[] = [1, 2, 3].map(session => ({
      session,
      tables: { 1: [p('F', { is_facilitator: true }), p('X')] },
    }))
    expect(checkPlan(plan, []).reassurances.maxPairRepeat).toBe(0)
  })
})

describe('checkPlan — table-overlap floor has one unit of alert slack', () => {
  // Six identical people, one table per session, so the only cross-session
  // table pair that can overlap is Session 1's table against Session 2's -
  // whoever the two sessions share in common is the entire overlap.
  const people = Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E', 'F'].map(n => [n, p(n)])
  )

  it('stays ok exactly one person over the floor - the gap a single-session shuffle cannot always close', () => {
    // Floor 1, actual 2 (share A & B): floor + TABLE_OVERLAP_ALERT_SLACK (1).
    const plan: Assignment[] = [
      { session: 1, tables: { 1: [people.A, people.B, people.C, people.D] } },
      { session: 2, tables: { 1: [people.A, people.B, people.E, people.F] } },
    ]
    const result = checkPlan(plan, [], undefined, 1)
    expect(result.verdict).toBe('ok')
    expect(result.reassurances.maxTableOverlap).toBe(2)
  })

  it('flips to lessThanIdeal more than one person over the floor', () => {
    // Floor 1, actual 3 (share A, B & C): floor + TABLE_OVERLAP_ALERT_SLACK + 1.
    const plan: Assignment[] = [
      { session: 1, tables: { 1: [people.A, people.B, people.C, people.D] } },
      { session: 2, tables: { 1: [people.A, people.B, people.C, people.F] } },
    ]
    const result = checkPlan(plan, [], undefined, 1)
    expect(result.verdict).toBe('lessThanIdeal')
    expect(result.reassurances.maxTableOverlap).toBe(3)
  })
})
