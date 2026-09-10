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
  UserPlus,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Chip from './Chip'
import TableBlock from './TableBlock'
import { tablesWithOpenSeat } from '@/utils/assignmentEdits'
import { personCount, seatedCount, tableNumbers } from '@/utils/assignmentStats'
import type { Assignment, AttributeFocus, Participant } from '@/types/assignments'

interface SessionCardProps {
  assignment: Assignment
  /** One of the leading completed sessions: renders as a collapsed row. */
  completed?: boolean
  /** Item 11 compact zoom — behavior implemented in a later task. */
  compact?: boolean
  /** Viewing an older version — looking is free, acting is not. */
  readOnly?: boolean
  isShuffling?: boolean
  onShuffle?: () => void
  onPrint?: () => void
  onMarkComplete?: () => void
  /** Supplied only for the latest completed session; reopening below it would leave a gap. */
  onReopen?: () => void
  /** Pass-throughs to TableBlock. */
  selectedName: string | null
  onSelect: (name: string) => void
  /** What the chiclets are coloured about. Program-scoped, from the page's view switch. */
  focus?: AttributeFocus
  /**
   * Required, and passed by the page to completed cards too: the card already
   * gates the button on `actionable`, so the suppression lives in one place and
   * `tsc` enforces that every call site is wired. TableBlock's own
   * `onMarkAbsent?` stays optional — there, absence *is* the suppression.
   */
  onMarkAbsent: (name: string) => void
  /** Required on the same terms as `onMarkAbsent`, and gated the same way. */
  onMarkPresent: (name: string, tableNumber: number) => void
}

const SessionCard: React.FC<SessionCardProps> = ({
  assignment,
  completed = false,
  compact = false,
  readOnly = false,
  isShuffling = false,
  onShuffle,
  onPrint,
  onMarkComplete,
  onReopen,
  selectedName,
  onSelect,
  focus = 'religion',
  onMarkAbsent,
  onMarkPresent,
}) => {
  // Expansion is a glance at the past, not a preference — it is not persisted.
  const [expanded, setExpanded] = useState(false)

  const showReopen = completed && !readOnly && !!onReopen
  const absent = assignment.absentParticipants ?? []

  // Mark present is reachable only from the absent row, and only where acting
  // is allowed — the same condition that hides Shuffle.
  const actionable = !completed && !readOnly

  // Carries the name rather than a boolean, so the picker's label and callback
  // get a `string` without a non-null assertion.
  const absentSelected =
    selectedName !== null && absent.some((p: Participant) => p.name === selectedName)
      ? selectedName
      : null

  // The gap the absence left is the anchor for the correction case, and makes
  // the common case a confirming click. When a shuffle since has closed every
  // gap, the annotation and the suggestion simply do not render.
  //
  // Only the lowest-numbered gap is suggested, deliberately: with two absentees
  // we cannot know whose gap is whose, and annotating one as theirs would
  // present a guess as a fact. This is not an off-by-default bug — do not
  // "fix" it by matching gaps to absentees.
  const openSeatTables = tablesWithOpenSeat(assignment)

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
            focus={focus}
            onMarkAbsent={actionable ? onMarkAbsent : undefined}
          />
        ))}
        {absent.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <span className="text-xs text-muted-foreground">Absent:</span>
            {absent.map((person: Participant) => (
              <Chip
                key={person.name}
                participant={person}
                selectedName={selectedName}
                onSelect={onSelect}
                focus={focus}
              />
            ))}
            {actionable && absentSelected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/*
                    Radix opens on pointerdown and lets the following click
                    through. The page dismisses a selection on any click that
                    reaches its root, and this picker is gated on that
                    selection — so without this the menu unmounted in the
                    instant it opened, and mark-present was unusable with a
                    mouse. Stopped here rather than by weakening the
                    dismissal, which is deliberately over-provided.
                  */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={event => event.stopPropagation()}
                  >
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Mark present
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>{`Seat ${absentSelected} at…`}</DropdownMenuLabel>
                  {/*
                    If this picker grows again, the boundary to extract is
                    `<TablePicker assignment name onPick />` — the menu content
                    is domain logic wearing JSX. Lifting the whole absent row
                    instead would relocate six props and separate the picker
                    from the `actionable` definition that gates it.
                  */}
                  {tableNumbers(assignment).map(n => {
                    const seated = assignment.tables[n].filter(Boolean).length
                    const hasGap = openSeatTables.includes(n)
                    const label =
                      `Table ${n} · ${personCount(seated)}` + (hasGap ? ' · open seat' : '')
                    return (
                      <DropdownMenuItem
                        key={n}
                        onSelect={() => onMarkPresent(absentSelected, n)}
                      >
                        {label}
                        {/*
                          A default, not persistent state — so not a checkbox
                          item, which would announce "not checked" on every
                          other row and imply toggling. The glyph alone is read
                          as "check mark" or dropped, so the word carries it.
                        */}
                        {n === openSeatTables[0] && (
                          <>
                            <span aria-hidden="true"> ✓</span>
                            <span className="sr-only"> (suggested)</span>
                          </>
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default SessionCard
