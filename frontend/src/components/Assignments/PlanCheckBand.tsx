import React from 'react'
import { CheckCircle2, AlertTriangle, Info, HelpCircle } from 'lucide-react'
import type { PlanCheckResult } from '@/utils/planCheck'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PlanCheckBandProps {
  result: PlanCheckResult
}

/**
 * The overview's verdict band: a headline plus a plain-language checklist that
 * lets a coordinator stop scrutinising the page and print. Every line is
 * yes/no; the only number shown is a worst-case fact when a soft signal is past
 * its floor. Presentational — all logic, including every floor and cap, lives
 * in `planCheck.ts`'s `checkPlan()`.
 */

function timesWord(n: number): string {
  if (n === 1) return 'once'
  if (n === 2) return 'twice'
  const word =
    n === 3 ? 'three' : n === 4 ? 'four' : n === 5 ? 'five' : n === 6 ? 'six' : String(n)
  return `${word} times`
}

function pairRepeatNote(max: number): string {
  return `At least one pair sits together ${timesWord(max)}`
}

function tableOverlapNote(max: number): string {
  const people = max === 1 ? 'person' : 'people'
  return `At least two tables share ${max} ${people}`
}

const CheckLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2">
    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
    <span>{children}</span>
  </li>
)

const ProblemLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2 font-medium">
    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
    <span className="sr-only">Needs attention: </span>
    <span>{children}</span>
  </li>
)

/** The (?) next to a worst-case note — hover or focus to see who, named, one per line. */
const RepeatWorstDetail: React.FC<{ label: string; lines: string[] }> = ({ label, lines }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
          aria-label={label}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="start">
        <ul className="space-y-0.5">
          {lines.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const NoteLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2 text-muted-foreground">
    <span className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </li>
)

const HEADLINE: Record<PlanCheckResult['verdict'], string> = {
  ok: 'Looks good — ready to print and hand out',
  lessThanIdeal: 'Good enough to print, but not ideal',
  attention: '', // computed below — singular/plural depends on violation count
}

const BAND_STYLES: Record<PlanCheckResult['verdict'], string> = {
  ok: 'border-green-200 bg-[#f0fdf4]',
  lessThanIdeal: 'border-slate-200 bg-slate-50',
  attention: 'border-amber-200 bg-amber-50',
}

const VerdictIcon: React.FC<{ verdict: PlanCheckResult['verdict'] }> = ({ verdict }) => {
  if (verdict === 'ok') {
    return <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-green-600" aria-hidden="true" />
  }
  if (verdict === 'lessThanIdeal') {
    return <Info className="h-6 w-6 flex-shrink-0 text-slate-500" aria-hidden="true" />
  }
  return <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-600" aria-hidden="true" />
}

const PlanCheckBand: React.FC<PlanCheckBandProps> = ({ result }) => {
  const { verdict, violations, incompleteSessionCount, reassurances: r } = result
  const multiSession = incompleteSessionCount >= 2
  const overlapCap = r.tableOverlapCap

  const headline =
    verdict === 'attention'
      ? violations.length === 1
        ? 'One thing to check before you print'
        : 'A few things to check before you print'
      : HEADLINE[verdict]

  return (
    <section
      data-testid="plan-check-band"
      aria-label="Plan check"
      className={`rounded-lg border p-4 ${BAND_STYLES[verdict]}`}
    >
      <div className="flex items-center gap-2.5">
        <VerdictIcon verdict={verdict} />
        <h2 className="text-2xl font-bold">{headline}</h2>
      </div>

      <ul className="mt-3 space-y-1.5 text-base">
        {violations.map(v => (
          <ProblemLine key={`${v.kind}-${v.session}-${v.table ?? ''}`}>{v.message}</ProblemLine>
        ))}

        {r.couplesSeparated === true && <CheckLine>All couples are seated apart</CheckLine>}
        {r.keepApartHonored === true && (
          <CheckLine>Everyone you asked to keep apart is kept apart</CheckLine>
        )}
        {r.facilitatorCoverage === true && (
          <CheckLine>Every table has a facilitator, every session</CheckLine>
        )}
        {r.balanceEven && (
          <CheckLine>Faiths and genders are mixed as evenly as this roster allows</CheckLine>
        )}

        {multiSession && r.maxPairRepeat <= r.pairRepeatFloor && (
          <CheckLine>{`No one sits with the same person more than ${timesWord(r.pairRepeatFloor)}`}</CheckLine>
        )}
        {multiSession && r.maxPairRepeat > r.pairRepeatFloor && (
          <NoteLine>
            {pairRepeatNote(r.maxPairRepeat)}
            {r.pairRepeatWorst.length > 0 && (
              <RepeatWorstDetail
                label="Who sits together repeatedly"
                lines={r.pairRepeatWorst.map(
                  w => `${w.names[0]} & ${w.names[1]} — ${w.count} sessions together`
                )}
              />
            )}
          </NoteLine>
        )}

        {multiSession && overlapCap != null && r.maxTableOverlap <= overlapCap && (
          <CheckLine>{`No two tables share more than ${overlapCap} ${
            overlapCap === 1 ? 'person' : 'people'
          }`}</CheckLine>
        )}
        {multiSession && overlapCap != null && r.maxTableOverlap > overlapCap && (
          <NoteLine>
            {tableOverlapNote(r.maxTableOverlap)}
            {r.tableOverlapWorst.length > 0 && (
              <RepeatWorstDetail
                label="Which tables overlap"
                lines={r.tableOverlapWorst.map(
                  w =>
                    `Session ${w.sessions[0]} Table ${w.tables[0]} & Session ${w.sessions[1]} Table ${w.tables[1]}`
                )}
              />
            )}
          </NoteLine>
        )}

        {multiSession && r.maxFacilitatorRepeat > 0 && r.maxFacilitatorRepeat <= r.facilitatorRepeatFloor && (
          <CheckLine>Everyone sees a variety of facilitators</CheckLine>
        )}
        {multiSession && r.maxFacilitatorRepeat > r.facilitatorRepeatFloor && (
          <NoteLine>
            {`At least one person has the same facilitator ${r.maxFacilitatorRepeat} of ${incompleteSessionCount} sessions`}
            {r.facilitatorRepeatWorst.length > 0 && (
              <RepeatWorstDetail
                label="Who has the repeat facilitator"
                lines={r.facilitatorRepeatWorst.map(
                  w => `Facilitator ${w.facilitator} sits with ${w.participant} ${w.count} times`
                )}
              />
            )}
          </NoteLine>
        )}
      </ul>
    </section>
  )
}

export default PlanCheckBand
