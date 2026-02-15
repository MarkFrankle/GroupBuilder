import { Religion } from '@/types/roster'

// Standard Building Bridges Together brand colors
export const BBT_COLORS = {
  Jewish:    { base: '#009EDB', bg: '#D6F0FB', text: '#005F83' },
  Christian: { base: '#E9282B', bg: '#FDE2E2', text: '#8B1A1A' },
  Muslim:    { base: '#64AA3E', bg: '#E2F2DA', text: '#3D6625' },
  Other:     { base: '#FBAF40', bg: '#FEF0D8', text: '#7A5410' },
} as const

// Shade variants per religion — name hash selects which variant
export const BBT_SHADE_VARIANTS: Record<Religion, { bg: string; text: string }[]> = {
  Jewish: [
    { bg: '#D6F0FB', text: '#005F83' },
    { bg: '#B0E0F6', text: '#005F83' },
    { bg: '#8AD0F1', text: '#004A66' },
    { bg: '#CCE8F4', text: '#005F83' },
  ],
  Christian: [
    { bg: '#FDE2E2', text: '#8B1A1A' },
    { bg: '#F9C4C4', text: '#8B1A1A' },
    { bg: '#F5A6A7', text: '#6B1414' },
    { bg: '#FCDADA', text: '#8B1A1A' },
  ],
  Muslim: [
    { bg: '#E2F2DA', text: '#3D6625' },
    { bg: '#C6E5B8', text: '#3D6625' },
    { bg: '#AAD896', text: '#2E4D1C' },
    { bg: '#D8EDCF', text: '#3D6625' },
  ],
  Other: [
    { bg: '#FEF0D8', text: '#7A5410' },
    { bg: '#FDE1B1', text: '#7A5410' },
    { bg: '#FCD28A', text: '#5C3F0C' },
    { bg: '#FDE9C5', text: '#7A5410' },
  ],
}

// djb2 hash — same algorithm as the old getPersonColor
function hashName(name: string): number {
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i)
  }
  return Math.abs(hash)
}

/**
 * Get religion-based color style for a participant.
 * Uses inline styles since BBT colors are custom hex values.
 *
 * When `varied` is true (default), the name hash picks a shade variant
 * within the religion's color family. When false, uses the flat base shade.
 */
export function getReligionStyle(
  religion: string,
  name: string,
  varied: boolean = true
): { backgroundColor: string; color: string } {
  const religionKey = (religion in BBT_SHADE_VARIANTS ? religion : 'Other') as Religion

  if (!varied) {
    const base = BBT_COLORS[religionKey]
    return { backgroundColor: base.bg, color: base.text }
  }

  const variants = BBT_SHADE_VARIANTS[religionKey]
  const index = hashName(name) % variants.length
  return { backgroundColor: variants[index].bg, color: variants[index].text }
}
