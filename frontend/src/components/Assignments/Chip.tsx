import React from 'react'
import { Link2 } from 'lucide-react'
import { chipSwatch } from '@/utils/chipPalettes'
import { useCoupleSlots } from './coupleSlotsContext'
import type { AttributeFocus, Participant } from '@/types/assignments'

interface ChipProps {
  participant: Participant
  /** The person selected page-wide, or null. Everyone else dims. */
  selectedName: string | null
  onSelect: (name: string) => void
  /**
   * What the chip is coloured about — religion, gender, or couples. Program-scoped,
   * set by the view-controls switch and threaded down the same path as
   * `selectedName`. Defaults to religion so the many leaf call sites need not pass it.
   */
  focus?: AttributeFocus
  /** Item 11 compact zoom — styling implemented in a later task. */
  compact?: boolean
}

const Chip: React.FC<ChipProps> = ({
  participant,
  selectedName,
  onSelect,
  focus = 'religion',
  compact = false,
}) => {
  const isFacilitator = !!participant.is_facilitator
  const coupleSlots = useCoupleSlots()
  const { bg, fg } = chipSwatch(focus, participant, coupleSlots)
  const partnered = focus === 'couples' && !!participant.partner

  const title = isFacilitator
    ? `${participant.name} · Facilitator`
    : partnered
      ? `${participant.name} · partner of ${participant.partner}`
      : participant.name

  // Colour is spoken for by the focus and the amber ring by facilitators, so
  // opacity is the only channel left to say "not this person".
  const dimmed = selectedName !== null && selectedName !== participant.name

  const shape = isFacilitator
    ? compact
      ? 'rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-amber-400'
      : 'rounded px-2.5 py-[5px] text-[13px] font-semibold ring-1 ring-amber-400'
    : compact
      ? 'rounded px-1.5 py-0.5 text-[11px] font-medium'
      : 'rounded px-2 py-1 text-xs font-medium'

  return (
    <button
      type="button"
      title={title}
      aria-pressed={selectedName === participant.name}
      onClick={event => {
        // The page clears selection on any click that is not a chip, so this
        // click must not reach it.
        event.stopPropagation()
        onSelect(participant.name)
      }}
      className={[
        shape,
        // `inline-flex` keeps the couples link icon on the baseline; `text-left`
        // undoes the button element's centring.
        'inline-flex items-center gap-1 cursor-pointer text-left transition-opacity',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1',
        dimmed && 'opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: bg, color: fg }}
    >
      {partnered && <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {participant.name}
      {isFacilitator && <span className="sr-only"> · Facilitator</span>}
    </button>
  )
}

export default Chip
