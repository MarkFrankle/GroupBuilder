import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoticeStrip from '../NoticeStrip'

describe('NoticeStrip', () => {
  it('says nothing when there is nothing to say, but stays mounted', () => {
    render(<NoticeStrip notice={null} />)

    // Mounted and empty rather than absent: a live region that appears with its
    // text already inside it is generally not announced, and this strip carries
    // every edit receipt and every Undo.
    const region = screen.getByRole('status')
    expect(region).toBeInTheDocument()
    expect(region).toHaveTextContent('')
    expect(region).toHaveClass('sr-only')
  })

  it('takes focus only when the notice asks for it', () => {
    const { rerender } = render(
      <NoticeStrip notice={{ tone: 'info', message: 'Assignments created.' }} />
    )
    expect(screen.getByRole('status')).not.toHaveFocus()

    rerender(
      <NoticeStrip
        notice={{ tone: 'info', message: 'Ann marked absent.', focusOnAppear: true }}
      />
    )
    expect(screen.getByRole('status')).toHaveFocus()
  })

  it('renders the message', () => {
    render(<NoticeStrip notice={{ tone: 'info', message: 'Session 3 shuffled.' }} />)

    expect(screen.getByText('Session 3 shuffled.')).toBeInTheDocument()
  })

  it('marks an error notice as an alert', () => {
    render(<NoticeStrip notice={{ tone: 'error', message: 'Session 1 is still open.' }} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Session 1 is still open.')
  })

  it('runs the action when one is given', async () => {
    const onClick = jest.fn()
    render(
      <NoticeStrip
        notice={{
          tone: 'info',
          message: 'Viewing an older version.',
          actions: [{ label: 'Back to current', onClick }],
        }}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Back to current' }))

    expect(onClick).toHaveBeenCalled()
  })

  it('renders every action it is given, in order', async () => {
    const promote = jest.fn()
    const back = jest.fn()
    render(
      <NoticeStrip
        notice={{
          tone: 'info',
          message: 'Viewing an older version.',
          actions: [
            { label: 'Promote', onClick: promote },
            { label: 'Back to current', onClick: back },
          ],
        }}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Promote' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to current' }))

    expect(promote).toHaveBeenCalled()
    expect(back).toHaveBeenCalled()
  })

  it('dismisses on the close button', async () => {
    const onDismiss = jest.fn()
    render(<NoticeStrip notice={{ tone: 'info', message: 'Done.' }} onDismiss={onDismiss} />)

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(onDismiss).toHaveBeenCalled()
  })

  it('has no dismiss control when it cannot be dismissed', () => {
    render(<NoticeStrip notice={{ tone: 'info', message: 'Done.' }} />)

    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })
})
