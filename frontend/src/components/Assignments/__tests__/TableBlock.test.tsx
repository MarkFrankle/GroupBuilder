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

    expect(screen.getByText('3 people · 2F/1M · 3 religions')).toBeInTheDocument()
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

  it('reports the person and this table when pressed', () => {
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
})
