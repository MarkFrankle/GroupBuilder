import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import '@testing-library/jest-dom'
import RootDispatch from '../RootDispatch'

const authState = { user: { uid: 'u1', email: 'u@example.com' } as any, loading: false }
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => authState }))

const programState = {
  currentProgram: { id: 'prog-a', name: 'Program A' } as any,
  programs: [{ id: 'prog-a', name: 'Program A' }],
  loading: false,
  needsProgramSelection: false,
}
jest.mock('@/contexts/ProgramContext', () => ({ useProgram: () => programState }))

const metaState: { data: any; isLoading: boolean } = { data: null, isLoading: false }
jest.mock('@/hooks/queries', () => ({
  useAssignmentSetMetadata: () => metaState,
}))

function Where() {
  const loc = useLocation()
  return <div>at:{loc.pathname}</div>
}

const renderDispatch = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RootDispatch />} />
        <Route path="/roster" element={<Where />} />
        <Route path="/table-assignments" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

describe('RootDispatch', () => {
  beforeEach(() => {
    localStorage.clear()
    metaState.data = null
    metaState.isLoading = false
    programState.loading = false
    localStorage.setItem('groupbuilder_welcome_seen_u1', 'true')
  })

  test('first-ever visit shows the welcome nudge', () => {
    localStorage.clear()
    renderDispatch()
    expect(screen.getByText(/Welcome to Group Builder/i)).toBeInTheDocument()
  })

  test('program with no plan redirects to /roster', () => {
    metaState.data = null
    renderDispatch()
    expect(screen.getByText('at:/roster')).toBeInTheDocument()
  })

  test('program with a plan redirects to /table-assignments', () => {
    metaState.data = { current_version_id: 'v1' }
    renderDispatch()
    expect(screen.getByText('at:/table-assignments')).toBeInTheDocument()
  })

  test('waits while metadata is loading', () => {
    metaState.isLoading = true
    renderDispatch()
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  test('waits while program context is loading', () => {
    programState.loading = true
    renderDispatch()
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })
})
