/**
 * Utility functions for formatting timestamps and dates.
 */

/**
 * Format a timestamp as "X time ago" (e.g., "5 min ago", "2 hours ago").
 *
 * @param input - Either an ISO string or Unix timestamp (seconds)
 * @returns Formatted string like "just now", "5 min ago", "2 hours ago", etc.
 */
export const formatTimeAgo = (input: string | number): string => {
  const date = typeof input === 'string'
    ? new Date(input)
    : new Date(input * 1000) // Convert Unix timestamp to milliseconds

  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`

  // For older dates (7+ days), show the actual date/time
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

/**
 * Format an ISO string as "X time ago".
 *
 * @param isoString - ISO 8601 date string
 * @returns Formatted string like "just now", "5 min ago", etc.
 */
export const formatISOTimeAgo = (isoString: string): string => {
  return formatTimeAgo(isoString)
}

/**
 * Format a Unix timestamp (seconds) as "X time ago".
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted string like "just now", "5 min ago", etc.
 */
export const formatUnixTimeAgo = (timestamp: number): string => {
  return formatTimeAgo(timestamp)
}
