import { RosterParticipant, RELIGIONS } from '@/types/roster';

/**
 * One line describing the live roster, for checking against a sign-up sheet.
 *
 * Deliberately says nothing about whether the mix is good: judging a plan
 * belongs elsewhere in the app. This counts, and only counts.
 *
 * While the roster is dirty this describes what is *about* to be built, not
 * what the current sessions contain. That is intended — it is the draft you
 * are proofreading.
 */
export function PopulationStats({ participants }: { participants: RosterParticipant[] }) {
  if (participants.length === 0) return null;

  const religions = RELIGIONS
    .map(r => ({ label: r, count: participants.filter(p => p.religion === r).length }))
    .filter(r => r.count > 0)
    .map(r => `${r.count} ${r.label}`)
    .join(', ');

  const female = participants.filter(p => p.gender === 'Female').length;
  const male = participants.filter(p => p.gender === 'Male').length;
  const otherGender = participants.length - female - male;
  const genders = `${female}F/${male}M` + (otherGender > 0 ? `/${otherGender} other` : '');

  // Each pair is stored on both people, so counting rows would double it.
  const pairs = (keepTogether: boolean) =>
    participants.filter(p =>
      p.partner_id && (p.keep_together ?? false) === keepTogether &&
      // Keep only one half of each pair: the one listed first.
      participants.findIndex(q => q.id === p.id) <
        participants.findIndex(q => q.id === p.partner_id),
    ).length;

  const couples = pairs(false);
  const linked = pairs(true);

  const parts = [
    `${participants.length} ${participants.length === 1 ? 'person' : 'people'}`,
    religions,
    genders,
  ];
  if (couples > 0) parts.push(`${couples} couple${couples === 1 ? '' : 's'}`);
  if (linked > 0) parts.push(`${linked} pair${linked === 1 ? '' : 's'} kept together`);

  return (
    <p className="text-sm text-muted-foreground">{parts.filter(Boolean).join(' · ')}</p>
  );
}
