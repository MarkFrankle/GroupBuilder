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

  test('renders Roster card linking to /roster', () => {
    renderWithRouter(<LandingPage />)
    const link = screen.getByRole('link', { name: /Roster/i })
    expect(link).toHaveAttribute('href', '/roster')
  })

  test('renders Groups card linking to /groups', () => {
    renderWithRouter(<LandingPage />)
    const link = screen.getByRole('link', { name: /Groups/i })
    expect(link).toHaveAttribute('href', '/groups')
  })

  test('renders Help card linking to /help', () => {
    renderWithRouter(<LandingPage />)
    const link = screen.getByRole('link', { name: /Help/i })
    expect(link).toHaveAttribute('href', '/help')
  })
})
