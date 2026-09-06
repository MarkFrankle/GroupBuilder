import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, FolderOpen } from 'lucide-react'
import { useAssignmentSetsList } from '@/hooks/queries'

import { useProgram } from '@/contexts/ProgramContext'

interface AssignmentSetSummary {
  assignment_set_id: string
  filename: string
  num_participants: number
  num_tables: number
  num_sessions: number
  created_at: number | null
  num_versions: number
}

const PreviousGroupsPage: React.FC = () => {
  const { currentProgram } = useProgram()
  const navigate = useNavigate()
  const { data: assignmentSets = [], isLoading, error } = useAssignmentSetsList(currentProgram?.id ?? null) as {
    data: AssignmentSetSummary[] | undefined; isLoading: boolean; error: Error | null
  }

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
      {assignmentSets.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No groups created yet. Upload a roster from the Home page to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {assignmentSets.map((set, index) => (
            <Card
              key={set.assignment_set_id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/table-assignments?program=${currentProgram?.id}`)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {set.created_at
                        ? new Date(set.created_at * 1000).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit'
                          })
                        : 'Unknown date'}
                      {index === 0 && (
                        <span className="text-xs font-medium text-muted-foreground">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {set.num_participants} participants &middot; {set.num_tables} tables &middot; {set.num_sessions} session{set.num_sessions !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {set.num_versions} version{set.num_versions !== 1 ? 's' : ''}
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
