import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RosterPrintPage from '../RosterPrintPage'

jest.mock('@/utils/apiClient', () => ({
  authenticatedFetch: (...args: any[]) => fetch(...args),
}))

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

  test('renders roster table sorted by last name', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    const nameElements = screen.getAllByRole('cell').filter(cell => {
      const text = cell.textContent || ''
      return ['Sarah Adams', 'Rachel Green', 'David Kim'].includes(text)
    })
    expect(nameElements.map(el => el.textContent)).toEqual([
      'Sarah Adams',
      'Rachel Green',
      'David Kim',
    ])
  })

  test('separates facilitators into their own section with Facilitators heading', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    expect(screen.getByText('Facilitators')).toBeInTheDocument()
    expect(screen.getByText('Mark Frank')).toBeInTheDocument()
  })

  test('shows absent participants', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    expect(screen.getByText(/Absent:/)).toBeInTheDocument()
    expect(screen.getByText(/Bob Smith/)).toBeInTheDocument()
  })

  test('shows table number for each participant', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    // Sarah Adams is at table 1, Rachel Green at table 2
    const rows = screen.getAllByRole('row')
    const sarahRow = rows.find(r => r.textContent?.includes('Sarah Adams'))
    expect(sarahRow?.textContent).toContain('1')
    const rachelRow = rows.find(r => r.textContent?.includes('Rachel Green'))
    expect(rachelRow?.textContent).toContain('2')
  })

  test('omits Session N prefix when only one session', () => {
    renderWithState({ assignments: mockAssignments, sessionId: 'test-session' })
    expect(screen.getByText('Roster')).toBeInTheDocument()
    expect(screen.queryByText(/Session 1 Roster/)).not.toBeInTheDocument()
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
