/**
 * Given a roster-level count map (e.g. {Female: 10, Male: 6}) and the number of
 * tables, returns the minimum achievable worst-case within-table deviation.
 *
 * Formula: ceil(max_count / numTables) - floor(min_count / numTables)
 *
 * This is the theoretical best any solver can do. If actual deviation equals
 * this number, the solver distributed the attribute as evenly as mathematically
 * possible.
 */
export function expectedWithinTableDeviation(
  rosterCounts: Record<string, number>,
  numTables: number
): number {
  const values = Object.values(rosterCounts)
  if (values.length <= 1 || numTables === 0) return 0
  const maxCount = Math.max(...values)
  const minCount = Math.min(...values)
  return Math.ceil(maxCount / numTables) - Math.floor(minCount / numTables)
}

/**
 * Given per-table count maps and the full set of attribute values from the
 * roster, returns the worst within-table deviation across all tables.
 *
 * Uses zero-filled counts so a table missing a gender (e.g. 4F, 0M) is
 * counted correctly as deviation 4, not 0.
 */
export function actualWithinTableDeviation(
  tableCountMaps: Record<string, number>[],
  allValues: string[]
): number {
  if (allValues.length <= 1) return 0
  let maxDev = 0
  for (const counts of tableCountMaps) {
    const values = allValues.map(v => counts[v] ?? 0)
    const dev = Math.max(...values) - Math.min(...values)
    maxDev = Math.max(maxDev, dev)
  }
  return maxDev
}

/**
 * For a single table of a given size, returns the minimum achievable within-table
 * deviation given the roster distribution and total participant count.
 *
 * Scales the roster proportionally to the table size:
 * ceil(max_count × tableSize / total) - floor(min_count × tableSize / total)
 *
 * More accurate than the session-level formula for unequal table sizes — a
 * 2-person table from a 20-person session should have a lower expected deviation.
 */
export function expectedDeviationForTableSize(
  rosterCounts: Record<string, number>,
  totalParticipants: number,
  tableSize: number
): number {
  const values = Object.values(rosterCounts)
  if (values.length <= 1 || totalParticipants === 0 || tableSize === 0) return 0
  const maxCount = Math.max(...values)
  const minCount = Math.min(...values)
  const expectedMax = Math.ceil((maxCount * tableSize) / totalParticipants)
  const expectedMin = Math.floor((minCount * tableSize) / totalParticipants)
  return Math.max(0, expectedMax - expectedMin)
}

/**
 * Formats a count map as a human-readable string sorted by count descending.
 * e.g. {Female: 10, Male: 6} → "10 Female / 6 Male"
 * With abbreviate=true → "10F / 6M"
 */
export function formatAttributeCounts(
  counts: Record<string, number>,
  abbreviate = false
): string {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) =>
      abbreviate ? `${count}${label.charAt(0)}` : `${count} ${label}`
    )
    .join(' / ')
}
