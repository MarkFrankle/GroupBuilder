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
    screen.getByText(/1 keep-apart rule will be removed because someone in it isn't in this file/),
  ).toBeInTheDocument();
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
  fireEvent.click(screen.getByRole('option', { name: 'Ignore' }));
  expect(screen.getByText('Choose which column holds names.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Add/ })).toBeDisabled();
});
