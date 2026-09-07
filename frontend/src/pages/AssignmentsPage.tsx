import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SessionCard from '@/components/Assignments/SessionCard'
import NoticeStrip, { Notice } from '@/components/Assignments/NoticeStrip'
import { authenticatedFetch } from '@/utils/apiClient'
import { shuffleReceipt } from '@/utils/assignmentStats'
import {
  useAssignmentResults,
  useAssignmentSetMetadata,
  useSessionCompletion,
} from '@/hooks/queries'
import { useProgram } from '@/contexts/ProgramContext'
import type { Assignment } from '@/types/assignments'

/**
 * Reads the user-facing `detail` an API refusal carries.
 *
 * Every refusal in the completion and shuffle paths names its own remedy, and
 * the wording is settled — the page surfaces it rather than writing a second
 * version that can drift out of step with the server's.
 */
async function refusalDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json()
    return body?.detail || fallback
  } catch {
    return fallback
  }
}

const AssignmentsPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentProgram, loading: programLoading } = useProgram()
  const programId = currentProgram?.id ?? null

  const { data: metadata } = useAssignmentSetMetadata(programId)
  const { data: fetchedAssignments, isLoading } = useAssignmentResults(programId)
  const { data: completedThrough = 0 } = useSessionCompletion(programId)

  const [notice, setNotice] = useState<Notice | null>(null)
  const [shufflingSession, setShufflingSession] = useState<number | null>(null)

  // Held so a shuffle can be diffed against what was on screen before it ran.
  const beforeShuffle = useRef<Assignment[]>([])

  const assignments: Assignment[] = useMemo(
    () => (Array.isArray(fetchedAssignments) ? fetchedAssignments : []),
    [fetchedAssignments]
  )

  const sorted = useMemo(
    () => [...assignments].sort((a, b) => a.session - b.session),
    [assignments]
  )
  const live = sorted.filter(a => a.session > completedThrough)
  const completed = sorted.filter(a => a.session <= completedThrough)

  // Collapsing a card reflows everything below it, so the anchor is lost. Put
  // the next thing to do back under the user's eyes.
  const firstLiveRef = useRef<HTMLDivElement | null>(null)
  const scrollToFirstLive = () => {
    firstLiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['results', programId] })
    queryClient.invalidateQueries({ queryKey: ['versions', programId] })
    queryClient.invalidateQueries({ queryKey: ['completion', programId] })
  }

  const completionMutation = useMutation({
    mutationFn: async ({
      sessionNumber,
      method,
    }: {
      sessionNumber: number
      method: 'POST' | 'DELETE'
    }) => {
      const response = await authenticatedFetch(
        `/api/assignments/completion/${sessionNumber}?program_id=${programId}`,
        { method }
      )
      if (!response.ok) {
        throw new Error(
          await refusalDetail(response, 'Could not update this session. Please try again.')
        )
      }
      return response.json()
    },
    onSuccess: () => {
      setNotice(null)
      invalidateAll()
      scrollToFirstLive()
    },
    onError: (error: Error) => {
      setNotice({ tone: 'error', message: error.message })
    },
  })

  const shuffleMutation = useMutation({
    mutationFn: async (sessionNumber: number) => {
      beforeShuffle.current = sorted
      const response = await authenticatedFetch(
        `/api/assignments/regenerate/session/${sessionNumber}?program_id=${programId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([]),
        }
      )
      if (!response.ok) {
        throw new Error(
          await refusalDetail(response, 'Could not shuffle this session. Please try again.')
        )
      }
      return sessionNumber
    },
    onMutate: (sessionNumber: number) => setShufflingSession(sessionNumber),
    onSettled: () => setShufflingSession(null),
    onSuccess: async (sessionNumber: number) => {
      invalidateAll()
      const fresh = await queryClient.fetchQuery<Assignment[]>({
        queryKey: ['results', programId, 'latest'],
      })
      setNotice({
        tone: 'info',
        message: shuffleReceipt(beforeShuffle.current, fresh ?? [], sessionNumber),
      })
    },
    onError: (error: Error) => {
      setNotice({ tone: 'error', message: error.message })
    },
  })

  const handlePrintSession = async (sessionNumber: number) => {
    const sessionAssignment = sorted.find(a => a.session === sessionNumber)
    if (!sessionAssignment || !programId) return
    try {
      const response = await authenticatedFetch(
        `/api/assignments/seating/${sessionNumber}?program_id=${programId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: [sessionAssignment] }),
        }
      )
      if (!response.ok) {
        throw new Error(await refusalDetail(response, 'Could not build the seating chart.'))
      }
      const seatingData = await response.json()
      navigate(
        `/table-assignments/seating?program=${programId}&sessionNum=${sessionNumber}`,
        { state: { seatingData } }
      )
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not build the seating chart.',
      })
    }
  }

  if (programLoading || isLoading) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!programId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Select a program to view its assignments.
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <p className="text-sm text-muted-foreground">
          This program has no assignments yet.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/roster')}>
          Go to Setup
        </Button>
      </div>
    )
  }

  const totalSessions = metadata?.num_sessions ?? sorted.length

  return (
    <div className="flex flex-col gap-4 px-8 pb-10">
      <NoticeStrip notice={notice} onDismiss={() => setNotice(null)} />

      <div className="flex flex-col gap-5">
        {live.map((assignment, index) => (
          <div key={assignment.session} ref={index === 0 ? firstLiveRef : undefined}>
            <SessionCard
              assignment={assignment}
              isShuffling={shufflingSession === assignment.session}
              onShuffle={() => shuffleMutation.mutate(assignment.session)}
              onPrint={() => handlePrintSession(assignment.session)}
              onMarkComplete={() =>
                completionMutation.mutate({
                  sessionNumber: assignment.session,
                  method: 'POST',
                })
              }
            />
          </div>
        ))}

        {live.length === 0 && (
          <p className="text-sm font-medium">All {totalSessions} sessions complete.</p>
        )}

        {completed.length > 0 && (
          <>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Completed
            </div>
            {completed.map(assignment => (
              <SessionCard
                key={assignment.session}
                assignment={assignment}
                completed
                onPrint={() => handlePrintSession(assignment.session)}
                onReopen={
                  assignment.session === completedThrough
                    ? () =>
                        completionMutation.mutate({
                          sessionNumber: assignment.session,
                          method: 'DELETE',
                        })
                    : undefined
                }
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default AssignmentsPage
