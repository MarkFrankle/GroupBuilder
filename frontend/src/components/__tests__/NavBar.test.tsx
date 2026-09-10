import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import { NavBar } from '../../App'

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }))

const mockAuthState = { user: { email: 'u@example.com' } as any, signOut: jest.fn() }
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuthState }))

const mockProgramState = {
  currentProgram: { id: 'prog-a', name: 'Program A' } as any,
  programs: [{ id: 'prog-a', name: 'Program A' }],
}
jest.mock('@/contexts/ProgramContext', () => ({ useProgram: () => mockProgramState }))

const mockMetaState: { data: any } = { data: null }
jest.mock('@/hooks/queries', () => ({
  useIsAdmin: () => ({ data: false }),
  useAssignmentSetMetadata: () => mockMetaState,
}))

const renderNav = () =>
  render(<MemoryRouter><NavBar /></MemoryRouter>)

describe('NavBar', () => {
  beforeEach(() => {
    mockMetaState.data = null
    mockProgramState.programs = [{ id: 'prog-a', name: 'Program A' }]
    mockProgramState.currentProgram = { id: 'prog-a', name: 'Program A' }
  })

  test('shows the Roster link', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Roster' })).toHaveAttribute('href', '/roster')
  })

  test('Home link points to /home', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home')
  })

  test('hides Assignments when the program has no plan', () => {
    mockMetaState.data = null
    renderNav()
    expect(screen.queryByRole('link', { name: 'Assignments' })).not.toBeInTheDocument()
  })

  test('shows Assignments once a plan exists', () => {
    mockMetaState.data = { current_version_id: 'v1' }
    renderNav()
    expect(screen.getByRole('link', { name: 'Assignments' })).toHaveAttribute('href', '/table-assignments')
  })

  test('hides Programs for a single-program facilitator', () => {
    renderNav()
    expect(screen.queryByRole('link', { name: 'Programs' })).not.toBeInTheDocument()
  })

  test('shows Programs for a multi-program facilitator', () => {
    mockProgramState.programs = [
      { id: 'prog-a', name: 'Program A' },
      { id: 'prog-b', name: 'Program B' },
    ]
    renderNav()
    expect(screen.getByRole('link', { name: 'Programs' })).toHaveAttribute('href', '/select-program')
  })
})
