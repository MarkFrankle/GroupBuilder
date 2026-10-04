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
