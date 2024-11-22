import React, { useState, useEffect } from "react"
import { useNavigate, useLocation } from 'react-router-dom'
import TableAssignments from "../components/TableAssignments/TableAssignments"
import { Button } from "@/components/ui/button"
import { dummyData } from "./dummyData"


  const TableAssignmentsPage: React.FC = () => {
    const [assignments, setAssignments] = useState<any[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const navigate = useNavigate()
    const location = useLocation()
    // const assignments = location.state?.assignments || []
  
    const handleClearAssignments = () => {
      navigate('/')
    }

    useEffect(() => {
        const fetchAssignments = async () => {
          // Check if we're running in development mode
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

      if (loading) {
          return (
              <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        )
    }

    if (error) {
      return (
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-500">{error}</p>
        </div>
      )
    }
    
    return (
      <div className="container mx-auto p-4">
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Table Assignments</h1>
          <Button onClick={handleClearAssignments} variant="outline">
            Clear Assignments
          </Button>
        </div>
        <TableAssignments assignments={assignments} />
      </div>
    )
  }
  
  export default TableAssignmentsPage