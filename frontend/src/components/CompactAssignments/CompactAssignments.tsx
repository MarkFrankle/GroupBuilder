import React, { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { getReligionStyle, BBT_COLORS } from '@/constants/colors'

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

const ColorLegend: React.FC = () => (
  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
    {Object.entries(BBT_COLORS).map(([religion, colors]) => (
      <div key={religion} className="flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: colors.base }}
        />
        <span>{religion}</span>
      </div>
    ))}
  </div>
)

const CompactAssignments: React.FC<CompactAssignmentsProps> = ({ assignments }) => {
  const [highlightedPerson, setHighlightedPerson] = useState<string | null>(null)

  const handlePersonClick = (name: string) => {
    setHighlightedPerson(highlightedPerson === name ? null : name)
  }

  return (
    <div className="space-y-4">
      <ColorLegend />

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
                        const religionStyle = getReligionStyle(participant.religion, participant.name)

                        return (
                          <button
                            key={idx}
                            onClick={() => handlePersonClick(participant.name)}
                            className={`
                              px-2 py-1 rounded text-xs transition-all religion-chip
                              ${participant.is_facilitator ? 'font-semibold ring-1 ring-amber-400' : 'font-medium'}
                              ${isHighlighted ? 'ring-2 ring-gray-800 ring-offset-1' : ''}
                              cursor-pointer
                            `}
                            style={religionStyle}
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
                      const religionStyle = getReligionStyle(participant.religion, participant.name)

                      return (
                        <button
                          key={idx}
                          onClick={() => handlePersonClick(participant.name)}
                          className={`
                            px-2 py-1 rounded text-xs font-medium transition-all opacity-60 religion-chip
                            ${isHighlighted ? 'ring-2 ring-gray-800 ring-offset-1' : ''}
                            cursor-pointer
                          `}
                          style={religionStyle}
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
