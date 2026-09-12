import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RosterPage } from '../RosterPage';
import { authenticatedFetch } from '@/utils/apiClient';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

// Radix Select scrolls the highlighted option into view; jsdom has no such method.
Element.prototype.scrollIntoView = jest.fn();

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
    const { unmount } = renderPage();

    expect(await screen.findByText(/1 change not yet in your sessions/i)).toBeInTheDocument();
    unmount();

    // Unlocked-clean is React-local and collapses back to Locked on remount.
    // A real difference is read from two stored copies, so it has to survive -
    // that asymmetry is the design, and without the remount this test only
    // proved the first render.
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
  const person = (id: string, name: string, isFacilitator = false) => ({
    id, name, religion: 'Christian', gender: 'Female',
    partner_id: null, is_facilitator: isFacilitator, keep_together: false,
  });
  const canonicalOf = (p: { name: string; religion: string; gender: string; is_facilitator?: boolean }) => ({
    name: p.name, religion: p.religion, gender: p.gender,
    partner: null, is_facilitator: p.is_facilitator ?? false, keep_together: false,
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

  // Two tables need two facilitators too, so Alice and Bob carry the flag.
  const alice = person('p1', 'Alice', true);
  const bob = person('p2', 'Bob', true);
  const cara = person('p3', 'Cara');
  const dan = person('p4', 'Dan');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('makes exactly one request', async () => {
    // Four people for two tables: the server's shortfall gate wants
    // participants >= tables x 2, and the button now agrees with it.
    mockProgram({ draft: [alice, bob, cara, dan], canonical: [alice, bob, cara] });
    renderPage();

    const btn = await screen.findByRole('button', { name: /save and rebuild sessions/i });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);

    // Flush a macrotask rather than asserting inside waitFor: waitFor succeeds
    // on its first tick, so a second request arriving later would slip past it -
    // and a second request is precisely the bug this test exists to catch.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const generateCalls = mockFetch.mock.calls.filter(
      ([url]) => String(url).includes('/api/roster/generate')
    );
    expect(generateCalls).toHaveLength(1);
    const solveCalls = mockFetch.mock.calls.filter(
      ([url]) => String(url).includes('/api/assignments/')
        && !String(url).includes('metadata')
    );
    expect(solveCalls).toHaveLength(0);
  });

  test('blocks the page while solving', async () => {
    let release: (value: any) => void = () => {};
    // Four people for two tables: the server's shortfall gate wants
    // participants >= tables x 2, and the button now agrees with it.
    mockProgram({ draft: [alice, bob, cara, dan], canonical: [alice, bob, cara] });
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
      // Four for two tables, so the button's own check passes and the refusal
      // under test is the server's, not the page's.
      draft: [alice, bob, cara, dan],
      canonical: [alice, bob, cara],
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
      // Four for two tables, so the button's own check passes and the refusal
      // under test is the server's, not the page's.
      draft: [alice, bob, cara, dan],
      canonical: [alice, bob, cara],
      generate: { body: { assignment_set_id: 's1', rebuilt: false, message: 'Roster saved. No rebuild needed.' } },
    });
    renderPage();

    const btn = await screen.findByRole('button', { name: /save and rebuild sessions/i });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);

    expect(await screen.findByText(/No rebuild needed\./)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('navigates to the provisional plan when the rebuild lands', async () => {
    mockProgram({
      draft: [alice, bob, cara, dan],
      canonical: [alice, bob, cara],
      generate: { body: { assignment_set_id: 'x', rebuilt: true, message: 'Sessions rebuilt.' } },
    });
    renderPage();

    const btn = await screen.findByRole('button', { name: /save and rebuild sessions/i });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/table-assignments?program=test-program-id'),
    );
  });

  // computeChangeset reports a brand-new program as clean — there is no
  // canonical roster to differ from — so gating the button on dirtiness alone
  // would hide it on exactly the program that needs it most.
  test('still offers generate on a brand-new program', async () => {
    mockProgram({ draft: [alice, bob, cara, dan], canonical: null });
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

/**
 * Keep apart. Two people who must never share a table — a rule that lives
 * beside the roster it is about, and that counts as a roster change like any
 * other.
 */
describe('the Keep apart block', () => {
  const person = (id: string, name: string) => ({
    id, name, religion: 'Christian', gender: 'Female',
    partner_id: null, is_facilitator: false, keep_together: false,
  });
  const alice = person('p1', 'Alice');
  const bob = person('p2', 'Bob');

  /** The live pairs come back as ids; the canonical copy stores names, exactly
   * as the server's own canonical roster does. */
  const mockProgram = (opts: {
    pairs: [string, string][];
    canonicalKeepApart?: Record<string, string[]>;
  }) => {
    const keepApart = opts.canonicalKeepApart ?? {};
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/api/roster/keep-apart')) {
        return Promise.resolve({
          ok: true, status: 200, json: async () => ({ pairs: opts.pairs }),
        } as Response);
      }
      if (String(url).includes('/api/roster/canonical')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            participants: [alice, bob].map(p => ({
              name: p.name, religion: p.religion, gender: p.gender,
              partner: null, is_facilitator: false, keep_together: false,
              keep_apart: keepApart[p.name] ?? [],
            })),
            num_tables: 2,
            num_sessions: 3,
          }),
        } as Response);
      }
      if (String(url).includes('/api/assignments/metadata')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ assignment_set_id: 's1', num_tables: 2, num_sessions: 3 }),
        } as Response);
      }
      return Promise.resolve({
        ok: true, json: async () => ({ participants: [alice, bob] }),
      } as Response);
    });
  };

  const matching = { Alice: ['Bob'], Bob: ['Alice'] };

  /** Everything except keep-apart, for the tests that drive that route by hand.
   * The sessions were built with nobody kept apart. */
  const baseline = (url: string) => {
    if (url.includes('/api/roster/canonical')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          participants: [alice, bob].map(p => ({
            name: p.name, religion: p.religion, gender: p.gender,
            partner: null, is_facilitator: false, keep_together: false,
            keep_apart: [] as string[],
          })),
          num_tables: 2,
          num_sessions: 3,
        }),
      } as Response);
    }
    if (url.includes('/api/assignments/metadata')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ assignment_set_id: 's1', num_tables: 2, num_sessions: 3 }),
      } as Response);
    }
    return Promise.resolve({
      ok: true, json: async () => ({ participants: [alice, bob] }),
    } as Response);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders below the shape controls', async () => {
    mockProgram({ pairs: [] });
    renderPage();

    const heading = await screen.findByRole('heading', { name: /keep apart/i });
    const sessions = screen.getByText('Number of Sessions');
    expect(
      sessions.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test('marks the roster dirty when a pair is kept apart', async () => {
    // The sessions were built with nobody kept apart; the live roster now
    // keeps two people apart, so the plan no longer matches the roster. Both
    // people gain a rule, so the changeset reports two lines.
    mockProgram({ pairs: [['p1', 'p2']] });
    renderPage();

    expect(await screen.findByText(/2 changes not yet in your sessions/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit roster/i })).not.toBeInTheDocument();
  });

  test('lists a matching pair, locked and unremovable', async () => {
    mockProgram({ pairs: [['p1', 'p2']], canonicalKeepApart: matching });
    renderPage();

    expect(await screen.findByRole('button', { name: /edit roster/i })).toBeInTheDocument();
    expect(screen.getByText('Alice and Bob')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /stop keeping alice and bob apart/i })
    ).not.toBeInTheDocument();
  });

  // The server prunes rules on delete, but a rule naming someone already gone
  // must read as no rule at all — exactly as a dangling partner_id resolves to
  // nobody — or the page would report a change the rebuild cannot make and the
  // roster would never lock again.
  test('ignores a rule naming someone no longer on the roster', async () => {
    mockProgram({ pairs: [['p1', 'gone']] });
    renderPage();

    expect(await screen.findByRole('button', { name: /edit roster/i })).toBeInTheDocument();
  });

  // The add path end to end: the POST goes out and the committed rule comes
  // back on screen without a reload.
  test('adds a pair and shows it', async () => {
    let pairs: [string, string][] = [];
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/roster/keep-apart')) {
        if ((init as RequestInit | undefined)?.method === 'POST') {
          pairs = [['p1', 'p2']];
          return Promise.resolve({
            ok: true, status: 200, json: async () => ({ pairs }),
          } as Response);
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ pairs }) } as Response);
      }
      return baseline(String(url));
    });
    renderPage();

    // The roster matches the sessions, so the block starts inert: pressing
    // Edit roster is how a coordinator gets at it, exactly as for the grid.
    fireEvent.click(await screen.findByRole('button', { name: /edit roster/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a pair' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'First person' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Alice' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Second person' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Bob' }));

    expect(await screen.findByText('Alice and Bob')).toBeInTheDocument();
    const posts = mockFetch.mock.calls.filter(
      ([url, init]) => String(url).includes('/api/roster/keep-apart')
        && (init as RequestInit | undefined)?.method === 'POST'
    );
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String((posts[0][1] as RequestInit).body)))
      .toEqual({ a_id: 'p1', b_id: 'p2' });
  });

  // The refusal is rendered beside the two dropdowns that caused it, not at the
  // top of the page. handleAddKeepApart lets the rejection through on purpose;
  // a try/catch there would break this with nothing else failing.
  test('shows the server’s refusal beside the dropdowns', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/roster/keep-apart')) {
        if ((init as RequestInit | undefined)?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({ detail: 'Alice and Bob are partners.' }),
          } as Response);
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ pairs: [] }) } as Response);
      }
      return baseline(String(url));
    });
    renderPage();

    // The roster matches the sessions, so the block starts inert: pressing
    // Edit roster is how a coordinator gets at it, exactly as for the grid.
    fireEvent.click(await screen.findByRole('button', { name: /edit roster/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a pair' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'First person' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Alice' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Second person' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Bob' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Alice and Bob are partners.');
    // The row stays up so it can be fixed rather than re-opened.
    expect(screen.getByRole('combobox', { name: 'First person' })).toBeInTheDocument();
  });

  test('names both people in the changeset', async () => {
    mockProgram({ pairs: [['p1', 'p2']] });
    renderPage();

    expect(await screen.findByText('Alice: kept apart none → Bob')).toBeInTheDocument();
    expect(screen.getByText('Bob: kept apart none → Alice')).toBeInTheDocument();
  });

  test('counts the pairs in the population line', async () => {
    mockProgram({ pairs: [['p1', 'p2']], canonicalKeepApart: matching });
    renderPage();

    expect(await screen.findByText(/1 pair kept apart/)).toBeInTheDocument();
  });

  // A failed read must never render as "nobody is being kept apart yet" - an
  // affirmative claim - beside a dirty roster offering Discard.
  test('names a failed read instead of implying there are no rules', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/api/roster/keep-apart')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
      }
      return baseline(String(url));
    });
    renderPage();

    expect(
      await screen.findByText(/Couldn’t load who is being kept apart/i)
    ).toBeInTheDocument();
  });

  // The lock is derived from four queries now. Painting once the other three
  // have landed reads the rules as absent, which on a locked program is a
  // dirty roster: grid editable and autosaving, with Discard - destructive -
  // on screen, until the rules land and it all silently flips back.
  test('does not paint before the rules have landed', async () => {
    let releasePairs: () => void = () => {};
    const pairsArrived = new Promise<void>((resolve) => { releasePairs = resolve; });

    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/roster/keep-apart')) {
        await pairsArrived;
        return { ok: true, status: 200, json: async () => ({ pairs: [['p1', 'p2']] }) } as Response;
      }
      return baseline(String(url));
    });

    renderPage();

    // A macrotask, so everything already settled is in React state and only
    // the keep-apart query is genuinely outstanding.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(screen.getByRole('status', { name: /loading roster/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /discard changes/i })).not.toBeInTheDocument();

    await act(async () => { releasePairs(); await pairsArrived; });
    expect(await screen.findByText(/2 changes not yet in your sessions/i)).toBeInTheDocument();
  });

  test('removes a pair', async () => {
    mockProgram({ pairs: [['p1', 'p2']] });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: /stop keeping alice and bob apart/i })
    );

    await waitFor(() => {
      const deletes = mockFetch.mock.calls.filter(
        ([url, init]) => String(url).includes('/api/roster/keep-apart/p1/p2')
          && (init as RequestInit | undefined)?.method === 'DELETE'
      );
      expect(deletes).toHaveLength(1);
    });
  });
});

