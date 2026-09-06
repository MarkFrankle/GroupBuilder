import { locationToPath, safeInternalPath } from '../safeRedirect';

describe('safeInternalPath', () => {
  test('accepts in-app paths with query strings', () => {
    expect(safeInternalPath('/table-assignments?program=abc')).toBe('/table-assignments?program=abc');
  });

  test('rejects off-site destinations', () => {
    expect(safeInternalPath('https://evil.com')).toBeNull();
    expect(safeInternalPath('//evil.com')).toBeNull();
    expect(safeInternalPath('/\\evil.com')).toBeNull();
    expect(safeInternalPath(['java','script:alert(1)'].join(''))).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
  });
});

describe('locationToPath', () => {
  test('joins pathname and search', () => {
    expect(locationToPath({ pathname: '/roster', search: '?program=x' })).toBe('/roster?program=x');
  });

  test('returns null for anything that is not a location', () => {
    expect(locationToPath(undefined)).toBeNull();
    expect(locationToPath({ pathname: 'https://evil.com' })).toBeNull();
  });
});
