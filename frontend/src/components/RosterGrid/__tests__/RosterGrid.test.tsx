import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterGrid } from '../RosterGrid';
import { RosterParticipant } from '@/types/roster';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const alice: RosterParticipant = {
  id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null,
};
const bob: RosterParticipant = {
  id: 'p2', name: 'Bob', religion: 'Jewish', gender: 'Male', partner_id: null,
};

describe('RosterGrid', () => {
  const defaultProps = {
    participants: [alice, bob],
    onUpdate: jest.fn(),
    onDelete: jest.fn(),
    onAdd: jest.fn(),
    onKeepTogetherToggle: jest.fn(),
    numSessions: 4,
  };

  beforeEach(() => jest.clearAllMocks());

  test('renders all participants as rows', () => {
    render(<RosterGrid {...defaultProps} />);
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
  });

  test('renders column headers', () => {
    render(<RosterGrid {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Religion')).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Partner')).toBeInTheDocument();
  });

  test('renders an empty row at the bottom', () => {
    render(<RosterGrid {...defaultProps} />);
    const nameInputs = screen.getAllByPlaceholderText('Name');
    expect(nameInputs).toHaveLength(3);
    expect(nameInputs[2]).toHaveValue('');
  });

  test('shows participant count', () => {
    render(<RosterGrid {...defaultProps} />);
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });

  test('calls onUpdate when name is changed and blurred', async () => {
    render(<RosterGrid {...defaultProps} />);
    const nameInput = screen.getByDisplayValue('Alice');
    // One change event, not six keystrokes: the input's onChange reads
    // e.target.value wholesale, so typing character by character exercises
    // nothing extra and user-event v13 spends seconds on it.
    fireEvent.change(nameInput, { target: { value: 'Alicia' } });
    fireEvent.blur(nameInput);
    expect(defaultProps.onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({
      name: 'Alicia',
    }));
  });

  test('calls onAdd when typing in the empty row', async () => {
    render(<RosterGrid {...defaultProps} />);
    const emptyNameInputs = screen.getAllByPlaceholderText('Name');
    const emptyRow = emptyNameInputs[2];
    // Focus first: the commit hangs off the *row's* onBlur, which checks
    // document.activeElement, so the input has to genuinely hold focus and then
    // lose it. One change event replaces seven keystrokes; the click stays
    // because it is what actually moves focus out of the row.
    emptyRow.focus();
    fireEvent.change(emptyRow, { target: { value: 'Charlie' } });
    await userEvent.click(document.body);
    // Flush the deferred setTimeout(0) handler
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(defaultProps.onAdd).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Charlie',
    }));
  });

  test('renders facilitator checkboxes', () => {
    render(<RosterGrid participants={[
      { id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null, is_facilitator: true },
      { id: 'p2', name: 'Bob', religion: 'Jewish', gender: 'Male', partner_id: null, is_facilitator: false },
    ]} onUpdate={jest.fn()} onDelete={jest.fn()} onAdd={jest.fn()} onKeepTogetherToggle={jest.fn()} numSessions={4} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // First two are participant checkboxes, third is the disabled empty-row checkbox
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  test('calls onUpdate when facilitator checkbox toggled', async () => {
    const onUpdate = jest.fn();
    render(<RosterGrid participants={[
      { id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null, is_facilitator: false },
    ]} onUpdate={onUpdate} onDelete={jest.fn()} onAdd={jest.fn()} onKeepTogetherToggle={jest.fn()} numSessions={4} />);
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    expect(onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ is_facilitator: true }));
  });

  test('renders an Away column and a participant\'s current marks', () => {
    render(<RosterGrid {...defaultProps} participants={[
      { ...alice, absent_sessions: [2] },
    ]} />);
    expect(screen.getByText('Away')).toBeInTheDocument();
    expect(screen.getByText('Misses session 2')).toBeInTheDocument();
  });

  test('an unrelated edit keeps absent_sessions intact', () => {
    render(<RosterGrid {...defaultProps} participants={[
      { ...alice, absent_sessions: [3] },
    ]} />);
    const nameInput = screen.getByDisplayValue('Alice');
    fireEvent.change(nameInput, { target: { value: 'Alicia' } });
    fireEvent.blur(nameInput);
    expect(defaultProps.onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({
      name: 'Alicia', absent_sessions: [3],
    }));
  });
});
