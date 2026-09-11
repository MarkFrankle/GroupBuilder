import React from 'react'
import { render, screen } from '@testing-library/react'
import PlanCheckBand from '../PlanCheckBand'
import type { PlanCheckResult } from '@/utils/planCheck'

const base: PlanCheckResult = {
  verdict: 'ok',
  violations: [],
  incompleteSessionCount: 4,
  reassurances: {
    couplesSeparated: true,
    keepApartHonored: undefined,
    facilitatorCoverage: true,
    balanceEven: true,
    maxPairRepeat: 2,
    pairRepeatFloor: 2,
    pairRepeatWorst: [],
    maxFacilitatorRepeat: 2,
    facilitatorRepeatFloor: 2,
    facilitatorRepeatWorst: [],
    maxTableOverlap: 1,
    tableOverlapCap: null,
    tableOverlapWorst: [],
  },
}

const withResult = (
  overrides: Partial<Omit<PlanCheckResult, 'reassurances'>> & {
    reassurances?: Partial<PlanCheckResult['reassurances']>
  } = {}
) =>
  render(
    <PlanCheckBand
      result={{
        ...base,
        ...overrides,
        reassurances: { ...base.reassurances, ...overrides.reassurances },
      }}
    />
  )

describe('PlanCheckBand — green state', () => {
  it('shows the ready-to-print headline', () => {
    withResult()
    expect(screen.getByText('Looks good — ready to print and hand out')).toBeInTheDocument()
  })

  it('shows a line only for features the roster uses', () => {
    withResult()
    expect(screen.getByText('All couples are seated apart')).toBeInTheDocument()
    expect(screen.getByText('Every table has a facilitator, every session')).toBeInTheDocument()
    expect(
      screen.queryByText('Everyone you asked to keep apart is kept apart')
    ).not.toBeInTheDocument()
  })

  it('shows the reassuring repeat lines when at or below the floor', () => {
    withResult()
    expect(screen.getByText('No one sits with the same person more than twice')).toBeInTheDocument()
    expect(screen.getByText('Everyone sees a variety of facilitators')).toBeInTheDocument()
  })

  it('shows the balance reassurance when the solver held the roster floor', () => {
    withResult()
    expect(
      screen.getByText('Faiths and genders are mixed as evenly as this roster allows')
    ).toBeInTheDocument()
  })

  it('hides the repeat lines entirely for a single-session program', () => {
    withResult({ incompleteSessionCount: 1 })
    expect(
      screen.queryByText('No one sits with the same person more than twice')
    ).not.toBeInTheDocument()
  })

  it("uses the solver's real pairwise cap instead of the hardcoded floor", () => {
    withResult({ reassurances: { maxPairRepeat: 3, pairRepeatFloor: 3 } })
    expect(
      screen.getByText('No one sits with the same person more than three times')
    ).toBeInTheDocument()
  })

  it('shows the table-overlap line only once a cap is known', () => {
    withResult()
    expect(screen.queryByText(/No two tables share/)).not.toBeInTheDocument()

    withResult({ reassurances: { tableOverlapCap: 1 } })
    expect(screen.getByText('No two tables share more than 1 person')).toBeInTheDocument()
  })
})

