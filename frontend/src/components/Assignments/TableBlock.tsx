import React from 'react'
import Chip from './Chip'
import type { Participant } from '@/types/assignments'

interface TableBlockProps {
  tableNumber: number
  participants: (Participant | null)[]
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

const TableBlock: React.FC<TableBlockProps> = ({ tableNumber, participants }) => {
  // Empty seats are stored as null, and Item 4b's mark-absent deliberately
  // leaves the gap rather than re-solving.
  const people = participants.filter((p): p is Participant => !!p)
  const facilitators = people.filter(p => p.is_facilitator)
  const others = people.filter(p => !p.is_facilitator)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[26px] items-center justify-between border-b pb-1">
        <div className="text-[13px] font-semibold">Table {tableNumber}</div>
        {/*
          The right-hand slot. Item 4b's contextual "Mark [person] absent" button
          takes this space when a person is selected, replacing the stats rather
          than sitting beside them — the row is too tight for both.
        */}
        <div className="text-xs text-muted-foreground">{tableStats(people)}</div>
      </div>

      {facilitators.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Facilitators
          </span>
          <div className="flex flex-wrap gap-1.5">
            {facilitators.map(p => (
              <Chip key={p.name} participant={p} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-[5px]">
        {others.map(p => (
          <Chip key={p.name} participant={p} />
        ))}
      </div>
    </div>
  )
}

export default TableBlock
