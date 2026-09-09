import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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
    render(<Chip participant={alice} selectedName={null} onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: /Alice/ })).toBeInTheDocument()
  })

  it('names facilitators for assistive tech', () => {
    render(
      <Chip
        participant={{ ...alice, is_facilitator: true }}
        selectedName={null}
        onSelect={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Alice/ })).toHaveAttribute(
      'title',
      'Alice · Facilitator'
    )
  })

  it('falls back to the Other palette for an unlisted religion', () => {
    render(
      <Chip
        participant={{ ...alice, religion: 'Zoroastrian' }}
        selectedName={null}
        onSelect={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Alice/ })).toHaveStyle({
      backgroundColor: '#FEF0D8',
    })
  })

  it('reports the click', () => {
    const onSelect = jest.fn()
    render(<Chip participant={alice} selectedName={null} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))

    expect(onSelect).toHaveBeenCalledWith('Alice')
  })

  it('does not let the click reach the page, which clears selection', () => {
    const onBackgroundClick = jest.fn()
    render(
      <div onClick={onBackgroundClick}>
        <Chip participant={alice} selectedName={null} onSelect={jest.fn()} />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))

    expect(onBackgroundClick).not.toHaveBeenCalled()
  })

  it('dims a chip that is not the selected person', () => {
    render(<Chip participant={alice} selectedName="Ben" onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: /Alice/ })).toHaveClass('opacity-30')
  })

  it('leaves the selected person at full strength', () => {
    render(<Chip participant={alice} selectedName="Alice" onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: /Alice/ })).not.toHaveClass('opacity-30')
  })
})
