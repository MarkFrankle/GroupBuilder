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

/**
 * Every chip in couples focus, partnered or not. Couples are told apart by a
 * numbered badge (see `buildCoupleNumbers`), not by colour. Colour-matching
 * across a crowded screen was hard to scan and not colourblind-safe.
 */
export const NO_COUPLE: Swatch = { bg: '#E4E4E4', fg: '#333333' }

/** Order-independent key for a couple. */
export function canonicalPairKey(a: string, b: string): string {
  return [a, b].sort().join('  ')
}

/**
 * Assign each couple in the plan a stable, 1-indexed number, in a stable order
 * (couples sorted by their canonical key). Both partners share the same number;
 * numbers have no ceiling, unlike the old colour palette, since there's no visual
 * collision risk to worry about.
 */
export function buildCoupleNumbers(
  participants: Array<{ name: string; partner: string | null }>
): Map<string, number> {
  const keys = new Set<string>()
  for (const p of participants) {
    if (p.partner) keys.add(canonicalPairKey(p.name, p.partner))
  }
  const numbers = new Map<string, number>()
  Array.from(keys)
    .sort()
    .forEach((key, i) => numbers.set(key, i + 1))
  return numbers
}

/** Look up a couple's badge number, if one has been assigned. */
export function coupleNumber(
  a: string,
  b: string,
  numbers: Map<string, number>
): number | undefined {
  return numbers.get(canonicalPairKey(a, b))
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
    return NO_COUPLE
  }
  return RELIGION_COLORS[participant.religion] ?? RELIGION_COLORS.Other
}
