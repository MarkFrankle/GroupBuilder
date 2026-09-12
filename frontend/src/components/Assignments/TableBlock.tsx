import React from 'react'
import { Button } from '@/components/ui/button'
import { UserMinus } from 'lucide-react'
import Chip from './Chip'
import { personCount } from '@/utils/assignmentStats'
import type { AttributeFocus, Participant } from '@/types/assignments'

interface TableBlockProps {
  tableNumber: number
  participants: (Participant | null)[]
  /** The person selected page-wide, or null. Threaded to Chip. */
  selectedName: string | null
  onSelect: (name: string) => void
  /** What the chiclets are coloured about. Defaults to religion; the page threads the live value. */
  focus?: AttributeFocus
  /**
   * Absent when acting is not allowed here — a completed or read-only view.
   * A missing callback rather than a disabled button, matching how Shuffle and
   * Mark complete are suppressed.
   */
  onMarkAbsent?: (name: string) => void
  /** Item 11 compact zoom — styling implemented in a later task. */
  compact?: boolean
}

/** "6 people · 4F/2M · 3 religions" — the mock's per-table line. */
function tableStats(people: Participant[]): string {
  const females = people.filter(p => p.gender?.[0]?.toUpperCase() === 'F').length
  const religions = new Set(people.map(p => p.religion)).size
  return (
    `${personCount(people.length)} · ` +
    `${females}F/${people.length - females}M · ` +
    `${religions} ${religions === 1 ? 'religion' : 'religions'}`
  )
}

const TableBlock: React.FC<TableBlockProps> = ({
  tableNumber,
  participants,
  selectedName,
  onSelect,
  focus = 'religion',
  onMarkAbsent,
  compact = false,
}) => {
  // Empty seats are stored as null: mark-absent deliberately leaves the gap
  // rather than re-solving.
  const people = participants.filter((p): p is Participant => !!p)
  const facilitators = people.filter(p => p.is_facilitator)
  const others = people.filter(p => !p.is_facilitator)

  // The selected person, when they sit at this table. The button appears in every
  // such table — lighting someone up in five places and making one actionable is
  // an inconsistency the user has to reverse-engineer.
  const selectedHere =
    selectedName !== null && people.some(p => p.name === selectedName) ? selectedName : null

  return (
    <div
      className={
        compact
          ? 'flex flex-col gap-1'
          : 'flex flex-col gap-1.5 rounded-md border bg-white p-3'
      }
    >
      {compact ? (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Table {tableNumber}
        </div>
      ) : (
      <div className="flex min-h-11 items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <div className="whitespace-nowrap text-base font-semibold">Table {tableNumber}</div>
          {/*
            Invisible until a person is selected, not present-and-disabled: an
            appearing control explains itself by appearing in response to the
            click just made.
          */}
          {selectedHere && onMarkAbsent && (
            <Button variant="outline" size="sm" onClick={() => onMarkAbsent(selectedHere)}>
              <UserMinus className="mr-1.5 h-3.5 w-3.5" />
              Mark {selectedHere} absent
            </Button>
          )}
        </div>
        <div className="whitespace-nowrap text-sm text-muted-foreground">
          {tableStats(people)}
        </div>
      </div>
      )}

      {compact ? (
        <div className="flex flex-wrap gap-1">
          {[...facilitators, ...others].map(p => (
            <Chip
              key={p.name}
              participant={p}
              selectedName={selectedName}
              onSelect={onSelect}
              focus={focus}
              compact
            />
          ))}
        </div>
      ) : (
        <>
      {facilitators.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-amber-800">
            Facilitators
          </span>
          <div className="flex flex-wrap gap-1.5">
            {facilitators.map(p => (
              <Chip
                key={p.name}
                participant={p}
                selectedName={selectedName}
                onSelect={onSelect}
                focus={focus}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-[5px]">
        {others.map(p => (
          <Chip
                key={p.name}
                participant={p}
                selectedName={selectedName}
                onSelect={onSelect}
                focus={focus}
              />
        ))}
      </div>
        </>
      )}
    </div>
  )
}

export default TableBlock
