import React from 'react'
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react'
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
 * its floor. Presentational — all logic lives in `planCheck.ts`.
 */
const REPEAT_FLOOR = 2

function pairRepeatNote(max: number): string {
  const word =
    max === 3 ? 'three' : max === 4 ? 'four' : max === 5 ? 'five' : max === 6 ? 'six' : String(max)
  return `At least one pair sits together ${word} times`
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

const PlanCheckBand: React.FC<PlanCheckBandProps> = ({ result }) => {
  const { verdict, violations, incompleteSessionCount, reassurances: r } = result
  const ok = verdict === 'ok'
  const multiSession = incompleteSessionCount >= 2

  const headline = ok
    ? 'Looks good — ready to print and hand out'
    : violations.length === 1
    ? 'One thing to check before you print'
    : 'A few things to check before you print'

  return (
    <section
      data-testid="plan-check-band"
      aria-label="Plan check"
      className={`rounded-lg border p-4 ${
        ok ? 'border-green-200 bg-[#f0fdf4]' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {ok ? (
          <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-green-600" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-600" aria-hidden="true" />
        )}
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

        {multiSession && r.maxPairRepeat <= REPEAT_FLOOR && (
          <CheckLine>No one sits with the same person more than twice</CheckLine>
        )}
        {multiSession && r.maxPairRepeat > REPEAT_FLOOR && (
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

        {multiSession && r.maxFacilitatorRepeat > 0 && r.maxFacilitatorRepeat <= REPEAT_FLOOR && (
          <CheckLine>Everyone sees a variety of facilitators</CheckLine>
        )}
        {multiSession && r.maxFacilitatorRepeat > REPEAT_FLOOR && (
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
