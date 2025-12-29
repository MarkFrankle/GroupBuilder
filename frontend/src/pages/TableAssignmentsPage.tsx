import React, { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import TableAssignments from "../components/TableAssignments/TableAssignments"
import CompactAssignments from "../components/CompactAssignments/CompactAssignments"
import ValidationStats from "../components/ValidationStats/ValidationStats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { dummyData } from "../data/dummyData"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, LayoutGrid, List, Edit, Undo2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { API_BASE_URL } from '@/config/api'

interface ResultVersion {
  version_id: string
  created_at: number
  solve_time?: number
  solution_quality?: string
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

  const navigate = useNavigate()

  const useRealData = true;

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

  const handleRegenerateAssignments = async () => {
    setLoading(true)
    setError(null)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session') || (window.history.state?.usr as any)?.sessionId;

      if (!sessionId) {
        throw new Error('Session ID not found. Please upload a file again.')
      }

      const response = await fetch(`${API_BASE_URL}/api/assignments/regenerate/${sessionId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to regenerate assignments')
      }

      const result = await response.json()
      // Backend now returns {assignments: [...], version_id: "v1"}
      setAssignments(result.assignments)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate assignments")
    } finally {
      setLoading(false)
    }
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
    setUndoStack(prev => {
      const newStack = [...prev, JSON.parse(JSON.stringify(assignments))].slice(-10)
      return newStack
    })

    setAssignments(prev => {
      const newAssignments = JSON.parse(JSON.stringify(prev)) as Assignment[]
      const session = newAssignments[sessionIndex]

      const temp = session.tables[tableNum1][participantIndex1]
      session.tables[tableNum1][participantIndex1] = session.tables[tableNum2][participantIndex2]
      session.tables[tableNum2][participantIndex2] = temp

      return newAssignments
    })
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
          <CardTitle className="text-3xl font-bold text-center">Table Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <ValidationStats assignments={assignments} />

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'compact' ? 'outline' : 'ghost'}
                onClick={() => setViewMode('compact')}
                size="sm"
                className={viewMode === 'compact' ? 'border-2 border-primary' : ''}
                disabled={editMode}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Compact
              </Button>
              <Button
                variant={viewMode === 'detailed' ? 'outline' : 'ghost'}
                onClick={() => setViewMode('detailed')}
                size="sm"
                className={viewMode === 'detailed' ? 'border-2 border-primary' : ''}
                disabled={editMode}
              >
                <List className="h-4 w-4 mr-2" />
                Detailed
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
              {availableVersions.length > 0 && (
                <Select value={currentVersion} onValueChange={handleVersionChange} disabled={editMode}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Latest</SelectItem>
                    {availableVersions.map((version) => (
                      <SelectItem key={version.version_id} value={version.version_id}>
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
              <Button variant="outline" onClick={downloadCSV} size="sm">
                Download CSV
              </Button>
              <Button variant="outline" onClick={handleRegenerateAssignments} size="sm" disabled={editMode}>
                Regenerate
              </Button>
              <Button variant="outline" onClick={handleClearAssignments} size="sm" disabled={editMode}>
                Clear
              </Button>
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
    </div>
  )
}

export default TableAssignmentsPage