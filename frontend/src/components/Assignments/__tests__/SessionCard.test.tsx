import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionCard from '../SessionCard'
import type { Assignment } from '@/types/assignments'

const assignment: Assignment = {
  session: 1,
  tables: {
    1: [
      { name: 'Ann', religion: 'Christian', gender: 'Female', partner: null, is_facilitator: true },
      { name: 'Ben', religion: 'Jewish', gender: 'Male', partner: null },
    ],
    2: [
      { name: 'Cara', religion: 'Muslim', gender: 'Female', partner: null },
      { name: 'Dan', religion: 'Christian', gender: 'Male', partner: null },
    ],
  },
}

describe('SessionCard — a live session', () => {
  it('renders one table block per table', () => {
    render(<SessionCard assignment={assignment} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByText('Table 2')).toBeInTheDocument()
  })

  it('offers Shuffle, Print and Mark complete', () => {
    render(<SessionCard assignment={assignment} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: /shuffle/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeInTheDocument()
  })

  it('lists absent participants beneath the tables', () => {
    render(
      <SessionCard
        assignment={{
          ...assignment,
          absentParticipants: [
            { name: 'Ken Adler', religion: 'Jewish', gender: 'Male', partner: null },
          ],
        }}
        selectedName={null}
        onSelect={jest.fn()}
      />
    )

    expect(screen.getByText('Absent: Ken Adler')).toBeInTheDocument()
  })

  it('disables Shuffle while a shuffle is running', () => {
    render(<SessionCard assignment={assignment} isShuffling selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: /shuffling/i })).toBeDisabled()
  })

  it('hides the mutating actions when read-only', () => {
    render(<SessionCard
        assignment={assignment}
        readOnly
        onReopen={jest.fn()}
        selectedName={null}
        onSelect={jest.fn()}
      />)

    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /shuffle/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark complete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument()
  })
})

describe('SessionCard — a completed session', () => {
  it('renders as one row', () => {
    render(<SessionCard assignment={assignment} completed selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByText(/Session 1/)).toBeInTheDocument()
    expect(screen.getByText(/completed/)).toBeInTheDocument()
    expect(screen.getByText(/4 seated/)).toBeInTheDocument()
    expect(screen.queryByText('Table 1')).not.toBeInTheDocument()
  })

  it('expands to the full session on the chevron', async () => {
    render(<SessionCard assignment={assignment} completed selectedName={null} onSelect={jest.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /expand session 1/i }))

    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /shuffle/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark complete/i })).not.toBeInTheDocument()
  })

  it('offers Reopen on the latest completed session only', () => {
    const { rerender } = render(
      <SessionCard
        assignment={assignment}
        completed
        onReopen={jest.fn()}
        selectedName={null}
        onSelect={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /reopen/i })).toBeInTheDocument()

    rerender(<SessionCard assignment={assignment} completed selectedName={null} onSelect={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument()
  })
})
