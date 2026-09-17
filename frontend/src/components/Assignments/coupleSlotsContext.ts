import { createContext, useContext } from 'react'

/**
 * Couple → badge-number map for the current plan, built once by AssignmentsPage
 * from every participant so each couple gets its own numbered badge (see
 * `buildCoupleNumbers`). Chip reads it here rather than having it threaded through
 * SessionCard and TableBlock alongside `focus`. Undefined outside the provider —
 * Chip then falls back to per-pair hashing.
 */
export const CoupleSlotsContext = createContext<Map<string, number> | undefined>(undefined)

export const useCoupleSlots = () => useContext(CoupleSlotsContext)
