import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TableBlock from '../TableBlock'
import type { Participant } from '@/types/assignments'

const people: Participant[] = [
  { name: 'Ann', religion: 'Christian', gender: 'Female', partner: null, is_facilitator: true },
  { name: 'Ben', religion: 'Jewish', gender: 'Male', partner: null },
  { name: 'Cara', religion: 'Muslim', gender: 'Female', partner: null },
]

describe('TableBlock', () => {
  it('renders the table number and its stats', () => {
    render(<TableBlock tableNumber={2} participants={people} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByText('Table 2')).toBeInTheDocument()
    expect(screen.getByText('3 people · 2F/1M · 3 religions')).toBeInTheDocument()
  })

  it('separates facilitators from everyone else', () => {
    render(<TableBlock tableNumber={1} participants={people} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByText('Facilitators')).toBeInTheDocument()
  })

  it('omits the facilitator row when the table has none', () => {
    render(<TableBlock tableNumber={1} participants={people.slice(1)} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.queryByText('Facilitators')).not.toBeInTheDocument()
  })

  it('ignores empty seats when counting', () => {
    render(<TableBlock tableNumber={1} participants={[...people, null]} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByText('3 people · 2F/1M · 3 religions')).toBeInTheDocument()
  })

  it('counts one person without pluralising', () => {
    render(<TableBlock tableNumber={1} participants={[people[1]]} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByText('1 person · 0F/1M · 1 religion')).toBeInTheDocument()
  })

  it('offers Mark absent in every table where the selected person sits', () => {
    render(
      <TableBlock
        tableNumber={2}
        participants={people}
        selectedName="Ben"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Mark Ben absent' })).toBeInTheDocument()
  })

  it('keeps the per-table stats while the button is showing', () => {
    render(
      <TableBlock
        tableNumber={2}
        participants={people}
        selectedName="Ben"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
      />
    )

    // Not just "the stats are on the page somewhere": the left-slot decision is
    // a structural fact, so assert both sit inside the same header row and that
    // the button comes first.
    //
    // `stats.parentElement` would be too loose — if the stats moved out of the
    // header the parent becomes the outer wrapper, which still *contains* the
    // button, so the assertion would pass in exactly the world it rules out.
    const button = screen.getByRole('button', { name: 'Mark Ben absent' })
    const stats = screen.getByText('3 people · 2F/1M · 3 religions')
    // Testing Library's queries cannot express "these two share a row", and
    // where they sit relative to each other is the whole claim here.
    /* eslint-disable testing-library/no-node-access */
    const row = button.closest('.border-b')
    expect(row).not.toBeNull()
    expect(stats.closest('.border-b')).toBe(row)
    expect(stats.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    /* eslint-enable testing-library/no-node-access */
  })

  it('offers nothing when the selected person sits elsewhere', () => {
    render(
      <TableBlock
        tableNumber={2}
        participants={people}
        selectedName="Zoe"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Mark .* absent/ })).not.toBeInTheDocument()
  })

  it('offers nothing when nobody is selected', () => {
    render(
      <TableBlock
        tableNumber={2}
        participants={people}
        selectedName={null}
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Mark .* absent/ })).not.toBeInTheDocument()
  })

  it('suppresses the button where acting is not allowed', () => {
    render(
      <TableBlock
        tableNumber={2}
        participants={people}
        selectedName="Ben"
        onSelect={jest.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Mark .* absent/ })).not.toBeInTheDocument()
  })

  it('reports the person when pressed', () => {
    const onMarkAbsent = jest.fn()
    render(
      <TableBlock
        tableNumber={2}
        participants={people}
        selectedName="Ben"
        onSelect={jest.fn()}
        onMarkAbsent={onMarkAbsent}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mark Ben absent' }))

    expect(onMarkAbsent).toHaveBeenCalledWith('Ben')
  })

  // Tests 3-5 above each pass vacuously on their own — deleting the button
  // entirely would satisfy all three. This one holds the positive and negative
  // assertions a single variable apart, so the suppression cannot pass for the
  // wrong reason.
  it('offers the button only in the table where the selected person sits', () => {
    const { rerender } = render(
      <TableBlock
        tableNumber={1}
        participants={people}
        selectedName="Ben"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Mark Ben absent' })).toBeInTheDocument()

    rerender(
      <TableBlock
        tableNumber={1}
        participants={[people[0]]}
        selectedName="Ben"
        onSelect={jest.fn()}
        onMarkAbsent={jest.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /Mark .* absent/ })).not.toBeInTheDocument()
  })

  // Both Chip call sites — the facilitator row and everyone else — must stay
  // wired. tsc catches a missing prop but not a dead branch, so a facilitator
  // row going inert would otherwise be silent.
  it('reports selection from the facilitator row and from everyone else', () => {
    const onSelect = jest.fn()
    render(
      <TableBlock
        tableNumber={1}
        participants={people}
        selectedName={null}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ann · Facilitator' }))
    expect(onSelect).toHaveBeenCalledWith('Ann')

    fireEvent.click(screen.getByRole('button', { name: 'Ben' }))
    expect(onSelect).toHaveBeenCalledWith('Ben')
  })
})
