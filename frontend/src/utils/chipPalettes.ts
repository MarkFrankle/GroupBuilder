/**
 * Chip colour palettes, one per attribute focus (Item 12).
 *
 * Religion is the app's original palette and the default focus. Gender is the
 * one alternate lens the view-controls switch offers.
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

interface Colourable {
  religion: string
  gender: string
}

export function chipSwatch(focus: AttributeFocus, participant: Colourable): Swatch {
  if (focus === 'gender') {
    return GENDER_COLORS[participant.gender] ?? GENDER_COLORS.Other
  }
  return RELIGION_COLORS[participant.religion] ?? RELIGION_COLORS.Other
}
