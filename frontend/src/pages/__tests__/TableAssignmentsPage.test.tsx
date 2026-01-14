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

describe('TableAssignmentsPage session dropdown', () => {
  const mockMultipleSessionsData = [
    { session: 1, tables: { 1: [] } },
    { session: 2, tables: { 1: [] } },
    { session: 3, tables: { 1: [] } },
  ]

  beforeEach(() => {
    delete (window as any).location
    window.location = {
      href: 'http://localhost:3000/results?session=test-123',
      origin: 'http://localhost:3000',
      pathname: '/results',
      search: '?session=test-123',
    } as any

    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/assignments/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMultipleSessionsData),
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

  it('session dropdown allows quick navigation', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    // Switch to detailed view first
    const detailedButton = await screen.findByRole('button', { name: /detailed view/i })
    fireEvent.click(detailedButton)

    // Wait for component to load and find session dropdown trigger
    const dropdownTrigger = await screen.findByRole('combobox', { name: /select session/i })
    expect(dropdownTrigger).toBeInTheDocument()

    // Should show current session (session 1 by default)
    expect(dropdownTrigger).toHaveTextContent('Session 1')

    // Click to open dropdown
    fireEvent.click(dropdownTrigger)

    // Select session 3
    const session3Option = await screen.findByRole('option', { name: /session 3/i })
    fireEvent.click(session3Option)

    // Should update current session
    await waitFor(() => {
      expect(dropdownTrigger).toHaveTextContent('Session 3')
    })
  })
})

describe('TableAssignmentsPage unified control bar', () => {
  beforeEach(() => {
    delete (window as any).location
    window.location = {
      href: 'http://localhost:3000/results?session=test-123',
      origin: 'http://localhost:3000',
      pathname: '/results',
      search: '?session=test-123',
    } as any

    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/assignments/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { session: 1, tables: { 1: [] } },
            { session: 2, tables: { 1: [] } },
          ]),
        })
      }
      if (url.includes('/versions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ versions: [] }),
        })
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      })
    })
  })

  it('shows session controls with action buttons in unified bar in detailed view', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    // Switch to detailed view
    const detailedButton = await screen.findByRole('button', { name: /detailed view/i })
    fireEvent.click(detailedButton)

    // Session dropdown, Edit, Regenerate, Prev/Next should all be visible
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /select session/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /regenerate session/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /prev/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })
  })

  it('hides session controls in compact view', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    // Should be in compact view by default
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: /select session/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    })
  })
})
