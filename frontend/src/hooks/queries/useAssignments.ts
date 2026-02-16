import { useQuery } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

export function useResultVersions(sessionId: string | null) {
  return useQuery({
    queryKey: ['versions', sessionId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/results/${sessionId}/versions`)
      if (!response.ok) throw new Error('Failed to fetch versions')
      const data = await response.json()
      return data.versions || []
    },
    enabled: !!sessionId,
  })
}

export function useAssignmentResults(sessionId: string | null, version?: string) {
  return useQuery({
    queryKey: ['results', sessionId, version ?? 'latest'],
    queryFn: async () => {
      const versionQuery = version ? `?version=${version}` : ''
      const response = await authenticatedFetch(`/api/assignments/results/${sessionId}${versionQuery}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to fetch assignments')
      }
      return response.json()
    },
    enabled: !!sessionId,
  })
}

export function useSessionMetadata(sessionId: string | null) {
  return useQuery({
    queryKey: ['session-metadata', sessionId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/sessions/${sessionId}/metadata`)
      if (!response.ok) throw new Error('Failed to fetch metadata')
      return response.json()
    },
    enabled: !!sessionId,
  })
}
