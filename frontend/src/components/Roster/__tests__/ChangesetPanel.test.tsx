import { render, screen } from '@testing-library/react';
import { ChangesetPanel } from '../ChangesetPanel';
import { RosterChangeset } from '@/utils/rosterDiff';

const changeset = (overrides: Partial<RosterChangeset> = {}): RosterChangeset => {
  const base: RosterChangeset = {
    added: [], removed: [], changed: [], renamed: [], shape: [],
    total: 0, isDirty: false, needsRebuild: false,
    ...overrides,
  };
  const total = base.added.length + base.removed.length + base.changed.length
    + base.renamed.length + base.shape.length;
  return { ...base, total, isDirty: total > 0 };
};

describe('ChangesetPanel', () => {
  test('renders nothing when the roster matches the sessions', () => {
    const { container } = render(<ChangesetPanel changeset={changeset()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('lists people added and removed under their own headings', () => {
    render(<ChangesetPanel changeset={changeset({
      added: ['Priya Raman'], removed: ['Ellen Marks'],
    })} />);
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Ellen Marks')).toBeInTheDocument();
  });

  test('shows a field change as an old-to-new value', () => {
    render(<ChangesetPanel changeset={changeset({
      changed: [{ name: 'Katherine Voss', field: 'religion', from: 'Christian', to: 'Jewish' }],
    })} />);
    expect(screen.getByText(/Katherine Voss: religion Christian → Jewish/)).toBeInTheDocument();
  });

  test('says a rename alone will not rebuild the sessions', () => {
    render(<ChangesetPanel changeset={changeset({
      renamed: [{ from: 'Kathrine Bell', to: 'Katherine Bell' }],
    })} />);
    expect(screen.getByText(/Kathrine Bell → Katherine Bell/)).toBeInTheDocument();
    expect(screen.getByText(/spelling.*no new assignments/i)).toBeInTheDocument();
  });

  test('shows a change in the plan size', () => {
    render(<ChangesetPanel changeset={changeset({
      shape: [{ field: 'sessions', from: 5, to: 6 }],
    })} />);
    expect(screen.getByText(/5 sessions → 6/)).toBeInTheDocument();
  });

  test('omits headings for groups with nothing in them', () => {
    render(<ChangesetPanel changeset={changeset({ added: ['Priya Raman'] })} />);
    expect(screen.queryByText('Removed')).not.toBeInTheDocument();
    expect(screen.queryByText('Renamed')).not.toBeInTheDocument();
  });

  test('shows a keep-apart rule as an old-to-new list of names', () => {
    render(<ChangesetPanel changeset={changeset({
      changed: [{ name: 'Ken Adler', field: 'kept apart', from: null, to: 'Bill Ross' }],
    })} />);
    expect(screen.getByText(/Ken Adler: kept apart none → Bill Ross/)).toBeInTheDocument();
  });
});
