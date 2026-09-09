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
 * how a rename is detected, and how the keep-apart pairs are compared.
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
  /** Optional: a roster frozen before the feature existed carries no rules at
   * all, and must not read as dirty the moment the field arrives. */
  keep_apart?: string[];
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

/** A separator no name can contain, so a joined pair is a safe set key. */
const PAIR_SEP = '\u0000';

/** The roster's keep-apart rules as an unordered set of name pairs.
 *
 * Compared as a set of pairs rather than as a mixing field, and only after
 * renames are resolved. `keep_apart` is deliberately absent from MIXING_FIELDS:
 * `sameMixing` compares values literally, and a partner's *name* moves under a
 * rename, so listing it there would make renaming anyone named in a rule read
 * as a mixing change — collapsing the rename fast path into a full rebuild and
 * destroying the plan over a typo fix. */
const keepApartPairs = (
  people: CanonicalParticipant[],
  renameMap: Map<string, string>,
): Set<string> => {
  const pairs = new Set<string>();
  people.forEach((person) => {
    const a = renameMap.get(person.name) ?? person.name;
    (person.keep_apart ?? []).forEach((other) => {
      const b = renameMap.get(other) ?? other;
      // A self-pair in pre-feature or hand-edited canonical data would be a
      // phantom the draft can never match, and so a permanent spurious rebuild.
      if (a !== b) pairs.add([a, b].sort().join(PAIR_SEP));
    });
  });
  return pairs;
};

/** The names one person is kept apart from, as the changeset shows them. */
const keepApartOf = (
  person: CanonicalParticipant | undefined,
  renameMap: Map<string, string>,
): string | null => {
  const names = (person?.keep_apart ?? []).map((n) => renameMap.get(n) ?? n).sort();
  return names.length > 0 ? names.join(', ') : null;
};

const sameSet = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && Array.from(a).every((v) => b.has(v));

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

  // Renames are applied to the canonical side, which holds the old spellings,
  // so a spelling change reads as the same rule rather than a different one.
  // Removing a rule needs a rebuild too: the existing plan stays *legal*
  // without it — a relaxed constraint is still satisfied — so only optimality
  // is lost. It is still the right call: the coordinator removed the rule
  // precisely so those two may now meet.
  const renameMap = new Map(renamed.map((r) => [r.from, r.to]));
  if (!sameSet(keepApartPairs(canonical, renameMap), keepApartPairs(draft, new Map()))) {
    const names = Array.from(
      new Set(
        canonical
          .map((p) => renameMap.get(p.name) ?? p.name)
          .concat(draft.map((p) => p.name)),
      ),
    );
    names.forEach((name) => {
      const before = canonical.find((p) => (renameMap.get(p.name) ?? p.name) === name);
      const after = draftByName.get(name);
      const from = keepApartOf(before, renameMap);
      const to = keepApartOf(after, new Map());
      if (from !== to) changed.push({ name, field: 'kept apart', from, to });
    });
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
