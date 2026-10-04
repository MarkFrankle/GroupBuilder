import { Gender, Religion } from '@/types/roster';

/** What a spreadsheet column can be mapped to in the upload preview. */
export type ImportField = 'name' | 'religion' | 'gender' | 'facilitator' | 'partner' | 'ignore';

export const IMPORT_FIELDS: ImportField[] = [
  'name',
  'religion',
  'gender',
  'facilitator',
  'partner',
  'ignore',
];

export const FIELD_LABELS: Record<ImportField, string> = {
  name: 'Name',
  religion: 'Religion',
  gender: 'Gender',
  facilitator: 'Facilitator',
  partner: 'Partner',
  ignore: 'Ignore',
};

/** For comparing headers and values: case, punctuation and spacing don't count. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** For matching people by name. Must agree with `_name_key` in `api/.../roster.py`. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

const RELIGION_VALUES: Record<string, Religion> = {
  christian: 'Christian',
  christianity: 'Christian',
  jewish: 'Jewish',
  judaism: 'Jewish',
  muslim: 'Muslim',
  islam: 'Muslim',
  other: 'Other',
};

const GENDER_VALUES: Record<string, Gender> = {
  male: 'Male',
  m: 'Male',
  man: 'Male',
  female: 'Female',
  f: 'Female',
  woman: 'Female',
  other: 'Other',
};

const YES = new Set(['yes', 'y', 'x', 'true', '1']);
const NO = new Set(['', 'no', 'n', 'false', '0']);

export function readReligion(raw: string): Religion | null {
  return RELIGION_VALUES[normalize(raw)] ?? null;
}

export function readGender(raw: string): Gender | null {
  return GENDER_VALUES[normalize(raw)] ?? null;
}

export function readFacilitator(raw: string): boolean | null {
  const value = normalize(raw);
  if (YES.has(value)) return true;
  if (NO.has(value)) return false;
  return null;
}

/** Map `column` to `field`. A field lives on one column, so whichever column had it is cleared. */
export function setColumnField(
  mapping: ImportField[],
  column: number,
  field: ImportField,
): ImportField[] {
  return mapping.map((current, c) => {
    if (c === column) return field;
    if (field !== 'ignore' && current === field) return 'ignore';
    return current;
  });
}

/** A complete person, as `PUT /api/roster/` takes them. Partners are names: nobody has an id yet. */
export interface ImportedParticipant {
  name: string;
  religion: Religion;
  gender: Gender;
  is_facilitator: boolean;
  partner_name: string | null;
}

/** A person missing a religion or gender. Saved once both are filled in on the roster. */
export interface ImportedDraft {
  name: string;
  religion: Religion | null;
  gender: Gender | null;
  is_facilitator: boolean;
  partner_name: string | null;
}

/** The user's answers for values we couldn't read, keyed by `fixKey`. */
export interface ValueFixes {
  religion: Record<string, Religion>;
  gender: Record<string, Gender>;
}

export const NO_FIXES: ValueFixes = { religion: {}, gender: {} };

/**
 * Something to show on one cell of the preview. `fix` marks a cell answered with
 * a dropdown. It stays set after it's answered so the dropdown keeps showing the
 * choice. `message` is an amber note with nothing to answer.
 */
export interface CellNote {
  row: number;
  column: number;
  message?: string;
  fix?: { field: 'religion' | 'gender'; key: string; answered: boolean };
}

export interface Resolution {
  participants: ImportedParticipant[];
  drafts: ImportedDraft[];
  notes: CellNote[];
  /** Data-row indexes shown struck through: no name, or a repeated name. */
  skippedRows: number[];
  /** No Name column: the one thing that blocks the import. */
  missingName: boolean;
  /** Religion or Gender with no column, which makes every row a draft. */
  unmappedFields: ImportField[];
}

/**
 * An answer covers every cell holding the same value. A blank cell has nothing
 * to share, so its answer belongs to that row alone.
 */
export function fixKey(raw: string, row: number): string {
  return normalize(raw) || `row:${row}`;
}

interface Kept {
  row: number;
  name: string;
  religion: Religion | null;
  gender: Gender | null;
  isFacilitator: boolean;
  partnerRaw: string;
}

