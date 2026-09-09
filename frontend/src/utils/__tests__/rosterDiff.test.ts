import { computeChangeset, CanonicalParticipant } from '../rosterDiff';

const person = (name: string, over: Partial<CanonicalParticipant> = {}): CanonicalParticipant => ({
  name,
  religion: 'Other',
  gender: 'Other',
  partner: null,
  is_facilitator: false,
  keep_together: false,
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
});
