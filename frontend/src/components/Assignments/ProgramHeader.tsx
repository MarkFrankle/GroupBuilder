import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Link as LinkIcon, Printer } from 'lucide-react'

export interface ProgramFacts {
  participants: number
  tables: number
  sessions: number
  uniqueTablemates: number
}

interface ProgramHeaderProps {
  programName: string
  facts: ProgramFacts
  /**
   * Linked partnerships. Keep-apart has no data model until item 9, so the
   * rules line names only what exists — a "no keep-apart rules" placeholder
   * would describe a feature the app does not have.
   */
  linkedPairs: number
  onPrintRoster?: () => void
  onCopyLink?: () => void
  /** The History control, supplied by the page that owns the version list. */
  history?: React.ReactNode
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function factsLine(facts: ProgramFacts): string {
  return [
    plural(facts.participants, 'participant'),
    plural(facts.tables, 'table'),
    plural(facts.sessions, 'session'),
    `avg ${facts.uniqueTablemates} unique tablemates`,
  ].join(' · ')
}

const ProgramHeader: React.FC<ProgramHeaderProps> = ({
  programName,
  facts,
  linkedPairs,
  onPrintRoster,
  onCopyLink,
  history,
}) => {
  const sentinel = useRef<HTMLDivElement | null>(null)
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(entries => {
      setCondensed(!entries[0].isIntersecting)
    })
    if (sentinel.current) observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [])

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrintRoster}>
        <Printer className="mr-1.5 h-3.5 w-3.5" />
        Print Roster
      </Button>
      <Button variant="outline" size="sm" onClick={onCopyLink}>
        <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
        Copy Link
      </Button>
      {history}
    </div>
  )

  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      <div
        data-testid="program-header"
        className={
          condensed
            ? 'sticky top-0 z-10 flex items-center justify-between gap-6 border-b bg-white px-8 py-2.5'
            : 'flex items-start justify-between gap-6 px-8 pb-3 pt-6'
        }
      >
        {condensed ? (
          <div className="flex items-baseline gap-3.5">
            <div className="text-[17px] font-bold">{programName}</div>
            <div className="text-[13px] text-muted-foreground">{factsLine(facts)}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{programName}</h1>
            <div className="text-sm text-muted-foreground">{factsLine(facts)}</div>
            {linkedPairs > 0 && (
              <div className="text-[13px]">
                <span className="font-semibold">Rules</span>
                <span className="px-2 text-muted-foreground">·</span>
                <span>
                  {linkedPairs} linked {linkedPairs === 1 ? 'pair' : 'pairs'}
                </span>
              </div>
            )}
          </div>
        )}
        {actions}
      </div>
    </>
  )
}

export default ProgramHeader
