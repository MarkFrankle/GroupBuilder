import React from 'react'
import { GENDER_COLORS, RELIGION_COLORS } from '@/utils/chipPalettes'
import type { AttributeFocus, Participant, ZoomLevel } from '@/types/assignments'

interface ViewBarProps {
  focus: AttributeFocus
  onFocusChange: (focus: AttributeFocus) => void
  /** Every seated person, for deciding whether the gender "Other" swatch is needed. */
  participants: Participant[]
  /** Optional until Task 4 wires the AssignmentsPage call site; defaults to 'full'. */
  zoom?: ZoomLevel
  onZoomChange?: (zoom: ZoomLevel) => void
}

const OPTIONS: { value: AttributeFocus; label: string }[] = [
  { value: 'religion', label: 'Religion' },
  { value: 'gender', label: 'Gender' },
  { value: 'couples', label: 'Couples' },
]

const ZOOMS: { value: ZoomLevel; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'compact', label: 'Compact' },
]

/**
 * The view-controls row: the focus switch and its follow-along legend on the
 * left, the Full/Compact zoom toggle on the right. The page wraps this row in a
 * sticky container (Task 4) — that positioning is not this component's job.
 *
 * Not a Radix ToggleGroup: no such dependency is installed and Radix widgets are
 * awkward to drive in the Jest suite. Plain buttons in a `role="group"` read as
 * "pick one" well enough.
 */
const ViewBar: React.FC<ViewBarProps> = ({
  focus,
  onFocusChange,
  participants,
  zoom = 'full',
  onZoomChange = () => {},
}) => (
  <div className="flex items-center justify-between gap-4 py-1">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Colour chiclets by" className="inline-flex rounded-md border">
        {OPTIONS.map(({ value, label }, i) => (
          <button
            key={value}
            type="button"
            aria-pressed={focus === value}
            onClick={() => onFocusChange(value)}
            className={[
              'px-3 py-1 text-xs font-medium transition-colors',
              i > 0 && 'border-l',
              focus === value
                ? 'bg-slate-900 text-white'
                : 'bg-white text-muted-foreground hover:bg-slate-50',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <FocusLegend focus={focus} participants={participants} />
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">View</span>
      <div role="group" aria-label="Zoom level" className="inline-flex rounded-md border">
        {ZOOMS.map(({ value, label }, i) => (
          <button
            key={value}
            type="button"
            aria-pressed={zoom === value}
            onClick={() => onZoomChange(value)}
            className={[
              'px-3 py-1 text-xs font-medium transition-colors',
              i > 0 && 'border-l',
              zoom === value
                ? 'bg-slate-900 text-white'
                : 'bg-white text-muted-foreground hover:bg-slate-50',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  </div>
)

const LegendSwatch: React.FC<{ bg: string; label: string }> = ({ bg, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 rounded-sm"
      style={{ backgroundColor: bg }}
    />
    {label}
  </span>
)

const FocusLegend: React.FC<{ focus: AttributeFocus; participants: Participant[] }> = ({
  focus,
  participants,
}) => {
  // The couple colours mean only "these two match", so there is nothing to spell out.
  if (focus === 'couples') return null

  if (focus === 'gender') {
    const hasOther = participants.some(p => p.gender !== 'Female' && p.gender !== 'Male')
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="focus-legend">
        <LegendSwatch bg={GENDER_COLORS.Female.bg} label="Female" />
        <LegendSwatch bg={GENDER_COLORS.Male.bg} label="Male" />
        {hasOther && <LegendSwatch bg={GENDER_COLORS.Other.bg} label="Other" />}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="focus-legend">
      {(['Jewish', 'Christian', 'Muslim', 'Other'] as const).map(name => (
        <LegendSwatch key={name} bg={RELIGION_COLORS[name].bg} label={name} />
      ))}
    </div>
  )
}

export default ViewBar
