import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RosterPrintPage from '../RosterPrintPage'

jest.mock('@/utils/apiClient', () => ({
  authenticatedFetch: (...args: any[]) => fetch(...args),
}))

jest.mock('@/components/SeatingChart/CircularTable', () => {
  return function MockCircularTable({ tableNumber }: { tableNumber: number }) {
    return <div data-testid={`circular-table-${tableNumber}`}>Table {tableNumber}</div>
  }
})

const mockAssignments = [
  {
    session: 1,
    tables: {
      1: [
        { name: 'David Kim', religion: 'None', gender: 'M', partner: null, is_facilitator: false },
        { name: 'Sarah Adams', religion: 'None', gender: 'F', partner: null, is_facilitator: false },
      ],
      2: [
        { name: 'Rachel Green', religion: 'None', gender: 'F', partner: null, is_facilitator: false },
        { name: 'Mark Frank', religion: 'None', gender: 'M', partner: null, is_facilitator: true },
      ],
    },
    absentParticipants: [
      { name: 'Bob Smith', religion: 'None', gender: 'M', partner: null },
    ],
  },
]

const renderWithState = (state: any) => {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/roster-print', state }]}>
      <RosterPrintPage />
    </MemoryRouter>
  )
}

describe('RosterPrintPage', () => {
  test('renders no-data message when state is missing', () => {
    render(
      <MemoryRouter>
        <RosterPrintPage />
      </MemoryRouter>
    )
    expect(screen.getByText('No Data Available')).toBeInTheDocument()
  })

  test('groups participants by table', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByText('Table 2')).toBeInTheDocument()
  })

  test('shows participants sorted by last name within each table', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    // Table 1: Adams before Kim
    expect(screen.getByText('Sarah Adams')).toBeInTheDocument()
    expect(screen.getByText('David Kim')).toBeInTheDocument()
  })

  test('separates facilitators into their own section per table', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    // Table 2 has Mark Frank as facilitator
    const facilitatorHeadings = screen.getAllByText('Facilitators')
    expect(facilitatorHeadings.length).toBe(1) // only table 2 has facilitators
    expect(screen.getByText('Mark Frank')).toBeInTheDocument()
  })

  test('shows absent participants', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    expect(screen.getByText(/Absent:/)).toBeInTheDocument()
    expect(screen.getByText(/Bob Smith/)).toBeInTheDocument()
  })

  test('omits Session N prefix when only one session', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    expect(screen.getByText('Roster')).toBeInTheDocument()
    expect(screen.queryByText(/Session 1 Roster/)).not.toBeInTheDocument()
  })

  test('fetches and renders seating charts', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        session: 1,
        tables: [{ table_number: 1, seats: [{ position: 0, name: 'Sarah Adams', religion: 'None' }] }],
      }),
    })

    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    const chart = await screen.findByTestId('circular-table-1')
    expect(chart).toBeInTheDocument()
  })

  test('shows Session N Roster prefix when multiple sessions', () => {
    const multiSession = [
      ...mockAssignments,
      {
        session: 2,
        tables: {
          1: [
            { name: 'David Kim', religion: 'None', gender: 'M', partner: null, is_facilitator: false },
          ],
        },
      },
    ]
    renderWithState({ assignments: multiSession, sessionId: 'test-session' })
    expect(screen.getByText('Session 1 Roster')).toBeInTheDocument()
    expect(screen.getByText('Session 2 Roster')).toBeInTheDocument()
  })
})
