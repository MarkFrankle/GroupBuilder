import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFoundPage from '../NotFoundPage'

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('NotFoundPage', () => {
  test('tells the user the page was not found', () => {
    renderWithRouter(<NotFoundPage />)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  test('offers a way back to Home', () => {
    renderWithRouter(<NotFoundPage />)
    expect(screen.getByRole('link', { name: /Go to Home/i })).toHaveAttribute('href', '/')
  })
})
