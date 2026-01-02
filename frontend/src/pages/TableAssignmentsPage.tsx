import React, { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { produce } from 'immer'
import TableAssignments from "../components/TableAssignments/TableAssignments"
import CompactAssignments from "../components/CompactAssignments/CompactAssignments"
import ValidationStats from "../components/ValidationStats/ValidationStats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { dummyData } from "../data/dummyData"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, LayoutGrid, List, Edit, Undo2, MoreVertical, Download, RotateCw, X } from 'lucide-react'
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
import { API_BASE_URL } from '@/config/api'

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
}

export interface Assignment {
  session: number;
  tables: {
    [key: number]: Participant[];
  };
}

const TableAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<number>(1)
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('compact')
  const [editMode, setEditMode] = useState<boolean>(false)
  const [undoStack, setUndoStack] = useState<Assignment[][]>([])
  const [availableVersions, setAvailableVersions] = useState<ResultVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState<string>('latest')
  const [showRegenerateDialog, setShowRegenerateDialog] = useState<boolean>(false)
  const [regenerateSolverTime, setRegenerateSolverTime] = useState<number>(120)
  const [currentMaxTime, setCurrentMaxTime] = useState<number>(120)
  const [currentSolveTime, setCurrentSolveTime] = useState<number>(0)
  const [regenerating, setRegenerating] = useState<boolean>(false)
  const [regenerateSuccess, setRegenerateSuccess] = useState<boolean>(false)
  const [newVersionId, setNewVersionId] = useState<string | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const navigate = useNavigate()

  const useRealData = true;

  // Ensure dialog cleanup when component unmounts
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

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        if (process.env.NODE_ENV === 'development' && !useRealData) {
          setAssignments(dummyData)
        } else {
          // Try to get session ID from: 1) URL query param, 2) navigation state
          const urlParams = new URLSearchParams(window.location.search);
          const sessionId = urlParams.get('session') || (window.history.state?.usr as any)?.sessionId;
          const versionParam = urlParams.get('version');

          if (!sessionId) {
            // No session ID available, user might have refreshed the page
            throw new Error('Session expired. Please upload a file again.')
          }

          // Set current version from URL param if available
          if (versionParam) {
            setCurrentVersion(versionParam)
          }

          // Fetch available versions
          try {
            const versionsResponse = await fetch(`${API_BASE_URL}/api/assignments/results/${sessionId}/versions`)
            if (versionsResponse.ok) {
              const versionsData = await versionsResponse.json()
              setAvailableVersions(versionsData.versions || [])

              // Set current version's metadata for regenerate dialog
              const currentVersionData = versionsData.versions?.find((v: ResultVersion) =>
                v.version_id === (versionParam || 'latest')
              ) || versionsData.versions?.[versionsData.versions.length - 1]

              if (currentVersionData) {
                setCurrentMaxTime(currentVersionData.max_time_seconds || 120)
                setCurrentSolveTime(currentVersionData.solve_time || 0)
                setRegenerateSolverTime(currentVersionData.max_time_seconds || 120)
              }
            }
          } catch (err) {
            console.error('Failed to fetch versions:', err)
          }

          // Fetch assignments for the specified version
          const versionQuery = versionParam ? `?version=${versionParam}` : ''
          const response = await fetch(`${API_BASE_URL}/api/assignments/results/${sessionId}${versionQuery}`)
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || 'Failed to fetch assignments')
          }
          const data = await response.json()
          setAssignments(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchAssignments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  

  const handleClearAssignments = () => {
    navigate('/')
  }

  const handleVersionChange = async (versionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session') || (window.history.state?.usr as any)?.sessionId;

      if (!sessionId) {
        throw new Error('Session ID not found. Please upload a file again.')
      }

      const versionQuery = versionId !== 'latest' ? `?version=${versionId}` : ''
      const response = await fetch(`${API_BASE_URL}/api/assignments/results/${sessionId}${versionQuery}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to fetch version')
      }

      const data = await response.json()
      setAssignments(data)
      setCurrentVersion(versionId)

      // Update URL without reload
      const newUrl = versionId !== 'latest'
        ? `${window.location.pathname}?session=${sessionId}&version=${versionId}`
        : `${window.location.pathname}?session=${sessionId}`
      window.history.replaceState({}, '', newUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateClick = () => {
    setShowRegenerateDialog(true)
  }

  const handleRegenerateConfirm = async () => {
    // Close dialog first and wait for state update
    setShowRegenerateDialog(false)

    // Force cleanup of body pointer-events that Radix Dialog sets
    document.body.style.removeProperty('pointer-events')

    // Use setTimeout to ensure dialog is fully closed before starting regeneration
    await new Promise(resolve => setTimeout(resolve, 100))

    setRegenerating(true)
    setRegenerateSuccess(false)
    setNewVersionId(null)
    setError(null)

    // Create abort controller for cancellation
    const controller = new AbortController()
    setAbortController(controller)

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session') || (window.history.state?.usr as any)?.sessionId;

      if (!sessionId) {
        throw new Error('Session ID not found. Please upload a file again.')
      }

      const response = await fetch(`${API_BASE_URL}/api/assignments/regenerate/${sessionId}?max_time_seconds=${regenerateSolverTime}`, {
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

      // Refetch versions list to include the new version
      try {
        const versionsResponse = await fetch(`${API_BASE_URL}/api/assignments/results/${sessionId}/versions`)
        if (versionsResponse.ok) {
          const versionsData = await versionsResponse.json()
          setAvailableVersions(versionsData.versions || [])
        }
      } catch (err) {
        console.error('Failed to refresh versions:', err)
      }
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

  const handleViewNewAssignments = async () => {
    if (!newVersionId) return

    setRegenerateSuccess(false)
    setNewVersionId(null)

    // Load the new version
    await handleVersionChange(newVersionId)
  }

  const downloadCSV = () => {
    let csvContent = ""

    // Generate CSV for each session
    assignments.forEach((assignment) => {
      csvContent += `Session ${assignment.session}\n`
      csvContent += "Table,Name,Religion,Gender,Partner\n"

      // Iterate through each table in the session
      Object.entries(assignment.tables).forEach(([tableNum, participants]) => {
        participants.forEach(participant => {
          const partner = participant.partner || ""
          csvContent += `${tableNum},"${participant.name}","${participant.religion}","${participant.gender}","${partner}"\n`
        })
      })

      csvContent += "\n" // Blank line between sessions
    })

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `table-assignments-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    }))
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return

    setAssignments(undoStack[undoStack.length - 1])
    setUndoStack(prev => prev.slice(0, -1))
  }

  const toggleEditMode = () => {
    if (!editMode) {
      setViewMode('detailed')
    }
    setEditMode(!editMode)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-32 w-32 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-2xl mt-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
                      Creating new assignments for a maximum of {Math.floor(regenerateSolverTime / 60)} min {regenerateSolverTime % 60}s.
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

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
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
              {viewMode === 'detailed' && (
                <Button
                  variant={editMode ? 'default' : 'outline'}
                  onClick={toggleEditMode}
                  size="sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {editMode ? 'Done Editing' : 'Edit'}
                </Button>
              )}
              {editMode && (
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  size="sm"
                  disabled={undoStack.length === 0}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Undo ({undoStack.length})
                </Button>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-slate-950">
                  <DropdownMenuItem onClick={downloadCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRegenerateClick} disabled={editMode || regenerating}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleClearAssignments}>
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {viewMode === 'compact' ? (
            <CompactAssignments assignments={assignments} />
          ) : (
            <>
              {currentAssignment && (
                <TableAssignments
                  assignment={currentAssignment}
                  editMode={editMode}
                  onSwap={(tableNum1, participantIndex1, tableNum2, participantIndex2) => {
                    const sessionIndex = assignments.findIndex(a => a.session === currentSession)
                    handleSwap(sessionIndex, tableNum1, participantIndex1, tableNum2, participantIndex2)
                  }}
                />
              )}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={handlePreviousSession} disabled={currentSession === 1 || editMode}>
                  Previous Session
                </Button>
                <Button variant="outline" onClick={handleNextSession} disabled={currentSession === assignments.length || editMode}>
                  Next Session
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Regenerate Dialog */}
      {showRegenerateDialog && (
        <Dialog open={true} onOpenChange={setShowRegenerateDialog}>
          <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Assignments</DialogTitle>
            <DialogDescription>
              Configure solver time to balance speed vs. quality
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Solver Time</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegenerateSolverTime(60)}
                  className={`flex flex-col h-auto py-3 ${regenerateSolverTime === 60 ? 'border-2 border-black bg-gray-100' : ''}`}
                >
                  <span className="font-semibold">Fast</span>
                  <span className="text-xs opacity-80">1 min</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegenerateSolverTime(120)}
                  className={`flex flex-col h-auto py-3 ${regenerateSolverTime === 120 ? 'border-2 border-black bg-gray-100' : ''}`}
                >
                  <span className="font-semibold">Default</span>
                  <span className="text-xs opacity-80">2 min</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegenerateSolverTime(240)}
                  className={`flex flex-col h-auto py-3 ${regenerateSolverTime === 240 ? 'border-2 border-black bg-gray-100' : ''}`}
                >
                  <span className="font-semibold">Slow</span>
                  <span className="text-xs opacity-80">4 min</span>
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                ℹ️ Current results used <strong>{currentMaxTime < 60 ? `${currentMaxTime}s` : `${Math.round(currentMaxTime / 60)}m`}</strong> and
                completed in <strong>{currentSolveTime < 1 ? `${(currentSolveTime * 1000).toFixed(0)}ms` : `${currentSolveTime.toFixed(1)}s`}</strong>.
                <span className="block mt-1">
                  More time often yields better balanced groups.
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleRegenerateConfirm}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  )
}

export default TableAssignmentsPage