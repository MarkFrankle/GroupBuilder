import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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

    expect(screen.getByText('Absent:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ken Adler' })).toBeInTheDocument()
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

describe('SessionCard — the absent row', () => {
  // Radix scrolls the focused menu item into view on open, and jsdom has no
  // implementation of it.
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn()
  })

  const withAbsence: Assignment = {
    session: 3,
    tables: {
      1: [
        {
          name: 'Ann',
          religion: 'Christian',
          gender: 'Female',
          partner: null,
          is_facilitator: true,
        },
        { name: 'Ben', religion: 'Jewish', gender: 'Male', partner: null },
      ],
      2: [null, { name: 'Dan', religion: 'Christian', gender: 'Male', partner: null }],
    },
    absentParticipants: [
      { name: 'Cara', religion: 'Muslim', gender: 'Female', partner: null },
    ],
  }

  /**
   * Radix menus do not open on a synthesized click — keyboard activation is
   * what works, as in KeepApartSection.test.tsx.
   */
  const openPicker = () => {
    fireEvent.keyDown(screen.getByRole('button', { name: 'Mark present' }), { key: 'Enter' })
  }

  it('renders absent names as selectable chips', () => {
    const onSelect = jest.fn()
    render(
      <SessionCard assignment={withAbsence} selectedName={null} onSelect={onSelect} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cara' }))

    expect(onSelect).toHaveBeenCalledWith('Cara')
  })

  it('offers Mark present only when the selected person is absent here', () => {
    const { rerender } = render(
      <SessionCard
        assignment={withAbsence}
        selectedName="Ann"
        onSelect={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: 'Mark present' })).not.toBeInTheDocument()

    rerender(
      <SessionCard
        assignment={withAbsence}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Mark present' })).toBeInTheDocument()
  })

  it('names every table, marking the one with an open seat', () => {
    render(
      <SessionCard
        assignment={withAbsence}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )

    openPicker()

    expect(screen.getByText('Seat Cara at…')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Table 1 · 2 people/ })).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /Table 2 · 1 person · open seat/ })
    ).toBeInTheDocument()
  })

  it('reports the table the user chose', () => {
    const onMarkPresent = jest.fn()
    render(
      <SessionCard
        assignment={withAbsence}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkPresent={onMarkPresent}
      />
    )

    openPicker()
    fireEvent.click(screen.getByRole('menuitem', { name: /Table 1/ }))

    expect(onMarkPresent).toHaveBeenCalledWith('Cara', 1)
  })

  it('drops the open-seat annotation when no gap survives', () => {
    render(
      <SessionCard
        assignment={{
          ...withAbsence,
          tables: {
            ...withAbsence.tables,
            2: [
              { name: 'Eve', religion: 'Other', gender: 'Female', partner: null },
              { name: 'Dan', religion: 'Christian', gender: 'Male', partner: null },
            ],
          },
        }}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )

    openPicker()

    expect(screen.getByRole('menuitem', { name: /Table 2 · 2 people/ })).toBeInTheDocument()
    expect(screen.queryByText(/open seat/)).not.toBeInTheDocument()
  })

  it('suppresses Mark present on a completed session', () => {
    render(
      <SessionCard
        assignment={withAbsence}
        completed
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /expand session 3/i }))

    expect(screen.getByRole('button', { name: 'Cara' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark present' })).not.toBeInTheDocument()
  })
})
