import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/utils/apiClient'

interface Organization {
  id: string
  name: string
  created_at: number
  member_count: number
  active?: boolean
}

interface OrgDetails {
  id: string
  name: string
  created_at: number
  created_by: string
  members: any[]
  invites: any[]
}

export function useAdminOrganizations(showInactive: boolean) {
  return useQuery({
    queryKey: ['admin-organizations', showInactive],
    queryFn: () => apiRequest<Organization[]>(`/api/admin/organizations?show_inactive=${showInactive}`),
  })
}

export function useOrgDetails(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-org-details', orgId],
    queryFn: () => apiRequest<OrgDetails>(`/api/admin/organizations/${orgId}`),
    enabled: enabled && !!orgId,
  })
}
