import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import { Assignment, Participant } from './TableAssignmentsPage'
import CircularTable from '@/components/SeatingChart/CircularTable'
import { API_BASE_URL } from '@/config/api'
import { authenticatedFetch } from '@/utils/apiClient'

interface SeatingTable {
  table_number: number
  seats: { position: number; name: string; religion: string; is_facilitator?: boolean }[]
}

interface SeatingData {
  session: number
  tables: SeatingTable[]
  absent_participants?: { name: string; religion: string }[]
}

interface LocationState {
  assignments: Assignment[]
  sessionId: string
}

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase()
}

function sortByLastName(a: string, b: string): number {
  const lastA = getLastName(a)
  const lastB = getLastName(b)
  if (lastA !== lastB) return lastA.localeCompare(lastB)
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

const RosterPrintPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const [seatingBySession, setSeatingBySession] = useState<Record<number, SeatingData>>({})

  const handleBack = () => navigate(-1)
  const handlePrint = () => window.print()

  useEffect(() => {
    if (!state?.assignments || !state?.sessionId) return

    const fetchSeating = async () => {
      const results: Record<number, SeatingData> = {}
      await Promise.all(
        state.assignments.map(async (assignment) => {
          try {
            const resp = await authenticatedFetch(
              `${API_BASE_URL}/api/assignments/seating/${state.sessionId}?session=${assignment.session}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments: [assignment] }),
              }
            )
            if (resp.ok) {
              const data = await resp.json()
              results[assignment.session] = data
            }
          } catch {
            // Fail silently — seating charts are supplementary
          }
        })
      )
      setSeatingBySession(results)
    }

    fetchSeating()
  }, [state])

  if (!state || !state.assignments) {
    return (
      <div className="container mx-auto p-8 max-w-4xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Data Available</h1>
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

  const { assignments } = state
  const isMultiSession = assignments.length > 1
  const today = new Date().toLocaleDateString()

  return (
    <div className="min-h-screen bg-white">
      <div className="no-print border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto p-4">
          <div className="flex justify-between items-center">
            <Button onClick={handleBack} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-8 max-w-3xl">
        {assignments.map((assignment) => {
          const absent = assignment.absentParticipants || []
          const title = isMultiSession
            ? `Session ${assignment.session} Roster`
            : 'Roster'
          const tableNumbers = Object.keys(assignment.tables)
            .map(Number)
            .sort((a, b) => a - b)

          return (
            <div key={assignment.session} className="roster-section mb-10">
              <div className="flex justify-between items-baseline mb-6">
                <h2 className="text-xl font-bold">{title}</h2>
                <span className="text-sm text-gray-500 print:text-black">{today}</span>
              </div>

              {tableNumbers.map((tableNum) => {
                const people = (assignment.tables[tableNum] || []).filter(
                  (p): p is Participant => p !== null
                )
                const facilitators = people
                  .filter((p) => p.is_facilitator)
                  .map((p) => p.name)
                  .sort(sortByLastName)
                const participants = people
                  .filter((p) => !p.is_facilitator)
                  .map((p) => p.name)
                  .sort(sortByLastName)

                return (
                  <div key={tableNum} className="mb-6">
                    <h3 className="text-lg font-bold mb-2 border-b-2 border-gray-300 pb-1">
                      Table {tableNum}
                    </h3>

                    {facilitators.length > 0 && (
                      <div className="mb-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 print:text-black">
                          Facilitators
                        </h4>
                        <ul className="ml-4">
                          {facilitators.map((name) => (
                            <li key={name} className="py-0.5">{name}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 print:text-black">
                        Participants
                      </h4>
                      <ul className="ml-4">
                        {participants.map((name) => (
                          <li key={name} className="py-0.5">{name}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              })}

              {absent.length > 0 && (
                <p className="mt-4 text-sm text-gray-600 print:text-black">
                  <span className="font-semibold">Absent:</span>{' '}
                  {absent.map((p) => p.name).join(', ')}
                </p>
              )}
            </div>
          )
        })}

        {Object.keys(seatingBySession).length > 0 && (
          <div className="seating-section">
            {assignments.map((assignment) => {
              const seating = seatingBySession[assignment.session]
              if (!seating) return null
              const seatingTitle = isMultiSession
                ? `Session ${assignment.session} Seating Chart`
                : 'Seating Chart'
              const tableCount = seating.tables.length
              const gridCols = tableCount >= 6 ? 'grid-cols-3' : 'grid-cols-2'

              return (
                <div key={`seating-${assignment.session}`} className="seating-session mb-10">
                  <h2 className="text-xl font-bold mb-6">{seatingTitle}</h2>
                  <div className={`grid ${gridCols} gap-4`}>
                    {seating.tables.map((table) => (
                      <CircularTable
                        key={table.table_number}
                        tableNumber={table.table_number}
                        seats={table.seats}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default RosterPrintPage
