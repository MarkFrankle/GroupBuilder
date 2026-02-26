import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from '../pages/LandingPage'

jest.mock('@/utils/apiClient', () => ({
  authenticatedFetch: (url: string, options?: RequestInit) => fetch(url, options),
}))

const mockUser = { uid: 'test-uid-123', email: 'test@example.com' }
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}))

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows welcome page on first visit', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/welcome to group builder/i)).toBeInTheDocument()
  })

  it('shows normal landing page when welcome has been dismissed', () => {
    localStorage.setItem('groupbuilder_welcome_seen_test-uid-123', 'true')
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )
    expect(screen.queryByText(/welcome to group builder/i)).not.toBeInTheDocument()
    expect(screen.getByText('Group Builder')).toBeInTheDocument()
  })
})
