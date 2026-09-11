import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Link as LinkIcon, Printer } from 'lucide-react'

interface ProgramHeaderProps {
  programName: string
  onPrintRoster?: () => void
  onCopyLink?: () => void
  /** The History control, supplied by the page that owns the version list. */
  history?: React.ReactNode
}

const ProgramHeader: React.FC<ProgramHeaderProps> = ({
  programName,
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
        Print roster &amp; seating charts
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
            ? 'sticky top-0 z-10 flex h-14 items-center justify-between gap-6 border-b bg-white px-8'
            : 'flex items-start justify-between gap-6 px-8 pb-3 pt-6'
        }
      >
        {condensed ? (
          <div className="text-[17px] font-bold">{programName}</div>
        ) : (
          <h1 className="text-3xl font-bold tracking-tight">{programName}</h1>
        )}
        {actions}
      </div>
    </>
  )
}

export default ProgramHeader
