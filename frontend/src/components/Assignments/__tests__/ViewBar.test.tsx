import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ViewBar from '../ViewBar'
import type { Participant } from '@/types/assignments'

const people: Participant[] = [
  { name: 'Alice', religion: 'Christian', gender: 'Female', partner: 'Bob' },
  { name: 'Bob', religion: 'Jewish', gender: 'Male', partner: 'Alice' },
]

function renderBar(overrides: Partial<React.ComponentProps<typeof ViewBar>> = {}) {
  const onFocusChange = jest.fn()
  const onZoomChange = jest.fn()
  render(
    <ViewBar
      focus="religion"
      onFocusChange={onFocusChange}
      participants={people}
      zoom="full"
      onZoomChange={onZoomChange}
      {...overrides}
    />
  )
  return { onFocusChange, onZoomChange }
}

describe('ViewBar', () => {
  it('offers the three focuses with Religion pressed by default', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Religion' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gender' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Couples' })).toBeInTheDocument()
  })

  it('reports a focus change on click', () => {
    const { onFocusChange } = renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Gender' }))
    expect(onFocusChange).toHaveBeenCalledWith('gender')
  })

  it('shows the religion legend under religion focus', () => {
    renderBar()
    const legend = screen.getByTestId('focus-legend')
    expect(within(legend).getByText('Jewish')).toBeInTheDocument()
    expect(within(legend).getByText('Muslim')).toBeInTheDocument()
  })

  it('shows only Female and Male under gender focus when no one is Other', () => {
    renderBar({ focus: 'gender' })
    const legend = screen.getByTestId('focus-legend')
    expect(within(legend).getByText('Female')).toBeInTheDocument()
    expect(within(legend).getByText('Male')).toBeInTheDocument()
    expect(within(legend).queryByText('Other')).not.toBeInTheDocument()
  })

  it('adds the Other swatch under gender focus when someone has it', () => {
    renderBar({
      focus: 'gender',
      participants: [...people, { name: 'Sam', religion: 'Other', gender: 'Other', partner: null }],
    })
    expect(within(screen.getByTestId('focus-legend')).getByText('Other')).toBeInTheDocument()
  })

  it('renders no legend under couples focus', () => {
    renderBar({ focus: 'couples' })
    expect(screen.queryByTestId('focus-legend')).not.toBeInTheDocument()
  })

  it('offers Full and Compact with Full pressed by default', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports a zoom change on click', () => {
    const { onZoomChange } = renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(onZoomChange).toHaveBeenCalledWith('compact')
  })

  it('marks Compact pressed when that is the active zoom', () => {
    renderBar({ zoom: 'compact' })
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true')
  })
})