describe('PlanCheckBand — less-than-ideal state', () => {
  it('shows the not-ideal headline when a soft signal runs past its floor', () => {
    withResult({
      verdict: 'lessThanIdeal',
      reassurances: { maxPairRepeat: 3 },
    })
    expect(screen.getByText('Good enough to print, but not ideal')).toBeInTheDocument()
  })

  it('replaces the pair reassurance with a factual note above the floor', () => {
    withResult({ verdict: 'lessThanIdeal', reassurances: { maxPairRepeat: 3 } })
    expect(
      screen.queryByText('No one sits with the same person more than twice')
    ).not.toBeInTheDocument()
    expect(screen.getByText('At least one pair sits together three times')).toBeInTheDocument()
  })

  it('replaces the overlap reassurance with a factual note above the cap', () => {
    withResult({
      verdict: 'lessThanIdeal',
      reassurances: { maxTableOverlap: 2, tableOverlapCap: 1 },
    })
    expect(
      screen.queryByText('No two tables share more than 1 person')
    ).not.toBeInTheDocument()
    expect(screen.getByText('At least two tables share 2 people')).toBeInTheDocument()
  })

  it('names the worst overlapping tables in the hoverable detail', async () => {
    withResult({
      verdict: 'lessThanIdeal',
      reassurances: {
        maxTableOverlap: 2,
        tableOverlapCap: 1,
        tableOverlapWorst: [{ sessions: [1, 3], tables: [1, 2], names: ['Ann', 'Bea'] }],
      },
    })
    const trigger = screen.getByRole('button', { name: /which tables overlap/i })
    trigger.focus()
    expect(
      (await screen.findAllByText('Session 1 Table 1 & Session 3 Table 2 — Ann, Bea')).length
    ).toBeGreaterThan(0)
  })

  it('names the tied worst pairs in the hoverable detail', async () => {
    withResult({
      verdict: 'lessThanIdeal',
      reassurances: {
        maxPairRepeat: 3,
        pairRepeatWorst: [
          { names: ['Ann', 'Bea'], count: 3 },
          { names: ['Cid', 'Dee'], count: 3 },
        ],
      },
    })
    const trigger = screen.getByRole('button', { name: /who sits together/i })
    trigger.focus()
    expect(
      (await screen.findAllByText('Ann & Bea — 3 sessions together')).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Cid & Dee — 3 sessions together').length).toBeGreaterThan(0)
  })

  it('replaces the facilitator reassurance with a factual note above the floor', () => {
    withResult({
      verdict: 'lessThanIdeal',
      incompleteSessionCount: 5,
      reassurances: {
        maxFacilitatorRepeat: 4,
        facilitatorRepeatWorst: [{ participant: 'Priya', facilitator: 'Sam', count: 4 }],
      },
    })
    expect(
      screen.getByText('At least one person has the same facilitator 4 of 5 sessions')
    ).toBeInTheDocument()
  })

  it('names the tied worst cases in the hoverable detail', async () => {
    withResult({
      verdict: 'lessThanIdeal',
      incompleteSessionCount: 5,
      reassurances: {
        maxFacilitatorRepeat: 4,
        facilitatorRepeatWorst: [
          { participant: 'Priya', facilitator: 'Sam', count: 4 },
          { participant: 'Dara', facilitator: 'Erin', count: 4 },
        ],
      },
    })
    const trigger = screen.getByRole('button', { name: /who/i })
    trigger.focus()
    expect(
      (await screen.findAllByText('Facilitator Sam sits with Priya 4 times')).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Facilitator Erin sits with Dara 4 times').length
    ).toBeGreaterThan(0)
  })
})

describe('PlanCheckBand — attention state', () => {
  const attention: PlanCheckResult = {
    ...base,
    verdict: 'attention',
    violations: [
      {
        kind: 'couple',
        session: 3,
        table: 1,
        names: ['Dara', 'Erin'],
        message: 'Session 3 seats Dara & Erin together',
      },
    ],
  }

  it('shows the check-before-printing headline and the problem, with no action button', () => {
    render(<PlanCheckBand result={attention} />)
    expect(screen.getByText('One thing to check before you print')).toBeInTheDocument()
    expect(screen.getByText('Session 3 seats Dara & Erin together')).toBeInTheDocument()
    expect(screen.getByText('Needs attention:')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pluralises the headline for more than one problem', () => {
    render(
      <PlanCheckBand
        result={{
          ...attention,
          violations: [
            ...attention.violations,
            {
              kind: 'facilitatorCoverage',
              session: 4,
              table: 2,
              message: 'Session 4, Table 2 has no facilitator',
            },
          ],
        }}
      />
    )
    expect(screen.getByText('A few things to check before you print')).toBeInTheDocument()
  })

  it('flags a balance violation with the same treatment as other hard violations', () => {
    render(
      <PlanCheckBand
        result={{
          ...base,
          verdict: 'attention',
          violations: [
            {
              kind: 'balance',
              session: 2,
              message: "Session 2 isn't mixed as evenly by religion as this roster allows",
            },
          ],
        }}
      />
    )
    expect(
      screen.getByText("Session 2 isn't mixed as evenly by religion as this roster allows")
    ).toBeInTheDocument()
  })
})
