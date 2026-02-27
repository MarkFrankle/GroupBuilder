import { RosterParticipant } from '@/types/roster';

/**
 * Sort participants so that partners appear adjacent in the list.
 * When two partners are at different positions, the higher-positioned
 * one moves down to be next to the lower-positioned one.
 * This is display-only — doesn't change stored order.
 */
export function sortWithPartnerAdjacency(participants: RosterParticipant[]): RosterParticipant[] {
  const result: RosterParticipant[] = [];
  const placed = new Set<string>();

  for (const p of participants) {
    if (placed.has(p.id)) continue;
    result.push(p);
    placed.add(p.id);

    // If this participant has a partner that hasn't been placed yet, place them next
    if (p.partner_id) {
      const partner = participants.find(other => other.id === p.partner_id);
      if (partner && !placed.has(partner.id)) {
        result.push(partner);
        placed.add(partner.id);
      }
    }
  }
  return result;
}
