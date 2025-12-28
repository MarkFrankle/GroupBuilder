import React, { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import TableAssignments from "../components/TableAssignments/TableAssignments"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from 'lucide-react'
import { dummyData } from "../data/dummyData"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from 'lucide-react'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

interface Assignment {
  session: number;
  tables: {
    [key: number]: {
      name: string;
      religion: string;
      gender: string;
      partner: string | null;
    }[];
  };
}

const TableAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<number>(1)

  const navigate = useNavigate()

  const useRealData = true;


  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        if (process.env.NODE_ENV === 'development' && !useRealData) {
          setAssignments(dummyData)
        } else {
          // Try to get session ID from navigation state
          const sessionId = (window.history.state?.usr as any)?.sessionId;

          if (!sessionId) {
            // No session ID available, user might have refreshed the page
            throw new Error('Session expired. Please upload a file again.')
          }

          const response = await fetch(`${API_BASE_URL}/api/assignments/results/${sessionId}`)
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

  const handleRegenerateAssignments = async () => {
    setLoading(true)
    setError(null)
    try {
      const sessionId = (window.history.state?.usr as any)?.sessionId;

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

      const newAssignments = await response.json()
      setAssignments(newAssignments)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate assignments")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (format: string) => {
    if (format === 'csv') {
      downloadCSV()
    } else {
      // TODO: Implement PDF and Excel export
      alert(`${format.toUpperCase()} export coming soon!`)
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
          <div className="flex justify-center space-x-4 mb-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Download Assignments <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleDownload('pdf')}>
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('xlsx')}>
                  Download Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('csv')}>
                  Download CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={handleRegenerateAssignments}>
              Regenerate Assignments
            </Button>
            <Button variant="outline" onClick={handleClearAssignments}>
              Clear Assignments
            </Button>
          </div>
          {currentAssignment && <TableAssignments assignment={currentAssignment} />}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={handlePreviousSession} disabled={currentSession === 1}>
              Previous Session
            </Button>
            <Button variant="outline" onClick={handleNextSession} disabled={currentSession === assignments.length}>
              Next Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TableAssignmentsPage