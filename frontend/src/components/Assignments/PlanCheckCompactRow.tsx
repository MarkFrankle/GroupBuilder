import React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { TABLE_OVERLAP_ALERT_SLACK, type PlanCheckResult } from '@/utils/planCheck'
import { DetailList } from './PlanCheckBand'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PlanCheckCompactRowProps {
  result: PlanCheckResult
}

function timesWord(n: number): string {
  if (n === 1) return 'once'
  if (n === 2) return 'twice'
  const word =
    n === 3 ? 'three' : n === 4 ? 'four' : n === 5 ? 'five' : n === 6 ? 'six' : String(n)
  return `${word} times`
}

/**
 * One badge in the row: an icon, a short label, and a tooltip on the badge
 * itself (not a separate "?" glyph) - hovering or focusing anywhere on the
 * badge shows the detail, whether that's a reassurance sentence for a clean
 * check or a worst-case breakdown for a flagged one. Every badge gets this,
 * green or not, so a clean check doesn't look inert next to a flagged one.
 */
const Badge: React.FC<{
  icon: React.ReactNode
  label: string
  ariaLabel?: string
  lines: string[]
  groupKeys?: Array<string | number>
  header?: string
  emphasize?: boolean
}> = ({ icon, label, ariaLabel, lines, groupKeys, header, emphasize }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? label}
          className={`flex items-center gap-1 ${emphasize ? 'font-medium' : ''}`}
        >
          {icon}
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        <DetailList lines={lines} groupKeys={groupKeys} header={header} />
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const okIcon = <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600" aria-hidden="true" />
/** Same shape as okIcon, muted rather than green - used only within
 *  TABLE_OVERLAP_ALERT_SLACK of the floor, where the gap is expected roster
 *  noise rather than something to fix, but still worth a status icon rather
 *  than none (a bare label next to four checkmarks reads as a rendering gap,
 *  not a deliberate calmer state). */
const mildIcon = (
  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
)
const warnIcon = (
  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" aria-hidden="true" />
)

/**
 * A one-line, always-visible summary of PlanCheckBand's checklist, meant to
 * stay in view (in the sticky header) while a coordinator scrolls down to
 * shuffle a session — so they don't have to scroll back up to see whether it
 * helped. Reads the same PlanCheckResult PlanCheckBand does; adds no new
 * computation of its own.
 *
 * Every badge is hoverable, green or not - a green badge's tooltip states the
 * reassurance in full sentence form (PlanCheckBand's own CheckLine copy),
 * rather than only warning states getting an affordance and green ones
 * looking inert by comparison.
 *
 * Deliberately excludes the hard-rule violations that drive the 'attention'
 * verdict for couples/keep-apart/facilitator-coverage/balance as individual
 * badges - collapsed instead into one "N issues" badge, since those are
 * table-level breaks a planned table-flagging feature will surface at the
 * table itself.
 */
const PlanCheckCompactRow: React.FC<PlanCheckCompactRowProps> = ({ result }) => {
  const { violations, incompleteSessionCount, reassurances: r } = result
  const multiSession = incompleteSessionCount >= 2
  const overlapCap = r.tableOverlapCap

  return (
    <div
      data-testid="plan-check-compact-row"
      aria-label="Mix quality summary"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-sm text-muted-foreground"
    >
      {violations.length > 0 && (
        <Badge
          icon={warnIcon}
          label={`${violations.length} ${violations.length === 1 ? 'issue' : 'issues'}`}
          ariaLabel="What needs attention"
          lines={violations.map(v => v.message)}
          emphasize
        />
      )}

      {r.facilitatorCoverage === true && (
        <Badge
          icon={okIcon}
          label="Facilitator coverage"
          lines={['Every table has a facilitator, every session']}
        />
      )}

      {r.balanceEven && (
        <Badge
          icon={okIcon}
          label="Balance"
          lines={['Faiths and genders are mixed as evenly as this roster allows']}
        />
      )}

      {multiSession &&
        (r.maxPairRepeat <= r.pairRepeatFloor ? (
          <Badge
            icon={okIcon}
            label="Repeats"
            lines={[`No one sits with the same person more than ${timesWord(r.pairRepeatFloor)}`]}
          />
        ) : (
          <Badge
            icon={warnIcon}
            label={`Repeats ${timesWord(r.maxPairRepeat)}`}
            ariaLabel="Who sits together repeatedly"
            lines={r.pairRepeatWorst.map(
              w => `${w.names[0]} & ${w.names[1]} — ${w.count} sessions together`
            )}
            emphasize
          />
        ))}

      {multiSession &&
        overlapCap != null &&
        (() => {
          const overlapLines = r.tableOverlapWorst.map(
            w =>
              `Session ${w.sessions[0]} Table ${w.tables[0]} & Session ${w.sessions[1]} Table ${w.tables[1]}`
          )
          const overlapGroupKeys = r.tableOverlapWorst.map(w => w.sessions[0])
          const overlapHeader = `${r.maxTableOverlap} ${
            r.maxTableOverlap === 1 ? 'person' : 'people'
          } shared`

          if (r.maxTableOverlap <= overlapCap) {
            return (
              <Badge
                icon={okIcon}
                label="Overlap"
                lines={[
                  `No two tables share more than ${overlapCap} ${
                    overlapCap === 1 ? 'person' : 'people'
                  }`,
                ]}
              />
            )
          }
          if (r.maxTableOverlap <= overlapCap + TABLE_OVERLAP_ALERT_SLACK) {
            return (
              <Badge
                icon={mildIcon}
                label="Overlap"
                ariaLabel="Which tables overlap"
                header={overlapHeader}
                lines={overlapLines}
                groupKeys={overlapGroupKeys}
              />
            )
          }
          return (
            <Badge
              icon={warnIcon}
              label="Overlap"
              ariaLabel="Which tables overlap"
              header={overlapHeader}
              lines={overlapLines}
              groupKeys={overlapGroupKeys}
              emphasize
            />
          )
        })()}

      {multiSession &&
        r.maxFacilitatorRepeat > 0 &&
        (r.maxFacilitatorRepeat <= r.facilitatorRepeatFloor ? (
          <Badge
            icon={okIcon}
            label="Facilitator variety"
            lines={['Everyone sees a variety of facilitators']}
          />
        ) : (
          <Badge
            icon={warnIcon}
            label={`Same facilitator ${timesWord(r.maxFacilitatorRepeat)}`}
            ariaLabel="Who has the repeat facilitator"
            lines={r.facilitatorRepeatWorst.map(
              w => `Facilitator ${w.facilitator} sits with ${w.participant} ${w.count} times`
            )}
            emphasize
          />
        ))}
    </div>
  )
}

export default PlanCheckCompactRow
