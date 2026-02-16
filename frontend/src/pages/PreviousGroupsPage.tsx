import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, FolderOpen } from 'lucide-react'
import { useSessionsList } from '@/hooks/queries'

import { useOrganization } from '@/contexts/OrganizationContext'

const PreviousGroupsPage: React.FC = () => {
  const { currentOrg } = useOrganization()
  const navigate = useNavigate()
  const { data: sessions = [], isLoading, error } = useSessionsList(currentOrg?.id ?? null)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-red-600">
        {error?.message}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Previous Groups</h1>
      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No groups created yet. Upload a roster from the Home page to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.session_id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/table-assignments?session=${session.session_id}`)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-medium">
                      {session.created_at
                        ? new Date(session.created_at * 1000).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit'
                          })
                        : 'Unknown date'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {session.num_participants} participants &middot; {session.num_tables} tables &middot; {session.num_sessions} session{session.num_sessions !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {session.num_versions} version{session.num_versions !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default PreviousGroupsPage
