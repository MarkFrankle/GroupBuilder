import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import TableAssignmentsPage from '../TableAssignmentsPage'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
})

// Mock fetch globally
global.fetch = jest.fn()

const mockAssignmentsData = [
  {
    session: 1,
    tables: {
      1: [
        { name: 'Alice', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'Bob', religion: 'Jewish', gender: 'Male', partner: null },
      ],
    },
  },
]

describe('TableAssignmentsPage copy link functionality', () => {
  beforeEach(() => {
    // Mock window.location
    delete (window as any).location
    window.location = {
      href: 'http://localhost:3000/results?session=test-123',
      origin: 'http://localhost:3000',
      pathname: '/results',
      search: '?session=test-123',
    } as any

    // Clear clipboard mock
    ;(navigator.clipboard.writeText as jest.Mock).mockClear()

    // Mock fetch responses
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/assignments/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAssignmentsData),
        })
      }
      if (url.includes('/sessions/') && url.includes('/versions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      })
    })
  })

  it('displays copy link button', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
    })
  })

  it('copies current URL to clipboard when clicked', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    // Wait for component to load
    const copyButton = await screen.findByRole('button', { name: /copy link/i })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3000/results?session=test-123'
      )
    })
  })

  it('shows success feedback after copying', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    // Wait for component to load
    const copyButton = await screen.findByRole('button', { name: /copy link/i })
    fireEvent.click(copyButton)

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument()
    })
  })
})
