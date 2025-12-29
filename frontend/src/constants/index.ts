/**
 * Application-wide constants.
 */

// Time constants (in seconds)
export const ONE_HOUR_SECONDS = 3600
export const ONE_DAY_SECONDS = 86400  // 24 * 3600
export const THIRTY_DAYS_SECONDS = 2592000  // 30 * 24 * 3600

// Session and result TTLs
export const SESSION_TTL_HOURS = 1
export const RESULTS_TTL_DAYS = 30

// Upload limits
export const MAX_TABLES = 10
export const MIN_TABLES = 1
export const MAX_SESSIONS = 6
export const MIN_SESSIONS = 1
export const MAX_PARTICIPANTS = 200

// Storage limits
export const MAX_RECENT_UPLOADS = 10

// Solver configuration
export const DEFAULT_SOLVER_TIMEOUT_SECONDS = 120  // 2 minutes
export const ESTIMATED_SOLVE_TIME_MINUTES = 2

// UI Text
export const SESSION_EXPIRY_MESSAGE = 'available for 1 hour'
export const RESULTS_EXPIRY_MESSAGE = 'bookmarkable for 30 days'
