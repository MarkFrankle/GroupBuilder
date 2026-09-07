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
}

const Chip: React.FC<ChipProps> = ({ participant }) => {
  const isFacilitator = !!participant.is_facilitator
  const { bg, fg } = RELIGION_COLORS[participant.religion] ?? RELIGION_COLORS.Other

  return (
    <span
      title={isFacilitator ? `${participant.name} · Facilitator` : participant.name}
      className={
        isFacilitator
          ? 'rounded px-2.5 py-[5px] text-[13px] font-semibold ring-1 ring-amber-400'
          : 'rounded px-2 py-1 text-xs font-medium'
      }
      style={{ backgroundColor: bg, color: fg }}
    >
      {participant.name}
    </span>
  )
}

export default Chip
