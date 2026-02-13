import { render, screen } from '@testing-library/react'
import CircularTable from '../CircularTable'

describe('CircularTable', () => {
  const mockSeats = [
    { position: 0, name: 'Alice Johnson', religion: 'Christian' },
    { position: 1, name: 'Bob Smith', religion: 'Jewish' },
    { position: 2, name: 'Charlie Brown', religion: 'Muslim' },
    { position: 3, name: 'Diana Prince', religion: 'Hindu' },
  ]

  it('renders table number', () => {
    render(<CircularTable tableNumber={1} seats={mockSeats} />)
    
    expect(screen.getByText('Table 1')).toBeInTheDocument()
  })

  it('renders all participant names', () => {
    render(<CircularTable tableNumber={1} seats={mockSeats} />)
    
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
    expect(screen.getByText('Diana Prince')).toBeInTheDocument()
  })

  it('renders SVG circle', () => {
    const { container } = render(<CircularTable tableNumber={1} seats={mockSeats} />)
    
    const circle = container.querySelector('circle')
    expect(circle).toBeInTheDocument()
  })

  it('shortens long names', () => {
    const longNameSeats = [
      { position: 0, name: 'Elizabeth Montgomery-Wellington', religion: 'Christian' },
      { position: 1, name: 'Short Name', religion: 'Jewish' },
    ]
    
    render(<CircularTable tableNumber={2} seats={longNameSeats} />)
    
    // Long name should be shortened to "FirstName L."
    expect(screen.getByText('Elizabeth M.')).toBeInTheDocument()
    // Short name should remain unchanged
    expect(screen.getByText('Short Name')).toBeInTheDocument()
  })

  it('handles single-seat table', () => {
    const singleSeat = [
      { position: 0, name: 'Solo Participant', religion: 'Buddhist' },
    ]
    
    render(<CircularTable tableNumber={3} seats={singleSeat} />)
    
    expect(screen.getByText('Solo Participant')).toBeInTheDocument()
    expect(screen.getByText('Table 3')).toBeInTheDocument()
  })

  it('positions names around circle using polar coordinates', () => {
    const { container } = render(<CircularTable tableNumber={1} seats={mockSeats} />)
    
    const textElements = container.querySelectorAll('text')
    
    // Should have as many text elements as seats
    expect(textElements.length).toBe(mockSeats.length)
    
    // Each text element should have x and y coordinates
    textElements.forEach(text => {
      expect(text.getAttribute('x')).toBeTruthy()
      expect(text.getAttribute('y')).toBeTruthy()
    })
  })

  it('uses appropriate text anchoring', () => {
    const { container } = render(<CircularTable tableNumber={1} seats={mockSeats} />)
    
    const textElements = container.querySelectorAll('text')
    
    // Check that text elements have textAnchor attribute
    textElements.forEach(text => {
      const anchor = text.getAttribute('text-anchor')
      expect(['start', 'middle', 'end']).toContain(anchor)
    })
  })

  it('applies correct test-id for component identification', () => {
    render(<CircularTable tableNumber={1} seats={mockSeats} />)

    expect(screen.getByTestId('circular-table')).toBeInTheDocument()
  })

  it('shows facilitator subtitle when facilitators present', () => {
    const seatsWithFacilitator = [
      { position: 0, name: 'Alice Johnson', religion: 'Christian', is_facilitator: true },
      { position: 1, name: 'Bob Smith', religion: 'Jewish', is_facilitator: false },
    ]
    render(<CircularTable tableNumber={1} seats={seatsWithFacilitator} />)
    const subtitle = screen.getByTestId('facilitator-subtitle')
    expect(subtitle).toBeInTheDocument()
    expect(subtitle).toHaveTextContent('Facilitators: Alice Johnson')
  })

  it('does not show facilitator subtitle when no facilitators', () => {
    render(<CircularTable tableNumber={1} seats={mockSeats} />)
    expect(screen.queryByTestId('facilitator-subtitle')).not.toBeInTheDocument()
  })
})
