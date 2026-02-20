import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import LandingPage from '../LandingPage'

const renderWithRouter = (component: React.ReactElement) =>
  render(<BrowserRouter>{component}</BrowserRouter>)

describe('Landing Page', () => {
  test('renders app title', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Group Builder')).toBeInTheDocument()
  })

  test('renders tagline', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Create balanced and diverse groups/)).toBeInTheDocument()
  })

  test('renders Manage Roster link to /roster', () => {
    renderWithRouter(<LandingPage />)
    const link = screen.getByRole('link', { name: /Manage Roster/i })
    expect(link).toHaveAttribute('href', '/roster')
  })
})
