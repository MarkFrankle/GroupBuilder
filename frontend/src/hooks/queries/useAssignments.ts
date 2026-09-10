import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'
import type { ResultVersion } from '@/types/assignments'

/**
 * The one definition of the results query key. useAssignmentResults registers
 * a query under it, and AssignmentsPage reads that query back with a
 * queryFn-less fetchQuery — so the two must agree exactly. A drift here fails
 * silently with an empty result rather than a type or lint error, which is why
 * neither side is allowed to spell the key out by hand.
 */
export const resultsQueryKey = (
  programId: string | null,
  version?: string,
  assignmentSetId?: string
) => ['results', programId, version ?? 'latest', assignmentSetId ?? 'current'] as const

export function useResultVersions(programId: string | null) {
  return useQuery({
    queryKey: ['versions', programId],
    queryFn: async (): Promise<ResultVersion[]> => {
      const response = await authenticatedFetch(`/api/assignments/results/versions?program_id=${programId}`)
      if (!response.ok) throw new Error('Failed to fetch versions')
      const data = await response.json()
      return data.versions || []
    },
    enabled: !!programId,
  })
}

export function useAssignmentResults(
  programId: string | null,
  version?: string,
  assignmentSetId?: string
) {
  return useQuery({
    queryKey: resultsQueryKey(programId, version, assignmentSetId),
    queryFn: async () => {
      const params = new URLSearchParams({ program_id: programId as string })
      if (version) params.set('version', version)
      if (assignmentSetId) params.set('assignment_set_id', assignmentSetId)
      const response = await authenticatedFetch(`/api/assignments/results?${params}`)
      if (response.status === 404) {
        throw new Error('This program has no assignments yet. Generate them from the roster.')
      }
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to fetch assignments')
      }
      return response.json()
    },
    enabled: !!programId,
  })
}

export function useAssignmentSetMetadata(programId: string | null) {
  return useQuery({
    queryKey: ['assignment-set-metadata', programId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/metadata?program_id=${programId}`)
      // No assignment set yet is a normal state, not an error.
      if (response.status === 404) return null
      if (!response.ok) throw new Error('Failed to fetch metadata')
      return response.json()
    },
    enabled: !!programId,
  })
}

export function useSessionCompletion(programId: string | null) {
  return useQuery({
    queryKey: ['completion', programId],
    queryFn: async (): Promise<number> => {
      const response = await authenticatedFetch(`/api/assignments/completion?program_id=${programId}`)
      // No assignment set yet is a normal state, not an error.
      if (response.status === 404) return 0
      if (!response.ok) throw new Error('Failed to fetch session completion')
      const data = await response.json()
      return data.completed_through ?? 0
    },
    enabled: !!programId,
  })
}

export function useAcceptRebuild(programId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `/api/assignments/accept?program_id=${programId}`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to accept')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment-set-metadata', programId] })
    },
  })
}

export function useUndoRebuild(programId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `/api/assignments/undo-rebuild?program_id=${programId}`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to undo')
      return res.json()
    },
    onSuccess: () => {
      ;['assignment-set-metadata', 'versions', 'results', 'completion', 'canonical-roster'].forEach(
        (k) => qc.invalidateQueries({ queryKey: [k, programId] })
      )
    },
  })
}
