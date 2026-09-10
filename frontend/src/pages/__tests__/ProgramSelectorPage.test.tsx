import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import '@testing-library/jest-dom'
import ProgramSelectorPage from '../ProgramSelectorPage'

const mockProgramState = {
  programs: [{ id: 'prog-a', name: 'Program A' }] as any[],
  setCurrentProgram: jest.fn(),
}
jest.mock('@/contexts/ProgramContext', () => ({ useProgram: () => mockProgramState }))

function Where() {
  const loc = useLocation()
  return <div>at:{loc.pathname}</div>
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/select-program']}>
      <Routes>
        <Route path="/select-program" element={<ProgramSelectorPage />} />
        <Route path="/" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

describe('ProgramSelectorPage', () => {
  test('redirects to / when the facilitator has one program', () => {
    mockProgramState.programs = [{ id: 'prog-a', name: 'Program A' }]
    renderPage()
    expect(screen.getByText('at:/')).toBeInTheDocument()
  })

  test('redirects to / when the facilitator has zero programs', () => {
    mockProgramState.programs = []
    renderPage()
    expect(screen.getByText('at:/')).toBeInTheDocument()
  })

  test('renders the choices when there are several', () => {
    mockProgramState.programs = [
      { id: 'prog-a', name: 'Program A' },
      { id: 'prog-b', name: 'Program B' },
    ]
    renderPage()
    expect(screen.getByRole('button', { name: 'Program A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Program B' })).toBeInTheDocument()
  })
})
