import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { expectedWithinTableDeviation, expectedDeviationForTableSize, actualWithinTableDeviation, formatAttributeCounts } from '@/utils/balanceStats'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

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
}

interface ValidationStatsProps {
  assignments: Assignment[];
}

interface ValidationResult {
  coupleViolations: number;
  expectedGenderDeviation: number;
  actualGenderDeviation: number;
  genderAnyTableExceedsExpected: boolean;
  genderRosterCounts: Record<string, number>;
  expectedReligionDeviation: number;
  actualReligionDeviation: number;
  religionAnyTableExceedsExpected: boolean;
  religionRosterCounts: Record<string, number>;
  numTables: number;
  totalParticipants: number;
  repeatPairings: number;
  avgNewPeopleMet: number;
  tablesWithoutFacilitator: number;
  hasFacilitators: boolean;
}

const ValidationStats: React.FC<ValidationStatsProps> = ({ assignments }) => {
  const calculateStats = (): ValidationResult => {
    if (assignments.length === 0) {
      return {
        coupleViolations: 0,
        expectedGenderDeviation: 0,
        actualGenderDeviation: 0,
        genderAnyTableExceedsExpected: false,
        genderRosterCounts: {},
        expectedReligionDeviation: 0,
        actualReligionDeviation: 0,
        religionAnyTableExceedsExpected: false,
        religionRosterCounts: {},
        numTables: 0,
        totalParticipants: 0,
        repeatPairings: 0,
        avgNewPeopleMet: 0,
        tablesWithoutFacilitator: 0,
        hasFacilitators: false,
      }
    }

    // Get all unique participants
    const firstSession = assignments[0]
    const allParticipants: Participant[] = []
    Object.values(firstSession.tables).forEach(participants => {
      // Filter out empty/undefined/null participants
      const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
      allParticipants.push(...realParticipants)
    })
    const totalParticipants = allParticipants.length

    // Check couple separation violations
    let coupleViolations = 0
    assignments.forEach(assignment => {
      Object.values(assignment.tables).forEach(participants => {
        // Filter out empty/undefined/null participants
        const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        const couples = new Set<string>()
        realParticipants.forEach(p => {
          if (p.partner) {
            // Check if partner is at same table
            const partnerAtTable = realParticipants.some(other => other && other.name === p.partner)
            if (partnerAtTable) {
              const coupleKey = [p.name, p.partner].sort().join('-')
              couples.add(coupleKey)
            }
          }
        })
        coupleViolations += couples.size
      })
    })

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

    const expectedGenderDeviation = expectedWithinTableDeviation(genderRosterCounts, numTables)
    const expectedReligionDeviation = expectedWithinTableDeviation(religionRosterCounts, numTables)

    let actualGenderDeviation = 0
    let actualReligionDeviation = 0
    let genderAnyTableExceedsExpected = false
    let religionAnyTableExceedsExpected = false
    assignments.forEach(assignment => {
      Object.values(assignment.tables).forEach(participants => {
        const real = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        const tableSize = real.length

        const genderCounts: Record<string, number> = {}
        real.forEach(p => { genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1 })
        const genderVals = allGenders.map(g => genderCounts[g] ?? 0)
        const tableGenderDev = genderVals.length > 1 ? Math.max(...genderVals) - Math.min(...genderVals) : 0
        actualGenderDeviation = Math.max(actualGenderDeviation, tableGenderDev)
        const tableExpectedGender = expectedDeviationForTableSize(genderRosterCounts, totalParticipants, tableSize)
        if (tableGenderDev > tableExpectedGender) genderAnyTableExceedsExpected = true

        const religionCounts: Record<string, number> = {}
        real.forEach(p => { religionCounts[p.religion] = (religionCounts[p.religion] || 0) + 1 })
        const religionVals = allReligions.map(r => religionCounts[r] ?? 0)
        const tableReligionDev = religionVals.length > 1 ? Math.max(...religionVals) - Math.min(...religionVals) : 0
        actualReligionDeviation = Math.max(actualReligionDeviation, tableReligionDev)
        const tableExpectedReligion = expectedDeviationForTableSize(religionRosterCounts, totalParticipants, tableSize)
        if (tableReligionDev > tableExpectedReligion) religionAnyTableExceedsExpected = true
      })
    })

    // Calculate repeat pairings
    const pairingsCount = new Map<string, number>()

    assignments.forEach(assignment => {
      Object.values(assignment.tables).forEach(participants => {
        // Filter out empty/undefined/null participants
        const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        // For each table, count all pairings
        for (let i = 0; i < realParticipants.length; i++) {
          for (let j = i + 1; j < realParticipants.length; j++) {
            const pairKey = [realParticipants[i].name, realParticipants[j].name].sort().join('|')
            pairingsCount.set(pairKey, (pairingsCount.get(pairKey) || 0) + 1)
          }
        }
      })
    })

    // Count how many pairs met more than once
    let repeatPairings = 0
    pairingsCount.forEach(count => {
      if (count > 1) {
        repeatPairings++
      }
    })

    // Calculate average new people met
    // For each person, count unique people they sat with across all sessions
    const participantPairings = new Map<string, Set<string>>()

    allParticipants.forEach(p => {
      participantPairings.set(p.name, new Set())
    })

    assignments.forEach(assignment => {
      Object.values(assignment.tables).forEach(participants => {
        // Filter out empty/undefined/null participants
        const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        realParticipants.forEach(p1 => {
          realParticipants.forEach(p2 => {
            if (p1.name !== p2.name) {
              participantPairings.get(p1.name)?.add(p2.name)
            }
          })
        })
      })
    })

    let totalUniquePeopleMet = 0
    participantPairings.forEach(uniquePeople => {
      totalUniquePeopleMet += uniquePeople.size
    })

    const avgNewPeopleMet = totalParticipants > 0
      ? Math.round((totalUniquePeopleMet / totalParticipants) * 10) / 10
      : 0

    // Check facilitator coverage
    const hasFacilitators = allParticipants.some(p => p.is_facilitator)
    let tablesWithoutFacilitator = 0
    if (hasFacilitators) {
      assignments.forEach(assignment => {
        Object.values(assignment.tables).forEach(participants => {
          const hasF = participants.some(p => p !== null && p !== undefined && p.is_facilitator)
          if (!hasF) tablesWithoutFacilitator++
        })
      })
    }

    return {
      coupleViolations,
      expectedGenderDeviation,
      actualGenderDeviation,
      genderAnyTableExceedsExpected,
      genderRosterCounts,
      expectedReligionDeviation,
      actualReligionDeviation,
      religionAnyTableExceedsExpected,
      religionRosterCounts,
      numTables,
      totalParticipants,
      repeatPairings,
      avgNewPeopleMet,
      tablesWithoutFacilitator,
      hasFacilitators,
    }
  }

  const stats = calculateStats()
  const allConstraintsSatisfied =
    stats.coupleViolations === 0 &&
    !stats.genderAnyTableExceedsExpected &&
    !stats.religionAnyTableExceedsExpected &&
    stats.tablesWithoutFacilitator === 0

  const buildBalanceTooltip = (
    rosterCounts: Record<string, number>,
    expected: number,
    actual: number,
    numTables: number,
    abbreviate = false
  ): string => {
    const breakdown = formatAttributeCounts(rosterCounts, abbreviate)
    const isGood = actual <= expected
    return [
      `Roster: ${breakdown} across ${numTables} tables.`,
      `Best achievable per table: ±${expected}.`,
      `Actual worst table: ±${actual}.`,
      isGood
        ? 'Distribution is as good as this roster allows.'
        : 'Try regenerating to improve distribution.',
    ].join(' ')
  }

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
                  {stats.coupleViolations === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    {stats.coupleViolations === 0 ? 'All couples separated' : `${stats.coupleViolations} couple violations`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!stats.religionAnyTableExceedsExpected ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm cursor-help underline decoration-dotted">
                        Religion: {!stats.religionAnyTableExceedsExpected ? 'Good' : 'Suboptimal'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {buildBalanceTooltip(stats.religionRosterCounts, stats.expectedReligionDeviation, stats.actualReligionDeviation, stats.numTables)}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  {!stats.genderAnyTableExceedsExpected ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm cursor-help underline decoration-dotted">
                        Gender: {!stats.genderAnyTableExceedsExpected ? 'Good' : 'Suboptimal'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {buildBalanceTooltip(stats.genderRosterCounts, stats.expectedGenderDeviation, stats.actualGenderDeviation, stats.numTables, true)}
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
