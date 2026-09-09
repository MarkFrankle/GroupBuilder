import React from 'react'
import type { Participant } from '@/types/assignments'

/**
 * Religion palette, taken from the design mock (`.design/build.py`).
 *
 * Chips are religion-coloured unconditionally. Switching what they are *about*
 * — religion, gender, couples — is Item 12, and lands with the control that
 * drives it rather than here.
 */
const RELIGION_COLORS: Record<string, { bg: string; fg: string }> = {
  Jewish: { bg: '#D6F0FB', fg: '#005F83' },
  Christian: { bg: '#FDE2E2', fg: '#8B1A1A' },
  Muslim: { bg: '#E2F2DA', fg: '#3D6625' },
  Other: { bg: '#FEF0D8', fg: '#7A5410' },
}

interface ChipProps {
  participant: Participant
  /** The person selected page-wide, or null. Everyone else dims. */
  selectedName: string | null
  onSelect: (name: string) => void
}

const Chip: React.FC<ChipProps> = ({ participant, selectedName, onSelect }) => {
  const isFacilitator = !!participant.is_facilitator
  const { bg, fg } = RELIGION_COLORS[participant.religion] ?? RELIGION_COLORS.Other
  const title = isFacilitator ? `${participant.name} · Facilitator` : participant.name

  // Colour is spoken for by religion and the amber ring by facilitators, so
  // opacity is the only channel left to say "not this person".
  const dimmed = selectedName !== null && selectedName !== participant.name

  const shape = isFacilitator
    ? 'rounded px-2.5 py-[5px] text-[13px] font-semibold ring-1 ring-amber-400'
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
      className={`${shape} text-left transition-opacity ${dimmed ? 'opacity-30' : ''}`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {participant.name}
    </button>
  )
}

export default Chip
