import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import LandingPage from '../LandingPage'
import * as recentUploadsModule from '@/utils/recentUploads'
import { authenticatedFetch } from '@/utils/apiClient'
import { importRoster } from '@/api/roster'

// Mock react-router-dom's useNavigate
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Mock roster API
jest.mock('@/api/roster', () => ({
  importRoster: jest.fn(),
}))
const mockImportRoster = importRoster as jest.MockedFunction<typeof importRoster>

// Get the mocked functions (already mocked in setupTests.ts)
const mockAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>

// Mock ResizeObserver (needed by Radix UI)
class ResizeObserverMock {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
}
global.ResizeObserver = ResizeObserverMock as any

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Landing Page - Hub', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    jest.spyOn(recentUploadsModule, 'getRecentUploadIds').mockReturnValue([])
  })

  test('renders page title', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Group Builder')).toBeInTheDocument()
  })

  test('renders tagline', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Create balanced and diverse groups/)).toBeInTheDocument()
  })

  test('renders Manage Roster card', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Manage Roster')).toBeInTheDocument()
    expect(screen.getByText('Add and edit participants')).toBeInTheDocument()
  })

  test('renders Import from Excel card', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Import from Excel')).toBeInTheDocument()
    expect(screen.getByText('Upload a roster file')).toBeInTheDocument()
  })

  test('Manage Roster links to /roster', () => {
    renderWithRouter(<LandingPage />)
    const link = screen.getByRole('link', { name: /Manage Roster/i })
    expect(link).toHaveAttribute('href', '/roster')
  })

  test('renders download template link', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Download Template with Sample Data/i)).toBeInTheDocument()
  })

  test('has hidden file input for import', () => {
    renderWithRouter(<LandingPage />)
    const fileInput = screen.getByTestId('file-input')
    expect(fileInput).toHaveAttribute('type', 'file')
    expect(fileInput).toHaveAttribute('accept', '.xlsx,.xls')
    expect(fileInput).toHaveClass('hidden')
  })

  test('calls importRoster and navigates on file select', async () => {
    mockImportRoster.mockResolvedValueOnce([])

    renderWithRouter(<LandingPage />)

    const fileInput = screen.getByTestId('file-input')
    const file = new File(['test'], 'roster.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockImportRoster).toHaveBeenCalledWith(file)
    })
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/roster')
    })
  })

  test('shows error on import failure', async () => {
    mockImportRoster.mockRejectedValueOnce(new Error('Failed to import roster: 400'))

    renderWithRouter(<LandingPage />)

    const fileInput = screen.getByTestId('file-input')
    const file = new File(['test'], 'roster.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Failed to import roster/)).toBeInTheDocument()
    })
  })

  test('does not show recent uploads section when empty', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.queryByText('Recent Uploads')).not.toBeInTheDocument()
  })

  test('shows recent uploads when available', async () => {
    jest.spyOn(recentUploadsModule, 'getRecentUploadIds').mockReturnValue(['session-123'])

    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session_id: 'session-123',
        filename: 'test.xlsx',
        num_participants: 10,
        num_tables: 2,
        num_sessions: 3,
        created_at: new Date().toISOString(),
        has_results: false
      })
    } as Response)

    renderWithRouter(<LandingPage />)

    await waitFor(() => {
      expect(screen.getByText('Recent Uploads')).toBeInTheDocument()
    })
  })

  test('removes expired sessions from recent uploads', async () => {
    jest.spyOn(recentUploadsModule, 'getRecentUploadIds').mockReturnValue(['expired-session'])
    const removeRecentUploadSpy = jest.spyOn(recentUploadsModule, 'removeRecentUpload')

    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response)

    renderWithRouter(<LandingPage />)

    await waitFor(() => {
      expect(removeRecentUploadSpy).toHaveBeenCalledWith('expired-session')
    })
  })
})
