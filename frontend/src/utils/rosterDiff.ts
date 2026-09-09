/**
 * What changed in the roster since the sessions were built.
 *
 * The roster exists twice: the live `roster/` collection (the draft the grid
 * edits) and the `participant_data` frozen on the current assignment set (the
 * canonical roster the assignments were actually built from). The Roster page
 * locks when they match and shows a changeset when they differ.
 *
 * This mirrors the backend's `api/src/api/services/roster_diff.py` — same
 * rules, different output. The backend asks "may I skip the solve?"; this asks
 * "what do I tell the user?". Keep the RULES in step: which fields count, and
 * how a rename is detected.
 */

/** Everything the solver mixes on. `name` is deliberately absent: it is the
 * identity key, handled by rename detection rather than by comparison.
 * `couple_id`, `linked_id` and `id` are excluded too — they are positionally
 * derived and change on a mere reorder. */
const MIXING_FIELDS = ['religion', 'gender', 'partner', 'is_facilitator', 'keep_together'] as const;

type MixingField = (typeof MIXING_FIELDS)[number];

/** How each mixing field is named to a coordinator. `is_facilitator` must
 * never reach the screen. */
const FIELD_LABELS: Record<MixingField, string> = {
  religion: 'religion',
  gender: 'gender',
  partner: 'partner',
  is_facilitator: 'facilitator',
  keep_together: 'kept together',
};

export interface CanonicalParticipant {
  name: string;
  religion: string;
  gender: string;
  partner: string | null;
  is_facilitator: boolean;
  keep_together: boolean;
}

/** The size of the plan. `tables: null` means there is no assignment set yet. */
export interface RosterShape {
  tables: number | null;
  sessions: number | null;
}

export interface FieldChange {
  name: string;
  field: string;
  from: string | boolean | null;
  to: string | boolean | null;
}

export interface Rename {
  from: string;
  to: string;
}

export interface ShapeChange {
  field: 'tables' | 'sessions';
  from: number | null;
  to: number | null;
}

export interface RosterChangeset {
  added: string[];
  removed: string[];
  changed: FieldChange[];
  renamed: Rename[];
  shape: ShapeChange[];
  /** Every change across every group — what the discard confirmation counts. */
  total: number;
  /** Anything at all differs, renames included. */
  isDirty: boolean;
  /** Anything except a rename differs, shape changes included. */
  needsRebuild: boolean;
}

const byName = (people: CanonicalParticipant[]): Map<string, CanonicalParticipant> =>
  new Map(people.map((p) => [p.name, p]));

const sameMixing = (a: CanonicalParticipant, b: CanonicalParticipant): boolean =>
  MIXING_FIELDS.every((f) => a[f] === b[f]);

export function computeChangeset(
  canonical: CanonicalParticipant[],
  draft: CanonicalParticipant[],
  canonicalShape: RosterShape,
  draftShape: RosterShape,
): RosterChangeset {
  const empty: RosterChangeset = {
    added: [],
    removed: [],
    changed: [],
    renamed: [],
    shape: [],
    total: 0,
    isDirty: false,
    needsRebuild: false,
  };

  // Before the first generate there is nothing to compare against: every
  // person would read as "added" and the lock could never engage.
  if (canonicalShape.tables === null) return empty;

  const canonicalByName = byName(canonical);
  const draftByName = byName(draft);

  let added = draft.map((p) => p.name).filter((n) => !canonicalByName.has(n));
  let removed = canonical.map((p) => p.name).filter((n) => !draftByName.has(n));

  const changed: FieldChange[] = [];
  canonical.forEach((before) => {
    const after = draftByName.get(before.name);
    if (!after) return;
    MIXING_FIELDS.forEach((f) => {
      if (before[f] !== after[f]) {
        changed.push({ name: before.name, field: FIELD_LABELS[f], from: before[f], to: after[f] });
      }
    });
  });

  // A rename shows up as exactly one unmatched name on each side. More than
  // one on either side is ambiguous — we will not pair them up by guesswork,
  // so it falls through as an add plus a remove, which needs a rebuild.
  const renamed: Rename[] = [];
  if (added.length === 1 && removed.length === 1) {
    const before = canonicalByName.get(removed[0])!;
    const after = draftByName.get(added[0])!;
    if (sameMixing(before, after)) {
      renamed.push({ from: before.name, to: after.name });
      added = [];
      removed = [];
    }
  }

  const shape: ShapeChange[] = (['tables', 'sessions'] as const)
    .filter((f) => canonicalShape[f] !== draftShape[f])
    .map((f) => ({ field: f, from: canonicalShape[f], to: draftShape[f] }));

  const needsRebuild =
    added.length > 0 || removed.length > 0 || changed.length > 0 || shape.length > 0;

  return {
    added,
    removed,
    changed,
    renamed,
    shape,
    total: added.length + removed.length + changed.length + renamed.length + shape.length,
    isDirty: needsRebuild || renamed.length > 0,
    needsRebuild,
  };
}
