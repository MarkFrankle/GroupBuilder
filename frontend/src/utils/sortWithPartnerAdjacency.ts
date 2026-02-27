import { RosterParticipant } from '@/types/roster';

/**
 * Sort all partners adjacent on initial load. Iterates top-to-bottom;
 * when it encounters the first of a pair, pulls the partner right after.
 */
export function sortPartnersAdjacent(participants: RosterParticipant[]): RosterParticipant[] {
  const result: RosterParticipant[] = [];
  const placed = new Set<string>();

  for (const p of participants) {
    if (placed.has(p.id)) continue;
    result.push(p);
    placed.add(p.id);

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

/**
 * Move a participant's partner to be adjacent (right after them) in the list.
 * The edited participant stays in place; their partner moves.
 * Returns a new array. If no partner or already adjacent, returns unchanged order.
 */
export function movePartnerAdjacent(
  participants: RosterParticipant[],
  editedId: string,
): RosterParticipant[] {
  const editedIdx = participants.findIndex(p => p.id === editedId);
  if (editedIdx === -1) return participants;

  const edited = participants[editedIdx];
  if (!edited.partner_id) return participants;

  const partnerIdx = participants.findIndex(p => p.id === edited.partner_id);
  if (partnerIdx === -1) return participants;

  // Already adjacent (right after)
  if (partnerIdx === editedIdx + 1) return participants;

  // Remove partner from current position, insert right after edited
  const result = [...participants];
  const [partner] = result.splice(partnerIdx, 1);
  // After splice, editedIdx may have shifted if partner was before edited
  const newEditedIdx = result.findIndex(p => p.id === editedId);
  result.splice(newEditedIdx + 1, 0, partner);
  return result;
}
