import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SeatingChartPage from '../SeatingChartPage'

// Mock useNavigate and useLocation
const mockNavigate = jest.fn()
const mockLocation = {
  state: {
    seatingData: {
      session: 1,
      tables: [
        {
          table_number: 1,
          seats: [
            { position: 0, name: 'Alice Johnson', religion: 'Christian' },
            { position: 1, name: 'Bob Smith', religion: 'Jewish' },
          ],
        },
        {
          table_number: 2,
          seats: [
            { position: 0, name: 'Charlie Brown', religion: 'Muslim' },
            { position: 1, name: 'Diana Prince', religion: 'Hindu' },
          ],
        },
      ],
      absent_participants: [
        { name: 'Eve Wilson', religion: 'Buddhist' },
      ],
    },
  },
  pathname: '/table-assignments/seating',
  search: '?session=test-123&sessionNum=1',
  hash: '',
  key: 'default',
}

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

// Mock window.print
window.print = jest.fn()

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

// Mock window.scrollTo
window.scrollTo = jest.fn()

describe('SeatingChartPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders session title', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    // There are two instances: one visible header and one print-only header
    const headers = screen.getAllByText('Session 1 Seating Chart')
    expect(headers.length).toBeGreaterThan(0)
  })

  it('renders Back button', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('renders Print button', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    expect(screen.getByText('Print')).toBeInTheDocument()
  })

  it('navigates back when Back button is clicked', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    const backButton = screen.getByText('Back')
    fireEvent.click(backButton)
    
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('triggers print when Print button is clicked', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    const printButton = screen.getByText('Print')
    fireEvent.click(printButton)
    
    expect(window.print).toHaveBeenCalled()
  })

  it('renders all tables', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByText('Table 2')).toBeInTheDocument()
  })

  it('renders all participant names', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
    expect(screen.getByText('Diana Prince')).toBeInTheDocument()
  })

  it('renders absent participants section when present', () => {
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    expect(screen.getByText('Absent Participants')).toBeInTheDocument()
    expect(screen.getByText(/Eve Wilson/)).toBeInTheDocument()
  })

  it('shows error message when seating data is missing', () => {
    // Mock location with no state
    const mockLocationNoState = {
      ...mockLocation,
      state: null,
    }
    
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(mockLocationNoState)
    
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    expect(screen.getByText('No Seating Data Available')).toBeInTheDocument()
    expect(screen.getByText(/Please return to the table assignments page/)).toBeInTheDocument()
  })

  it('does not render absent participants section when none exist', () => {
    // Mock location without absent participants
    const mockLocationNoAbsent = {
      ...mockLocation,
      state: {
        seatingData: {
          session: 1,
          tables: mockLocation.state.seatingData.tables,
          absent_participants: [],
        },
      },
    }
    
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(mockLocationNoAbsent)
    
    render(
      <BrowserRouter>
        <SeatingChartPage />
      </BrowserRouter>
    )
    
    expect(screen.queryByText('Absent Participants')).not.toBeInTheDocument()
  })
})
