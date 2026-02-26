import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WelcomePage from '../pages/WelcomePage'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

describe('WelcomePage', () => {
  const mockOnDismiss = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders welcome heading and both CTA buttons', () => {
    render(
      <MemoryRouter>
        <WelcomePage onDismiss={mockOnDismiss} />
      </MemoryRouter>
    )
    expect(screen.getByText(/welcome to group builder/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /learn how it works/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  it('navigates to help and calls onDismiss when "Learn how it works" is clicked', () => {
    render(
      <MemoryRouter>
        <WelcomePage onDismiss={mockOnDismiss} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /learn how it works/i }))
    expect(mockOnDismiss).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/help')
  })

  it('navigates to roster and calls onDismiss when "Get started" is clicked', () => {
    render(
      <MemoryRouter>
        <WelcomePage onDismiss={mockOnDismiss} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(mockOnDismiss).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/roster')
  })
})
