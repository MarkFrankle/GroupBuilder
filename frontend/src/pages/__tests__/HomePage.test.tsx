import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import HomePage from '../HomePage'

const renderWithRouter = () =>
  render(<BrowserRouter><HomePage /></BrowserRouter>)

describe('HomePage', () => {
  test('renders app title', () => {
    renderWithRouter()
    expect(screen.getByText('Group Builder')).toBeInTheDocument()
  })

  test('Roster card links to /roster', () => {
    renderWithRouter()
    expect(screen.getByRole('link', { name: /Roster/i })).toHaveAttribute('href', '/roster')
  })

  test('Assignments card links to /table-assignments', () => {
    renderWithRouter()
    expect(screen.getByRole('link', { name: /Assignments/i })).toHaveAttribute('href', '/table-assignments')
  })

  test('Help card links to /help', () => {
    renderWithRouter()
    expect(screen.getByRole('link', { name: /Help/i })).toHaveAttribute('href', '/help')
  })
})
