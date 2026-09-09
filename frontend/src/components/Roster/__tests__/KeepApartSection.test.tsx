import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KeepApartSection } from '../KeepApartSection';
import { RosterParticipant } from '@/types/roster';

// Radix Select scrolls the highlighted option into view; jsdom has no such method.
Element.prototype.scrollIntoView = jest.fn();

const person = (id: string, name: string): RosterParticipant => ({
  id, name, religion: 'Other', gender: 'Other', partner_id: null,
});

const ken = person('p1', 'Ken Adler');
const bill = person('p2', 'Bill Steigelmann');
const diane = person('p3', 'Diane Stadlen');

const defaultProps = {
  participants: [ken, bill, diane],
  pairs: [] as [string, string][],
  onAdd: jest.fn(() => Promise.resolve()),
  onRemove: jest.fn(() => Promise.resolve()),
  readOnly: false,
};

// Radix's select opens on a keypress and commits on a click; user-event v13's
// synthetic pointer sequence does neither, so drive it with fireEvent.
const click = (el: Element) => fireEvent.click(el);

const openSelect = (index: number) =>
  fireEvent.keyDown(screen.getAllByRole('combobox')[index], { key: 'Enter' });

const pick = (name: string) => fireEvent.click(screen.getByRole('option', { name }));

describe('KeepApartSection', () => {
  beforeEach(() => jest.clearAllMocks());

  test('empty state shows the heading, the explanation and the add control', () => {
    render(<KeepApartSection {...defaultProps} />);
    expect(screen.getByText('Keep apart')).toBeInTheDocument();
    expect(screen.getByText(
      'No pairs. People here will never be seated at the same table.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a pair' })).toBeInTheDocument();
  });

  test('a committed pair reads as text, not as dropdowns', () => {
    render(<KeepApartSection {...defaultProps} pairs={[['p1', 'p2']]} />);
    expect(screen.getByText('Ken Adler and Bill Steigelmann')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(
      'No pairs. People here will never be seated at the same table.',
    )).not.toBeInTheDocument();
  });

  test('the explanation stays up while a draft row is open', () => {
    render(<KeepApartSection {...defaultProps} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByText(
      'No pairs. People here will never be seated at the same table.',
    )).toBeInTheDocument();
  });

  test('a half-filled draft row is discarded, not remembered', () => {
    render(<KeepApartSection {...defaultProps} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));
    openSelect(0);
    pick('Ken Adler');

    click(screen.getByRole('button', { name: 'Discard this pair' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(defaultProps.onAdd).not.toHaveBeenCalled();
  });

  test('nothing is saved until both names are chosen', async () => {
    render(<KeepApartSection {...defaultProps} />);
    await click(screen.getByRole('button', { name: 'Add a pair' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);

    await openSelect(0);
    await pick('Ken Adler');
    expect(defaultProps.onAdd).not.toHaveBeenCalled();

    await openSelect(1);
    await pick('Bill Steigelmann');
    await waitFor(() => expect(defaultProps.onAdd).toHaveBeenCalledWith('p1', 'p2'));
  });

  test('the second select excludes the first person and anyone already kept apart from them', async () => {
    render(<KeepApartSection {...defaultProps} pairs={[['p1', 'p2']]} />);
    await click(screen.getByRole('button', { name: 'Add a pair' }));

    await openSelect(0);
    await pick('Ken Adler');

    await openSelect(1);
    expect(screen.getByRole('option', { name: 'Diane Stadlen' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ken Adler' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Bill Steigelmann' })).not.toBeInTheDocument();
  });

  test('a refusal is shown verbatim and the draft row survives', async () => {
    const onAdd = jest.fn(() => Promise.reject(new Error(
      'Ken Adler and Bill Steigelmann are a couple, and couples are always seated at different tables.',
    )));
    render(<KeepApartSection {...defaultProps} onAdd={onAdd} />);
    await click(screen.getByRole('button', { name: 'Add a pair' }));

    await openSelect(0);
    await pick('Ken Adler');
    await openSelect(1);
    await pick('Bill Steigelmann');

    expect(await screen.findByText(
      'Ken Adler and Bill Steigelmann are a couple, and couples are always seated at different tables.',
    )).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  test('the refusal clears when a name is changed', async () => {
    const onAdd = jest.fn(() => Promise.reject(new Error('A person can\'t be kept apart from themselves.')));
    render(<KeepApartSection {...defaultProps} onAdd={onAdd} />);
    await click(screen.getByRole('button', { name: 'Add a pair' }));

    await openSelect(0);
    await pick('Ken Adler');
    await openSelect(1);
    await pick('Bill Steigelmann');
    await screen.findByText('A person can\'t be kept apart from themselves.');

    await openSelect(1);
    await pick('Diane Stadlen');
    await waitFor(() => expect(
      screen.queryByText('A person can\'t be kept apart from themselves.'),
    ).not.toBeInTheDocument());
  });

  test('removing a pair happens on one click, with no confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<KeepApartSection {...defaultProps} pairs={[['p1', 'p2']]} />);

    await click(screen.getByRole('button', {
      name: 'Stop keeping Ken Adler and Bill Steigelmann apart',
    }));
    expect(defaultProps.onRemove).toHaveBeenCalledWith('p1', 'p2');
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('a locked roster still reads, but offers no controls', () => {
    render(<KeepApartSection {...defaultProps} pairs={[['p1', 'p2']]} readOnly />);
    expect(screen.getByText('Ken Adler and Bill Steigelmann')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
