import { render, screen, fireEvent } from '@testing-library/react';
import { DraftRow } from '@/components/RosterGrid/DraftRow';
import { RosterDraft } from '@/types/roster';

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const DRAFT: RosterDraft = {
  id: 'd1',
  name: 'Grace Hansen',
  religion: null,
  gender: 'Female',
  is_facilitator: false,
  partner_name: null,
};

function setupRow(onChange = jest.fn()) {
  render(
    <table>
      <tbody>
        <DraftRow draft={DRAFT} onChange={onChange} onDelete={jest.fn()} />
      </tbody>
    </table>,
  );
  return onChange;
}

it('marks the row as not saved', () => {
  setupRow();
  expect(screen.getByText('Not saved')).toBeInTheDocument();
});

it('sends a chosen religion', () => {
  const onChange = setupRow();
  fireEvent.keyDown(screen.getByLabelText('Religion for Grace Hansen'), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: 'Christian' }));
  expect(onChange).toHaveBeenCalledWith({ religion: 'Christian' });
});

it('shows a waiting partner by name alone', () => {
  render(
    <table>
      <tbody>
        <DraftRow draft={{ ...DRAFT, partner_name: 'Joe Rossi' }} onChange={jest.fn()} onDelete={jest.fn()} />
      </tbody>
    </table>,
  );
  expect(screen.getByText('Joe Rossi')).toHaveAttribute('title', 'Partners are linked once both are saved.');
});
