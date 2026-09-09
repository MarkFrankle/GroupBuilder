import { render, screen } from '@testing-library/react';
import { PopulationStats } from '../PopulationStats';
import { RosterParticipant } from '@/types/roster';

const person = (
  id: string,
  overrides: Partial<RosterParticipant> = {},
): RosterParticipant => ({
  id,
  name: id,
  religion: 'Christian',
  gender: 'Female',
  partner_id: null,
  ...overrides,
});

describe('PopulationStats', () => {
  test('summarises the head count, religions and genders', () => {
    render(<PopulationStats participants={[
      person('a'),
      person('b', { religion: 'Jewish', gender: 'Male' }),
      person('c', { religion: 'Muslim', gender: 'Male' }),
    ]} />);
    expect(screen.getByText(/3 people/)).toBeInTheDocument();
    expect(screen.getByText(/1 Christian, 1 Jewish, 1 Muslim/)).toBeInTheDocument();
    expect(screen.getByText(/1F\/2M/)).toBeInTheDocument();
  });

  test('omits religions nobody has', () => {
    render(<PopulationStats participants={[person('a'), person('b')]} />);
    expect(screen.queryByText(/Other/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 Christian/)).toBeInTheDocument();
  });

  test('counts people whose gender is neither female nor male', () => {
    render(<PopulationStats participants={[
      person('a'),
      person('b', { gender: 'Male' }),
      person('c', { gender: 'Other' }),
    ]} />);
    expect(screen.getByText(/1F\/1M\/1 other/)).toBeInTheDocument();
  });

  test('counts a couple once, not once per person', () => {
    render(<PopulationStats participants={[
      person('a', { partner_id: 'b' }),
      person('b', { partner_id: 'a' }),
      person('c'),
    ]} />);
    expect(screen.getByText(/1 couple(?!s)/)).toBeInTheDocument();
  });

  test('reports pairs kept together separately from couples', () => {
    render(<PopulationStats participants={[
      person('a', { partner_id: 'b' }),
      person('b', { partner_id: 'a' }),
      person('c', { partner_id: 'd', keep_together: true }),
      person('d', { partner_id: 'c', keep_together: true }),
    ]} />);
    expect(screen.getByText(/1 couple/)).toBeInTheDocument();
    expect(screen.getByText(/1 pair kept together/)).toBeInTheDocument();
  });

  test('renders nothing for an empty roster', () => {
    const { container } = render(<PopulationStats participants={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
