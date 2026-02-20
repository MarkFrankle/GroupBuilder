import React, { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { produce } from 'immer'
import TableAssignments from "../components/TableAssignments/TableAssignments"
import CompactAssignments from "../components/CompactAssignments/CompactAssignments"
import ValidationStats from "../components/ValidationStats/ValidationStats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEFAULT_SOLVER_TIMEOUT_SECONDS } from '@/constants'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, LayoutGrid, List, Edit, Undo2, MoreVertical, RotateCw, Check, Link, AlertCircle, Printer } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authenticatedFetch } from '@/utils/apiClient'
import { useResultVersions, useAssignmentResults } from '@/hooks/queries'

interface ResultVersion {
  version_id: string
  created_at: number
  solve_time?: number
  solution_quality?: string
  max_time_seconds?: number
}

export interface Participant {
  name: string;
  religion: string;
  gender: string;
  partner: string | null;
  is_facilitator?: boolean;
}

export interface Assignment {
  session: number;
  tables: {
    [key: number]: (Participant | null)[];
  };
  absentParticipants?: Participant[];
}

const TableAssignmentsPage: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const sessionId = urlParams.get('session') || (window.history.state?.usr as any)?.sessionId || null
  const versionParam = urlParams.get('version') || undefined

  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: versionsData } = useResultVersions(sessionId)
  const [currentVersion, setCurrentVersion] = useState<string>(versionParam ?? 'latest')
  const { data: fetchedAssignments, isLoading: loading, error: fetchError } = useAssignmentResults(sessionId, currentVersion !== 'latest' ? currentVersion : undefined)

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<number>(1)
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>(() => {
    // Restore view mode from localStorage
    const saved = localStorage.getItem('tableAssignments_viewMode')
    return (saved === 'detailed' || saved === 'compact') ? saved : 'compact'
  })
  const [editMode, setEditMode] = useState<boolean>(false)
  const [undoStack, setUndoStack] = useState<Assignment[][]>([])
  const [selectedAbsentParticipant, setSelectedAbsentParticipant] = useState<Participant | null>(null)
  const [selectedParticipantSlot, setSelectedParticipantSlot] = useState<{tableNum: number, participantIndex: number} | null>(null)
  const [clearSelectionKey, setClearSelectionKey] = useState(0)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState<boolean>(false)
  const [regenerating, setRegenerating] = useState<boolean>(false)
  const [regenerateSuccess, setRegenerateSuccess] = useState<boolean>(false)
  const [newVersionId, setNewVersionId] = useState<string | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [regeneratingSession, setRegeneratingSession] = useState<number | null>(null)
  const [copySuccess, setCopySuccess] = useState<boolean>(false)
  const [copyError, setCopyError] = useState<boolean>(false)

  const availableVersions: ResultVersion[] = versionsData ?? []

  // Sync fetched assignments to local state (needed for edit mode)
  useEffect(() => {
    if (fetchedAssignments) {
      setAssignments(fetchedAssignments)
    }
  }, [fetchedAssignments])


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setShowRegenerateDialog(false)
      document.body.style.removeProperty('pointer-events')
      if (abortController) {
        abortController.abort()
      }
    }
  }, [abortController])

  // Clean up body pointer-events whenever dialog closes
  useEffect(() => {
    if (!showRegenerateDialog) {
      document.body.style.removeProperty('pointer-events')
    }
  }, [showRegenerateDialog])

  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem('tableAssignments_viewMode', viewMode)
  }, [viewMode])

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000) // Convert Unix timestamp to milliseconds
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`

    // For older dates, show the actual date/time
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }



  const handleCopyLink = async () => {
    try {
      if (!sessionId) {
        console.error('No session ID available to copy')
        setCopyError(true)
        setTimeout(() => {
          setCopyError(false)
        }, 2000)
        return
      }

      // Construct URL with session and version
      const baseUrl = `${window.location.origin}${window.location.pathname}`
      const params = new URLSearchParams({ session: sessionId })
      
      // Only include version if it's not 'latest'
      if (currentVersion !== 'latest') {
        params.append('version', currentVersion)
      }
      
      const linkToCopy = `${baseUrl}?${params.toString()}`
      
      await navigator.clipboard.writeText(linkToCopy)
      setCopySuccess(true)

      // Reset success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
      setCopyError(true)
      setTimeout(() => {
        setCopyError(false)
      }, 2000)
    }
  }

  const handlePrintRoster = () => {
    navigate('/table-assignments/roster-print', {
      state: { assignments, sessionId }
    })
  }

  const handlePrintSeating = async () => {
    try {
      if (!sessionId) {
        throw new Error('Session ID not found. Please upload a file again.')
      }

      // Find the current session assignment
      const sessionAssignment = assignments.find(a => a.session === currentSession)
      if (!sessionAssignment) {
        throw new Error(`Session ${currentSession} not found`)
      }

      // POST to backend seating API endpoint
      const response = await authenticatedFetch(
        `/api/assignments/seating/${sessionId}?session=${currentSession}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ assignments: [sessionAssignment] }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to generate seating chart')
      }

      const seatingData = await response.json()

      // Navigate to seating chart page with the data
      navigate(`/table-assignments/seating?session=${sessionId}&sessionNum=${currentSession}`, {
        state: { seatingData }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate seating chart")
    }
  }

  const handleVersionChange = (versionId: string) => {
    setUndoStack([])
    setCurrentVersion(versionId)

    // Update URL without reload
    const newUrl = versionId !== 'latest'
      ? `${window.location.pathname}?session=${sessionId}&version=${versionId}`
      : `${window.location.pathname}?session=${sessionId}`
    window.history.replaceState({}, '', newUrl)
  }

  const handleRegenerateConfirm = async () => {
    setShowRegenerateDialog(false)
    document.body.style.removeProperty('pointer-events')

    // Wait for dialog to fully unmount before starting regeneration
    await new Promise(resolve => setTimeout(resolve, 100))

    setRegenerating(true)
    setRegenerateSuccess(false)
    setNewVersionId(null)
    setError(null)

    // Create abort controller for cancellation
    const controller = new AbortController()
    setAbortController(controller)

    try {
      if (!sessionId) {
        throw new Error('Session ID not found. Please upload a file again.')
      }

      console.log('[Regenerate] Requesting regeneration with max_time_seconds:', DEFAULT_SOLVER_TIMEOUT_SECONDS)
      const response = await authenticatedFetch(`/api/assignments/regenerate/${sessionId}?max_time_seconds=${DEFAULT_SOLVER_TIMEOUT_SECONDS}`, {
        method: 'POST',
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to regenerate assignments')
      }

      const result = await response.json()
      // Save new version ID but don't auto-switch
      setNewVersionId(result.version_id)
      setRegenerateSuccess(true)

      // Invalidate queries so versions list refreshes
      queryClient.invalidateQueries({ queryKey: ['versions', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['results', sessionId] })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Regeneration was cancelled
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : "Failed to regenerate assignments")
      }
    } finally {
      setRegenerating(false)
      setAbortController(null)
    }
  }

  const handleCancelRegenerate = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const handleRegenerateSession = async (sessionNumber: number) => {
    // Save current state to undo stack
    setUndoStack(prev => {
      const newStack = [...prev, produce(assignments, draft => draft)].slice(-10)
      return newStack
    })

    setRegeneratingSession(sessionNumber)
    setError(null)

    try {
      if (!sessionId) {
        throw new Error('Session ID not found. Please upload a file again.')
      }

      const sessionAssignment = assignments.find(a => a.session === sessionNumber)
      if (!sessionAssignment) {
        throw new Error(`Session ${sessionNumber} not found`)
      }

      // Use existing absent participants from the session
      const absentParticipants = sessionAssignment.absentParticipants || []

      console.log('[Regenerate Session] Regenerating session:', {
        session: sessionNumber,
        max_time_seconds: 30,
        version_id: currentVersion !== 'latest' ? currentVersion : undefined,
        absent_count: absentParticipants.length
      })

      const queryParams = new URLSearchParams({
        max_time_seconds: '30'  // Fast 30-second timeout for single session
      })

      if (currentVersion !== 'latest') {
        queryParams.append('version_id', currentVersion)
      }

      const response = await authenticatedFetch(
        `/api/assignments/regenerate/${sessionId}/session/${sessionNumber}?${queryParams}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(absentParticipants),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to regenerate session')
      }

      const result = await response.json()

      // Update assignments in-place (no new version)
      setAssignments(result.assignments)

      console.log('[Regenerate Session] Successfully regenerated session', sessionNumber,
        'in', result.solve_time?.toFixed(2), 's')

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate session")
      // Restore from undo stack on error
      if (undoStack.length > 0) {
        const previousState = undoStack[undoStack.length - 1]
        setAssignments(previousState)
        setUndoStack(prev => prev.slice(0, -1))
      }
    } finally {
      setRegeneratingSession(null)
    }
  }

  const handleViewNewAssignments = async () => {
    if (!newVersionId) return

    setRegenerateSuccess(false)
    setNewVersionId(null)

    // Load the new version
    await handleVersionChange(newVersionId)
  }

  const handlePreviousSession = () => {
    setCurrentSession(prev => Math.max(1, prev - 1))
  }

  const handleNextSession = () => {
    setCurrentSession(prev => Math.min(assignments.length, prev + 1))
  }

  const handleSwap = (sessionIndex: number, tableNum1: number, participantIndex1: number, tableNum2: number, participantIndex2: number) => {
    // Save current state to undo stack using immer for efficient cloning
    setUndoStack(prev => {
      const newStack = [...prev, produce(assignments, draft => draft)].slice(-10)
      return newStack
    })

    // Swap participants using immer for efficient immutable update
    setAssignments(prev => produce(prev, draft => {
      const session = draft[sessionIndex]
      const temp = session.tables[tableNum1][participantIndex1]
      session.tables[tableNum1][participantIndex1] = session.tables[tableNum2][participantIndex2]
      session.tables[tableNum2][participantIndex2] = temp

      // Remove any nulls created by swapping with empty slots to avoid index mismatch
      session.tables[tableNum1] = session.tables[tableNum1].filter((p): p is Participant => p !== null && p !== undefined)
      session.tables[tableNum2] = session.tables[tableNum2].filter((p): p is Participant => p !== null && p !== undefined)
    }))

    // Edit made (hasUnsavedEdits tracking removed)
  }

  const handleMarkAbsent = (sessionIndex: number, tableNum: number, participantIndex: number) => {
    // Save current state to undo stack
    setUndoStack(prev => {
      const newStack = [...prev, produce(assignments, draft => draft)].slice(-10)
      return newStack
    })

    setAssignments(prev => produce(prev, draft => {
      const session = draft[sessionIndex]
      if (!session || !session.tables || !session.tables[tableNum]) {
        console.error('Invalid session or table:', { sessionIndex, tableNum, session })
        return
      }

      const table = session.tables[tableNum]
      const participant = table[participantIndex]

      if (participant) {
        // Add to absent participants
        if (!session.absentParticipants) {
          session.absentParticipants = []
        }
        session.absentParticipants.push(participant)

        // Remove from table entirely (filter out) to avoid index mismatch with tablesWithEmptySlots
        const newTable = table.filter((_, i) => i !== participantIndex)
        session.tables[tableNum] = newTable
      }
    }))

    // Clear selection after marking absent
    setSelectedParticipantSlot(null)
    setClearSelectionKey(prev => prev + 1)

    // Edit made (hasUnsavedEdits tracking removed)
  }

  const handlePlaceAbsentParticipant = (sessionIndex: number, tableNum: number, seatIndex: number) => {
    if (!selectedAbsentParticipant) return

    // Save current state to undo stack
    setUndoStack(prev => {
      const newStack = [...prev, produce(assignments, draft => draft)].slice(-10)
      return newStack
    })

    setAssignments(prev => produce(prev, draft => {
      const session = draft[sessionIndex]
      if (!session || !session.tables || !session.tables[tableNum]) {
        console.error('Invalid session or table:', { sessionIndex, tableNum, session })
        return
      }

      // Remove from absent participants
      if (session.absentParticipants) {
        const index = session.absentParticipants.findIndex(p => p.name === selectedAbsentParticipant.name)
        if (index !== -1) {
          session.absentParticipants.splice(index, 1)
        }
      }

      // Simply append to the end of the table (avoiding nulls to prevent index mismatch)
      const table = session.tables[tableNum]
      session.tables[tableNum] = [...table, selectedAbsentParticipant]
    }))

    setSelectedAbsentParticipant(null)
    // Edit made (hasUnsavedEdits tracking removed)
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return

    setAssignments(undoStack[undoStack.length - 1])
    setUndoStack(prev => prev.slice(0, -1))
    setSelectedAbsentParticipant(null)
    setSelectedParticipantSlot(null)
  }

  const toggleEditMode = async () => {
    if (!editMode) {
      setViewMode('detailed')
    } else {
      // Clean up nulls from tables when exiting edit mode
      const cleanedAssignments = produce(assignments, draft => {
        draft.forEach(session => {
          Object.keys(session.tables).forEach(tableNum => {
            const key = Number(tableNum)
            // Filter out all null/undefined values
            session.tables[key] = session.tables[key].filter((p): p is Participant => p !== null && p !== undefined)
          })
        })
      })

      setAssignments(cleanedAssignments)

      // Save edits as a new version if actual changes were made
      if (undoStack.length > 0) {
        try {
          const response = await authenticatedFetch(`/api/assignments/results/${sessionId}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assignments: cleanedAssignments,
              based_on_version: currentVersion,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to save edits')
          }

          const result = await response.json()

          // Update version state to reflect the new version
          setCurrentVersion(result.version_id)

          // Invalidate versions query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['versions', sessionId] })

          // Update URL to reflect new version
          const newUrl = `${window.location.pathname}?session=${sessionId}&version=${result.version_id}`
          window.history.replaceState({}, '', newUrl)

          // Clear undo stack — saved state is now the baseline
          setUndoStack([])
        } catch (err) {
          console.error('Failed to save edits as new version:', err)
          setError('Failed to save your edits. Please try again.')
        }
      }

      // Clear selections when exiting edit mode
      setSelectedAbsentParticipant(null)
      setSelectedParticipantSlot(null)
    }
    setEditMode(!editMode)
  }

  const displayError = !sessionId ? 'Session expired. Please upload a file again.' : fetchError?.message || error

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-32 w-32 animate-spin" />
      </div>
    )
  }

  if (displayError && !assignments.length) {
    return (
      <div className="container mx-auto p-4 max-w-2xl mt-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
        <div className="flex justify-center mt-6">
          <Button onClick={() => navigate('/')} variant="outline">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const currentAssignment = assignments.find(a => a.session === currentSession)

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle className="text-3xl font-bold">Table Assignments</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrintRoster}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={editMode}
              >
                <Printer className="h-4 w-4" />
                Print Roster
              </Button>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {copySuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : copyError ? (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Failed
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
              {availableVersions.length > 0 && (
                <Select value={currentVersion} onValueChange={handleVersionChange} disabled={editMode}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest" disabled={currentVersion === 'latest'}>Latest</SelectItem>
                    {availableVersions.map((version) => (
                      <SelectItem
                        key={version.version_id}
                        value={version.version_id}
                        disabled={currentVersion === version.version_id}
                      >
                        <div className="flex flex-col">
                          <span>{version.version_id}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(version.created_at)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {regenerating && (
            <Alert className="mb-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <Loader2 className="h-4 w-4 animate-spin mt-0.5" />
                  <div>
                    <AlertTitle>Regenerating Assignments</AlertTitle>
                    <AlertDescription>
                      Creating new assignments (up to 2 minutes).
                      You can continue browsing while we work.
                    </AlertDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleCancelRegenerate}>
                  Cancel
                </Button>
              </div>
            </Alert>
          )}

          {regenerateSuccess && !regenerating && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <div className="flex items-start justify-between">
                <div>
                  <AlertTitle>Regeneration Complete!</AlertTitle>
                  <AlertDescription>
                    New assignments saved as {newVersionId}
                  </AlertDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleViewNewAssignments}>
                  View New Assignments
                </Button>
              </div>
            </Alert>
          )}

          <ValidationStats assignments={assignments} />

          {/* View mode toggles */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'compact' ? 'outline' : 'ghost'}
                onClick={() => setViewMode('compact')}
                size="sm"
                className={viewMode === 'compact' ? 'border-2 border-primary' : ''}
                disabled={editMode}
                aria-label="Compact view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'detailed' ? 'outline' : 'ghost'}
                onClick={() => setViewMode('detailed')}
                size="sm"
                className={viewMode === 'detailed' ? 'border-2 border-primary' : ''}
                disabled={editMode}
                aria-label="Detailed view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={editMode || regenerating}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-slate-950">
                <DropdownMenuItem onClick={() => setShowRegenerateDialog(true)}>
                  <RotateCw className="h-4 w-4 mr-2" />
                  Regenerate All Sessions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Unified session control bar (only in detailed view) */}
          {viewMode === 'detailed' && (
            <div className="flex justify-between items-center mb-6 gap-4">
              <div className="flex gap-2 items-center">
                <Select
                  value={currentSession.toString()}
                  onValueChange={(value) => setCurrentSession(parseInt(value))}
                  disabled={editMode}
                >
                  <SelectTrigger className="w-[180px]" aria-label="Select session">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.session} value={assignment.session.toString()}>
                        Session {assignment.session}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={toggleEditMode}
                  size="sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {editMode ? 'Done Editing' : 'Edit'}
                </Button>

                {editMode && (
                  <Button
                    variant="outline"
                    onClick={() => handleRegenerateSession(currentSession)}
                    size="sm"
                    disabled={regeneratingSession !== null}
                  >
                    {regeneratingSession === currentSession ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RotateCw className="h-4 w-4 mr-2" />
                        Regenerate Session
                      </>
                    )}
                  </Button>
                )}

                {!editMode && (
                  <Button
                    variant="outline"
                    onClick={handlePrintSeating}
                    size="sm"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Seating
                  </Button>
                )}

                {editMode && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleUndo}
                      size="sm"
                      disabled={undoStack.length === 0}
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      Undo ({undoStack.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (selectedParticipantSlot && !selectedAbsentParticipant) {
                          const sessionIndex = assignments.findIndex(a => a.session === currentSession)
                          handleMarkAbsent(sessionIndex, selectedParticipantSlot.tableNum, selectedParticipantSlot.participantIndex)
                          setSelectedParticipantSlot(null)
                        }
                      }}
                      size="sm"
                      disabled={!selectedParticipantSlot || selectedAbsentParticipant !== null}
                      title={selectedAbsentParticipant ? "Cannot mark absent participant as absent" : selectedParticipantSlot ? "Mark selected participant as absent" : "Select a participant to mark them absent"}
                    >
                      Mark Absent
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreviousSession}
                  disabled={currentSession === 1 || editMode}
                  size="sm"
                >
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNextSession}
                  disabled={currentSession === assignments.length || editMode}
                  size="sm"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {viewMode === 'compact' ? (
            <CompactAssignments assignments={assignments} />
          ) : (
            <>
              {/* Absent Participants Box */}
              {currentAssignment && currentAssignment.absentParticipants && currentAssignment.absentParticipants.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h3 className="font-semibold mb-2 text-amber-900">Absent Participants</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentAssignment.absentParticipants.map((participant, index) => (
                      <div
                        key={index}
                        onClick={() => editMode ? setSelectedAbsentParticipant(participant) : null}
                        className={`px-3 py-2 bg-white border rounded-md cursor-pointer hover:bg-gray-50 ${
                          selectedAbsentParticipant?.name === participant.name ? 'ring-2 ring-blue-500' : 'border-amber-300'
                        }`}
                      >
                        <div className="font-medium">{participant.name}</div>
                        <div className="text-xs text-gray-600">
                          {participant.is_facilitator && 'Facilitator • '}{participant.religion} • {participant.gender}
                        </div>
                      </div>
                    ))}
                  </div>
                  {editMode && (
                    <p className="text-sm text-amber-700 mt-2">
                      Click an absent participant, then click an empty seat to place them
                    </p>
                  )}
                </div>
              )}

              {currentAssignment && (
                <TableAssignments
                  assignment={currentAssignment}
                  editMode={editMode}
                  onSwap={(tableNum1, participantIndex1, tableNum2, participantIndex2) => {
                    const sessionIndex = assignments.findIndex(a => a.session === currentSession)
                    handleSwap(sessionIndex, tableNum1, participantIndex1, tableNum2, participantIndex2)
                  }}
                  selectedAbsentParticipant={selectedAbsentParticipant}
                  onPlaceAbsent={(tableNum, seatIndex) => {
                    const sessionIndex = assignments.findIndex(a => a.session === currentSession)
                    handlePlaceAbsentParticipant(sessionIndex, tableNum, seatIndex)
                  }}
                  clearSelectionKey={clearSelectionKey}
                  onSelectionChange={(tableNum, participantIndex) => {
                    if (tableNum !== null && participantIndex !== null) {
                      setSelectedParticipantSlot({ tableNum, participantIndex })
                    } else {
                      setSelectedParticipantSlot(null)
                    }
                  }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {showRegenerateDialog && (
        <Dialog open={true} onOpenChange={setShowRegenerateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Regenerate All Sessions</DialogTitle>
              <DialogDescription>
                This will create a completely new set of assignments. It takes up to 2
                minutes — you can continue browsing while it runs.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Your current version will be saved and you can switch back anytime.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleRegenerateConfirm}>
                Regenerate All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default TableAssignmentsPage