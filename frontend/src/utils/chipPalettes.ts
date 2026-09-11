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
  Jewish: { bg: '#D3E4F5', fg: '#123A5E' },
  Christian: { bg: '#F7DDCE', fg: '#7A2E0C' },
  Muslim: { bg: '#D3E9D6', fg: '#14532D' },
  Other: { bg: '#F5E7C4', fg: '#5C4409' },
}

export const GENDER_COLORS: Record<string, Swatch> = {
  Female: { bg: '#FBD5E6', fg: '#9A2159' },
  Male: { bg: '#CFE0F7', fg: '#1E4E8C' },
  Other: { bg: '#E4E4E4', fg: '#333333' },
}

/** Neutral chip for a person with no partner, in couples focus. */
export const NO_COUPLE: Swatch = { bg: '#E4E4E4', fg: '#333333' }

/**
 * Colours cycled across couples. They carry no meaning beyond "these two chips
 * are partners" — unrelated couples may collide, which is fine: you scan a
 * table locally and the names disambiguate.
 */
export const COUPLE_PALETTE: Swatch[] = [
  { bg: '#D3E4F5', fg: '#123A5E' },
  { bg: '#F7DDCE', fg: '#7A2E0C' },
  { bg: '#D3E9D6', fg: '#14532D' },
  { bg: '#ECD9E9', fg: '#6A2151' },
  { bg: '#F5E7C4', fg: '#5C4409' },
  { bg: '#CFE8E4', fg: '#0F4D46' },
  { bg: '#F6D9E1', fg: '#7A2141' },
  { bg: '#DCDDF0', fg: '#2E2F63' },
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

/**
 * Assign each couple in the plan its own palette slot, round-robin in a stable
 * order (couples sorted by their canonical key). With up to COUPLE_PALETTE.length
 * couples this guarantees no two distinct couples share a colour; beyond that the
 * palette wraps and far-apart couples may collide — acceptable, names disambiguate.
 *
 * Hashing each pair independently (paletteSlot) collided far too often — the
 * birthday paradox put two unrelated couples on the same colour at the *same
 * table*, which is exactly the confusion the colour is meant to prevent.
 */
export function buildCoupleSlots(
  participants: Array<{ name: string; partner: string | null }>
): Map<string, number> {
  const keys = new Set<string>()
  for (const p of participants) {
    if (p.partner) keys.add(canonicalPairKey(p.name, p.partner))
  }
  const slots = new Map<string, number>()
  Array.from(keys)
    .sort()
    .forEach((key, i) => slots.set(key, i % COUPLE_PALETTE.length))
  return slots
}

interface Colourable {
  religion: string
  gender: string
  name: string
  partner: string | null
}

export function chipSwatch(
  focus: AttributeFocus,
  participant: Colourable,
  coupleSlots?: Map<string, number>
): Swatch {
  if (focus === 'gender') {
    return GENDER_COLORS[participant.gender] ?? GENDER_COLORS.Other
  }
  if (focus === 'couples') {
    if (!participant.partner) return NO_COUPLE
    const key = canonicalPairKey(participant.name, participant.partner)
    const slot = coupleSlots?.get(key) ?? paletteSlot(key)
    return COUPLE_PALETTE[slot]
  }
  return RELIGION_COLORS[participant.religion] ?? RELIGION_COLORS.Other
}
