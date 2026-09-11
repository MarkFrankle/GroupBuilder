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
    maxFacilitatorRepeat: 2,
    facilitatorRepeatWorst: [],
  },
}

const withResult = (overrides: Partial<PlanCheckResult>) =>
  render(<PlanCheckBand result={{ ...base, ...overrides }} />)

describe('PlanCheckBand — green state', () => {
  it('shows the ready-to-print headline', () => {
    withResult({})
    expect(screen.getByText('Looks good — ready to print and hand out')).toBeInTheDocument()
  })

  it('shows a line only for features the roster uses', () => {
    withResult({})
    expect(screen.getByText('All couples are seated apart')).toBeInTheDocument()
    expect(screen.getByText('Every table has a facilitator, every session')).toBeInTheDocument()
    expect(
      screen.queryByText('Everyone you asked to keep apart is kept apart')
    ).not.toBeInTheDocument()
  })

  it('shows the reassuring repeat lines when at or below the floor', () => {
    withResult({})
    expect(screen.getByText('No one sits with the same person more than twice')).toBeInTheDocument()
    expect(screen.getByText('Everyone sees a variety of facilitators')).toBeInTheDocument()
  })

  it('hides the balance line when the solver did worse than the roster allows', () => {
    withResult({ reassurances: { ...base.reassurances, balanceEven: false } })
    expect(
      screen.queryByText('Faiths and genders are mixed as evenly as this roster allows')
    ).not.toBeInTheDocument()
  })

  it('hides the repeat lines entirely for a single-session program', () => {
    withResult({ incompleteSessionCount: 1 })
    expect(
      screen.queryByText('No one sits with the same person more than twice')
    ).not.toBeInTheDocument()
  })
})

describe('PlanCheckBand — worst-case notes', () => {
  it('replaces the pair reassurance with a factual note above the floor', () => {
    withResult({ reassurances: { ...base.reassurances, maxPairRepeat: 3 } })
    expect(
      screen.queryByText('No one sits with the same person more than twice')
    ).not.toBeInTheDocument()
    expect(screen.getByText('One pair sits together three times')).toBeInTheDocument()
  })

  it('replaces the facilitator reassurance with a factual note above the floor', () => {
    withResult({
      incompleteSessionCount: 5,
      reassurances: {
        ...base.reassurances,
        maxFacilitatorRepeat: 4,
        facilitatorRepeatWorst: [{ participant: 'Priya', facilitator: 'Sam', count: 4 }],
      },
    })
    expect(
      screen.getByText('One person has the same facilitator 4 of 5 sessions')
    ).toBeInTheDocument()
  })

  it('names the tied worst cases in the hoverable detail', async () => {
    withResult({
      incompleteSessionCount: 5,
      reassurances: {
        ...base.reassurances,
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
      (await screen.findAllByText('Priya — same facilitator as Sam, 4 sessions')).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Dara — same facilitator as Erin, 4 sessions').length).toBeGreaterThan(
      0
    )
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
})
