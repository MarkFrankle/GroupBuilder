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

interface Assignment {
  session: number;
  tables: {
    [key: number]: {
      name: string;
      religion: string;
      gender: string;
      partner: string;
    }[];
  };
}

const TableAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<number>(1)

  const navigate = useNavigate()

  useEffect(() => {
    const fetchAssignments = async () => {
      if (process.env.NODE_ENV === "development") {
        // Use dummy data in development
        setAssignments(dummyData)
        setLoading(false)
      } else {
        try {
          // In production, fetch from API
          const response = await fetch("/api/table-assignments")
          if (!response.ok) {
            throw new Error("Failed to fetch assignments")
          }
          const data = await response.json()
          setAssignments(data)
        } catch (err) {
          setError(err instanceof Error ? err.message : "An unknown error occurred")
        } finally {
          setLoading(false)
        }
      }
    }

    fetchAssignments()
  }, [])

  const handleClearAssignments = () => {
    navigate('/')
  }

  const handleRegenerateAssignments = async () => {
    setLoading(true)
    try {
      // In a real application, you would call an API endpoint to regenerate assignments
      // For this example, we'll just simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // For demonstration, we'll just shuffle the current assignments
      setAssignments(prevAssignments => [...prevAssignments].sort(() => Math.random() - 0.5))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate assignments")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (format: string) => {
    // TODO: Implement download logic
    console.log(`Downloading assignments as ${format}...`)
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
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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