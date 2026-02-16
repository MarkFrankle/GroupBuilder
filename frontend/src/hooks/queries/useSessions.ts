import { useQuery } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

export function useSessionsList(orgId: string | null) {
  return useQuery({
    queryKey: ['sessions', orgId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/sessions?org_id=${orgId}`)
      if (!response.ok) throw new Error('Failed to load sessions')
      return response.json()
    },
    enabled: !!orgId,
  })
}
