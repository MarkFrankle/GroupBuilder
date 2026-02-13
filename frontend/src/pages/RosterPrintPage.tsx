import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import { Assignment, Participant } from './TableAssignmentsPage'

interface LocationState {
  assignments: Assignment[]
  sessionId: string
}

interface RosterEntry {
  name: string
  table: number
  is_facilitator: boolean
}

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase()
}

function sortByLastName(a: RosterEntry, b: RosterEntry): number {
  const lastA = getLastName(a.name)
  const lastB = getLastName(b.name)
  if (lastA !== lastB) return lastA.localeCompare(lastB)
  return a.name.localeCompare(b.name)
}

function buildRosterEntries(assignment: Assignment): RosterEntry[] {
  const entries: RosterEntry[] = []
  for (const [tableNum, participants] of Object.entries(assignment.tables)) {
    for (const p of participants) {
      if (p) {
        entries.push({
          name: p.name,
          table: Number(tableNum),
          is_facilitator: !!p.is_facilitator,
        })
      }
    }
  }
  return entries
}

const RosterPrintPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const handleBack = () => navigate(-1)
  const handlePrint = () => window.print()

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
            <Button onClick={handlePrint} size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-8 max-w-4xl">
        {assignments.map((assignment) => {
          const allEntries = buildRosterEntries(assignment)
          const participants = allEntries.filter(e => !e.is_facilitator).sort(sortByLastName)
          const facilitators = allEntries.filter(e => e.is_facilitator).sort(sortByLastName)
          const absent = assignment.absentParticipants || []

          const title = isMultiSession
            ? `Session ${assignment.session} Roster`
            : 'Roster'

          return (
            <div key={assignment.session} className="mb-10">
              <div className="flex justify-between items-baseline mb-4">
                <h2 className="text-xl font-bold">{title}</h2>
                <span className="text-sm text-gray-500">{today}</span>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-1 px-2">Name</th>
                    <th className="text-left py-1 px-2">Table</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((entry) => (
                    <tr key={entry.name} className="border-b border-gray-200">
                      <td className="py-1 px-2">{entry.name}</td>
                      <td className="py-1 px-2">{entry.table}</td>
                    </tr>
                  ))}
                </tbody>
                {facilitators.length > 0 && (
                  <>
                    <tbody>
                      <tr>
                        <td colSpan={2} className="pt-4 pb-1 px-2 font-semibold">
                          Facilitators
                        </td>
                      </tr>
                      {facilitators.map((entry) => (
                        <tr key={entry.name} className="border-b border-gray-200">
                          <td className="py-1 px-2">{entry.name}</td>
                          <td className="py-1 px-2">{entry.table}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>

              {absent.length > 0 && (
                <p className="mt-4 text-sm text-gray-600">
                  <span className="font-semibold">Absent:</span>{' '}
                  {absent.map(p => p.name).join(', ')}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RosterPrintPage
