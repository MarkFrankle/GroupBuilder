import { act, render, screen, waitFor } from '@testing-library/react';
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

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

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

/**
 * The lock. A program's assignments were built from one specific roster, and
 * most roster edits invalidate them. The lock is the guard against destroying
 * a plan by accident: locked when the live roster still matches the one the
 * sessions were built from, unlocked deliberately or by a real difference.
 */
describe('while the page is still loading', () => {
  test('an established program never paints as a brand-new one', async () => {
    // The lock is derived from three queries. Rendering as soon as the roster
    // alone had landed showed an existing program unlocked, offering "Generate
    // assignments", with an editable grid that autosaves every keystroke - the
    // guard off for exactly the first paint, which is when a returning
    // coordinator looks at it.
    //
    // Each query is resolved by hand so the assertion lands in a window this
    // test controls, rather than whenever promises happen to settle.
    let releaseMetadata: () => void = () => {};
    const metadataArrived = new Promise<void>((resolve) => {
      releaseMetadata = resolve;
    });

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/assignments/metadata')) {
        await metadataArrived;
        return {
          ok: true,
          json: async () => ({
            assignment_set_id: 'set-1',
            num_tables: 2,
            num_sessions: 3,
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ participants: [], num_tables: 2, num_sessions: 3 }),
      } as Response;
    });

    renderPage();

    // Roster and canonical have landed; metadata has not. The page must still
    // be waiting rather than guessing.
    await act(async () => {
      // A macrotask, so every already-settled promise has been flushed into
      // React state. Only the metadata query is genuinely still outstanding.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByRole('status', { name: /loading roster/i })).toBeInTheDocument();
    expect(screen.queryByText('Roster')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /generate assignments/i })
    ).not.toBeInTheDocument();

    // And once it does land, the page renders - locked, not offering to generate.
    await act(async () => {
      releaseMetadata();
      await metadataArrived;
    });
    expect(await screen.findByRole('button', { name: /edit roster/i })).toBeInTheDocument();
  });
});

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


/**
 * One button, one request. The rebuild is a single blocking call: the server
 * refuses, solves, and repoints the program on its own, so the page's only job
 * is to ask once and report what came back.
 */
describe('rebuilding from the roster', () => {
  const person = (id: string, name: string) => ({
    id, name, religion: 'Christian', gender: 'Female',
    partner_id: null, is_facilitator: false, keep_together: false,
  });
  const canonicalOf = (p: { name: string; religion: string; gender: string }) => ({
    name: p.name, religion: p.religion, gender: p.gender,
    partner: null, is_facilitator: false, keep_together: false,
  });

  /** Wires the page's reads, and lets one test choose what generate answers. */
  const mockProgram = (opts: {
    draft: ReturnType<typeof person>[];
    canonical: ReturnType<typeof person>[] | null;
    generate?: { ok?: boolean; status?: number; body?: any };
  }) => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/roster/generate')) {
        const g = opts.generate ?? {};
        return Promise.resolve({
          ok: g.ok ?? true,
          status: g.status ?? 200,
          json: async () => g.body ?? { assignment_set_id: 's2', rebuilt: true, message: 'Sessions rebuilt.' },
        } as Response);
      }
      if (url.includes('/api/roster/discard')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'discarded' }) } as Response);
      }
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
      return Promise.resolve({ ok: true, json: async () => ({ participants: opts.draft }) } as Response);
    });
  };

  const alice = person('p1', 'Alice');
  const bob = person('p2', 'Bob');
  const cara = person('p3', 'Cara');
  const dan = person('p4', 'Dan');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('makes exactly one request', async () => {
    mockProgram({ draft: [alice, bob], canonical: [alice] });
    renderPage();

    const btn = await screen.findByRole('button', { name: /save and rebuild sessions/i });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);

    await waitFor(() => {
      const generateCalls = mockFetch.mock.calls.filter(
        ([url]) => String(url).includes('/api/roster/generate')
      );
      expect(generateCalls).toHaveLength(1);
    });
    const solveCalls = mockFetch.mock.calls.filter(
      ([url]) => String(url).includes('/api/assignments/')
        && !String(url).includes('metadata')
    );
    expect(solveCalls).toHaveLength(0);
  });

  test('blocks the page while solving', async () => {
    let release: (value: any) => void = () => {};
    mockProgram({ draft: [alice, bob], canonical: [alice] });
    const passthrough = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/roster/generate')) {
        return new Promise(resolve => { release = resolve; });
      }
      return passthrough(url, init);
    });
    renderPage();

    const btn = await screen.findByRole('button', { name: /save and rebuild sessions/i });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);

    expect(
      await screen.findByText(/Rebuilding your sessions… this can take up to two minutes\./)
    ).toBeInTheDocument();
    release({ ok: true, status: 200, json: async () => ({ assignment_set_id: 's2', rebuilt: true }) });
  });

  test('shows the refusal and leaves the roster alone', async () => {
    mockProgram({
      draft: [alice, bob],
      canonical: [alice],
      generate: { ok: false, status: 400, body: { detail: 'Add 2 more participants.' } },
    });
    renderPage();

    const btn = await screen.findByRole('button', { name: /save and rebuild sessions/i });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);

    expect(await screen.findByText('Add 2 more participants.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and rebuild sessions/i })).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('confirms a discard and names the count', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    mockProgram({ draft: [alice, bob, cara, dan], canonical: [alice] });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /discard changes/i }));

    expect(confirmSpy).toHaveBeenCalledWith('Discard 3 roster changes?');
    confirmSpy.mockRestore();
  });

  test('stays on the page when nothing needed rebuilding', async () => {
    mockProgram({
      draft: [alice, bob],
      canonical: [alice],
      generate: { body: { assignment_set_id: 's1', rebuilt: false, message: 'Roster saved. No rebuild needed.' } },
    });
    renderPage();

    const btn = await screen.findByRole('button', { name: /save and rebuild sessions/i });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);

    expect(await screen.findByText(/No rebuild needed\./)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // computeChangeset reports a brand-new program as clean — there is no
  // canonical roster to differ from — so gating the button on dirtiness alone
  // would hide it on exactly the program that needs it most.
  test('still offers generate on a brand-new program', async () => {
    mockProgram({ draft: [alice, bob], canonical: null });
    renderPage();

    expect(await screen.findByRole('button', { name: /generate assignments/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /discard changes/i })).not.toBeInTheDocument();
  });

  test('offers nothing to press when the roster matches the sessions', async () => {
    mockProgram({ draft: [alice], canonical: [alice] });
    renderPage();

    await screen.findByRole('button', { name: /edit roster/i });
    expect(screen.queryByRole('button', { name: /rebuild sessions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /discard changes/i })).not.toBeInTheDocument();
  });
});
