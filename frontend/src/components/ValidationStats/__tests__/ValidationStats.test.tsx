import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ValidationStats from '../ValidationStats'

// Balanced roster: 4F/4M across 2 tables of 4 — no imbalance expected
const balancedAssignments = [
  {
    session: 1,
    tables: {
      1: [
        { name: 'Alice', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'Bob',   religion: 'Jewish',    gender: 'Male',   partner: null },
        { name: 'Carol', religion: 'Muslim',    gender: 'Female', partner: null },
        { name: 'Dave',  religion: 'Christian', gender: 'Male',   partner: null },
      ],
      2: [
        { name: 'Eve',   religion: 'Jewish',    gender: 'Female', partner: null },
        { name: 'Frank', religion: 'Muslim',    gender: 'Male',   partner: null },
        { name: 'Grace', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'Hal',   religion: 'Jewish',    gender: 'Male',   partner: null },
      ],
    },
  },
]

// Imbalanced roster: 6F/2M across 2 tables — expected = ceil(6/2)-floor(2/2) = 3-1 = 2
// Solver gives 3F/1M and 3F/1M → actual = 2 = expected → still "Good"
const rosterImbalancedButSolverOptimal = [
  {
    session: 1,
    tables: {
      1: [
        { name: 'A', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'B', religion: 'Jewish',    gender: 'Female', partner: null },
        { name: 'C', religion: 'Muslim',    gender: 'Female', partner: null },
        { name: 'D', religion: 'Christian', gender: 'Male',   partner: null },
      ],
      2: [
        { name: 'E', religion: 'Jewish',    gender: 'Female', partner: null },
        { name: 'F', religion: 'Muslim',    gender: 'Female', partner: null },
        { name: 'G', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'H', religion: 'Jewish',    gender: 'Male',   partner: null },
      ],
    },
  },
]

// Solver did a bad job: 4F/0M on one table when 2F/2M was achievable
const solverSuboptimal = [
  {
    session: 1,
    tables: {
      1: [
        { name: 'A', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'B', religion: 'Jewish',    gender: 'Female', partner: null },
        { name: 'C', religion: 'Muslim',    gender: 'Female', partner: null },
        { name: 'D', religion: 'Christian', gender: 'Female', partner: null },
      ],
      2: [
        { name: 'E', religion: 'Jewish',    gender: 'Male',   partner: null },
        { name: 'F', religion: 'Muslim',    gender: 'Male',   partner: null },
        { name: 'G', religion: 'Christian', gender: 'Male',   partner: null },
        { name: 'H', religion: 'Jewish',    gender: 'Male',   partner: null },
      ],
    },
  },
]

describe('ValidationStats gender display', () => {
  it('shows "Good" for a balanced roster with balanced tables', () => {
    render(<ValidationStats assignments={balancedAssignments} />)
    expect(screen.getByText(/Gender:.*Good/)).toBeInTheDocument()
  })

  it('shows "Good" when roster imbalance makes some table skew unavoidable', () => {
    render(<ValidationStats assignments={rosterImbalancedButSolverOptimal} />)
    expect(screen.getByText(/Gender:.*Good/)).toBeInTheDocument()
  })

  it('shows "Suboptimal" when the solver distributed genders worse than the roster requires', () => {
    render(<ValidationStats assignments={solverSuboptimal} />)
    expect(screen.getByText(/Gender:.*Suboptimal/)).toBeInTheDocument()
  })
})
