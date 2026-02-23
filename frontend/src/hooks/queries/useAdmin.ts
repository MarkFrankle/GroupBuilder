import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/utils/apiClient'

interface Program {
  id: string
  name: string
  created_at: number
  member_count: number
  active?: boolean
}

interface ProgramDetails {
  id: string
  name: string
  created_at: number
  created_by: string
  members: any[]
  invites: any[]
}

export function useIsAdmin(enabled = true) {
  return useQuery({
    queryKey: ['admin-check'],
    queryFn: () => apiRequest<{ is_admin: boolean }>('/api/admin/check').then(() => true).catch(() => false),
    staleTime: Infinity,
    retry: false,
    enabled,
  })
}

export function useAdminPrograms(showInactive: boolean) {
  return useQuery({
    queryKey: ['admin-programs', showInactive],
    queryFn: () => apiRequest<Program[]>(`/api/admin/programs?show_inactive=${showInactive}`),
  })
}

export function useProgramDetails(programId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-program-details', programId],
    queryFn: () => apiRequest<ProgramDetails>(`/api/admin/programs/${programId}`),
    enabled: enabled && !!programId,
  })
}
