import React from 'react'
import { Button } from '@/components/ui/button'
import { UserMinus } from 'lucide-react'
import Chip from './Chip'
import type { Participant } from '@/types/assignments'

interface TableBlockProps {
  tableNumber: number
  participants: (Participant | null)[]
  /** The person selected page-wide, or null. Threaded to Chip. */
  selectedName: string | null
  onSelect: (name: string) => void
  /**
   * Absent when acting is not allowed here — a completed or read-only view.
   * A missing callback rather than a disabled button, matching how Shuffle and
   * Mark complete are suppressed.
   */
  onMarkAbsent?: (name: string) => void
}

/** "6 people · 4F/2M · 3 religions" — the mock's per-table line. */
function tableStats(people: Participant[]): string {
  const females = people.filter(p => p.gender?.[0]?.toUpperCase() === 'F').length
  const religions = new Set(people.map(p => p.religion)).size
  return (
    `${people.length} ${people.length === 1 ? 'person' : 'people'} · ` +
    `${females}F/${people.length - females}M · ` +
    `${religions} ${religions === 1 ? 'religion' : 'religions'}`
  )
}

const TableBlock: React.FC<TableBlockProps> = ({
  tableNumber,
  participants,
  selectedName,
  onSelect,
  onMarkAbsent,
}) => {
  // Empty seats are stored as null, and Item 4b's mark-absent deliberately
  // leaves the gap rather than re-solving.
  const people = participants.filter((p): p is Participant => !!p)
  const facilitators = people.filter(p => p.is_facilitator)
  const others = people.filter(p => !p.is_facilitator)

  // The button appears in every table where the selected person sits, each
  // scoped to its own session — lighting someone up in five places and making
  // one actionable is an inconsistency the user has to reverse-engineer.
  const selectedSitsHere =
    selectedName !== null && people.some(p => p.name === selectedName)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[26px] items-center justify-between border-b pb-1">
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-semibold">Table {tableNumber}</div>
          {/*
            The free left slot. An earlier design assumed this button would have
            to displace the stats on the right; this slot was empty the whole
            time, so the stats never move.

            Invisible until a person is selected, not present-and-disabled: an
            appearing control explains itself by appearing in response to the
            click just made.
          */}
          {selectedName !== null && selectedSitsHere && onMarkAbsent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkAbsent(selectedName)}
            >
              <UserMinus className="mr-1.5 h-3.5 w-3.5" />
              Mark {selectedName} absent
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{tableStats(people)}</div>
      </div>

      {facilitators.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Facilitators
          </span>
          <div className="flex flex-wrap gap-1.5">
            {facilitators.map(p => (
              <Chip key={p.name} participant={p} selectedName={selectedName} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-[5px]">
        {others.map(p => (
          <Chip key={p.name} participant={p} selectedName={selectedName} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

export default TableBlock
