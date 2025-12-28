import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart } from 'lucide-react'

interface Participant {
  name: string;
  religion: string;
  gender: string;
  partner: string | null;
}

interface Assignment {
  session: number;
  tables: {
    [key: number]: Participant[];
  };
}

interface TableAssignmentsProps {
  assignment: Assignment;
}

const TableAssignments: React.FC<TableAssignmentsProps> = ({ assignment }) => {
  const calculateTableStats = (participants: Participant[]) => {
    const genderCounts: { [key: string]: number } = {}
    const religions = new Set<string>()

    participants.forEach(p => {
      genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1
      religions.add(p.religion)
    })

    const genderSplit = Object.entries(genderCounts)
      .map(([gender, count]) => `${count}${gender.charAt(0)}`)
      .join('/')

    return {
      count: participants.length,
      genderSplit,
      religionCount: religions.size
    }
  }

  const getGenderColor = (gender: string): string => {
    const colors: { [key: string]: string } = {
      'Male': 'bg-blue-100 text-blue-800',
      'Female': 'bg-pink-100 text-pink-800',
      'Non-binary': 'bg-purple-100 text-purple-800',
      'Nonbinary': 'bg-purple-100 text-purple-800',
      'Genderqueer': 'bg-violet-100 text-violet-800',
      'Other': 'bg-purple-100 text-purple-800',
      'M': 'bg-blue-100 text-blue-800',
      'F': 'bg-pink-100 text-pink-800',
    }
    // Fallback to neutral gray for any other gender identity
    return colors[gender] || 'bg-gray-100 text-gray-800'
  }

  const getReligionColor = (religion: string): string => {
    const colors: { [key: string]: string } = {
      'Christian': 'bg-green-100 text-green-800',
      'Muslim': 'bg-teal-100 text-teal-800',
      'Jewish': 'bg-indigo-100 text-indigo-800',
      'Hindu': 'bg-orange-100 text-orange-800',
      'Buddhist': 'bg-yellow-100 text-yellow-800',
      'Sikh': 'bg-amber-100 text-amber-800',
      'Other': 'bg-gray-100 text-gray-800',
      'None': 'bg-slate-100 text-slate-800',
    }
    return colors[religion] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Session {assignment.session}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(assignment.tables)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([tableNumber, participants]) => {
            const stats = calculateTableStats(participants)

            return (
              <Card key={tableNumber}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Table {tableNumber}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {stats.count} {stats.count === 1 ? 'person' : 'people'} • {stats.genderSplit} • {stats.religionCount} {stats.religionCount === 1 ? 'religion' : 'religions'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {participants.map((participant, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{participant.name}</span>
                            {participant.partner && (
                              <div className="flex items-center gap-1 text-xs text-red-600">
                                <Heart className="h-3 w-3 fill-current" />
                                <span className="text-muted-foreground">with {participant.partner}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getReligionColor(participant.religion)}`}>
                              {participant.religion}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getGenderColor(participant.gender)}`}>
                              {participant.gender}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}

export default TableAssignments
