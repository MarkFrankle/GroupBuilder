import React, { useState, useMemo } from 'react'
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
  editMode?: boolean;
  onSwap?: (tableNum1: number, participantIndex1: number, tableNum2: number, participantIndex2: number) => void;
}

const EMPTY_PARTICIPANT: Participant = {
  name: '',
  religion: '',
  gender: '',
  partner: null
}

const TableAssignments: React.FC<TableAssignmentsProps> = ({ assignment, editMode = false, onSwap }) => {
  const [selectedSlot, setSelectedSlot] = useState<{tableNum: number, index: number} | null>(null)

  const tablesWithEmptySlots = useMemo(() => {
    const tables = { ...assignment.tables }
    const tableSizes = Object.values(tables).map(p => p.length)
    const maxSize = Math.max(...tableSizes)

    Object.keys(tables).forEach(tableNum => {
      const key = Number(tableNum)
      const currentSize = tables[key].length
      if (currentSize < maxSize) {
        tables[key] = [...tables[key], ...Array(maxSize - currentSize).fill(EMPTY_PARTICIPANT)]
      }
    })

    return tables
  }, [assignment.tables])

  const calculateTableStats = (participants: Participant[]) => {
    const realParticipants = participants.filter(p => p && p.name !== '')
    const genderCounts: { [key: string]: number } = {}
    const religions = new Set<string>()

    realParticipants.forEach(p => {
      genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1
      religions.add(p.religion)
    })

    const genderSplit = Object.entries(genderCounts)
      .map(([gender, count]) => `${count}${gender.charAt(0)}`)
      .join('/')

    // Check gender imbalance (deviation > 1)
    const genderCountValues = Object.values(genderCounts)
    const hasGenderImbalance = genderCountValues.length > 0 &&
      (Math.max(...genderCountValues) - Math.min(...genderCountValues) > 1)

    const coupleViolations = new Set<string>()
    realParticipants.forEach(p => {
      if (p.partner && realParticipants.some(other => other && other.name === p.partner)) {
        const coupleKey = [p.name, p.partner].sort().join('-')
        coupleViolations.add(coupleKey)
      }
    })

    return {
      count: realParticipants.length,
      genderSplit: genderSplit || '0',
      religionCount: religions.size,
      hasCoupleViolation: coupleViolations.size > 0,
      hasGenderImbalance
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
      'Secular': 'bg-slate-100 text-slate-800',
      'Other': 'bg-gray-100 text-gray-800',
      'None': 'bg-slate-100 text-slate-800',
    }
    return colors[religion] || 'bg-gray-100 text-gray-800'
  }

  const handleSlotClick = (tableNum: number, index: number) => {
    if (!editMode || !onSwap) return

    const participant = tablesWithEmptySlots[tableNum][index]
    const isEmpty = !participant || participant.name === ''

    if (!selectedSlot) {
      setSelectedSlot({ tableNum, index })
    } else {
      if (selectedSlot.tableNum === tableNum && selectedSlot.index === index) {
        setSelectedSlot(null)
      } else {
        // Prevent swapping with/from empty slots on the same table
        const selectedParticipant = tablesWithEmptySlots[selectedSlot.tableNum][selectedSlot.index]
        const selectedIsEmpty = !selectedParticipant || selectedParticipant.name === ''

        if (selectedSlot.tableNum === tableNum && (isEmpty || selectedIsEmpty)) {
          return
        }
        onSwap(selectedSlot.tableNum, selectedSlot.index, tableNum, index)
        setSelectedSlot(null)
      }
    }
  }

  const isSelected = (tableNum: number, index: number) => {
    return selectedSlot?.tableNum === tableNum && selectedSlot?.index === index
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        Session {assignment.session}
        {editMode && <span className="text-sm font-normal text-muted-foreground ml-3">(Edit Mode)</span>}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(editMode ? tablesWithEmptySlots : assignment.tables)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([tableNumber, participants]) => {
            const stats = calculateTableStats(participants)

            return (
              <Card key={tableNumber}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className={stats.hasCoupleViolation ? 'text-red-600' : ''}>Table {tableNumber}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {stats.count} {stats.count === 1 ? 'person' : 'people'} • <span className={stats.hasGenderImbalance ? 'text-red-600' : ''}>{stats.genderSplit}</span> • {stats.religionCount} {stats.religionCount === 1 ? 'religion' : 'religions'}
                      {stats.hasCoupleViolation && <span className="text-red-600"> • ⚠️ Couple</span>}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {participants.map((participant, index) => {
                      const isEmpty = !participant || participant.name === ''
                      const selected = isSelected(Number(tableNumber), index)
                      const isTarget = editMode && selectedSlot && !selected

                      return (
                        <div
                          key={index}
                          onClick={() => handleSlotClick(Number(tableNumber), index)}
                          className={`
                            flex items-start gap-2 p-3 rounded-lg transition-all
                            ${isEmpty ? 'border-2 border-dashed border-gray-300 bg-gray-50 min-h-[60px]' : 'bg-gray-50'}
                            ${editMode ? 'cursor-pointer' : ''}
                            ${selected ? 'ring-4 ring-blue-500 bg-blue-50' : ''}
                            ${isTarget ? 'ring-2 ring-green-400 hover:ring-green-500 hover:bg-green-50' : isEmpty ? '' : 'hover:bg-gray-100'}
                          `}
                        >
                          {isEmpty ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                              {editMode ? 'Empty slot' : null}
                            </div>
                          ) : (
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{participant.name}</span>
                                {participant.partner && (() => {
                                  const partnerAtSameTable = participants.some(p => p && p.name === participant.partner)
                                  return (
                                    <div className="flex items-center gap-1 text-xs text-red-600">
                                      <Heart className="h-3 w-3 fill-current" />
                                      <span className={partnerAtSameTable ? 'text-red-600' : 'text-gray-900'}>with {participant.partner}</span>
                                    </div>
                                  )
                                })()}
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
                          )}
                        </div>
                      )
                    })}
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
