import {
  normalize,
  readReligion,
  readGender,
  readFacilitator,
  setColumnField,
  resolveRows,
  NO_FIXES,
  ImportField,
  guessMapping,
  readRosterFile,
  UNREADABLE_FILE,
} from '@/utils/rosterImport';

describe('normalize', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(normalize('  Catholic ')).toBe('catholic');
    expect(normalize('Roman-Catholic!')).toBe('roman catholic');
    expect(normalize('')).toBe('');
  });
});

describe('cell readers', () => {
  it('reads religions case-insensitively, with noun forms', () => {
    expect(readReligion(' jewish ')).toBe('Jewish');
    expect(readReligion('Islam')).toBe('Muslim');
    expect(readReligion('Catholic')).toBeNull();
  });

  it('reads genders including single letters', () => {
    expect(readGender('F')).toBe('Female');
    expect(readGender('man')).toBe('Male');
    expect(readGender('?')).toBeNull();
  });

  it('reads facilitator yes and no values', () => {
    expect(readFacilitator('x')).toBe(true);
    expect(readFacilitator('Yes')).toBe(true);
    expect(readFacilitator('')).toBe(false);
    expect(readFacilitator('maybe')).toBeNull();
  });
});

describe('setColumnField', () => {
  it('moves a field off the column that had it', () => {
    expect(setColumnField(['name', 'ignore', 'gender'], 1, 'name')).toEqual([
      'ignore',
      'name',
      'gender',
    ]);
  });

  it('lets any number of columns be ignored', () => {
    expect(setColumnField(['ignore', 'name'], 1, 'ignore')).toEqual(['ignore', 'ignore']);
  });
});

const MAP: ImportField[] = ['name', 'religion', 'gender', 'partner', 'facilitator'];

describe('resolveRows', () => {
  it('builds participants from readable rows', () => {
    const { participants, drafts, notes } = resolveRows(
      [['Ana', 'Jewish', 'F', '', 'x']],
      MAP,
      NO_FIXES,
    );
    expect(notes).toEqual([]);
    expect(drafts).toEqual([]);
    expect(participants).toEqual([
      { name: 'Ana', religion: 'Jewish', gender: 'Female', is_facilitator: true, partner_name: null },
    ]);
  });

  it('needs only a name column', () => {
    expect(resolveRows([['Ana']], ['ignore'], NO_FIXES).missingName).toBe(true);
    const { missingName, unmappedFields, drafts } = resolveRows([['Ana']], ['name'], NO_FIXES);
    expect(missingName).toBe(false);
    expect(unmappedFields).toEqual(['religion', 'gender']);
    expect(drafts.map(d => d.name)).toEqual(['Ana']);
  });

  it('makes unreadable rows drafts, and one answer covers every matching cell', () => {
    const rows = [
      ['Ana', 'Catholic', 'F', '', ''],
      ['Ben', 'catholic', 'M', '', ''],
    ];
    const before = resolveRows(rows, MAP, NO_FIXES);
    expect(before.participants).toEqual([]);
    expect(before.drafts.map(d => d.name)).toEqual(['Ana', 'Ben']);
    expect(before.notes.every(n => n.fix && !n.fix.answered)).toBe(true);

    const after = resolveRows(rows, MAP, { religion: { catholic: 'Christian' }, gender: {} });
    expect(after.drafts).toEqual([]);
    expect(after.participants.map(p => p.religion)).toEqual(['Christian', 'Christian']);
    expect(after.notes.every(n => n.fix?.answered)).toBe(true);
  });

  it('skips blank rows silently and nameless rows visibly', () => {
    const { skippedRows, participants } = resolveRows(
      [['', '', '', '', ''], ['', 'Jewish', 'F', '', ''], ['Ana', 'Jewish', 'F', '', '']],
      MAP,
      NO_FIXES,
    );
    expect(skippedRows).toEqual([1]);
    expect(participants).toHaveLength(1);
  });

  it('keeps the first of two rows with the same name', () => {
    const { participants, skippedRows } = resolveRows(
      [['Ana', 'Jewish', 'F', '', ''], ['ana ', 'Muslim', 'F', '', '']],
      MAP,
      NO_FIXES,
    );
    expect(participants.map(p => p.religion)).toEqual(['Jewish']);
    expect(skippedRows).toEqual([1]);
  });

  it('pairs partners listed on one side only, including with a draft', () => {
    const { participants, drafts } = resolveRows(
      [['Ana', 'Jewish', 'F', 'Ben', ''], ['Ben', '?', 'M', '', '']],
      MAP,
      NO_FIXES,
    );
    expect(participants[0].partner_name).toBe('Ben');
    expect(drafts[0].partner_name).toBe('Ana');
  });

  it('leaves conflicting and unknown partners blank with a note', () => {
    const { participants, notes } = resolveRows(
      [
        ['Ana', 'Jewish', 'F', 'Ben', ''],
        ['Cy', 'Jewish', 'M', 'Ben', ''],
        ['Ben', 'Muslim', 'M', '', ''],
        ['Dee', 'Muslim', 'F', 'Zed', ''],
      ],
      MAP,
      NO_FIXES,
    );
    expect(participants.every(p => p.partner_name === null)).toBe(true);
    expect(notes.filter(n => n.column === 3)).toHaveLength(3);
  });
});

describe('guessMapping', () => {
  it('recognizes religion, gender and facilitator from their values', () => {
    const rows = [
      ['Ana', 'Jewish', 'F', ''],
      ['Ben', 'Muslim', 'M', 'x'],
      ['Cy', 'Christian', 'M', ''],
    ];
    expect(guessMapping(['Full Name', 'Tradition', 'Col C', 'Lead'], rows)).toEqual([
      'name',
      'religion',
      'gender',
      'facilitator',
    ]);
  });

  it('uses header alternates', () => {
    expect(guessMapping(['Faith', 'Sex', 'Spouse'], [['Catholic', '?', 'Ben']])).toEqual([
      'religion',
      'gender',
      'partner',
    ]);
  });

  it('finds name and partner only from their headers', () => {
    const rows = [
      ['Ana', 'Ben'],
      ['Ben', 'Ana'],
    ];
    expect(guessMapping(['First Name', 'Spouse or partner attending'], rows)).toEqual([
      'ignore',
      'ignore',
    ]);
  });

  it('never matches part of a header', () => {
    expect(guessMapping(['Email', 'Name'], [['ana@example.com', 'Ana']])).toEqual([
      'ignore',
      'name',
    ]);
  });

  it('gives a field to one column only, header first', () => {
    const rows = [['Jewish', 'Muslim']];
    expect(guessMapping(['Notes', 'Religion'], rows)).toEqual(['ignore', 'religion']);
  });
});

describe('readRosterFile', () => {
  it('reads a csv into trimmed, equal-width rows without blank lines', async () => {
    const file = new File(['Name,Faith\n Ana ,Jewish\n\nBen\n'], 'roster.csv', { type: 'text/csv' });
    expect(await readRosterFile(file)).toEqual([
      ['Name', 'Faith'],
      ['Ana', 'Jewish'],
      ['Ben', ''],
    ]);
  });

  it('refuses other file types with a message that says what to do', async () => {
    const file = new File(['x'], 'roster.pdf');
    await expect(readRosterFile(file)).rejects.toThrow(UNREADABLE_FILE);
  });
});
