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
    render(<SessionCard assignment={assignment} selectedName={null} onSelect={jest.fn()} onMarkAbsent={jest.fn()} onMarkPresent={jest.fn()} />)

    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByText('Table 2')).toBeInTheDocument()
  })

  it('offers Shuffle, Print and Mark complete', () => {
    render(<SessionCard assignment={assignment} selectedName={null} onSelect={jest.fn()} onMarkAbsent={jest.fn()} onMarkPresent={jest.fn()} />)

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
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )

    expect(screen.getByText('Absent:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ken Adler' })).toBeInTheDocument()
  })

  it('disables Shuffle while a shuffle is running', () => {
    render(<SessionCard assignment={assignment} isShuffling selectedName={null} onSelect={jest.fn()} onMarkAbsent={jest.fn()} onMarkPresent={jest.fn()} />)

    expect(screen.getByRole('button', { name: /shuffling/i })).toBeDisabled()
  })

  it('hides the mutating actions when read-only', () => {
    render(<SessionCard
        assignment={assignment}
        readOnly
        onReopen={jest.fn()}
        selectedName={null}
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />)

    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /shuffle/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark complete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument()
  })
})

describe('SessionCard — a completed session', () => {
  it('renders as one row', () => {
    render(<SessionCard assignment={assignment} completed selectedName={null} onSelect={jest.fn()} onMarkAbsent={jest.fn()} onMarkPresent={jest.fn()} />)

    expect(screen.getByText(/Session 1/)).toBeInTheDocument()
    expect(screen.getByText(/completed/)).toBeInTheDocument()
    expect(screen.getByText(/4 seated/)).toBeInTheDocument()
    expect(screen.queryByText('Table 1')).not.toBeInTheDocument()
  })

  it('expands to the full session on the chevron', async () => {
    render(<SessionCard assignment={assignment} completed selectedName={null} onSelect={jest.fn()} onMarkAbsent={jest.fn()} onMarkPresent={jest.fn()} />)

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
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /reopen/i })).toBeInTheDocument()

    rerender(<SessionCard assignment={assignment} completed selectedName={null} onSelect={jest.fn()} onMarkAbsent={jest.fn()} onMarkPresent={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument()
  })
})

describe('SessionCard — compact', () => {
  const renderCard = (props: Partial<React.ComponentProps<typeof SessionCard>> = {}) =>
    render(
      <SessionCard
        assignment={assignment}
        selectedName={null}
        onSelect={jest.fn()}
        onShuffle={jest.fn()}
        onPrint={jest.fn()}
        onMarkComplete={jest.fn()}
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
        {...props}
      />
    )

  it('renders the session name but not the header actions', () => {
    renderCard({ compact: true })
    expect(screen.getByRole('heading', { name: /Session \d+/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Shuffle/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mark complete/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Print$/ })).not.toBeInTheDocument()
  })

  it('still lets a chip be clicked to select', () => {
    const onSelect = jest.fn()
    renderCard({ compact: true, onSelect })
    fireEvent.click(screen.getByRole('button', { name: 'Ben' }))
    expect(onSelect).toHaveBeenCalledWith('Ben')
  })

  it('does not offer Mark absent even when the selected person sits here', () => {
    renderCard({ compact: true, selectedName: 'Ben' })
    expect(screen.queryByRole('button', { name: /Mark .* absent/ })).not.toBeInTheDocument()
  })

  it('shows a completed session inline with no collapse toggle', () => {
    renderCard({ compact: true, completed: true })
    expect(screen.getByRole('heading', { name: /Session \d+/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Expand session/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Collapse session/ })).not.toBeInTheDocument()
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
  // The trigger is queried by exact name, deliberately: naming the default
  // table in it ("Mark present at Table 2") invites pressing it unread, which
  // is how a false attendance record gets written. Loosening this to
  // /mark present/i would delete that protection silently.
  const openPicker = () => {
    fireEvent.keyDown(screen.getByRole('button', { name: 'Mark present' }), { key: 'Enter' })
  }

  /**
   * The mouse path, which the keyboard one masks: Radix opens on pointerdown,
   * and the trigger stops the click that follows so a container's
   * click-outside handler never sees it. A real MouseEvent, because jsdom has
   * no PointerEvent and Radix opens only on button 0.
   */
  it('opens on the mouse path too, without letting the click escape', () => {
    const onContainerClick = jest.fn()
    render(
      <div onClick={onContainerClick}>
        <SessionCard
          assignment={withAbsence}
          selectedName="Cara"
          onSelect={jest.fn()}
          onMarkAbsent={jest.fn()}
          onMarkPresent={jest.fn()}
        />
      </div>
    )

    const trigger = screen.getByRole('button', { name: 'Mark present' })
    fireEvent(
      trigger,
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
    )
    fireEvent.click(trigger)

    expect(screen.getByText('Seat Cara at\u2026')).toBeInTheDocument()
    expect(onContainerClick).not.toHaveBeenCalled()
  })

  it('renders absent names as selectable chips', () => {
    const onSelect = jest.fn()
    render(
      <SessionCard assignment={withAbsence} selectedName={null} onSelect={onSelect} onMarkAbsent={jest.fn()} onMarkPresent={jest.fn()} />
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
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: 'Mark present' })).not.toBeInTheDocument()

    rerender(
      <SessionCard
        assignment={withAbsence}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
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
        onMarkAbsent={jest.fn()}
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

  it('says "suggested" in words, not only as a glyph', () => {
    render(
      <SessionCard
        assignment={withAbsence}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )

    openPicker()

    // A screen reader either reads the check mark as noise or drops it, so the
    // only cue marking the pre-picked row has to be a word.
    expect(screen.getByRole('menuitem', { name: /open seat \(suggested\)/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Table 1/ }).textContent).not.toMatch(
      /suggested/
    )
  })

  it('reports the table the user chose', () => {
    const onMarkPresent = jest.fn()
    render(
      <SessionCard
        assignment={withAbsence}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
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
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )

    openPicker()

    expect(screen.getByRole('menuitem', { name: /Table 2 · 2 people/ })).toBeInTheDocument()
    expect(screen.queryByText(/open seat/)).not.toBeInTheDocument()
  })

  it('suppresses Mark present on a completed session', () => {
    const onSelect = jest.fn()
    render(
      <SessionCard
        assignment={withAbsence}
        completed
        selectedName="Cara"
        onSelect={onSelect}
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /expand session 3/i }))

    expect(screen.queryByRole('button', { name: 'Mark present' })).not.toBeInTheDocument()

    // Looking is free even here: the chip still selects, only acting is gated.
    fireEvent.click(screen.getByRole('button', { name: 'Cara' }))
    expect(onSelect).toHaveBeenCalledWith('Cara')
  })

  it('suppresses Mark present while viewing an older version', () => {
    const { rerender } = render(
      <SessionCard
        assignment={withAbsence}
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Mark present' })).toBeInTheDocument()

    rerender(
      <SessionCard
        assignment={withAbsence}
        readOnly
        selectedName="Cara"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
        onMarkPresent={jest.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: 'Mark present' })).not.toBeInTheDocument()
  })
})
