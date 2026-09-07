import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProgramHeader from '../ProgramHeader'

const facts = {
  participants: 24,
  tables: 4,
  sessions: 5,
  uniqueTablemates: 18.5,
}

describe('ProgramHeader', () => {
  it('renders the program name and its facts', () => {
    render(<ProgramHeader programName="Spring 2026 Series" facts={facts} linkedPairs={4} />)

    expect(
      screen.getByRole('heading', { name: 'Spring 2026 Series' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('24 participants · 4 tables · 5 sessions · avg 18.5 unique tablemates')
    ).toBeInTheDocument()
  })

  it('renders the rules line when there are linked pairs', () => {
    render(<ProgramHeader programName="Spring" facts={facts} linkedPairs={4} />)

    expect(screen.getByText(/4 linked pairs/)).toBeInTheDocument()
  })

  it('does not pluralise a single linked pair', () => {
    render(<ProgramHeader programName="Spring" facts={facts} linkedPairs={1} />)

    expect(screen.getByText(/1 linked pair$/)).toBeInTheDocument()
  })

  it('omits the rules line entirely when there are no rules', () => {
    render(<ProgramHeader programName="Spring" facts={facts} linkedPairs={0} />)

    expect(screen.queryByText(/Rules/)).not.toBeInTheDocument()
  })

  it('offers Print Roster and Copy Link', async () => {
    const onPrintRoster = jest.fn()
    render(
      <ProgramHeader
        programName="Spring"
        facts={facts}
        linkedPairs={0}
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

    render(<ProgramHeader programName="Spring 2026 Series" facts={facts} linkedPairs={4} />)

    expect(screen.getByTestId('program-header')).not.toHaveClass('sticky')

    act(() => observers[0]([{ isIntersecting: false }]))

    expect(screen.getByTestId('program-header')).toHaveClass('sticky')
  })
})
