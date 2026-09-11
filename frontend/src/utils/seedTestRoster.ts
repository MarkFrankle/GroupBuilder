import { RosterParticipant, Gender, Religion } from '@/types/roster';

const FIRST_NAMES = [
  'Alex', 'Jamie', 'Morgan', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Avery',
  'Sam', 'Drew', 'Quinn', 'Reese', 'Skyler', 'Dana', 'Rowan', 'Charlie',
  'Emerson', 'Finley', 'Harper', 'Kai', 'Logan', 'Parker', 'Sage', 'Blake',
];

const LAST_NAMES = [
  'Rivera', 'Chen', 'Patel', 'Kim', 'Nguyen', 'Garcia', 'Cohen', 'Ahmed',
  'Johnson', 'Martinez', 'Brown', 'Lee', 'Novak', 'Rossi', 'Khan', 'Silva',
  'Weber', 'Okafor', 'Sato', 'Hassan', 'Murphy', 'Diaz', 'Popescu', 'Park',
];

// Picking gender uniformly across all three options put "Other" at ~1 in 3 —
// nothing like a real roster. Weight it down to an occasional appearance
// instead, split evenly between Male and Female otherwise.
function pickGender(): Gender {
  const roll = Math.random();
  if (roll < 0.1) return 'Other';
  return roll < 0.55 ? 'Male' : 'Female';
}

// Same reasoning as gender: a flat 1-in-4 pick put "Other" as common as any
// named religion. Weight it down and split the rest evenly.
function pickReligion(): Religion {
  const roll = Math.random();
  if (roll < 0.05) return 'Other';
  if (roll < 0.35) return 'Christian';
  if (roll < 0.65) return 'Jewish';
  return 'Muslim';
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generates `count` plain fake participants (no partners, no facilitators)
 * with names drawn from a fixed pool and randomized religion/gender, for
 * exercising the roster UI with realistic-looking data in local dev.
 *
 * First and last names are each drawn from independently shuffled copies of
 * their pool and only repeat once every name in that pool has been used —
 * picking each half independently at random made a first or last name (e.g.
 * "Blake", "Harper") show up two or three times in a batch of 20 well before
 * the pool was exhausted.
 *
 * `excludeNames` should be the names already on the roster: each call
 * reshuffles from scratch with no memory of a prior call, so without this a
 * second "Add test data" click can hand back names the first click already
 * used.
 */
export function generateTestParticipants(
  count: number,
  excludeNames: ReadonlySet<string> = new Set(),
): Omit<RosterParticipant, 'id'>[] {
  const maxUniqueNames = FIRST_NAMES.length * LAST_NAMES.length;
  const target = Math.min(count, maxUniqueNames);
  const used = new Set<string>(excludeNames);
  const result: Omit<RosterParticipant, 'id'>[] = [];

  let firstNames = shuffled(FIRST_NAMES);
  let lastNames = shuffled(LAST_NAMES);
  let firstIdx = 0;
  let lastIdx = 0;

  // A generous but finite attempt budget: excludeNames can eat arbitrarily
  // far into the pool (or contain names outside it entirely), so nothing
  // here guarantees `target` names are actually reachable. Without a cap,
  // an already-full roster spins this loop forever instead of just handing
  // back fewer participants than asked for.
  let attempts = 0;
  const maxAttempts = maxUniqueNames * 4;

  while (result.length < target && attempts < maxAttempts) {
    attempts++;
    if (firstIdx === firstNames.length) {
      firstNames = shuffled(FIRST_NAMES);
      firstIdx = 0;
    }
    if (lastIdx === lastNames.length) {
      lastNames = shuffled(LAST_NAMES);
      lastIdx = 0;
    }

    const name = `${firstNames[firstIdx++]} ${lastNames[lastIdx++]}`;
    if (used.has(name)) continue;
    used.add(name);

    result.push({
      name,
      religion: pickReligion(),
      gender: pickGender(),
      partner_id: null,
    });
  }

  return result;
}
