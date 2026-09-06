import { useQuery } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

export function useAssignmentSetsList(programId: string | null) {
  return useQuery({
    queryKey: ['assignment-sets', programId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/assignment_sets?program_id=${programId}`)
      if (!response.ok) throw new Error('Failed to load assignment sets')
      return response.json()
    },
    enabled: !!programId,
  })
}
