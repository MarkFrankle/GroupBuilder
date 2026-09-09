import React, { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export interface Notice {
  tone: 'info' | 'error'
  message: string
  actions?: { label: string; onClick: () => void }[]
  /**
   * Take focus when this notice appears. Set by the notices that follow an
   * edit, where the control the user just pressed unmounts — Mark absent
   * disappears with the selection, and the table picker's whole menu goes with
   * it — dropping focus to `<body>` with the Undo they were just handed
   * nowhere near it. Off by default, deliberately: the first-generate nudge and
   * the version banner appear without anyone pressing anything, and stealing
   * focus from a user who is reading would be worse than the problem.
   */
  focusOnAppear?: boolean
  /**
   * Run when this notice leaves the strip by any route — dismissed, acted on,
   * or displaced by the next one. The nudge uses it to record that it has been
   * seen, so being overruled by a receipt does not bring it back on reload.
   */
  onDismiss?: () => void
}

interface NoticeStripProps {
  notice: Notice | null
  onDismiss?: () => void
}

/**
 * The one strip above the session stack, with three tenants over time:
 *
 * - now: the shuffle receipt, and any refusal the API sends back
 * - item 7: the "viewing an older version" notice, carrying Promote
 * - item 3: the universal banner, carrying receipts and undo
 *
 * Built once so the wording and the delta logic do not get rewritten when the
 * container changes.
 *
 * The container is always mounted and only its contents swap — the same reason
 * AssignmentsPage keeps its selection region mounted and empty. A live region
 * that appears with its text already inside it is generally not announced at
 * all, and this is the channel every edit receipt and every Undo arrives on.
 * Empty, it is `sr-only`: out of flow, so it adds no gap to the stack below,
 * but still in the accessibility tree where an announcement needs it.
 */
const NoticeStrip: React.FC<NoticeStripProps> = ({ notice, onDismiss }) => {
  const isError = notice?.tone === 'error'
  const container = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (notice?.focusOnAppear) container.current?.focus()
  }, [notice])

  return (
    <div
      ref={container}
      // Focusable only as a target, never in the tab order: it is a place to
      // put focus after an edit, not a stop on the way through the page.
      tabIndex={-1}
      role={isError ? 'alert' : 'status'}
      // A page can hold more than one role="status" region — AssignmentsPage's
      // selection announcement is the other — so tests name this one directly.
      data-testid="notice-strip"
      className={
        notice
          ? `flex items-center justify-between gap-4 rounded-lg border border-black px-4 py-3 ${
              isError ? 'bg-red-50' : 'bg-[#f0fdf4]'
            }`
          : 'sr-only'
      }
    >
      {notice && (
        <>
          <div className="text-sm font-medium">{notice.message}</div>
          <div className="flex items-center gap-2">
            {notice.actions?.map(action => (
              <Button key={action.label} variant="outline" size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
            {onDismiss && (
              <Button variant="outline" size="sm" aria-label="Dismiss" onClick={onDismiss}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default NoticeStrip
