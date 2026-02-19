import { useQuery } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

export function useSessionsList(programId: string | null) {
  return useQuery({
    queryKey: ['sessions', programId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/sessions?program_id=${programId}`)
      if (!response.ok) throw new Error('Failed to load sessions')
      return response.json()
    },
    enabled: !!programId,
  })
}
