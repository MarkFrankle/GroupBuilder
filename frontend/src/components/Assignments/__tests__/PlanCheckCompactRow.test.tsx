import React from 'react'
import { render, screen } from '@testing-library/react'
import PlanCheckCompactRow from '../PlanCheckCompactRow'
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
    <PlanCheckCompactRow
      result={{
        ...base,
        ...overrides,
        reassurances: { ...base.reassurances, ...overrides.reassurances },
      }}
    />
  )

describe('PlanCheckCompactRow — green state', () => {
  it('shows facilitator coverage and balance chips', () => {
    withResult()
    expect(screen.getByText('Facilitator coverage')).toBeInTheDocument()
    expect(screen.getByText('Balance')).toBeInTheDocument()
  })

  it('shows the reassuring repeat/overlap/variety chips at or below the floor', () => {
    withResult({ reassurances: { tableOverlapCap: 1, maxTableOverlap: 1 } })
    expect(screen.getByText('Repeats')).toBeInTheDocument()
    expect(screen.getByText('Overlap')).toBeInTheDocument()
    expect(screen.getByText('Facilitator variety')).toBeInTheDocument()
  })

  it('never shows an issues chip when there are no violations', () => {
    withResult()
    expect(screen.queryByText(/issue/)).not.toBeInTheDocument()
  })

  it('hides the overlap chip entirely when no cap is known', () => {
    withResult()
    expect(screen.queryByText('Overlap')).not.toBeInTheDocument()
    expect(screen.queryByText(/Overlap:/)).not.toBeInTheDocument()
  })

  it('hides the repeat/overlap/variety chips for a single-session program', () => {
    withResult({ incompleteSessionCount: 1, reassurances: { tableOverlapCap: 1 } })
    expect(screen.queryByText('Repeats')).not.toBeInTheDocument()
    expect(screen.queryByText('Overlap')).not.toBeInTheDocument()
    expect(screen.queryByText('Facilitator variety')).not.toBeInTheDocument()
    expect(screen.getByText('Facilitator coverage')).toBeInTheDocument()
  })
})

describe('PlanCheckCompactRow — less-than-ideal state', () => {
  it('shows a warning chip for repeats above the floor, with detail', async () => {
    withResult({
      verdict: 'lessThanIdeal',
      reassurances: {
        maxPairRepeat: 3,
        pairRepeatWorst: [{ names: ['Ann', 'Bea'], count: 3 }],
      },
    })
    expect(screen.getByText('Repeats three times')).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /who sits together repeatedly/i })
    trigger.focus()
    expect(
      (await screen.findAllByText('Ann & Bea — 3 sessions together')).length
    ).toBeGreaterThan(0)
  })

  it('shows a warning chip for overlap above the cap, with detail', async () => {
    withResult({
      verdict: 'lessThanIdeal',
      reassurances: {
        maxTableOverlap: 2,
        tableOverlapCap: 1,
        tableOverlapWorst: [{ sessions: [1, 3], tables: [1, 2], names: ['Ann', 'Bea'] }],
      },
    })
    expect(screen.getByText('Overlap: 2 people')).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /which tables overlap/i })
    trigger.focus()
    expect(
      (await screen.findAllByText('Session 1 Table 1 & Session 3 Table 2')).length
    ).toBeGreaterThan(0)
  })

  it('shows a warning chip for facilitator repeats above the floor, with detail', async () => {
    withResult({
      verdict: 'lessThanIdeal',
      reassurances: {
        maxFacilitatorRepeat: 3,
        facilitatorRepeatWorst: [{ participant: 'Ann', facilitator: 'Kai', count: 3 }],
      },
    })
    expect(screen.getByText('Same facilitator three times')).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /who has the repeat facilitator/i })
    trigger.focus()
    expect(
      (await screen.findAllByText('Facilitator Kai sits with Ann 3 times')).length
    ).toBeGreaterThan(0)
  })
})

describe('PlanCheckCompactRow — attention state', () => {
  it('shows a single-issue chip with the violation message in its detail', async () => {
    withResult({
      verdict: 'attention',
      violations: [
        {
          kind: 'facilitatorCoverage',
          session: 2,
          table: 3,
          message: 'Session 2, Table 3 has no facilitator',
        },
      ],
    })
    expect(screen.getByText('1 issue')).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /what needs attention/i })
    trigger.focus()
    expect(
      (await screen.findAllByText('Session 2, Table 3 has no facilitator')).length
    ).toBeGreaterThan(0)
  })

  it('pluralises the issues chip for more than one violation', () => {
    withResult({
      verdict: 'attention',
      violations: [
        { kind: 'couple', session: 1, message: 'Session 1 seats a couple together' },
        { kind: 'balance', session: 2, message: "Session 2 isn't mixed evenly" },
      ],
    })
    expect(screen.getByText('2 issues')).toBeInTheDocument()
  })
})
