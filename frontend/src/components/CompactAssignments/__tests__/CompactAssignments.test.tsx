/**
 * Tests for CompactAssignments component.
 *
 * Tests:
 * - Rendering assignments
 * - Person highlighting on click
 * - Color consistency
 * - Tooltip display
 */

import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import CompactAssignments from '../CompactAssignments'

const sampleAssignments = [
  {
    session: 1,
    tables: {
      1: [
        { name: 'Alice Johnson', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'Bob Smith', religion: 'Jewish', gender: 'Male', partner: 'Alice Johnson' }
      ],
      2: [
        { name: 'Charlie Davis', religion: 'Muslim', gender: 'Male', partner: null },
        { name: 'Diana Prince', religion: 'Christian', gender: 'Female', partner: null }
      ]
    }
  },
  {
    session: 2,
    tables: {
      1: [
        { name: 'Alice Johnson', religion: 'Christian', gender: 'Female', partner: null },
        { name: 'Charlie Davis', religion: 'Muslim', gender: 'Male', partner: null }
      ],
      2: [
        { name: 'Bob Smith', religion: 'Jewish', gender: 'Male', partner: 'Alice Johnson' },
        { name: 'Diana Prince', religion: 'Christian', gender: 'Female', partner: null }
      ]
    }
  }
]

