import { movePartnerAdjacent, sortPartnersAdjacent } from '../sortWithPartnerAdjacency';
import { RosterParticipant } from '@/types/roster';

const makeParticipant = (id: string, name: string, partner_id: string | null = null): RosterParticipant => ({
  id, name, religion: 'Other', gender: 'Other', partner_id,
});

describe('movePartnerAdjacent', () => {
  test('partner below edited row moves up to be adjacent', () => {
    const participants = [
      makeParticipant('1', 'A'),
      makeParticipant('2', 'B', '4'),
      makeParticipant('3', 'C'),
      makeParticipant('4', 'D', '2'),
    ];
    // Editing B (id=2), partner D should move right after B
    const result = movePartnerAdjacent(participants, '2');
    expect(result.map(p => p.name)).toEqual(['A', 'B', 'D', 'C']);
  });

  test('partner above edited row moves down to be adjacent', () => {
    const participants = [
      makeParticipant('1', 'A', '3'),
      makeParticipant('2', 'B'),
      makeParticipant('3', 'C', '1'),
    ];
    // Editing C (id=3), partner A should move right after C
    const result = movePartnerAdjacent(participants, '3');
    expect(result.map(p => p.name)).toEqual(['B', 'C', 'A']);
  });

  test('already adjacent - no change', () => {
    const participants = [
      makeParticipant('1', 'A', '2'),
      makeParticipant('2', 'B', '1'),
      makeParticipant('3', 'C'),
    ];
    const result = movePartnerAdjacent(participants, '1');
    expect(result.map(p => p.name)).toEqual(['A', 'B', 'C']);
  });

  test('no partner - no change', () => {
    const participants = [
      makeParticipant('1', 'A'),
      makeParticipant('2', 'B'),
    ];
    const result = movePartnerAdjacent(participants, '1');
    expect(result.map(p => p.name)).toEqual(['A', 'B']);
  });

  test('edited id not found - no change', () => {
    const participants = [makeParticipant('1', 'A')];
    const result = movePartnerAdjacent(participants, 'nonexistent');
    expect(result).toBe(participants);
  });

  test('empty array', () => {
    expect(movePartnerAdjacent([], '1')).toEqual([]);
  });
});

describe('sortPartnersAdjacent', () => {
  test('pulls partners together on load', () => {
    const participants = [
      makeParticipant('1', 'A'),
      makeParticipant('2', 'B', '4'),
      makeParticipant('3', 'C'),
      makeParticipant('4', 'D', '2'),
    ];
    const result = sortPartnersAdjacent(participants);
    expect(result.map(p => p.name)).toEqual(['A', 'B', 'D', 'C']);
  });

  test('multiple pairs sorted adjacent', () => {
    const participants = [
      makeParticipant('1', 'A', '3'),
      makeParticipant('2', 'B', '4'),
      makeParticipant('3', 'C', '1'),
      makeParticipant('4', 'D', '2'),
    ];
    const result = sortPartnersAdjacent(participants);
    expect(result.map(p => p.name)).toEqual(['A', 'C', 'B', 'D']);
  });

  test('no partners - unchanged', () => {
    const participants = [
      makeParticipant('1', 'A'),
      makeParticipant('2', 'B'),
    ];
    const result = sortPartnersAdjacent(participants);
    expect(result.map(p => p.name)).toEqual(['A', 'B']);
  });
});
