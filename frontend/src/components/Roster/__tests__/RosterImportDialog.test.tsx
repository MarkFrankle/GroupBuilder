import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RosterImportDialog } from '@/components/Roster/RosterImportDialog';
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const HEADERS = ['Name', 'Faith', 'Gender'];
const ROWS = [
  ['Ana', 'Jewish', 'F'],
  ['Ben', 'Catholic', 'M'],
  ['Cy', 'Methodist', 'M'],
];

function setup(props: Partial<React.ComponentProps<typeof RosterImportDialog>> = {}) {
  const onCommit = jest.fn().mockResolvedValue(undefined);
  render(
    <RosterImportDialog
      headers={HEADERS}
      rows={ROWS}
      currentCount={0}
      keepApartNames={[]}
      onCancel={jest.fn()}
      onCommit={onCommit}
      {...props}
    />,
  );
  return { onCommit };
}

it('imports unanswered rows as drafts', async () => {
  const { onCommit } = setup();
  const commit = screen.getByRole('button', { name: 'Add 3 people (2 still need fixing)' });
  expect(commit).toBeEnabled();

  fireEvent.keyDown(screen.getByLabelText('Religion for row 3'), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: 'Christian' }));

  fireEvent.click(screen.getByRole('button', { name: 'Add 3 people (1 still needs fixing)' }));
  await waitFor(() => expect(onCommit).toHaveBeenCalled());
  const upload = onCommit.mock.calls[0][0];
  expect(upload.participants.map((p: { name: string }) => p.name)).toEqual(['Ana', 'Ben']);
  expect(upload.drafts.map((d: { name: string }) => d.name)).toEqual(['Cy']);
});

it('warns only about keep-apart rules naming someone not in the file', () => {
  setup({ keepApartNames: [['ana', 'Ben'], ['Ana', 'Zed']] });
  expect(
    screen.getByText(
      "The keep-apart rule for Ana and Zed will be removed because someone in it isn't in this file.",
    ),
  ).toBeInTheDocument();
});

it('names two dropped rules and counts more', () => {
  setup({ keepApartNames: [['Ana', 'Zed'], ['Ben', 'Yan']] });
  expect(
    screen.getByText(
      "The keep-apart rules for Ana and Zed, and for Ben and Yan, will be removed because someone in them isn't in this file.",
    ),
  ).toBeInTheDocument();
});

it('counts more than two dropped rules', () => {
  setup({ keepApartNames: [['Ana', 'Zed'], ['Ben', 'Yan'], ['Cy', 'Xi']] });
  expect(screen.getByText(/^3 keep-apart rules will be removed/)).toBeInTheDocument();
});

it('says it will replace an existing roster', () => {
  setup({ currentCount: 12, rows: [['Ana', 'Jewish', 'F']] });
  expect(screen.getByRole('button', { name: 'Replace 12 people with 1' })).toBeEnabled();
});

it('shows the server refusal and stays open', async () => {
  const onCommit = jest.fn().mockRejectedValue(new Error('Ana appears more than once.'));
  setup({ onCommit, rows: [['Ana', 'Jewish', 'F']] });
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 person' }));
  expect(await screen.findByText('Ana appears more than once.')).toBeInTheDocument();
});

it('blocks only when no column holds names', () => {
  setup();
  fireEvent.keyDown(screen.getByLabelText('Column Name'), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: "Don't import" }));
  expect(screen.getByText('Choose which column holds names.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Add/ })).toBeDisabled();
});

it('shows an unused column as a dash, named only for screen readers, without a footer count', () => {
  setup({ headers: ['Name', 'Faith', 'Notes'], rows: [['Ana', 'Jewish', 'hi']] });
  const trigger = screen.getByLabelText('Column Notes');
  expect(trigger).toHaveTextContent("–Don't import");
  expect(screen.queryByText(/not imported/)).toBeNull();
});
