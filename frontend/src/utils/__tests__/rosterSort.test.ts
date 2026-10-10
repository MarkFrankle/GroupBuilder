import { compareLastName, sortRoster } from '../rosterSort';
import { RosterParticipant } from '@/types/roster';

const person = (
  id: string,
  name: string,
  fields: Partial<RosterParticipant> = {},
): RosterParticipant => ({
  id, name, religion: 'Other', gender: 'Other', partner_id: null, ...fields,
});

const names = (list: RosterParticipant[]) => list.map(p => p.name);

describe('compareLastName', () => {
  test('orders by the last word of the name', () => {
    expect(compareLastName('Ann Zed', 'Bo Adams')).toBeGreaterThan(0);
  });

  test('breaks a shared last name on the full name, ignoring case', () => {
    expect(compareLastName('bea Smith', 'Al Smith')).toBeGreaterThan(0);
    expect(compareLastName('Al smith', 'Al Smith')).toBe(0);
  });
});

describe('sortRoster', () => {
  test('name sorts by last name', () => {
    const list = [person('1', 'Cy Brown'), person('2', 'Zoe Adams'), person('3', 'Al Cole')];
    expect(names(sortRoster(list, 'name', 'asc'))).toEqual(['Zoe Adams', 'Cy Brown', 'Al Cole']);
  });

  test('religion follows the dropdown order, ties by last name', () => {
    const list = [
      person('1', 'A Zed', { religion: 'Muslim' }),
      person('2', 'B Young', { religion: 'Christian' }),
      person('3', 'C Adams', { religion: 'Muslim' }),
    ];
    expect(names(sortRoster(list, 'religion', 'asc'))).toEqual(['B Young', 'C Adams', 'A Zed']);
  });

  test('gender follows the dropdown order', () => {
    const list = [
      person('1', 'A', { gender: 'Other' }),
      person('2', 'B', { gender: 'Female' }),
      person('3', 'C', { gender: 'Male' }),
    ];
    expect(names(sortRoster(list, 'gender', 'asc'))).toEqual(['C', 'B', 'A']);
  });

  test('facilitators come first', () => {
    const list = [person('1', 'A'), person('2', 'B', { is_facilitator: true })];
    expect(names(sortRoster(list, 'facilitator', 'asc'))).toEqual(['B', 'A']);
  });

  test('the most absences come first', () => {
    const list = [
      person('1', 'A', { absent_sessions: [1] }),
      person('2', 'B'),
      person('3', 'C', { absent_sessions: [1, 2] }),
    ];
    expect(names(sortRoster(list, 'absences', 'asc'))).toEqual(['C', 'A', 'B']);
  });

  test('partner puts each pair together, ordered by the earlier last name, unpartnered last', () => {
    const list = [
      person('1', 'Al Adams'),
      person('2', 'Zoe Zed', { partner_id: '3' }),
      person('3', 'Bo Baker', { partner_id: '2' }),
      person('4', 'Cy Cole', { partner_id: '5' }),
      person('5', 'Di Young', { partner_id: '4' }),
    ];
    expect(names(sortRoster(list, 'partner', 'asc'))).toEqual([
      'Bo Baker', 'Zoe Zed', 'Cy Cole', 'Di Young', 'Al Adams',
    ]);
  });

  test('a partner who is not in the list counts as no partner', () => {
    const list = [person('1', 'Bo Baker', { partner_id: 'gone' }), person('2', 'Al Adams')];
    expect(names(sortRoster(list, 'partner', 'asc'))).toEqual(['Al Adams', 'Bo Baker']);
  });

  test('descending is ascending reversed', () => {
    const list = [person('1', 'Cy Brown'), person('2', 'Zoe Adams'), person('3', 'Al Cole')];
    expect(sortRoster(list, 'name', 'desc')).toEqual([...sortRoster(list, 'name', 'asc')].reverse());
  });

  test('leaves the input alone', () => {
    const list = [person('1', 'Cy Brown'), person('2', 'Zoe Adams')];
    sortRoster(list, 'name', 'asc');
    expect(names(list)).toEqual(['Cy Brown', 'Zoe Adams']);
  });
});
