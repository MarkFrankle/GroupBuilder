import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart } from 'lucide-react'

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

interface TableAssignmentsProps {
  assignment: Assignment;
  editMode?: boolean;
  onSwap?: (tableNum1: number, participantIndex1: number, tableNum2: number, participantIndex2: number) => void;
  selectedAbsentParticipant?: Participant | null;
  onMarkAbsent?: (tableNum: number, participantIndex: number) => void;
  onPlaceAbsent?: (tableNum: number, seatIndex: number) => void;
  onSelectionChange?: (tableNum: number | null, participantIndex: number | null) => void;
}

const TableAssignments: React.FC<TableAssignmentsProps> = ({
  assignment,
  editMode = false,
  onSwap,
  selectedAbsentParticipant = null,
  onMarkAbsent,
  onPlaceAbsent,
  onSelectionChange
}) => {
  const [selectedSlot, setSelectedSlot] = useState<{tableNum: number, index: number} | null>(null)

  // Notify parent when selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      if (selectedSlot) {
        onSelectionChange(selectedSlot.tableNum, selectedSlot.index)
      } else {
        onSelectionChange(null, null)
      }
    }
  }, [selectedSlot, onSelectionChange])

  // Clear selection when exiting edit mode or when absent participant is selected
  React.useEffect(() => {
    if (!editMode || selectedAbsentParticipant) {
      setSelectedSlot(null)
    }
  }, [editMode, selectedAbsentParticipant])

  // Clear selection if the selected participant was removed or is null
  React.useEffect(() => {
    if (selectedSlot) {
      const table = assignment.tables[selectedSlot.tableNum]

      if (!table) {
        // Table doesn't exist anymore
        setSelectedSlot(null)
        return
      }

      // Check if index is out of bounds (participant was removed)
      if (selectedSlot.index >= table.length) {
        setSelectedSlot(null)
        return
      }

      // Check if participant is null/undefined
      const participant = table[selectedSlot.index]
      if (participant === null || participant === undefined) {
        setSelectedSlot(null)
      }
    }
  }, [selectedSlot, assignment.tables])

  const tablesWithEmptySlots = useMemo(() => {
    if (!editMode) return assignment.tables

    const tables: { [key: number]: (Participant | null)[] } = {}

    Object.keys(assignment.tables).forEach(tableNum => {
      const key = Number(tableNum)
      const table = assignment.tables[key]
      const realParticipants = table.filter((p): p is Participant => p !== null && p !== undefined)
      const hasFacilitators = realParticipants.some(p => p.is_facilitator)

      // Keep original order, append empty slots at end
      // Second null is the facilitator empty slot (only when facilitators exist)
      if (hasFacilitators) {
        tables[key] = [...realParticipants, null, null]
      } else {
        tables[key] = [...realParticipants, null]
      }
    })

    return tables
  }, [assignment.tables, editMode])

  // Track which empty slot index is for facilitators vs regulars per table
  const facilitatorEmptySlotIndex = useMemo(() => {
    if (!editMode) return {}
    const map: { [tableNum: number]: number } = {}
    Object.keys(tablesWithEmptySlots).forEach(tableNum => {
      const key = Number(tableNum)
      const arr = tablesWithEmptySlots[key]
      const hasFacilitators = arr.some(p => p !== null && p !== undefined && p.is_facilitator)
      if (hasFacilitators) {
        // Last null is the facilitator empty slot
        map[key] = arr.length - 1
      }
    })
    return map
  }, [tablesWithEmptySlots, editMode])

  const calculateTableStats = (participants: (Participant | null)[]) => {
    const realParticipants = participants.filter((p): p is Participant => p !== null)
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

    const facilitatorCount = realParticipants.filter(p => p.is_facilitator).length

    return {
      count: realParticipants.length,
      genderSplit: genderSplit || '0',
      religionCount: religions.size,
      hasCoupleViolation: coupleViolations.size > 0,
      hasGenderImbalance,
      facilitatorCount,
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
    if (!editMode) return

    const participant = tablesWithEmptySlots[tableNum][index]
    const isEmpty = participant === null || participant === undefined

    // If an absent participant is selected and user clicks an empty seat, place them there
    if (selectedAbsentParticipant && isEmpty && onPlaceAbsent) {
      onPlaceAbsent(tableNum, index)
      return
    }

    // If an absent participant is selected but they click a non-empty seat, ignore
    if (selectedAbsentParticipant) {
      return
    }

    // Normal swap logic
    if (!onSwap) return

    if (!selectedSlot) {
      // Don't allow selecting empty slots
      if (!isEmpty) {
        setSelectedSlot({ tableNum, index })
      }
    } else {
      if (selectedSlot.tableNum === tableNum && selectedSlot.index === index) {
        setSelectedSlot(null)
      } else {
        // Prevent swapping with/from empty slots on the same table
        const selectedParticipant = tablesWithEmptySlots[selectedSlot.tableNum][selectedSlot.index]
        const selectedIsEmpty = selectedParticipant === null || selectedParticipant === undefined

        if (selectedSlot.tableNum === tableNum && (isEmpty || selectedIsEmpty)) {
          return
        }

        // Facilitator restriction: facilitators swap with facilitators, regulars with regulars
        const selectedIsFacilitator = selectedParticipant?.is_facilitator ?? false
        const targetIsFacilitator = participant?.is_facilitator ?? false
        if (!isEmpty && selectedIsFacilitator !== targetIsFacilitator) {
          return
        }

        // Empty slot type restriction: facilitators only to facilitator empty slots, regulars to regular empty slots
        if (isEmpty) {
          const isFacilitatorEmptySlot = facilitatorEmptySlotIndex[tableNum] === index
          if (selectedIsFacilitator !== isFacilitatorEmptySlot) {
            return
          }
        }

        onSwap(selectedSlot.tableNum, selectedSlot.index, tableNum, index)
        setSelectedSlot(null)
      }
    }
  }

  const isSelected = (tableNum: number, index: number) => {
    return selectedSlot?.tableNum === tableNum && selectedSlot?.index === index
  }

  // Calculate table sizes and balance info
  const tableSizeInfo = useMemo(() => {
    const tables = editMode ? tablesWithEmptySlots : assignment.tables
    const sizeMap = new Map<number, number>()

    // Count total non-absent participants
    let totalParticipants = 0
    Object.entries(tables).forEach(([tableNum, participants]) => {
      const count = participants.filter((p): p is Participant => p !== null && p !== undefined).length
      sizeMap.set(Number(tableNum), count)
      totalParticipants += count
    })

    const numTables = Object.keys(tables).length
    const expectedMin = Math.floor(totalParticipants / numTables)
    const expectedMax = Math.ceil(totalParticipants / numTables)

    return { sizeMap, expectedMin, expectedMax }
  }, [editMode, tablesWithEmptySlots, assignment.tables])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        Session {assignment.session}
        {editMode && <span className="text-sm font-normal text-muted-foreground ml-3">(Edit Mode)</span>}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(tablesWithEmptySlots)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([tableNumber, participants], tableIndex) => {
            const stats = calculateTableStats(participants)
            // Show red when table size is outside expected range (based on total participants / number of tables)
            const tableSize = tableSizeInfo.sizeMap.get(Number(tableNumber)) || 0
            const isUnbalanced = tableSize < tableSizeInfo.expectedMin || tableSize > tableSizeInfo.expectedMax

            return (
              <Card key={tableNumber}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className={stats.hasCoupleViolation || isUnbalanced ? 'text-red-600' : ''}>Table {tableNumber}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      <span className={isUnbalanced ? 'text-red-600' : ''}>{stats.count} {stats.count === 1 ? 'person' : 'people'}</span> • <span className={stats.facilitatorCount === 0 ? 'text-red-600 font-semibold' : ''}>{stats.facilitatorCount} {stats.facilitatorCount === 1 ? 'facilitator' : 'facilitators'}</span> • <span className={stats.hasGenderImbalance ? 'text-red-600' : ''}>{stats.genderSplit}</span> • {stats.religionCount} {stats.religionCount === 1 ? 'religion' : 'religions'}
                      {stats.hasCoupleViolation && <span className="text-red-600"> • ⚠️ Couple</span>}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const allParticipants = participants
                    const tNum = Number(tableNumber)
                    const facEmptyIdx = facilitatorEmptySlotIndex[tNum]
                    const indexed = allParticipants.map((p, i) => ({ participant: p, index: i }))

                    // Split into regular participants + their empty slot, and facilitators + their empty slot
                    const regularParticipants = indexed.filter(({ participant, index }) => {
                      if (participant === null || participant === undefined) {
                        // In edit mode with facilitators, last null goes to facilitator section
                        return index !== facEmptyIdx
                      }
                      return !participant.is_facilitator
                    })
                    const facilitatorEntries = indexed.filter(({ participant, index }) => {
                      if (participant === null || participant === undefined) {
                        return index === facEmptyIdx
                      }
                      return participant.is_facilitator
                    })

                    const renderSlot = ({ participant, index: slotIndex }: { participant: Participant | null, index: number }) => {
                      const isEmpty = participant === null || participant === undefined
                      const selected = isSelected(Number(tableNumber), slotIndex)

                      const selectedParticipant = selectedSlot ? tablesWithEmptySlots[selectedSlot.tableNum][selectedSlot.index] : null
                      const selectedIsEmpty = selectedParticipant === null || selectedParticipant === undefined

                      const sameTable = selectedSlot && selectedSlot.tableNum === Number(tableNumber)
                      const shouldExclude = sameTable && (isEmpty || selectedIsEmpty)

                      const selectedIsFacilitator = selectedParticipant?.is_facilitator ?? false
                      const targetIsFacilitator = participant?.is_facilitator ?? false
                      const isFacilitatorMismatch = !isEmpty && selectedIsFacilitator !== targetIsFacilitator

                      // Empty slot type mismatch: facilitator can only go to facilitator empty slot and vice versa
                      const isEmptySlotMismatch = isEmpty && editMode && selectedSlot && !selectedIsEmpty &&
                        (selectedIsFacilitator !== (facilitatorEmptySlotIndex[tNum] === slotIndex))

                      const isTarget = editMode && selectedSlot && !selected && !shouldExclude && !isFacilitatorMismatch && !isEmptySlotMismatch
                      const isAbsentTarget = editMode && selectedAbsentParticipant && isEmpty

                      return (
                        <div
                          key={slotIndex}
                          onClick={() => handleSlotClick(Number(tableNumber), slotIndex)}
                          className={`
                            flex items-start gap-2 p-3 rounded-lg transition-all
                            ${isEmpty ? 'border-2 border-dashed border-gray-300 bg-gray-50 min-h-[60px]' : 'bg-gray-50'}
                            ${editMode ? 'cursor-pointer' : ''}
                            ${selected ? 'ring-4 ring-blue-500 bg-blue-50' : ''}
                            ${isTarget ? 'ring-2 ring-green-400 hover:ring-green-500 hover:bg-green-50' : ''}
                            ${isAbsentTarget ? 'ring-2 ring-amber-400 hover:ring-amber-500 hover:bg-amber-50' : ''}
                            ${!isEmpty && !selected && !isTarget && editMode ? 'hover:bg-gray-100' : ''}
                          `}
                        >
                          {isEmpty ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                              Empty slot
                            </div>
                          ) : (
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{participant.name}</span>
                                {participant.partner && (() => {
                                  const partnerAtSameTable = allParticipants.some(p => p !== null && p.name === participant.partner)
                                  return (
                                    <div className="flex items-center gap-1 text-xs text-red-600">
                                      <Heart className="h-3 w-3 fill-current" />
                                      <span className={partnerAtSameTable ? 'text-red-600' : 'text-gray-900'}>with {participant.partner}</span>
                                    </div>
                                  )
                                })()}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {participant.is_facilitator && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                    Facilitator
                                  </span>
                                )}
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
                    }

                    return (
                      <>
                        <div className="space-y-3">
                          {regularParticipants.map(renderSlot)}
                        </div>
                        {facilitatorEntries.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Facilitators</h4>
                            <div className="space-y-3">
                              {facilitatorEntries.map(renderSlot)}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}

export default TableAssignments
