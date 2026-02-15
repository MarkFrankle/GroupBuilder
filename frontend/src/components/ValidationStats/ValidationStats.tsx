import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle } from 'lucide-react'

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
  maxReligionDeviation: number;
  maxGenderDeviation: number;
  repeatPairings: number;
  avgNewPeopleMet: number;
  totalParticipants: number;
  tablesWithoutFacilitator: number;
  hasFacilitators: boolean;
}

const ValidationStats: React.FC<ValidationStatsProps> = ({ assignments }) => {
  const calculateStats = (): ValidationResult => {
    if (assignments.length === 0) {
      return {
        coupleViolations: 0,
        maxReligionDeviation: 0,
        maxGenderDeviation: 0,
        repeatPairings: 0,
        avgNewPeopleMet: 0,
        totalParticipants: 0,
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

    // Check religion and gender balance
    let maxReligionDeviation = 0
    let maxGenderDeviation = 0

    assignments.forEach(assignment => {
      const tables = Object.values(assignment.tables)

      // Religion balance
      const religionCounts = tables.map(participants => {
        const counts: { [key: string]: number } = {}
        // Filter out empty/undefined/null participants
        const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        realParticipants.forEach(p => {
          counts[p.religion] = (counts[p.religion] || 0) + 1
        })
        return counts
      })

      // Check deviation for each religion
      const allReligions = new Set(allParticipants.map(p => p.religion))
      allReligions.forEach(religion => {
        const countsForReligion = religionCounts.map(rc => rc[religion] || 0)
        const min = Math.min(...countsForReligion)
        const max = Math.max(...countsForReligion)
        maxReligionDeviation = Math.max(maxReligionDeviation, max - min)
      })

      // Gender balance
      const genderCounts = tables.map(participants => {
        const counts: { [key: string]: number } = {}
        // Filter out empty/undefined/null participants
        const realParticipants = participants.filter((p): p is Participant => p !== null && p !== undefined && p.name !== '')
        realParticipants.forEach(p => {
          counts[p.gender] = (counts[p.gender] || 0) + 1
        })
        return counts
      })

      const allGenders = new Set(allParticipants.map(p => p.gender))
      allGenders.forEach(gender => {
        const countsForGender = genderCounts.map(gc => gc[gender] || 0)
        const min = Math.min(...countsForGender)
        const max = Math.max(...countsForGender)
        maxGenderDeviation = Math.max(maxGenderDeviation, max - min)
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
      maxReligionDeviation,
      maxGenderDeviation,
      repeatPairings,
      avgNewPeopleMet,
      totalParticipants,
      tablesWithoutFacilitator,
      hasFacilitators,
    }
  }

  const stats = calculateStats()
  const allConstraintsSatisfied = stats.coupleViolations === 0 &&
                                   stats.maxReligionDeviation <= 1 &&
                                   stats.maxGenderDeviation <= 1 &&
                                   stats.tablesWithoutFacilitator === 0

  return (
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
                {stats.maxReligionDeviation <= 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">
                  Religion balanced (±{stats.maxReligionDeviation})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {stats.maxGenderDeviation <= 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">
                  Gender balanced (±{stats.maxGenderDeviation})
                </span>
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
  )
}

export default ValidationStats
