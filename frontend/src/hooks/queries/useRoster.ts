import { useQuery } from '@tanstack/react-query'
import { getKeepApart, getRoster } from '@/api/roster'
import { authenticatedFetch } from '@/utils/apiClient'
import { useProgram } from '@/contexts/ProgramContext'

export function useRoster() {
  const { currentProgram } = useProgram()
  const programId = currentProgram?.id

  return useQuery({
    queryKey: ['roster', programId],
    queryFn: () => getRoster(programId!),
    enabled: !!programId,
  })
}

/**
 * The roster the current assignments were actually built from, plus the shape
 * of the plan. The Roster page compares this against the live roster to decide
 * whether the grid is locked. Nulls mean the program has never generated, which
 * is a normal first-run state rather than an error.
 */
export function useCanonicalRoster(programId: string | null) {
  return useQuery({
    queryKey: ['canonical-roster', programId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/roster/canonical?program_id=${programId}`)
      if (!response.ok) throw new Error('Failed to fetch canonical roster')
      return response.json()
    },
    enabled: !!programId,
  })
}

/**
 * The pairs who must never share a table, as roster ids. Read on the Roster
 * page, which both renders them and folds them into the roster's changeset.
 */
export function useKeepApart(programId: string | null) {
  return useQuery({
    queryKey: ['keep-apart', programId],
    queryFn: () => getKeepApart(programId!),
    enabled: !!programId,
  })
}
