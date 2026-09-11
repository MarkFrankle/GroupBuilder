import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProgramHeader from '../ProgramHeader'

describe('ProgramHeader', () => {
  it('renders the program name', () => {
    render(<ProgramHeader programName="Spring 2026 Series" />)

    expect(
      screen.getByRole('heading', { name: 'Spring 2026 Series' })
    ).toBeInTheDocument()
  })

  it('offers Print roster & seating charts and Copy Link', async () => {
    const onPrintRoster = jest.fn()
    render(
      <ProgramHeader
        programName="Spring"
        onPrintRoster={onPrintRoster}
        onCopyLink={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /print roster/i }))

    expect(onPrintRoster).toHaveBeenCalled()
  })

  it('condenses once the sentinel leaves the viewport', () => {
    const observers: Array<(entries: any[]) => void> = []
    ;(window as any).IntersectionObserver = class {
      constructor(callback: (entries: any[]) => void) {
        observers.push(callback)
      }
      observe() {}
      disconnect() {}
    }

    render(<ProgramHeader programName="Spring 2026 Series" />)

    expect(screen.getByTestId('program-header')).not.toHaveClass('sticky')

    act(() => observers[0]([{ isIntersecting: false }]))

    expect(screen.getByTestId('program-header')).toHaveClass('sticky')
  })
})
