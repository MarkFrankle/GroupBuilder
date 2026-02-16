import { useQuery } from '@tanstack/react-query'
import { getRoster } from '@/api/roster'

export function useRoster() {
  return useQuery({
    queryKey: ['roster'],
    queryFn: getRoster,
  })
}
