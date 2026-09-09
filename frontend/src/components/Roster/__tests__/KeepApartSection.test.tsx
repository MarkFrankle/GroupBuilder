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
      'Nobody is being kept apart yet. People here will never be seated at the same table.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a pair' })).toBeInTheDocument();
  });

  test('a committed pair reads as text, not as dropdowns', () => {
    render(<KeepApartSection {...defaultProps} pairs={[['p1', 'p2']]} />);
    expect(screen.getByText('Ken Adler and Bill Steigelmann')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    // The description stays; only the "nobody yet" half goes away.
    expect(screen.getByText(
      'People here will never be seated at the same table.',
    )).toBeInTheDocument();
  });

  test('the explanation stays up while a draft row is open', () => {
    render(<KeepApartSection {...defaultProps} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByText(
      'Nobody is being kept apart yet. People here will never be seated at the same table.',
    )).toBeInTheDocument();
  });

  test('a half-filled draft row is discarded, not remembered', () => {
    render(<KeepApartSection {...defaultProps} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));
    openSelect(0);
    pick('Ken Adler');

    click(screen.getByRole('button', { name: 'Discard this row' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(defaultProps.onAdd).not.toHaveBeenCalled();
  });

  test('nothing is saved until both names are chosen', async () => {
    render(<KeepApartSection {...defaultProps} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));
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
    click(screen.getByRole('button', { name: 'Add a pair' }));

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
    click(screen.getByRole('button', { name: 'Add a pair' }));

    await openSelect(0);
    await pick('Ken Adler');
    await openSelect(1);
    await pick('Bill Steigelmann');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Ken Adler and Bill Steigelmann are a couple, and couples are always seated at different tables.',
    );
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    // A screen reader must be able to reach the refusal from either name.
    expect(screen.getByLabelText('First person')).toHaveAttribute('aria-describedby', alert.id);
    expect(screen.getByLabelText('Second person')).toHaveAttribute('aria-describedby', alert.id);
  });

  test('the refusal clears when a name is changed', async () => {
    const onAdd = jest.fn<Promise<void>, [string, string]>()
      .mockRejectedValueOnce(new Error('A person can\'t be kept apart from themselves.'))
      // The re-pick commits again; leave that one hanging so the error's
      // disappearance can only be the change clearing it.
      .mockReturnValue(new Promise(() => {}));
    render(<KeepApartSection {...defaultProps} onAdd={onAdd} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));

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

  test('a successful commit clears the draft row', async () => {
    render(<KeepApartSection {...defaultProps} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));

    openSelect(0);
    pick('Ken Adler');
    openSelect(1);
    pick('Bill Steigelmann');

    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add a pair' })).toBeInTheDocument();
  });

  test('the exclusion works in the other direction too', async () => {
    render(<KeepApartSection {...defaultProps} pairs={[['p1', 'p2']]} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));

    openSelect(1);
    pick('Ken Adler');

    openSelect(0);
    expect(screen.getByRole('option', { name: 'Diane Stadlen' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ken Adler' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Bill Steigelmann' })).not.toBeInTheDocument();
  });

  test('both names are inert while the add is in flight', async () => {
    const onAdd = jest.fn(() => new Promise<void>(() => {}));
    render(<KeepApartSection {...defaultProps} onAdd={onAdd} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));

    openSelect(0);
    pick('Ken Adler');
    openSelect(1);
    pick('Bill Steigelmann');

    await waitFor(() => expect(screen.getByLabelText('First person')).toBeDisabled());
    expect(screen.getByLabelText('Second person')).toBeDisabled();

    // A second pick cannot get through, so only one rule is ever created.
    openSelect(0);
    expect(screen.queryByRole('option', { name: 'Diane Stadlen' })).not.toBeInTheDocument();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  test('only one draft row exists at a time', () => {
    render(<KeepApartSection {...defaultProps} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Add a pair' })).not.toBeInTheDocument();
  });

  test('the block and its selects carry accessible names', () => {
    render(<KeepApartSection {...defaultProps} />);
    expect(screen.getByRole('group', { name: 'Keep apart' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Keep apart' })).toBeInTheDocument();
    click(screen.getByRole('button', { name: 'Add a pair' }));
    expect(screen.getByLabelText('First person')).toBeInTheDocument();
    expect(screen.getByLabelText('Second person')).toBeInTheDocument();
  });

  test('names are offered in alphabetical order', () => {
    render(<KeepApartSection {...defaultProps} participants={[diane, ken, bill]} />);
    click(screen.getByRole('button', { name: 'Add a pair' }));
    openSelect(0);
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
      'Bill Steigelmann', 'Diane Stadlen', 'Ken Adler',
    ]);
  });

  test('removing a pair happens on one click, with no confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<KeepApartSection {...defaultProps} pairs={[['p1', 'p2']]} />);

    click(screen.getByRole('button', {
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
