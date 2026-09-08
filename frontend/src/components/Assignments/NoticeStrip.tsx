import React from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export interface Notice {
  tone: 'info' | 'error'
  message: string
  actions?: { label: string; onClick: () => void }[]
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
 * container changes. It renders only when there is something to say.
 */
const NoticeStrip: React.FC<NoticeStripProps> = ({ notice, onDismiss }) => {
  if (!notice) return null

  const isError = notice.tone === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-center justify-between gap-4 rounded-lg border border-black px-4 py-3 ${
        isError ? 'bg-red-50' : 'bg-[#f0fdf4]'
      }`}
    >
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
    </div>
  )
}

export default NoticeStrip
