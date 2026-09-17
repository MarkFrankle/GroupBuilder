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
 * The roster a given set of assignments was actually built from, plus the
 * shape of the plan. The Roster page compares the current set's copy against
 * the live roster to decide whether the grid is locked.
 *
 * `assignmentSetId` scopes this to a specific past set - History views must
 * check a past plan against the keep-apart rules (and roster) it was actually
 * built with, not whatever is current today, or an old plan can be flagged for
 * breaking a rule that didn't exist when it was made. Omit it for the
 * program's current set. Nulls mean the program has never generated, which is
 * a normal first-run state rather than an error.
 */
export function useCanonicalRoster(programId: string | null, assignmentSetId?: string) {
  return useQuery({
    queryKey: ['canonical-roster', programId, assignmentSetId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({ program_id: programId! })
      if (assignmentSetId) params.set('assignment_set_id', assignmentSetId)
      const response = await authenticatedFetch(`/api/roster/canonical?${params}`)
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
