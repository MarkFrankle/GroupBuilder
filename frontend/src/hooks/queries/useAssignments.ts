import { useQuery } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

export function useResultVersions(programId: string | null) {
  return useQuery({
    queryKey: ['versions', programId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/results/versions?program_id=${programId}`)
      if (!response.ok) throw new Error('Failed to fetch versions')
      const data = await response.json()
      return data.versions || []
    },
    enabled: !!programId,
  })
}

export function useAssignmentResults(programId: string | null, version?: string) {
  return useQuery({
    queryKey: ['results', programId, version ?? 'latest'],
    queryFn: async () => {
      const versionQuery = version ? `&version=${version}` : ''
      const response = await authenticatedFetch(`/api/assignments/results?program_id=${programId}${versionQuery}`)
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