export function resolveRows(rows: string[][], mapping: ImportField[], fixes: ValueFixes): Resolution {
  const empty = { participants: [], drafts: [], notes: [], skippedRows: [] };
  if (!mapping.includes('name')) return { ...empty, missingName: true, unmappedFields: [] };

  const columnOf = (field: ImportField) => mapping.indexOf(field);
  const nameCol = columnOf('name');
  const religionCol = columnOf('religion');
  const genderCol = columnOf('gender');
  const facilitatorCol = columnOf('facilitator');
  const partnerCol = columnOf('partner');
  const cell = (row: string[], column: number) => (column === -1 ? '' : (row[column] ?? '').trim());

  const notes: CellNote[] = [];
  const skippedRows: number[] = [];
  const kept: Kept[] = [];
  const seen = new Set<string>();

  const readFixable = <T extends string>(
    field: 'religion' | 'gender',
    read: (raw: string) => T | null,
    answers: Record<string, T>,
    row: string[],
    r: number,
    column: number,
  ): T | null => {
    const raw = cell(row, column);
    const direct = read(raw);
    if (direct) return direct;
    const key = fixKey(raw, r);
    const answer = answers[key] ?? null;
    if (column !== -1) notes.push({ row: r, column, fix: { field, key, answered: answer !== null } });
    return answer;
  };

  rows.forEach((row, r) => {
    if (row.every(value => !value.trim())) return;
    const name = cell(row, nameCol).replace(/\s+/g, ' ');
    if (!name) {
      skippedRows.push(r);
      return;
    }
    if (seen.has(nameKey(name))) {
      skippedRows.push(r);
      notes.push({
        row: r,
        column: nameCol,
        message: `${name} is already listed above, so this row will be skipped.`,
      });
      return;
    }
    seen.add(nameKey(name));

    const religion = readFixable('religion', readReligion, fixes.religion, row, r, religionCol);
    const gender = readFixable('gender', readGender, fixes.gender, row, r, genderCol);

    let isFacilitator = false;
    if (facilitatorCol !== -1) {
      const raw = cell(row, facilitatorCol);
      const value = readFacilitator(raw);
      if (value === null) {
        notes.push({
          row: r,
          column: facilitatorCol,
          message: `Couldn't read "${raw}", so this person won't be marked as a facilitator.`,
        });
      }
      isFacilitator = value ?? false;
    }

    kept.push({
      row: r,
      name,
      religion,
      gender,
      isFacilitator,
      partnerRaw: cell(row, partnerCol),
    });
  });

  const partners = partnerCol === -1 ? new Map<Kept, Kept>() : resolvePartners(kept, partnerCol, notes);

  const participants: ImportedParticipant[] = [];
  const drafts: ImportedDraft[] = [];
  for (const k of kept) {
    const partner_name = partners.get(k)?.name ?? null;
    if (k.religion && k.gender) {
      participants.push({
        name: k.name,
        religion: k.religion,
        gender: k.gender,
        is_facilitator: k.isFacilitator,
        partner_name,
      });
    } else {
      drafts.push({
        name: k.name,
        religion: k.religion,
        gender: k.gender,
        is_facilitator: k.isFacilitator,
        partner_name,
      });
    }
  }

  const unmappedFields = (['religion', 'gender'] as ImportField[]).filter(f => !mapping.includes(f));
  return { participants, drafts, notes, skippedRows, missingName: false, unmappedFields };
}

/**
 * A pair stands when the two name each other, or when one names the other and
 * the other's partner cell is blank: often only one spouse fills it in.
 * Anything else is left blank with a note rather than guessed at.
 */
function resolvePartners(kept: Kept[], column: number, notes: CellNote[]): Map<Kept, Kept> {
  const byKey = new Map(kept.map(k => [nameKey(k.name), k]));
  const claims = new Map<Kept, Kept>();
  const claimCount = new Map<Kept, number>();

  for (const k of kept) {
    if (!k.partnerRaw) continue;
    const target = byKey.get(nameKey(k.partnerRaw));
    if (!target || target === k) {
      notes.push({
        row: k.row,
        column,
        message: `No one else in this file is named "${k.partnerRaw}", so the partner will be left blank.`,
      });
      continue;
    }
    claims.set(k, target);
    claimCount.set(target, (claimCount.get(target) ?? 0) + 1);
  }

  const partners = new Map<Kept, Kept>();
  claims.forEach((target, k) => {
    const mutual = claims.get(target) === k;
    const unclaimedBack = !target.partnerRaw && claimCount.get(target) === 1;
    if (mutual || unclaimedBack) {
      partners.set(k, target);
      partners.set(target, k);
    } else {
      notes.push({
        row: k.row,
        column,
        message: `${target.name} is paired with someone else in this file, so the partner will be left blank.`,
      });
    }
  });
  return partners;
}
