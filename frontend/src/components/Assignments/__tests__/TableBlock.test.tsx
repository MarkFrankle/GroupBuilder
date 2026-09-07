import React from 'react'
import { render, screen } from '@testing-library/react'
import TableBlock from '../TableBlock'
import type { Participant } from '@/types/assignments'

const people: Participant[] = [
  { name: 'Ann', religion: 'Christian', gender: 'Female', partner: null, is_facilitator: true },
  { name: 'Ben', religion: 'Jewish', gender: 'Male', partner: null },
  { name: 'Cara', religion: 'Muslim', gender: 'Female', partner: null },
]

describe('TableBlock', () => {
  it('renders the table number and its stats', () => {
    render(<TableBlock tableNumber={2} participants={people} />)

    expect(screen.getByText('Table 2')).toBeInTheDocument()
    expect(screen.getByText('3 people · 2F/1M · 3 religions')).toBeInTheDocument()
  })

  it('separates facilitators from everyone else', () => {
    render(<TableBlock tableNumber={1} participants={people} />)

    expect(screen.getByText('Facilitators')).toBeInTheDocument()
  })

  it('omits the facilitator row when the table has none', () => {
    render(<TableBlock tableNumber={1} participants={people.slice(1)} />)

    expect(screen.queryByText('Facilitators')).not.toBeInTheDocument()
  })

  it('ignores empty seats when counting', () => {
    render(<TableBlock tableNumber={1} participants={[...people, null]} />)

    expect(screen.getByText('3 people · 2F/1M · 3 religions')).toBeInTheDocument()
  })

  it('counts one person without pluralising', () => {
    render(<TableBlock tableNumber={1} participants={[people[1]]} />)

    expect(screen.getByText('1 person · 0F/1M · 1 religion')).toBeInTheDocument()
  })
})
