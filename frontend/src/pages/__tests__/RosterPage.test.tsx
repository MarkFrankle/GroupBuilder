import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RosterPage } from '../RosterPage';
import { authenticatedFetch } from '@/utils/apiClient';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

jest.mock('@/utils/apiClient');
const mockFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

jest.mock('@/contexts/ProgramContext', () => ({
  useProgram: () => ({
    currentProgram: { id: 'test-program-id', name: 'Test' },
    programs: [],
    loading: false,
    needsProgramSelection: false,
    setCurrentProgram: jest.fn(),
    refreshPrograms: jest.fn(),
  }),
}));

const renderPage = () => {
  const QueryWrapper = createQueryWrapper();
  return render(
    <BrowserRouter>
      <QueryWrapper>
        <RosterPage />
      </QueryWrapper>
    </BrowserRouter>
  );
};

describe('RosterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      // No assignment set yet for this program
      if (url.includes('/api/assignments/metadata')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ participants: [] }),
      } as Response);
    });
  });

  test('renders page title', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Roster')).toBeInTheDocument();
    });
  });

  test('loads and displays participants', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        participants: [
          { id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null },
        ],
      }),
    } as Response);
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });
  });

  test('renders table and session selectors', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Number of Tables')).toBeInTheDocument();
    });
    expect(screen.getByText('Number of Sessions')).toBeInTheDocument();
  });

  test('renders generate button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Assignments/i })).toBeInTheDocument();
    });
  });

  test('shows saving indicator', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Saved/i)).toBeInTheDocument();
    });
  });
});

describe('RosterPage with an existing assignment set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/assignments/metadata')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ assignment_set_id: 's1', num_tables: 4, num_sessions: 2 }),
        } as Response);
      }
      if (url.includes('/api/assignments/results')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          participants: [
            { id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null },
            { id: 'p2', name: 'Bob', religion: 'Jewish', gender: 'Male', partner_id: null },
            { id: 'p3', name: 'Cara', religion: 'Muslim', gender: 'Female', partner_id: null },
            { id: 'p4', name: 'Dan', religion: 'None', gender: 'Male', partner_id: null },
          ],
        }),
      } as Response);
    });
  });

  test('shows both regeneration tabs', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: /Regenerate/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fresh Start/i })).toBeInTheDocument();
  });

  test('describes the layout the existing set will preserve', async () => {
    renderPage();
    expect(
      await screen.findByText(/Keeps the existing layout: 4 tables × 2 sessions\./)
    ).toBeInTheDocument();
  });

  test('enables the regenerate button when there are enough participants', async () => {
    renderPage();
    await screen.findByDisplayValue('Alice');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Regenerate All Sessions/i })).toBeEnabled();
    });
  });
});

/**
 * The lock. A program's assignments were built from one specific roster, and
 * most roster edits invalidate them. The lock is the guard against destroying
 * a plan by accident: locked when the live roster still matches the one the
 * sessions were built from, unlocked deliberately or by a real difference.
 */
describe('the lock', () => {
  const alice = {
    id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female',
    partner_id: null, is_facilitator: false, keep_together: false,
  };
  const bob = {
    id: 'p2', name: 'Bob', religion: 'Jewish', gender: 'Male',
    partner_id: null, is_facilitator: false, keep_together: false,
  };
  const canonicalOf = (p: typeof alice) => ({
    name: p.name, religion: p.religion, gender: p.gender,
    partner: null, is_facilitator: false, keep_together: false,
  });

  /** Wires the three endpoints the page reads: the draft roster, the
   * assignment set's shape, and the canonical roster it was built from. */
  const mockProgram = (opts: {
    draft: typeof alice[];
    canonical: typeof alice[] | null;
  }) => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/roster/canonical')) {
        return Promise.resolve({
          ok: true,
          json: async () => opts.canonical
            ? { participants: opts.canonical.map(canonicalOf), num_tables: 2, num_sessions: 3 }
            : { participants: [], num_tables: null, num_sessions: null },
        } as Response);
      }
      if (url.includes('/api/assignments/metadata')) {
        return opts.canonical
          ? Promise.resolve({
              ok: true,
              json: async () => ({ assignment_set_id: 's1', num_tables: 2, num_sessions: 3 }),
            } as Response)
          : Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
      }
      if (url.includes('/api/assignments/results')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({
        ok: true, json: async () => ({ participants: opts.draft }),
      } as Response);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('is locked when the roster matches the sessions', async () => {
    mockProgram({ draft: [alice, bob], canonical: [alice, bob] });
    renderPage();

    expect(await screen.findByRole('button', { name: /edit roster/i })).toBeInTheDocument();
  });

  test('arms the fields when Edit roster is pressed', async () => {
    mockProgram({ draft: [alice, bob], canonical: [alice, bob] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /edit roster/i }));

    expect(screen.queryByRole('button', { name: /edit roster/i })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeEnabled();
  });

  // Unlocked-and-clean is React-local on purpose: nothing was changed, so a
  // reload has nothing to remember and the guard should come back.
  test('re-locks on remount when nothing was changed', async () => {
    mockProgram({ draft: [alice, bob], canonical: [alice, bob] });
    const { unmount } = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /edit roster/i }));
    unmount();

    renderPage();
    expect(await screen.findByRole('button', { name: /edit roster/i })).toBeInTheDocument();
  });

  // Unlocked-and-dirty is durable: it is derived from a real difference
  // between two stored copies, so it survives a reload with nothing persisted.
  test('stays unlocked on remount when the roster differs', async () => {
    mockProgram({ draft: [alice, bob], canonical: [alice] });
    renderPage();

    expect(await screen.findByText(/1 change not yet in your sessions/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit roster/i })).not.toBeInTheDocument();
  });

  test('is unlocked before the first generate', async () => {
    mockProgram({ draft: [alice, bob], canonical: null });
    renderPage();

    expect(await screen.findByRole('button', { name: /generate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit roster/i })).not.toBeInTheDocument();
  });

  // A lock that only hides buttons is not a lock — the grid is where the
  // damage would be done.
  test('locks the grid inputs, not just the buttons', async () => {
    mockProgram({ draft: [alice, bob], canonical: [alice, bob] });
    renderPage();

    expect(await screen.findByDisplayValue('Alice')).toBeDisabled();
    expect(screen.getByLabelText(/Mark Alice as facilitator/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Delete Alice/i })).not.toBeInTheDocument();
  });
});
