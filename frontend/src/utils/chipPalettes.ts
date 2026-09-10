/**
 * Chip colour palettes, one per attribute focus (Item 12).
 *
 * Religion is the app's original palette and the default focus. Gender and
 * couples are the two alternate lenses the view-controls switch offers.
 */
import type { AttributeFocus } from '@/types/assignments'

export interface Swatch {
  bg: string
  fg: string
}

export const RELIGION_COLORS: Record<string, Swatch> = {
  Jewish: { bg: '#D6F0FB', fg: '#005F83' },
  Christian: { bg: '#FDE2E2', fg: '#8B1A1A' },
  Muslim: { bg: '#E2F2DA', fg: '#3D6625' },
  Other: { bg: '#FEF0D8', fg: '#7A5410' },
}

export const GENDER_COLORS: Record<string, Swatch> = {
  Female: { bg: '#F3E1F0', fg: '#7A2E6E' },
  Male: { bg: '#E1E9F5', fg: '#2E4A7A' },
  Other: { bg: '#ECECEC', fg: '#555555' },
}

/** Neutral chip for a person with no partner, in couples focus. */
export const NO_COUPLE: Swatch = { bg: '#ECECEC', fg: '#555555' }

/**
 * Colours cycled across couples. They carry no meaning beyond "these two chips
 * are partners" — unrelated couples may collide, which is fine: you scan a
 * table locally and the names disambiguate.
 */
export const COUPLE_PALETTE: Swatch[] = [
  { bg: '#D6F0FB', fg: '#005F83' },
  { bg: '#FDE2E2', fg: '#8B1A1A' },
  { bg: '#E2F2DA', fg: '#3D6625' },
  { bg: '#FEF0D8', fg: '#7A5410' },
  { bg: '#E7E2F7', fg: '#4B3B8F' },
  { bg: '#FCE3D3', fg: '#9A4A1E' },
  { bg: '#DDF1EC', fg: '#1F6B5C' },
  { bg: '#F1E1E9', fg: '#8F3B63' },
]

/** Order-independent key for a couple. */
export function canonicalPairKey(a: string, b: string): string {
  return [a, b].sort().join('  ')
}

/** Deterministic hash of a couple key into a COUPLE_PALETTE index. */
export function paletteSlot(pairKey: string): number {
  let hash = 0
  for (let i = 0; i < pairKey.length; i += 1) {
    hash = (hash * 31 + pairKey.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % COUPLE_PALETTE.length
}

interface Colourable {
  religion: string
  gender: string
  name: string
  partner: string | null
}

export function chipSwatch(focus: AttributeFocus, participant: Colourable): Swatch {
  if (focus === 'gender') {
    return GENDER_COLORS[participant.gender] ?? GENDER_COLORS.Other
  }
  if (focus === 'couples') {
    if (!participant.partner) return NO_COUPLE
    return COUPLE_PALETTE[paletteSlot(canonicalPairKey(participant.name, participant.partner))]
  }
  return RELIGION_COLORS[participant.religion] ?? RELIGION_COLORS.Other
}
