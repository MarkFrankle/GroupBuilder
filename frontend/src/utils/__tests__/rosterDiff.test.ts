import { computeChangeset, CanonicalParticipant } from '../rosterDiff';

const person = (name: string, over: Partial<CanonicalParticipant> = {}): CanonicalParticipant => ({
  name,
  religion: 'Other',
  gender: 'Other',
  partner: null,
  is_facilitator: false,
  keep_together: false,
  keep_apart: [],
  ...over,
});

describe('computeChangeset', () => {
  it('reports nothing when the rosters match', () => {
    const roster = [person('Alice')];
    const result = computeChangeset(roster, roster, { tables: 2, sessions: 3 }, { tables: 2, sessions: 3 });

    expect(result.isDirty).toBe(false);
    expect(result.total).toBe(0);
  });

  // Priya differs from Ellen in a mixing field on purpose: one unmatched name
  // on each side with identical fields is a rename, not an add plus a remove.
  it('groups added, removed and changed people', () => {
    const result = computeChangeset(
      [person('Alice'), person('Ellen')],
      [person('Alice', { religion: 'Jewish' }), person('Priya', { gender: 'Female' })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.added).toEqual(['Priya']);
    expect(result.removed).toEqual(['Ellen']);
    expect(result.changed).toEqual([
      { name: 'Alice', field: 'religion', from: 'Other', to: 'Jewish' },
    ]);
    expect(result.total).toBe(3);
  });

  it('separates a rename from a change, because it will not force a rebuild', () => {
    const result = computeChangeset(
      [person('Kathrine')],
      [person('Katherine')],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.renamed).toEqual([{ from: 'Kathrine', to: 'Katherine' }]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.needsRebuild).toBe(false);
    expect(result.isDirty).toBe(true);
  });

  it('does not guess at two simultaneous renames', () => {
    const result = computeChangeset(
      [person('Kathrine'), person('Jon')],
      [person('Katherine'), person('John')],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.renamed).toEqual([]);
    expect(result.added.sort()).toEqual(['John', 'Katherine']);
    expect(result.removed.sort()).toEqual(['Jon', 'Kathrine']);
    expect(result.needsRebuild).toBe(true);
  });

  // Mirrors the backend's test_a_rename_alongside_a_removal_is_still_detected:
  // a typo fix in the same edit that also drops someone else. The rename is
  // unambiguous by mixing fields, so it is still paired up; the removal still
  // forces the rebuild.
  it('still detects a rename alongside an unrelated removal', () => {
    const result = computeChangeset(
      [person('Kathrine', { religion: 'Jewish' }), person('Bob', { religion: 'Muslim' })],
      [person('Katherine', { religion: 'Jewish' })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.renamed).toEqual([{ from: 'Kathrine', to: 'Katherine' }]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(['Bob']);
    expect(result.needsRebuild).toBe(true);
  });

  it('treats a lone unmatched pair with different mixing fields as an add and a remove', () => {
    const result = computeChangeset(
      [person('Kathrine')],
      [person('Katherine', { gender: 'Female' })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.renamed).toEqual([]);
    expect(result.added).toEqual(['Katherine']);
    expect(result.removed).toEqual(['Kathrine']);
    expect(result.needsRebuild).toBe(true);
  });

  it('labels changed fields the way a coordinator reads them', () => {
    const result = computeChangeset(
      [person('Alice')],
      [person('Alice', { is_facilitator: true, keep_together: true })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.changed.map((c) => c.field)).toEqual(['facilitator', 'kept together']);
  });

  it('reports a shape change', () => {
    const result = computeChangeset(
      [person('Alice')], [person('Alice')],
      { tables: 2, sessions: 5 }, { tables: 2, sessions: 6 },
    );

    expect(result.shape).toEqual([{ field: 'sessions', from: 5, to: 6 }]);
    expect(result.needsRebuild).toBe(true);
    expect(result.total).toBe(1);
  });

  it('is not dirty before the first generate, when there is no canonical roster', () => {
    const result = computeChangeset(
      [], [person('Alice')], { tables: null, sessions: null }, { tables: 2, sessions: 3 },
    );

    expect(result.isDirty).toBe(false);
  });

  it('reports an added keep-apart pair as a change needing a rebuild', () => {
    const result = computeChangeset(
      [person('A'), person('B')],
      [person('A', { keep_apart: ['B'] }), person('B', { keep_apart: ['A'] })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.needsRebuild).toBe(true);
    expect(result.isDirty).toBe(true);
    expect(result.changed).toContainEqual(
      expect.objectContaining({ name: 'A', field: 'kept apart', from: null, to: 'B' }),
    );
  });

  it('reports a removed keep-apart pair as a change needing a rebuild', () => {
    const result = computeChangeset(
      [person('A', { keep_apart: ['B'] }), person('B', { keep_apart: ['A'] })],
      [person('A'), person('B')],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.needsRebuild).toBe(true);
    expect(result.changed).toContainEqual(
      expect.objectContaining({ name: 'A', field: 'kept apart', from: 'B', to: null }),
    );
  });

  // The rule is untouched; only the spelling moved. Falling through to a
  // rebuild here would destroy the plan over a typo fix, through the one
  // action in the app that cannot be undone.
  it('still treats a rename of someone inside a keep-apart pair as a rename', () => {
    const result = computeChangeset(
      [person('Kathrine', { keep_apart: ['B'] }), person('B', { keep_apart: ['Kathrine'] })],
      [person('Katherine', { keep_apart: ['B'] }), person('B', { keep_apart: ['Katherine'] })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.renamed).toEqual([{ from: 'Kathrine', to: 'Katherine' }]);
    expect(result.changed).toEqual([]);
    expect(result.needsRebuild).toBe(false);
    expect(result.isDirty).toBe(true);
  });

  // The one case where the two halves interact: the rename must not
  // short-circuit the pair comparison, or the new rule never reaches the solver.
  it('needs a rebuild for a rename plus a keep-apart change in the same edit', () => {
    const result = computeChangeset(
      [person('Kathrine'), person('B'), person('C')],
      [person('Katherine'), person('B', { keep_apart: ['C'] }), person('C', { keep_apart: ['B'] })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.renamed).toEqual([{ from: 'Kathrine', to: 'Katherine' }]);
    expect(result.needsRebuild).toBe(true);
    expect(result.changed.map((c) => c.name).sort()).toEqual(['B', 'C']);
  });

  it('reads an asymmetric canonical rule as the same rule', () => {
    const result = computeChangeset(
      [person('A', { keep_apart: ['B'] }), person('B')],
      [person('A', { keep_apart: ['B'] }), person('B', { keep_apart: ['A'] })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.isDirty).toBe(false);
    expect(result.needsRebuild).toBe(false);
  });

  // A set frozen before the feature existed has no `keep_apart` at all. Those
  // rosters must not read as dirty the moment the field is added.
  it('is not dirty when the canonical roster predates the keep-apart field', () => {
    const legacy = (name: string): CanonicalParticipant => {
      const p = person(name);
      delete p.keep_apart;
      return p;
    };
    const result = computeChangeset(
      [legacy('A'), legacy('B')],
      [person('A'), person('B')],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.isDirty).toBe(false);
  });

  // A freshly derived draft can never carry a rule naming its own participant,
  // so keeping one would be a permanent spurious rebuild.
  it('drops a canonical self-pair rather than reading it as a change', () => {
    const result = computeChangeset(
      [person('A', { keep_apart: ['A'] }), person('B')],
      [person('A'), person('B')],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.isDirty).toBe(false);
  });

  // Renames must resolve on the *canonical* side, which holds the old
  // spellings. An asymmetric canonical rule is where that shows: matching the
  // pairs by luck is not enough, because the per-person listing below it would
  // then report a rule the coordinator never touched.
  it('resolves a rename against an asymmetric canonical keep-apart rule', () => {
    const result = computeChangeset(
      [person('Kathrine', { keep_apart: ['B'] }), person('B')],
      [person('Katherine', { keep_apart: ['B'] }), person('B', { keep_apart: ['Katherine'] })],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.renamed).toEqual([{ from: 'Kathrine', to: 'Katherine' }]);
    expect(result.changed).toEqual([]);
    expect(result.needsRebuild).toBe(false);
  });

  // `needsRebuild` must come from the pair comparison itself, not from the
  // display listing; and `total` is what the discard confirmation counts.
  it('counts a keep-apart change alongside another change', () => {
    const result = computeChangeset(
      [person('A'), person('B')],
      [
        person('A', { keep_apart: ['B'], religion: 'Jewish' }),
        person('B', { keep_apart: ['A'] }),
      ],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.needsRebuild).toBe(true);
    // A's religion, plus a "kept apart" line for each of A and B.
    expect(result.total).toBe(3);
    expect(result.changed).toHaveLength(3);
  });

  // Removing someone while another person still names them is an ordinary
  // coordinator action, and leaves one side of the pair with no entry at all.
  it('reports a keep-apart pair whose other member was removed', () => {
    const result = computeChangeset(
      [person('A', { keep_apart: ['B'] }), person('B', { keep_apart: ['A'] })],
      [person('A')],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.removed).toEqual(['B']);
    expect(result.needsRebuild).toBe(true);
    expect(result.changed).toContainEqual({
      name: 'A',
      field: 'kept apart',
      from: 'B',
      to: null,
    });
    // B is gone from the draft entirely, so its rule reads as emptied.
    expect(result.changed).toContainEqual({
      name: 'B',
      field: 'kept apart',
      from: 'A',
      to: null,
    });
  });

  it('lists several keep-apart names in a stable order', () => {
    const result = computeChangeset(
      [person('A'), person('B'), person('C')],
      [
        person('A', { keep_apart: ['C', 'B'] }),
        person('B', { keep_apart: ['A'] }),
        person('C', { keep_apart: ['A'] }),
      ],
      { tables: 2, sessions: 3 },
      { tables: 2, sessions: 3 },
    );

    expect(result.changed).toContainEqual({
      name: 'A',
      field: 'kept apart',
      from: null,
      to: 'B, C',
    });
  });
});
