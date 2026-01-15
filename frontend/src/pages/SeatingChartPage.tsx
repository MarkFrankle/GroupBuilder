import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import CircularTable, { Seat } from '../components/SeatingChart/CircularTable'

interface Table {
  table_number: number
  seats: Seat[]
}

interface AbsentParticipant {
  name: string
  religion: string
}

interface SeatingData {
  session: number
  tables: Table[]
  absent_participants?: AbsentParticipant[]
}

interface LocationState {
  seatingData: SeatingData
}

/**
 * SeatingChartPage displays a printable view of circular seating arrangements
 * for a single session. Each table is shown as a circle with names positioned
 * around the perimeter.
 */
const SeatingChartPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const topRef = useRef<HTMLDivElement>(null)

  // Disable browser scroll restoration and force scroll to top
  useLayoutEffect(() => {
    // Disable automatic scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    // Immediately scroll to top
    window.scrollTo(0, 0)
    
    // Also scroll the ref element into view
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }, [])

  useEffect(() => {
    // Backup scroll attempts with multiple delays to override any browser behavior
    const timers = [0, 10, 50, 100].map(delay => 
      setTimeout(() => {
        window.scrollTo(0, 0)
        if (topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
        }
      }, delay)
    )
    
    return () => timers.forEach(timer => clearTimeout(timer))
  }, [])

  const handleBack = () => {
    navigate(-1)
  }

  const handlePrint = () => {
    window.print()
  }

  // Handle missing state (e.g., page refresh)
  if (!state || !state.seatingData) {
    return (
      <div className="container mx-auto p-8 max-w-4xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Seating Data Available</h1>
          <p className="text-gray-600 mb-6">
            Please return to the table assignments page and try again.
          </p>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
        </div>
      </div>
    )
  }

  const { seatingData } = state
  const { session, tables, absent_participants } = seatingData

  // Determine grid columns based on number of tables
  const gridCols = tables.length >= 6 ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2'

  return (
    <div ref={topRef} className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header with controls (hidden on print) */}
      <div className="no-print border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto p-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              Session {session} Seating Chart
            </h1>
            <div className="flex gap-2">
              <Button onClick={handleBack} variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handlePrint} variant="default" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto p-8">
        {/* Print-only header */}
        <div className="hidden print:block mb-6 text-center">
          <h1 className="text-2xl font-bold">Session {session} Seating Chart</h1>
        </div>

        {/* Grid of circular tables */}
        <div className={`seating-grid grid grid-cols-1 ${gridCols} gap-6 mb-8`}>
          {tables.map((table) => (
            <CircularTable
              key={table.table_number}
              tableNumber={table.table_number}
              seats={table.seats}
            />
          ))}
        </div>

        {/* Absent participants (if any) */}
        {absent_participants && absent_participants.length > 0 && (
          <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg print:bg-white print:border-gray-400">
            <h2 className="text-lg font-semibold mb-2">Absent Participants</h2>
            <p className="text-gray-700">
              {absent_participants.map((p) => p.name).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SeatingChartPage
