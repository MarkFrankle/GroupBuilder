import { GENDERS, RELIGIONS, RosterParticipant } from '@/types/roster';

export type RosterSortColumn = 'name' | 'religion' | 'gender' | 'partner' | 'facilitator' | 'absences';
export type SortDirection = 'asc' | 'desc';
export interface RosterSort {
  column: RosterSortColumn;
  direction: SortDirection;
}

/** The last word of a name, lowercased. The printed roster's rule. */
export function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

/** Last name, then the full name, ignoring case. Shared with print so the two never disagree. */
export function compareLastName(a: string, b: string): number {
  const lastA = getLastName(a);
  const lastB = getLastName(b);
  if (lastA !== lastB) return lastA.localeCompare(lastB);
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

/**
 * The roster reordered by one column. A one-off: rows don't stay sorted as
 * they're edited. Descending is ascending reversed, so pairs stay together.
 */
export function sortRoster(
  participants: RosterParticipant[],
  column: RosterSortColumn,
  direction: SortDirection,
): RosterParticipant[] {
  const byId = new Map(participants.map(p => [p.id, p]));
  const partnerOf = (p: RosterParticipant) => (p.partner_id ? byId.get(p.partner_id) : undefined);
  // A pair sorts under whichever of the two comes first by last name.
  const pairLead = (p: RosterParticipant) => {
    const partner = partnerOf(p);
    return partner && compareLastName(partner.name, p.name) < 0 ? partner.name : p.name;
  };

  const byColumn: Record<RosterSortColumn, (a: RosterParticipant, b: RosterParticipant) => number> = {
    name: () => 0,
    religion: (a, b) => RELIGIONS.indexOf(a.religion) - RELIGIONS.indexOf(b.religion),
    gender: (a, b) => GENDERS.indexOf(a.gender) - GENDERS.indexOf(b.gender),
    facilitator: (a, b) => Number(b.is_facilitator ?? false) - Number(a.is_facilitator ?? false),
    absences: (a, b) => (b.absent_sessions?.length ?? 0) - (a.absent_sessions?.length ?? 0),
    partner: (a, b) =>
      Number(!partnerOf(a)) - Number(!partnerOf(b)) || compareLastName(pairLead(a), pairLead(b)),
  };

  const sorted = [...participants].sort(
    (a, b) => byColumn[column](a, b) || compareLastName(a.name, b.name),
  );
  return direction === 'asc' ? sorted : sorted.reverse();
}
