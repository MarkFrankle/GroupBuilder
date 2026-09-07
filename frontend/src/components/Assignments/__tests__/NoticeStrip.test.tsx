import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoticeStrip from '../NoticeStrip'

describe('NoticeStrip', () => {
  it('renders nothing when there is nothing to say', () => {
    const { container } = render(<NoticeStrip notice={null} />)

    expect(container).toBeEmptyDOMElement()
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
        notice={{ tone: 'info', message: 'Viewing an older version.', action: { label: 'Back to current', onClick } }}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Back to current' }))

    expect(onClick).toHaveBeenCalled()
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
