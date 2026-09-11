import { render, screen, fireEvent } from '@testing-library/react';
import { AwayCell } from '../AwayCell';

Element.prototype.scrollIntoView = jest.fn();

const base = {
  name: 'Greg Laws',
  numSessions: 4,
  readOnly: false,
  onChange: jest.fn(),
  onLockedClick: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('AwayCell label', () => {
  test('empty reads Attends all sessions', () => {
    render(<AwayCell {...base} absentSessions={[]} />);
    expect(screen.getByText('Attends all sessions')).toBeInTheDocument();
  });

  test('a single session reads Misses session 2', () => {
    render(<AwayCell {...base} absentSessions={[2]} />);
    expect(screen.getByText('Misses session 2')).toBeInTheDocument();
  });

  test('several sessions read comma-separated ascending', () => {
    render(<AwayCell {...base} absentSessions={[4, 2]} />);
    expect(screen.getByText('Misses sessions 2, 4')).toBeInTheDocument();
  });

  test('every session reads Misses all sessions', () => {
    render(<AwayCell {...base} numSessions={2} absentSessions={[1, 2]} />);
    expect(screen.getByText('Misses all sessions')).toBeInTheDocument();
  });

  test('a mark above the current session count is ignored', () => {
    render(<AwayCell {...base} numSessions={3} absentSessions={[4]} />);
    expect(screen.getByText('Attends all sessions')).toBeInTheDocument();
  });
});

describe('AwayCell editing', () => {
  test('the popover shows one checkbox per session', () => {
    render(<AwayCell {...base} numSessions={3} absentSessions={[]} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(screen.getByRole('menuitemcheckbox', { name: 'Session 1' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Session 3' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Session 4' })).toBeNull();
  });

  test('ticking a box calls onChange with the new sorted list', () => {
    render(<AwayCell {...base} absentSessions={[4]} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Session 2' }));
    expect(base.onChange).toHaveBeenCalledWith([2, 4]);
  });

  test('the heading names the participant', () => {
    render(<AwayCell {...base} absentSessions={[]} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(screen.getByText('Which sessions will Greg Laws miss?')).toBeInTheDocument();
  });
});

describe('AwayCell locked', () => {
  test('shows the mirror text and routes a click, with no popover', () => {
    render(<AwayCell {...base} readOnly absentSessions={[2]} />);
    const cell = screen.getByText('Misses session 2');
    fireEvent.click(cell);
    expect(base.onLockedClick).toHaveBeenCalled();
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
  });
});
