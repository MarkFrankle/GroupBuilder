import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ProgramProvider, useProgram } from '../ProgramContext'
import { authenticatedFetch } from '@/utils/apiClient'

jest.mock('@/utils/apiClient', () => ({
  authenticatedFetch: jest.fn(),
}))
// Stateful mock shared across every render in this file; beforeEach must fully
// reset all fields or state leaks between tests.
const authState: { user: { uid: string } | null; loading: boolean } = {
  user: null,
  loading: true,
}
jest.mock('../AuthContext', () => ({
  useAuth: () => authState,
}))

const TWO_PROGRAMS = [
  { id: 'prog-a', name: 'Program A' },
  { id: 'prog-b', name: 'Program B' },
]

function Probe() {
  const { currentProgram, needsProgramSelection, loading } = useProgram()
  if (loading) return <div>loading</div>
  return (
    <div>
      <span data-testid="current">{currentProgram?.id ?? 'none'}</span>
      <span data-testid="needs">{String(needsProgramSelection)}</span>
    </div>
  )
}

describe('ProgramContext reload behavior', () => {
  beforeEach(() => {
    localStorage.clear()
    authState.user = null
    authState.loading = true
    ;(authenticatedFetch as jest.Mock).mockReset()
    ;(authenticatedFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ programs: TWO_PROGRAMS }),
    })
  })

  test('a reload keeps the multi-program user in their stored program', async () => {
    localStorage.setItem(
      'groupbuilder_current_program',
      JSON.stringify({ id: 'prog-b', name: 'Program B' }),
    )

    const { rerender } = render(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    )

    authState.user = { uid: 'user-1' }
    authState.loading = false
    rerender(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('current')).toHaveTextContent('prog-b'),
    )
    expect(screen.getByTestId('needs')).toHaveTextContent('false')
    expect(localStorage.getItem('groupbuilder_current_program')).toContain('prog-b')
  })

  test('a real sign-out clears the stored program', async () => {
    authState.user = { uid: 'user-1' }
    authState.loading = false
    localStorage.setItem(
      'groupbuilder_current_program',
      JSON.stringify({ id: 'prog-b', name: 'Program B' }),
    )

    const { rerender } = render(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('current')).toHaveTextContent('prog-b'),
    )

    authState.user = null
    authState.loading = false
    ;(authenticatedFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ programs: [] }),
    })
    rerender(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    )

    await waitFor(() =>
      expect(localStorage.getItem('groupbuilder_current_program')).toBeNull(),
    )
  })
})
