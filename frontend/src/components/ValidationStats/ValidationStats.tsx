import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { expectedDeviationForTableSize } from '@/utils/balanceStats'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

interface Participant {
  name: string;
  religion: string;
  gender: string;
  partner: string | null;
  is_facilitator?: boolean;
  keep_together?: boolean;
}

interface Assignment {
  session: number;
  tables: {
    [key: number]: (Participant | null)[];
  };
}

interface ValidationStatsProps {
  assignments: Assignment[];
}

interface ValidationResult {
  coupleOffendingTables: string[];
  linkedOffendingTables: string[];
  genderOffendingTables: string[];
  religionOffendingTables: string[];
  numTables: number;
  totalParticipants: number;
  repeatPairings: number;
  avgNewPeopleMet: number;
  tablesWithoutFacilitator: number;
  hasFacilitators: boolean;
  hasLinkedPairs: boolean;
}

const ValidationStats: React.FC<ValidationStatsProps> = ({ assignments }) => {
  const calculateStats = (): ValidationResult => {
    if (assignments.length === 0) {
      return {
        coupleOffendingTables: [],
        linkedOffendingTables: [],
        genderOffendingTables: [],
        religionOffendingTables: [],
        numTables: 0,
        totalParticipants: 0,
        repeatPairings: 0,
        avgNewPeopleMet: 0,
        tablesWithoutFacilitator: 0,
        hasFacilitators: false,
        hasLinkedPairs: false,
      }
    }

    // Get all unique participants
    const firstSession = assignments[0]
    const allParticipants: Participant[] = []
    Object.values(firstSession.tables).forEach(participants => {
      const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
      allParticipants.push(...realParticipants)
    })
    const totalParticipants = allParticipants.length

    // Roster-level attribute counts
    const genderRosterCounts: Record<string, number> = {}
    const religionRosterCounts: Record<string, number> = {}
    allParticipants.forEach(p => {
      genderRosterCounts[p.gender] = (genderRosterCounts[p.gender] || 0) + 1
      religionRosterCounts[p.religion] = (religionRosterCounts[p.religion] || 0) + 1
    })

    const numTables = Object.keys(firstSession.tables).length
    const allGenders = Object.keys(genderRosterCounts)
    const allReligions = Object.keys(religionRosterCounts)

    const coupleOffendingTables: string[] = []
    const linkedOffendingTables: string[] = []
    const genderOffendingTables: string[] = []
    const religionOffendingTables: string[] = []

    assignments.forEach(assignment => {
      Object.entries(assignment.tables).forEach(([tableNumber, participants]) => {
        const real = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        const tableSize = real.length
        const label = `Session ${assignment.session} Table ${tableNumber}`

        // Couple violations
        const couples = new Set<string>()
        real.forEach(p => {
          if (p.partner && real.some(other => other.name === p.partner)) {
            couples.add([p.name, p.partner].sort().join('-'))
          }
        })
        if (couples.size > 0) coupleOffendingTables.push(label)

        // Keep-together violations (only checked when relevant)
        const linkedPairs = new Set<string>()
        real.forEach(p => {
          if (p.keep_together && p.partner && !real.some(other => other.name === p.partner)) {
            linkedPairs.add([p.name, p.partner].sort().join('-'))
          }
        })
        if (linkedPairs.size > 0) linkedOffendingTables.push(label)

        // Gender balance
        const genderCounts: Record<string, number> = {}
        real.forEach(p => { genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1 })
        const genderVals = allGenders.map(g => genderCounts[g] ?? 0)
        const tableGenderDev = genderVals.length > 1 ? Math.max(...genderVals) - Math.min(...genderVals) : 0
        if (tableGenderDev > expectedDeviationForTableSize(genderRosterCounts, totalParticipants, tableSize)) {
          genderOffendingTables.push(label)
        }

        // Religion balance
        const religionCounts: Record<string, number> = {}
        real.forEach(p => { religionCounts[p.religion] = (religionCounts[p.religion] || 0) + 1 })
        const religionVals = allReligions.map(r => religionCounts[r] ?? 0)
        const tableReligionDev = religionVals.length > 1 ? Math.max(...religionVals) - Math.min(...religionVals) : 0
        if (tableReligionDev > expectedDeviationForTableSize(religionRosterCounts, totalParticipants, tableSize)) {
          religionOffendingTables.push(label)
        }
      })
    })

    // Calculate repeat pairings
    const pairingsCount = new Map<string, number>()
    assignments.forEach(assignment => {
      Object.values(assignment.tables).forEach(participants => {
        const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        for (let i = 0; i < realParticipants.length; i++) {
          for (let j = i + 1; j < realParticipants.length; j++) {
            const pairKey = [realParticipants[i].name, realParticipants[j].name].sort().join('|')
            pairingsCount.set(pairKey, (pairingsCount.get(pairKey) || 0) + 1)
          }
        }
      })
    })

    let repeatPairings = 0
    pairingsCount.forEach(count => { if (count > 1) repeatPairings++ })

    // Calculate average new people met
    const participantPairings = new Map<string, Set<string>>()
    allParticipants.forEach(p => { participantPairings.set(p.name, new Set()) })
    assignments.forEach(assignment => {
      Object.values(assignment.tables).forEach(participants => {
        const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        realParticipants.forEach(p1 => {
          realParticipants.forEach(p2 => {
            if (p1.name !== p2.name) participantPairings.get(p1.name)?.add(p2.name)
          })
        })
      })
    })

    let totalUniquePeopleMet = 0
    participantPairings.forEach(uniquePeople => { totalUniquePeopleMet += uniquePeople.size })
    const avgNewPeopleMet = totalParticipants > 0
      ? Math.round((totalUniquePeopleMet / totalParticipants) * 10) / 10
      : 0

    // Check if any participant has keep_together
    const hasLinkedPairs = allParticipants.some(p => p.keep_together === true)

    // Check facilitator coverage
    const hasFacilitators = allParticipants.some(p => p.is_facilitator)
    let tablesWithoutFacilitator = 0
    if (hasFacilitators) {
      assignments.forEach(assignment => {
        Object.values(assignment.tables).forEach(participants => {
          if (!participants.some(p => p !== null && p !== undefined && p.is_facilitator)) {
            tablesWithoutFacilitator++
          }
        })
      })
    }

    return {
      coupleOffendingTables,
      linkedOffendingTables,
      genderOffendingTables,
      religionOffendingTables,
      numTables,
      totalParticipants,
      repeatPairings,
      avgNewPeopleMet,
      tablesWithoutFacilitator,
      hasFacilitators,
      hasLinkedPairs,
    }
  }

  const stats = calculateStats()
  const allConstraintsSatisfied =
    stats.coupleOffendingTables.length === 0 &&
    stats.linkedOffendingTables.length === 0 &&
    stats.genderOffendingTables.length === 0 &&
    stats.religionOffendingTables.length === 0 &&
    stats.tablesWithoutFacilitator === 0

  const OffenderList = ({ offenders }: { offenders: string[] }) => (
    <div>
      <div className="font-medium mb-1">Tables with issues:</div>
      {offenders.map(t => <div key={t}>{t}</div>)}
    </div>
  )

  return (
    <TooltipProvider>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {allConstraintsSatisfied ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            Validation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Constraint Checks */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Constraints</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {stats.coupleOffendingTables.length === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  {stats.coupleOffendingTables.length === 0 ? (
                    <span className="text-sm">All couples separated</span>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm cursor-help underline decoration-dotted">
                          {stats.coupleOffendingTables.length} couple violation{stats.coupleOffendingTables.length !== 1 ? 's' : ''}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <OffenderList offenders={stats.coupleOffendingTables} />
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {stats.hasLinkedPairs && (
                  <div className="flex items-center gap-2">
                    {stats.linkedOffendingTables.length === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    {stats.linkedOffendingTables.length === 0 ? (
                      <span className="text-sm">All linked partners together</span>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm cursor-help underline decoration-dotted">
                            {stats.linkedOffendingTables.length} linked-pair violation{stats.linkedOffendingTables.length !== 1 ? 's' : ''}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <OffenderList offenders={stats.linkedOffendingTables} />
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {stats.religionOffendingTables.length === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm cursor-help underline decoration-dotted">
                        Religion: {stats.religionOffendingTables.length === 0 ? 'Good' : 'Suboptimal'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {stats.religionOffendingTables.length === 0
                        ? 'All tables are balanced.'
                        : <OffenderList offenders={stats.religionOffendingTables} />}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  {stats.genderOffendingTables.length === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm cursor-help underline decoration-dotted">
                        Gender: {stats.genderOffendingTables.length === 0 ? 'Good' : 'Suboptimal'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {stats.genderOffendingTables.length === 0
                        ? 'All tables are balanced.'
                        : <OffenderList offenders={stats.genderOffendingTables} />}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {stats.hasFacilitators && (
                  <div className="flex items-center gap-2">
                    {stats.tablesWithoutFacilitator === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">
                      {stats.tablesWithoutFacilitator === 0
                        ? 'All tables have facilitators'
                        : `${stats.tablesWithoutFacilitator} table(s) without facilitator`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mixing Stats */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Mixing Quality</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base">👥</span>
                  Avg {stats.avgNewPeopleMet} unique tablemates per person
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base">🔄</span>
                  {stats.repeatPairings} pairs meet more than once
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Across {assignments.length} session{assignments.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Overall Status */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Overall</h3>
              {allConstraintsSatisfied ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-3xl">✅</span>
                  <div className="font-semibold text-sm text-green-900">Looks Good</div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                  <span className="text-3xl">🚧</span>
                  <div className="font-semibold text-sm text-yellow-900">Has Issues</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

export default ValidationStats
