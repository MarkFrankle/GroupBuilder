import { sortWithPartnerAdjacency } from '../sortWithPartnerAdjacency';
import { RosterParticipant } from '@/types/roster';

const makeParticipant = (id: string, name: string, partner_id: string | null = null): RosterParticipant => ({
  id, name, religion: 'Other', gender: 'Other', partner_id,
});

describe('sortWithPartnerAdjacency', () => {
  test('partners are sorted adjacent, lower position keeps place', () => {
    const participants = [
      makeParticipant('1', 'A'),
      makeParticipant('2', 'B', '4'),
      makeParticipant('3', 'C'),
      makeParticipant('4', 'D', '2'),
    ];
    const sorted = sortWithPartnerAdjacency(participants);
    expect(sorted.map(p => p.name)).toEqual(['A', 'B', 'D', 'C']);
  });

  test('no partners - order unchanged', () => {
    const participants = [
      makeParticipant('1', 'A'),
      makeParticipant('2', 'B'),
      makeParticipant('3', 'C'),
    ];
    const sorted = sortWithPartnerAdjacency(participants);
    expect(sorted.map(p => p.name)).toEqual(['A', 'B', 'C']);
  });

  test('partners already adjacent - order unchanged', () => {
    const participants = [
      makeParticipant('1', 'A', '2'),
      makeParticipant('2', 'B', '1'),
      makeParticipant('3', 'C'),
    ];
    const sorted = sortWithPartnerAdjacency(participants);
    expect(sorted.map(p => p.name)).toEqual(['A', 'B', 'C']);
  });

  test('multiple partner pairs sorted correctly', () => {
    const participants = [
      makeParticipant('1', 'A', '3'),
      makeParticipant('2', 'B', '4'),
      makeParticipant('3', 'C', '1'),
      makeParticipant('4', 'D', '2'),
    ];
    const sorted = sortWithPartnerAdjacency(participants);
    expect(sorted.map(p => p.name)).toEqual(['A', 'C', 'B', 'D']);
  });

  test('empty array', () => {
    expect(sortWithPartnerAdjacency([])).toEqual([]);
  });
});
