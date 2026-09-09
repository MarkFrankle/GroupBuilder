import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Printer,
  RotateCcw,
  Shuffle,
} from 'lucide-react'
import TableBlock from './TableBlock'
import type { Assignment, Participant } from '@/types/assignments'

interface SessionCardProps {
  assignment: Assignment
  /** One of the leading completed sessions: renders as a collapsed row. */
  completed?: boolean
  /** Viewing an older version — looking is free, acting is not. */
  readOnly?: boolean
  isShuffling?: boolean
  onShuffle?: () => void
  onPrint?: () => void
  onMarkComplete?: () => void
  /** Supplied only for the latest completed session; reopening below it would leave a gap. */
  onReopen?: () => void
  /** Pass-throughs to TableBlock. */
  selectedName?: string | null
  onSelect?: (name: string) => void
}

/** Table numbers arrive as object keys, so they are strings. */
function tableNumbers(assignment: Assignment): number[] {
  return Object.keys(assignment.tables)
    .map(Number)
    .sort((a, b) => a - b)
}

function seatedCount(assignment: Assignment): number {
  return tableNumbers(assignment).reduce(
    (total, n) => total + assignment.tables[n].filter(Boolean).length,
    0
  )
}

const SessionCard: React.FC<SessionCardProps> = ({
  assignment,
  completed = false,
  readOnly = false,
  isShuffling = false,
  onShuffle,
  onPrint,
  onMarkComplete,
  onReopen,
  selectedName = null,
  // Temporary no-op default; chips depress and do nothing until the page owns
  // selection.
  onSelect = () => {},
}) => {
  // Expansion is a glance at the past, not a preference — it is not persisted.
  const [expanded, setExpanded] = useState(false)

  const showReopen = completed && !readOnly && !!onReopen
  const absent = assignment.absentParticipants ?? []

  const reopenButton = showReopen && (
    <Button variant="outline" size="sm" onClick={onReopen}>
      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
      Reopen
    </Button>
  )

  const printButton = (
    <Button variant="outline" size="sm" onClick={onPrint}>
      <Printer className="mr-1.5 h-3.5 w-3.5" />
      Print
    </Button>
  )

  if (completed && !expanded) {
    return (
      <section
        aria-label={`Session ${assignment.session}`}
        className="flex items-center gap-3 rounded-lg border bg-white px-4 py-2"
      >
        <button
          type="button"
          aria-label={`Expand session ${assignment.session}`}
          onClick={() => setExpanded(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">Session {assignment.session}</span>
        <span className="text-sm text-muted-foreground">· completed</span>
        <span className="text-sm text-muted-foreground">
          · {seatedCount(assignment)} seated
        </span>
        <div className="ml-auto">{reopenButton}</div>
      </section>
    )
  }

  return (
    <section
      aria-label={`Session ${assignment.session}`}
      className="overflow-hidden rounded-lg border border-black bg-white"
    >
      <div className="flex items-center justify-between border-b border-black bg-[#f3f4f6] px-4 py-2.5">
        <div className="flex items-center gap-2">
          {completed && (
            <button
              type="button"
              aria-label={`Collapse session ${assignment.session}`}
              onClick={() => setExpanded(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
          <h3 className="text-base font-semibold">Session {assignment.session}</h3>
          {completed && (
            <span className="text-sm text-muted-foreground">· completed</span>
          )}
        </div>

        <div className="flex gap-2">
          {!completed && !readOnly && (
            <Button variant="outline" size="sm" onClick={onShuffle} disabled={isShuffling}>
              {isShuffling ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shuffle className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isShuffling ? 'Shuffling' : 'Shuffle'}
            </Button>
          )}
          {printButton}
          {!completed && !readOnly && (
            <Button variant="outline" size="sm" onClick={onMarkComplete}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Mark complete
            </Button>
          )}
          {reopenButton}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {tableNumbers(assignment).map(n => (
          <TableBlock
            key={n}
            tableNumber={n}
            participants={assignment.tables[n]}
            selectedName={selectedName}
            onSelect={onSelect}
          />
        ))}
        {absent.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Absent: {absent.map((p: Participant) => p.name).join(', ')}
          </div>
        )}
      </div>
    </section>
  )
}

export default SessionCard
