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
