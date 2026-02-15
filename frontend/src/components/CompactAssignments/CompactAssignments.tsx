import React, { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"

interface Participant {
  name: string;
  religion: string;
  gender: string;
  partner: string | null;
  is_facilitator?: boolean;
}

interface Assignment {
  session: number;
  tables: {
    [key: number]: (Participant | null)[];
  };
  absentParticipants?: Participant[];
}

interface CompactAssignmentsProps {
  assignments: Assignment[];
}

const CompactAssignments: React.FC<CompactAssignmentsProps> = ({ assignments }) => {
  const [highlightedPerson, setHighlightedPerson] = useState<string | null>(null)

  // Generate consistent color for each participant based on their name
  const getPersonColor = (name: string): string => {
    // djb2 hash function - better distribution than simple character sum
    let hash = 5381
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) + hash) + name.charCodeAt(i) // hash * 33 + char
    }

    // Use predefined color palette for better visibility
    const colors = [
      'bg-blue-100 hover:bg-blue-200',
      'bg-green-100 hover:bg-green-200',
      'bg-yellow-100 hover:bg-yellow-200',
      'bg-purple-100 hover:bg-purple-200',
      'bg-pink-100 hover:bg-pink-200',
      'bg-indigo-100 hover:bg-indigo-200',
      'bg-red-100 hover:bg-red-200',
      'bg-orange-100 hover:bg-orange-200',
      'bg-teal-100 hover:bg-teal-200',
      'bg-cyan-100 hover:bg-cyan-200',
      'bg-lime-100 hover:bg-lime-200',
      'bg-amber-100 hover:bg-amber-200',
    ]

    const index = Math.abs(hash) % colors.length
    return colors[index]
  }

  const handlePersonClick = (name: string) => {
    setHighlightedPerson(highlightedPerson === name ? null : name)
  }

  return (
    <div className="space-y-4">
      {highlightedPerson && (
        <div
          className="bg-blue-50 border border-blue-200 rounded p-3 text-sm"
          data-testid="highlight-message"
        >
          <strong>{highlightedPerson}</strong> is highlighted across all sessions. Click again to clear.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map((assignment) => (
          <Card key={assignment.session} className="overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b">
              <h3 className="font-semibold text-center">Session {assignment.session}</h3>
            </div>
            <CardContent className="p-4 space-y-3">
              {Object.entries(assignment.tables)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([tableNum, participants]) => (
                  <div key={tableNum} className="space-y-1">
                    <div className="text-xs font-semibold text-gray-600">Table {tableNum}</div>
                    {(() => {
                      const facilitators = participants.filter((p): p is Participant => p !== null && !!p.is_facilitator)
                      return facilitators.length > 0 ? (
                        <div className="text-xs text-gray-500">Facilitators: {facilitators.map(f => f.name).join(', ')}</div>
                      ) : null
                    })()}
                    <div className="flex flex-wrap gap-1">
                      {participants.filter((p): p is Participant => p !== null).map((participant, idx) => {
                        const isHighlighted = participant.name === highlightedPerson
                        const colorClass = getPersonColor(participant.name)

                        return (
                          <button
                            key={idx}
                            onClick={() => handlePersonClick(participant.name)}
                            className={`
                              px-2 py-1 rounded text-xs transition-all
                              ${colorClass}
                              ${participant.is_facilitator ? 'font-semibold ring-1 ring-amber-400' : 'font-medium'}
                              ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                              cursor-pointer
                            `}
                            title={`${participant.name}\n${participant.religion}, ${participant.gender}${participant.partner ? `\nPartner: ${participant.partner}` : ''}${participant.is_facilitator ? '\n(Facilitator)' : ''}`}
                          >
                            {participant.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

              {/* Show absent participants if any */}
              {assignment.absentParticipants && assignment.absentParticipants.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-amber-200">
                  <div className="text-xs font-semibold text-amber-700">Absent</div>
                  <div className="flex flex-wrap gap-1">
                    {assignment.absentParticipants.map((participant, idx) => {
                      const isHighlighted = participant.name === highlightedPerson
                      const colorClass = getPersonColor(participant.name)

                      return (
                        <button
                          key={idx}
                          onClick={() => handlePersonClick(participant.name)}
                          className={`
                            px-2 py-1 rounded text-xs font-medium transition-all opacity-60
                            ${colorClass}
                            ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                            cursor-pointer
                          `}
                          title={`${participant.name}\n${participant.religion}, ${participant.gender}${participant.partner ? `\nPartner: ${participant.partner}` : ''}\n(Absent)`}
                        >
                          {participant.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-xs text-muted-foreground text-center mt-4">
        Click any name to highlight them across all sessions. Hover to see details.
      </div>
    </div>
  )
}

export default CompactAssignments