/**
 * The Away column. Editable before the first build (autosaves like every other
 * field); a read-only, inert mirror of the assignment set's per-session
 * absences afterward — same as every other locked field.
 */
describe('the Away column', () => {
  const alice = {
    id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female',
    partner_id: null, is_facilitator: false, keep_together: false,
  };
  const bob = {
    id: 'p2', name: 'Bob', religion: 'Jewish', gender: 'Male',
    partner_id: null, is_facilitator: false, keep_together: false,
  };

  const mockProgram = (opts: {
    draft: any[];
    canonical: any[] | null;
    canonicalAbsences?: Record<string, number[]>;
  }) => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/roster/canonical')) {
        return Promise.resolve({
          ok: true,
          json: async () => opts.canonical
            ? {
                participants: opts.canonical.map(p => ({
                  name: p.name, religion: p.religion, gender: p.gender,
                  partner: null, is_facilitator: false, keep_together: false,
                  absent_sessions: opts.canonicalAbsences?.[p.name] ?? [],
                })),
                num_tables: 2, num_sessions: 3,
              }
            : { participants: [], num_tables: null, num_sessions: null },
        } as Response);
      }
      if (url.includes('/api/assignments/metadata')) {
        return opts.canonical
          ? Promise.resolve({ ok: true, json: async () => ({ assignment_set_id: 's1', num_tables: 2, num_sessions: 3 }) } as Response)
          : Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
      }
      if (url.includes('/api/assignments/results')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ participants: opts.draft }) } as Response);
    });
  };

  beforeEach(() => jest.clearAllMocks());

  test('pre-build: ticking a session autosaves', async () => {
    mockProgram({ draft: [{ ...alice, absent_sessions: [1] }, bob], canonical: null });
    renderPage();

    const awayCell = await screen.findByRole('button', { name: 'Misses session 1' });
    fireEvent.keyDown(awayCell, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Session 2' }));

    await waitFor(() => {
      const puts = mockFetch.mock.calls.filter(
        ([url, init]) => String(url).includes('/api/roster/p1')
          && (init as RequestInit | undefined)?.method === 'PUT'
          && JSON.parse(String((init as RequestInit).body)).absent_sessions?.includes(2)
      );
      expect(puts.length).toBeGreaterThan(0);
    });
  });

  test('post-build: the cell mirrors the set and stays inert', async () => {
    mockProgram({
      draft: [alice, bob],
      canonical: [alice, bob],
      canonicalAbsences: { Alice: [2] },
    });
    renderPage();

    const cell = await screen.findByText('Misses session 2');
    fireEvent.click(cell);
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
  });
});
