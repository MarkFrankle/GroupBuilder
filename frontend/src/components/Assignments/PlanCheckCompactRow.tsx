import React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { PlanCheckResult } from '@/utils/planCheck'
import { RepeatWorstDetail } from './PlanCheckBand'

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

const OkChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="flex items-center gap-1">
    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600" aria-hidden="true" />
    {children}
  </span>
)

const WarnChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="flex items-center gap-1 font-medium">
    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" aria-hidden="true" />
    {children}
  </span>
)

/**
 * A one-line, always-visible summary of PlanCheckBand's checklist, meant to
 * stay in view (in the sticky header) while a coordinator scrolls down to
 * shuffle a session — so they don't have to scroll back up to see whether it
 * helped. Reads the same PlanCheckResult PlanCheckBand does; adds no new
 * computation of its own.
 *
 * Deliberately excludes the hard-rule violations that drive the 'attention'
 * verdict for couples/keep-apart/facilitator-coverage/balance as individual
 * chips - collapsed instead into one "N issues" chip, since those are
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
        <WarnChip>
          {`${violations.length} ${violations.length === 1 ? 'issue' : 'issues'}`}
          <RepeatWorstDetail label="What needs attention" lines={violations.map(v => v.message)} />
        </WarnChip>
      )}

      {r.facilitatorCoverage === true && <OkChip>Facilitator coverage</OkChip>}
      {r.balanceEven && <OkChip>Balance</OkChip>}

      {multiSession &&
        (r.maxPairRepeat <= r.pairRepeatFloor ? (
          <OkChip>Repeats</OkChip>
        ) : (
          <WarnChip>
            {`Repeats ${timesWord(r.maxPairRepeat)}`}
            {r.pairRepeatWorst.length > 0 && (
              <RepeatWorstDetail
                label="Who sits together repeatedly"
                lines={r.pairRepeatWorst.map(
                  w => `${w.names[0]} & ${w.names[1]} — ${w.count} sessions together`
                )}
              />
            )}
          </WarnChip>
        ))}

      {multiSession &&
        overlapCap != null &&
        (r.maxTableOverlap <= overlapCap ? (
          <OkChip>Overlap</OkChip>
        ) : (
          <WarnChip>
            {`Overlap: ${r.maxTableOverlap} ${r.maxTableOverlap === 1 ? 'person' : 'people'}`}
            {r.tableOverlapWorst.length > 0 && (
              <RepeatWorstDetail
                label="Which tables overlap"
                lines={r.tableOverlapWorst.map(
                  w =>
                    `Session ${w.sessions[0]} Table ${w.tables[0]} & Session ${w.sessions[1]} Table ${w.tables[1]}`
                )}
                groupKeys={r.tableOverlapWorst.map(w => w.sessions[0])}
              />
            )}
          </WarnChip>
        ))}

      {multiSession &&
        r.maxFacilitatorRepeat > 0 &&
        (r.maxFacilitatorRepeat <= r.facilitatorRepeatFloor ? (
          <OkChip>Facilitator variety</OkChip>
        ) : (
          <WarnChip>
            {`Same facilitator ${timesWord(r.maxFacilitatorRepeat)}`}
            {r.facilitatorRepeatWorst.length > 0 && (
              <RepeatWorstDetail
                label="Who has the repeat facilitator"
                lines={r.facilitatorRepeatWorst.map(
                  w => `Facilitator ${w.facilitator} sits with ${w.participant} ${w.count} times`
                )}
              />
            )}
          </WarnChip>
        ))}
    </div>
  )
}

export default PlanCheckCompactRow
