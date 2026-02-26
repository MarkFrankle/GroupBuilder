import { useQuery } from '@tanstack/react-query'
import { getRoster } from '@/api/roster'
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
