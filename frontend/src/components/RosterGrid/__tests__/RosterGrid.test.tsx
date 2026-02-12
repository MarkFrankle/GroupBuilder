import { render, screen, fireEvent } from '@testing-library/react';
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
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Alicia');
    fireEvent.blur(nameInput);
    expect(defaultProps.onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({
      name: 'Alicia',
    }));
  });

  test('calls onAdd when typing in the empty row', async () => {
    render(<RosterGrid {...defaultProps} />);
    const emptyNameInputs = screen.getAllByPlaceholderText('Name');
    const emptyRow = emptyNameInputs[2];
    await userEvent.type(emptyRow, 'Charlie');
    fireEvent.blur(emptyRow);
    expect(defaultProps.onAdd).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Charlie',
    }));
  });
});