describe('CompactAssignments', () => {
  it('renders all sessions', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 2')).toBeInTheDocument()
  })

  it('renders all participants', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    expect(screen.getAllByText('Alice Johnson')).toHaveLength(2) // Appears in both sessions
    expect(screen.getAllByText('Bob Smith')).toHaveLength(2)
    expect(screen.getAllByText('Charlie Davis')).toHaveLength(2)
    expect(screen.getAllByText('Diana Prince')).toHaveLength(2)
  })

  it('renders table numbers', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    // Each session has 2 tables
    const tableLabels = screen.getAllByText(/Table \d/)
    expect(tableLabels.length).toBeGreaterThanOrEqual(4) // 2 sessions × 2 tables
  })

  it('highlights person across all sessions when clicked', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButtons = screen.getAllByText('Alice Johnson')

    // Click first Alice
    fireEvent.click(aliceButtons[0])

    // All Alice instances should have highlight ring
    aliceButtons.forEach(button => {
      expect(button.closest('button')).toHaveClass('ring-2')
      expect(button.closest('button')).toHaveClass('ring-blue-500')
    })
  })

  it('shows highlight message when person is selected', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButton = screen.getAllByText('Alice Johnson')[0]
    fireEvent.click(aliceButton)

    // Check for the highlight message (text is split across <strong> tag)
    const highlightMessage = screen.getByText(/is highlighted across all sessions/i)
    expect(highlightMessage).toBeInTheDocument()
    expect(highlightMessage.parentElement).toHaveTextContent('Alice Johnson is highlighted across all sessions. Click again to clear.')
  })

  it('removes highlight when clicking same person again', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButton = screen.getAllByText('Alice Johnson')[0]

    // Click to highlight
    fireEvent.click(aliceButton)
    expect(screen.getByText(/is highlighted across all sessions/i)).toBeInTheDocument()

    // Click again to unhighlight
    fireEvent.click(aliceButton)
    expect(screen.queryByText(/is highlighted across all sessions/i)).not.toBeInTheDocument()
  })

  it('switches highlight when clicking different person', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButton = screen.getAllByText('Alice Johnson')[0]
    const bobButton = screen.getAllByText('Bob Smith')[0]

    // Highlight Alice
    fireEvent.click(aliceButton)
    expect(screen.getByText(/is highlighted across all sessions/i)).toBeInTheDocument()
    // Alice's name should be in the highlight message (in the strong tag)
    const highlightDiv = screen.getByText(/is highlighted across all sessions/i).parentElement
    expect(highlightDiv).toHaveTextContent('Alice Johnson')

    // Highlight Bob (should replace Alice)
    fireEvent.click(bobButton)
    const newHighlightDiv = screen.getByText(/is highlighted across all sessions/i).parentElement
    // Check that the highlight message contains Bob and full message doesn't start with Alice
    expect(newHighlightDiv).toHaveTextContent('Bob Smith is highlighted across all sessions')
    expect(newHighlightDiv?.textContent?.startsWith('Alice')).toBe(false)
  })

  it('shows person details in title attribute', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButton = screen.getAllByText('Alice Johnson')[0].closest('button')
    expect(aliceButton).toHaveAttribute('title')

    const title = aliceButton?.getAttribute('title') || ''
    expect(title).toContain('Alice Johnson')
    expect(title).toContain('Christian')
    expect(title).toContain('Female')
  })

  it('shows partner info in tooltip for couples', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const bobButton = screen.getAllByText('Bob Smith')[0].closest('button')
    const title = bobButton?.getAttribute('title') || ''

    expect(title).toContain('Partner: Alice Johnson')
  })

  it('applies consistent colors to same person across sessions', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButtons = screen.getAllByText('Alice Johnson')

    // Get class names from all Alice buttons
    const class1 = aliceButtons[0].closest('button')?.className
    const class2 = aliceButtons[1].closest('button')?.className

    // Should have same background color class
    expect(class1).toBe(class2)
  })

  it('renders empty state when no assignments', () => {
    const { container } = render(<CompactAssignments assignments={[]} />)

    expect(container.querySelector('.space-y-4')).toBeInTheDocument()
    expect(screen.queryByText(/Session \d/)).not.toBeInTheDocument()
  })

  it('handles single session', () => {
    const singleSession = [sampleAssignments[0]]

    render(<CompactAssignments assignments={singleSession} />)

    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.queryByText('Session 2')).not.toBeInTheDocument()
  })

  it('handles single table per session', () => {
    const singleTable = [
      {
        session: 1,
        tables: {
          1: [
            { name: 'Alice', religion: 'Christian', gender: 'Female', partner: null },
          ]
        }
      }
    ]

    render(<CompactAssignments assignments={singleTable} />)

    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.queryByText('Table 2')).not.toBeInTheDocument()
  })

  it('renders tip message', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    expect(screen.getByText(/Click any name to highlight/i)).toBeInTheDocument()
  })

  it('sorts tables numerically', () => {
    const unsortedTables = [
      {
        session: 1,
        tables: {
          3: [{ name: 'Person3', religion: 'Christian', gender: 'Male', partner: null }],
          1: [{ name: 'Person1', religion: 'Christian', gender: 'Male', partner: null }],
          2: [{ name: 'Person2', religion: 'Christian', gender: 'Male', partner: null }],
        }
      }
    ]

    render(<CompactAssignments assignments={unsortedTables} />)

    const tableLabels = screen.getAllByText(/Table \d/)

    // Should be in order: Table 1, Table 2, Table 3
    expect(tableLabels[0]).toHaveTextContent('Table 1')
    expect(tableLabels[1]).toHaveTextContent('Table 2')
    expect(tableLabels[2]).toHaveTextContent('Table 3')
  })

  it('handles participants with null partners', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const charlieButton = screen.getAllByText('Charlie Davis')[0].closest('button')
    const title = charlieButton?.getAttribute('title') || ''

    // Should not show "Partner:" when partner is null
    expect(title).not.toContain('Partner:')
  })

  it('maintains highlight state across re-renders', () => {
    const { rerender } = render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButton = screen.getAllByText('Alice Johnson')[0]
    fireEvent.click(aliceButton)

    let highlightDiv = screen.getByText(/is highlighted across all sessions/i).parentElement
    expect(highlightDiv).toHaveTextContent('Alice Johnson')

    // Re-render with same props
    rerender(<CompactAssignments assignments={sampleAssignments} />)

    // Highlight should persist
    highlightDiv = screen.getByText(/is highlighted across all sessions/i).parentElement
    expect(highlightDiv).toHaveTextContent('Alice Johnson')
  })

  it('uses button elements for clickable names', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButton = screen.getAllByText('Alice Johnson')[0].closest('button')

    expect(aliceButton).toBeInstanceOf(HTMLButtonElement)
    expect(aliceButton).toHaveClass('cursor-pointer')
  })

  it('applies hover styles to person buttons', () => {
    render(<CompactAssignments assignments={sampleAssignments} />)

    const aliceButton = screen.getAllByText('Alice Johnson')[0].closest('button')

    // Should have a hover class (specific to the color)
    expect(aliceButton?.className).toMatch(/hover:/)
  })
})
