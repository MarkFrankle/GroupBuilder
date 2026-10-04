import {
  normalize,
  readReligion,
  readGender,
  readFacilitator,
  setColumnField,
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
