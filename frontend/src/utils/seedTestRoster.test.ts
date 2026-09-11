import { generateTestParticipants } from './seedTestRoster';
import { RELIGIONS, GENDERS } from '@/types/roster';

describe('generateTestParticipants', () => {
  it('generates the requested count with unique names', () => {
    const result = generateTestParticipants(20);
    expect(result).toHaveLength(20);
    expect(new Set(result.map(p => p.name)).size).toBe(20);
  });

  it('produces plain participants with no partner links', () => {
    const result = generateTestParticipants(5);
    result.forEach(p => {
      expect(p.partner_id).toBeNull();
      expect(RELIGIONS).toContain(p.religion);
      expect(GENDERS).toContain(p.gender);
    });
  });

  it('caps at the name pool size instead of looping forever', () => {
    const result = generateTestParticipants(10000);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(10000);
  });

  it('rarely assigns "Other" gender, unlike a uniform pick across all three', () => {
    const result = generateTestParticipants(500); // large sample; gender isn't tied to the name pool so this doesn't hit the 576-name cap in any way that matters here
    const others = result.filter(p => p.gender === 'Other').length;
    // A uniform pick would land near 1/3; the weighted pick should land well under it.
    expect(others / result.length).toBeLessThan(0.2);
  });

  it('rarely assigns "Other" religion, unlike a uniform pick across all four', () => {
    const result = generateTestParticipants(500);
    const others = result.filter(p => p.religion === 'Other').length;
    // A uniform pick would land near 1/4; the weighted pick should land well under it.
    expect(others / result.length).toBeLessThan(0.15);
  });

  it('does not repeat a first or last name within one pass of the pool', () => {
    const result = generateTestParticipants(20);
    const firstNames = result.map(p => p.name.split(' ')[0]);
    const lastNames = result.map(p => p.name.split(' ')[1]);
    expect(new Set(firstNames).size).toBe(firstNames.length);
    expect(new Set(lastNames).size).toBe(lastNames.length);
  });

  it('avoids names already on the roster across repeated calls', () => {
    const first = generateTestParticipants(20);
    const existing = new Set(first.map(p => p.name));
    const second = generateTestParticipants(20, existing);
    second.forEach(p => expect(existing.has(p.name)).toBe(false));
  });

  it('returns fewer than requested rather than looping forever once the pool is exhausted', () => {
    // Exclude the entire 24x24 pool so no name is generatable.
    const excludeNames = new Set<string>();
    const firstList = ['Alex', 'Jamie', 'Morgan', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Avery',
      'Sam', 'Drew', 'Quinn', 'Reese', 'Skyler', 'Dana', 'Rowan', 'Charlie',
      'Emerson', 'Finley', 'Harper', 'Kai', 'Logan', 'Parker', 'Sage', 'Blake'];
    const lastList = ['Rivera', 'Chen', 'Patel', 'Kim', 'Nguyen', 'Garcia', 'Cohen', 'Ahmed',
      'Johnson', 'Martinez', 'Brown', 'Lee', 'Novak', 'Rossi', 'Khan', 'Silva',
      'Weber', 'Okafor', 'Sato', 'Hassan', 'Murphy', 'Diaz', 'Popescu', 'Park'];
    firstList.forEach(f => lastList.forEach(l => excludeNames.add(`${f} ${l}`)));

    const result = generateTestParticipants(5, excludeNames);
    expect(result).toHaveLength(0);
  });
});
