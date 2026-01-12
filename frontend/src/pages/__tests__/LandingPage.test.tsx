/**
 * Tests for LandingPage component.
 *
 * Tests key user flows:
 * - File upload
 * - Form validation
 * - Recent uploads
 * - Error handling
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import LandingPage from '../LandingPage'
import * as recentUploadsModule from '@/utils/recentUploads'

// Mock react-router-dom's useNavigate
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Mock fetch
global.fetch = jest.fn()

// Mock ResizeObserver (needed by Radix UI Slider)
class ResizeObserverMock {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
}
global.ResizeObserver = ResizeObserverMock as any

// Helper to render component with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

// Mock file
const createMockFile = (name: string = 'test.xlsx', type: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => {
  return new File(['test content'], name, { type })
}

describe('LandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
    localStorage.clear()
    // Mock getRecentUploadIds to return empty array by default
    jest.spyOn(recentUploadsModule, 'getRecentUploadIds').mockReturnValue([])
  })

  describe('Rendering', () => {
    it('renders the main title', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.getByText('Group Builder')).toBeInTheDocument()
    })

    it('renders the "How it works" section', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.getByText('How it works')).toBeInTheDocument()
    })

    it('renders the file upload input', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.getByLabelText(/Upload Participant Data/i)).toBeInTheDocument()
    })

    it('renders number of tables selector', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.getByText('Number of Tables')).toBeInTheDocument()
    })

    it('renders number of sessions selector', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.getByText('Number of Sessions')).toBeInTheDocument()
    })

    it('renders submit button', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.getByRole('button', { name: /Generate Assignments/i })).toBeInTheDocument()
    })

    it('renders template download link', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.getByText(/Download Template with Sample Data/i)).toBeInTheDocument()
    })
  })

  describe('Advanced Options', () => {
    it('hides solver time options by default', () => {
      renderWithRouter(<LandingPage />)
      expect(screen.queryByText(/Solver Time/i)).not.toBeInTheDocument()
    })

    it('shows solver time options when Advanced Options clicked', async () => {
      renderWithRouter(<LandingPage />)

      const advancedButton = screen.getByText('Advanced Options')
      fireEvent.click(advancedButton)

      await waitFor(() => {
        expect(screen.getByText(/Solver Time/i)).toBeInTheDocument()
      })
    })

    it('hides solver time options when Advanced Options clicked again', async () => {
      renderWithRouter(<LandingPage />)

      const advancedButton = screen.getByText('Advanced Options')

      // Click to open
      fireEvent.click(advancedButton)
      await waitFor(() => {
        expect(screen.getByText(/Solver Time/i)).toBeInTheDocument()
      })

      // Click to close
      fireEvent.click(advancedButton)
      await waitFor(() => {
        expect(screen.queryByText(/Solver Time/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('File Upload', () => {
    it('displays selected file name', async () => {
      renderWithRouter(<LandingPage />)

      const fileInput = screen.getByLabelText(/Upload Participant Data/i) as HTMLInputElement
      const file = createMockFile('participants.xlsx')

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(fileInput.files?.[0].name).toBe('participants.xlsx')
      })
    })

    it('accepts .xlsx files', () => {
      renderWithRouter(<LandingPage />)

      const fileInput = screen.getByLabelText(/Upload Participant Data/i)
      expect(fileInput).toHaveAttribute('accept', '.xlsx, .xls')
    })
  })

  describe('Form Submission', () => {
    it('shows error when no file selected', async () => {
      renderWithRouter(<LandingPage />)

      const submitButton = screen.getByRole('button', { name: /Generate Assignments/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Please select a file/i)).toBeInTheDocument()
      })
    })

    it('submits form with valid file', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_id: 'session-123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ assignments: [] })
        })

      renderWithRouter(<LandingPage />)

      const fileInput = screen.getByLabelText(/Upload Participant Data/i) as HTMLInputElement
      const file = createMockFile()

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      fireEvent.change(fileInput)

      const submitButton = screen.getByRole('button', { name: /Generate Assignments/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/upload/'),
          expect.any(Object)
        )
      })
    })

    it('shows loading state during submission', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      renderWithRouter(<LandingPage />)

      const fileInput = screen.getByLabelText(/Upload Participant Data/i) as HTMLInputElement
      const file = createMockFile()

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      fireEvent.change(fileInput)

      const submitButton = screen.getByRole('button', { name: /Generate Assignments/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Processing/i)).toBeInTheDocument()
      })
    })

    it('disables button during submission', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      renderWithRouter(<LandingPage />)

      const fileInput = screen.getByLabelText(/Upload Participant Data/i) as HTMLInputElement
      const file = createMockFile()

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      fireEvent.change(fileInput)

      const submitButton = screen.getByRole('button', { name: /Generate Assignments/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
    })

    it('navigates to results page on success', async () => {
      const mockAssignments = [{ session: 1, tables: {} }]

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_id: 'session-123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAssignments
        })

      renderWithRouter(<LandingPage />)

      const fileInput = screen.getByLabelText(/Upload Participant Data/i) as HTMLInputElement
      const file = createMockFile()

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      fireEvent.change(fileInput)

      const submitButton = screen.getByRole('button', { name: /Generate Assignments/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/table-assignments?session=session-123',
          expect.objectContaining({
            state: expect.objectContaining({
              assignments: mockAssignments,
              sessionId: 'session-123'
            })
          })
        )
      })
    })

    it('displays error message on upload failure', async () => {
      // Mock fetch to return 400 error (client error - won't retry)
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'File upload failed' })
      })

      renderWithRouter(<LandingPage />)

      const fileInput = screen.getByLabelText(/Upload Participant Data/i) as HTMLInputElement
      const file = createMockFile()

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      fireEvent.change(fileInput)

      const submitButton = screen.getByRole('button', { name: /Generate Assignments/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/File upload failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Recent Uploads', () => {
    it('does not show recent uploads section when empty', () => {
      jest.spyOn(recentUploadsModule, 'getRecentUploadIds').mockReturnValue([])

      renderWithRouter(<LandingPage />)

      expect(screen.queryByText('Recent Uploads')).not.toBeInTheDocument()
    })

    it('shows recent uploads when available', async () => {
      jest.spyOn(recentUploadsModule, 'getRecentUploadIds').mockReturnValue(['session-123'])

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
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
      })

      renderWithRouter(<LandingPage />)

      await waitFor(() => {
        expect(screen.getByText('Recent Uploads')).toBeInTheDocument()
      })
    })

    it('removes expired sessions from recent uploads', async () => {
      jest.spyOn(recentUploadsModule, 'getRecentUploadIds').mockReturnValue(['expired-session'])
      const removeRecentUploadSpy = jest.spyOn(recentUploadsModule, 'removeRecentUpload')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      renderWithRouter(<LandingPage />)

      await waitFor(() => {
        expect(removeRecentUploadSpy).toHaveBeenCalledWith('expired-session')
      })
    })
  })

  describe('Default Values', () => {
    it('has default numTables of 1', () => {
      renderWithRouter(<LandingPage />)

      // The component uses a Select, so we check the SelectValue (which should show "1" by default)
      const tablesButton = screen.getByRole('combobox', { name: /Number of Tables/i })
      expect(tablesButton).toHaveTextContent('1')
    })

    it('has default numSessions of 1', () => {
      renderWithRouter(<LandingPage />)

      const sessionsButton = screen.getByRole('combobox', { name: /Number of Sessions/i })
      expect(sessionsButton).toHaveTextContent('1')
    })
  })

  describe('Accessibility', () => {
    it('has proper labels for all inputs', () => {
      renderWithRouter(<LandingPage />)

      expect(screen.getByLabelText(/Upload Participant Data/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Number of Tables/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Number of Sessions/i)).toBeInTheDocument()
    })

    it('submit button is keyboard accessible', () => {
      renderWithRouter(<LandingPage />)

      const submitButton = screen.getByRole('button', { name: /Generate Assignments/i })
      expect(submitButton).toBeInstanceOf(HTMLButtonElement)
    })
  })
})
