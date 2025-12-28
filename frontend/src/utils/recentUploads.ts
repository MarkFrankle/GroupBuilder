/**
 * Utility for managing recent uploads in localStorage
 */

const STORAGE_KEY = 'groupbuilder_recent_uploads'
const MAX_RECENT_UPLOADS = 10

export interface RecentUpload {
  session_id: string
  filename: string
  num_participants: number
  num_tables: number
  num_sessions: number
  created_at: string
}

/**
 * Save a session ID to recent uploads
 */
export const saveRecentUpload = (sessionId: string): void => {
  try {
    const existing = getRecentUploadIds()

    // Add to front of list, remove duplicates
    const updated = [sessionId, ...existing.filter(id => id !== sessionId)]

    // Keep only the most recent MAX_RECENT_UPLOADS
    const trimmed = updated.slice(0, MAX_RECENT_UPLOADS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (error) {
    console.error('Failed to save recent upload:', error)
  }
}

/**
 * Get list of recent upload session IDs
 */
export const getRecentUploadIds = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load recent uploads:', error)
    return []
  }
}

/**
 * Remove a session ID from recent uploads
 */
export const removeRecentUpload = (sessionId: string): void => {
  try {
    const existing = getRecentUploadIds()
    const filtered = existing.filter(id => id !== sessionId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to remove recent upload:', error)
  }
}

/**
 * Clear all recent uploads
 */
export const clearRecentUploads = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear recent uploads:', error)
  }
}
