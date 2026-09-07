import React from 'react'
import { render, screen } from '@testing-library/react'
import Chip from '../Chip'
import type { Participant } from '@/types/assignments'

const alice: Participant = {
  name: 'Alice',
  religion: 'Christian',
  gender: 'Female',
  partner: null,
}

describe('Chip', () => {
  it('renders the participant name', () => {
    render(<Chip participant={alice} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('names facilitators for assistive tech', () => {
    render(<Chip participant={{ ...alice, is_facilitator: true }} />)

    expect(screen.getByText('Alice')).toHaveAttribute('title', 'Alice · Facilitator')
  })

  it('falls back to the Other palette for an unlisted religion', () => {
    render(<Chip participant={{ ...alice, religion: 'Zoroastrian' }} />)

    expect(screen.getByText('Alice')).toHaveStyle({ backgroundColor: '#FEF0D8' })
  })
})
