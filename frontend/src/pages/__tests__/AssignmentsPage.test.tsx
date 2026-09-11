import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import AssignmentsPage from '../AssignmentsPage'
import { authenticatedFetch } from '@/utils/apiClient'
import { createQueryWrapper } from '@/test-utils/queryWrapper'

const mockAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<
  typeof authenticatedFetch
>

const RESOLVED_PROGRAM = { id: 'test-program-id', name: 'Spring 2026 Series' }
const mockProgramContext: any = {
  currentProgram: RESOLVED_PROGRAM,
  programs: [RESOLVED_PROGRAM],
  loading: false,
  needsProgramSelection: false,
  setCurrentProgram: jest.fn(),
  refreshPrograms: jest.fn(),
}
jest.mock('@/contexts/ProgramContext', () => ({
  useProgram: () => mockProgramContext,
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, loading: false }),
}))

const NUDGE_KEY = 'groupbuilder_assignments_nudge_seen_test-uid'

const person = (name: string, gender = 'Female') => ({
  name,
  religion: 'Christian',
  gender,
  partner: null,
})

/** Three sessions, two tables, four people. */
const assignments = [1, 2, 3].map(session => ({
  session,
  tables: {
    1: [person('Ann'), person('Ben', 'Male')],
    2: [person('Cara'), person('Dan', 'Male')],
  },
}))

/**
 * The same three sessions, but with Cara absent from session 2 and the gap she
 * left still open at table 2 — the fixture a mark-present needs. Sessions 1 and
 * 3 are the shared objects, so the trust clause can be checked by identity.
 */
const withAbsence = [
  assignments[0],
  {
    session: 2,
    tables: {
      1: [person('Ann'), person('Ben', 'Male')],
      2: [null, person('Dan', 'Male')],
    },
    absentParticipants: [person('Cara')],
  },
  assignments[2],
]

const metadata = {
  created_at: 1740000000,
  num_participants: 4,
  num_tables: 2,
  num_sessions: 3,
  has_results: true,
}

interface ApiState {
  completedThrough: number
  /** Serve metadata with accepted:false and handle accept/undo-rebuild. */
  provisional?: boolean
  accepted?: string
  undoneRebuild?: string
  completionResponse?: { status: number; body: any }
  shuffled?: boolean
  shuffleBody?: any
  /** Serve the fixture where Cara is absent from session 2 with a gap open. */
  absence?: boolean
  /** Replace the results fixture wholesale (plan check band tests). */
  resultsOverride?: any[]
  /** Participants served by GET /api/roster/canonical. */
  canonicalParticipants?: any[]
  promoted?: string
  promoteResponse?: { status: number; body: any }
  saved?: { assignments: any[]; label?: string }
  saveResponse?: { status: number; body: any }
}

let api: ApiState

function mockApi() {
  mockAuthenticatedFetch.mockImplementation((url: string, options?: any) => {
    const method = options?.method ?? 'GET'

    if (url.includes('/api/assignments/completion')) {
      if (method !== 'GET' && api.completionResponse) {
        const { status, body } = api.completionResponse
        return Promise.resolve({
          ok: status < 400,
          status,
          json: () => Promise.resolve(body),
        } as Response)
      }
      if (method === 'POST') {
        api.completedThrough = Number(url.split('/completion/')[1].split('?')[0])
      }
      if (method === 'DELETE') {
        api.completedThrough =
          Number(url.split('/completion/')[1].split('?')[0]) - 1
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ completed_through: api.completedThrough }),
      } as Response)
    }

    if (url.includes('/api/assignments/seating/')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tables: [] }),
      } as Response)
    }

    if (url.includes('/api/assignments/regenerate/session/')) {
      api.shuffled = true
      api.shuffleBody = JSON.parse(options?.body ?? 'null')
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ version_id: 'v2' }),
      } as Response)
    }

    if (url.includes('/api/assignments/results/save')) {
      api.saved = JSON.parse(options.body)
      if (api.saveResponse) {
        const { status, body } = api.saveResponse
        return Promise.resolve({
          ok: status < 400,
          status,
          json: () => Promise.resolve(body),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ version_id: 'v3' }),
      } as Response)
    }

    if (url.includes('/api/assignments/results/promote/')) {
      api.promoted = url
      if (api.promoteResponse) {
        const { status, body } = api.promoteResponse
        return Promise.resolve({
          ok: status < 400,
          status,
          json: () => Promise.resolve(body),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ version_id: 'v3', label: 'Restored "Session 3 shuffled"' }),
      } as Response)
    }

    if (url.includes('/api/assignments/results/versions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            versions: [
              {
                version_id: 'v2',
                created_at: 1740086400,
                assignment_set_id: 'set-current',
                label: 'Session 3 shuffled',
                promotable: true,
                not_promotable_reason: null,
              },
              {
                version_id: 'v1',
                created_at: 1740000000,
                assignment_set_id: 'set-current',
                label: null,
                promotable: true,
                not_promotable_reason: null,
              },
              {
                version_id: 'v1',
                created_at: 1739000000,
                assignment_set_id: 'set-previous',
                label: 'Original plan',
                promotable: false,
                not_promotable_reason:
                  'This version predates your roster change on Feb 19, 2025 — ' +
                  'it seats 3 of your 4 participants, and 1 person who has since left.',
              },
            ],
          }),
      } as Response)
    }

    if (url.includes('/api/assignments/accept')) {
      api.accepted = url
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    }

    if (url.includes('/api/assignments/undo-rebuild')) {
      api.undoneRebuild = url
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    }

    if (url.includes('/api/assignments/metadata')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            api.provisional
              ? { ...metadata, accepted: false, previous_set_id: 'set-previous' }
              : metadata
          ),
      } as Response)
    }

    if (url.includes('/api/roster/canonical')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ participants: api.canonicalParticipants ?? [] }),
      } as Response)
    }

    if (url.includes('/api/assignments/results')) {
      // After a shuffle, session 2 comes back with Ann and Cara swapped.
      const body = api.resultsOverride
        ? api.resultsOverride
        : api.absence
        ? withAbsence
        : api.shuffled
        ? [
            assignments[0],
            {
              session: 2,
              tables: {
                1: [person('Ann'), person('Cara')],
                2: [person('Ben', 'Male'), person('Dan', 'Male')],
              },
            },
            assignments[2],
          ]
        : assignments
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as Response)
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    } as Response)
  })
}

function renderPage() {
  const QueryWrapper = createQueryWrapper()
  return render(
    <BrowserRouter>
      <QueryWrapper>
        <AssignmentsPage />
      </QueryWrapper>
    </BrowserRouter>
  )
}

beforeEach(() => {
  api = { completedThrough: 0 }
  mockApi()
  window.HTMLElement.prototype.scrollIntoView = jest.fn()
  // The nudge is once-per-user and would otherwise occupy the strip in every
  // test that asserts on a receipt.
  localStorage.setItem(NUDGE_KEY, 'true')
  Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.resolve()) } })
})

describe('AssignmentsPage', () => {
  it('stacks every session on one page', async () => {
    renderPage()

    expect(await screen.findByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 2')).toBeInTheDocument()
    expect(screen.getByText('Session 3')).toBeInTheDocument()
  })

  it('sorts completed sessions below the live ones', async () => {
    api.completedThrough = 1
    renderPage()

    await screen.findByText('Session 2')

    const headings = screen
      .getAllByText(/^Session \d$/)
      .map(node => node.textContent)
    expect(headings).toEqual(['Session 2', 'Session 3', 'Session 1'])
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('collapses a completed session and expands it on the chevron', async () => {
    api.completedThrough = 1
    renderPage()

    await screen.findByText(/4 seated/)
    await userEvent.click(
      screen.getByRole('button', { name: /expand session 1/i })
    )

    expect(screen.getAllByText('Table 1').length).toBeGreaterThan(1)
  })

  it('marks the first live session complete', async () => {
    renderPage()

    const session1 = await screen.findByRole('region', { name: 'Session 1' })
    await userEvent.click(
      within(session1).getByRole('button', { name: /mark complete/i })
    )

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/assignments/completion/1'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('surfaces the API refusal rather than writing its own copy', async () => {
    api.completionResponse = {
      status: 400,
      body: {
        detail:
          "Session 2 can't be completed yet — Session 1 is still open. Complete your sessions in order.",
      },
    }
    renderPage()

    const session1 = await screen.findByRole('region', { name: 'Session 1' })
    await userEvent.click(
      within(session1).getByRole('button', { name: /mark complete/i })
    )

    expect(
      await screen.findByText(/Session 1 is still open/)
    ).toBeInTheDocument()
  })

  it('resends the session\'s recorded absentees so the shuffle keeps their seats empty', async () => {
    api.absence = true
    renderPage()

    const session2 = await screen.findByRole('region', { name: 'Session 2' })
    await userEvent.click(within(session2).getByRole('button', { name: /shuffle/i }))

    await screen.findByText(/Session 2 shuffled\./)
    expect(api.shuffleBody).toEqual([
      expect.objectContaining({ name: 'Cara' }),
    ])
  })

  it('reports a shuffle with a receipt', async () => {
    renderPage()

    const session2 = await screen.findByRole('region', { name: 'Session 2' })
    await userEvent.click(within(session2).getByRole('button', { name: /shuffle/i }))

    const receipt = await screen.findByText(/Session 2 shuffled\./)
    expect(receipt).toHaveTextContent('2 of 4 people moved')
    expect(receipt).toHaveTextContent('sessions 1, 3 unchanged')
  })

  it('announces the end of the program when every session is complete', async () => {
    api.completedThrough = 3
    renderPage()

    expect(await screen.findByText('All 3 sessions complete.')).toBeInTheDocument()
  })

  it('states the program facts in the header', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Spring 2026 Series' })).toBeInTheDocument()
    expect(
      screen.getByText('4 participants · 2 tables · 3 sessions · avg 1 unique tablemates')
    ).toBeInTheDocument()
  })

  it('copies a program-scoped link, never a version-scoped one', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /copy link/i }))

    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]
    expect(copied).toContain('program=test-program-id')
    expect(copied).not.toContain('version')
  })

  it('goes read-only when an older version is selected', async () => {
    renderPage()

    // A version from the current set: the one that still offers Promote, so
    // read-only is proved against the version most likely to tempt an edit.
    await openVersion(/Session 3 shuffled/)

    expect(await screen.findByText(/You're viewing "Session 3 shuffled"/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /promote/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /shuffle/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark complete/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^print$/i }).length).toBeGreaterThan(0)
  })

  /** Opens History and picks a version by its menu label. */
  async function openVersion(label: string | RegExp) {
    fireEvent.keyDown(await screen.findByRole('button', { name: /history/i }), {
      key: 'Enter',
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: label }))
  }

  it('offers Promote when viewing a version from the current set', async () => {
    renderPage()

    await openVersion(/Session 3 shuffled/)

    expect(await screen.findByRole('button', { name: /promote/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to current/i })).toBeInTheDocument()
  })

  it('states the reason and offers no Promote for a version from an older set', async () => {
    renderPage()

    await openVersion(/Original plan/)

    expect(await screen.findByText(/predates your roster change/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /promote/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to current/i })).toBeInTheDocument()
  })

  it('returns to the current plan after promoting', async () => {
    renderPage()

    await openVersion(/Session 3 shuffled/)
    fireEvent.click(await screen.findByRole('button', { name: /promote/i }))

    expect(
      await screen.findByText(/Restored "Session 3 shuffled" is now the current plan\./)
    ).toBeInTheDocument()
    expect(api.promoted).toContain('/api/assignments/results/promote/v2')
    expect(api.promoted).toContain('program_id=test-program-id')
    expect(api.promoted).toContain('assignment_set_id=set-current')

    // Promotion writes a new version at the head, so the page is live again.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /shuffle/i }).length).toBeGreaterThan(0)
    )
  })

  it('surfaces the API refusal when a promotion is rejected', async () => {
    api.promoteResponse = {
      status: 409,
      body: {
        detail:
          'Session 1 is marked complete and cannot be changed. ' +
          'Reopen it first if you need to make changes.',
      },
    }
    renderPage()

    await openVersion(/Session 3 shuffled/)
    fireEvent.click(await screen.findByRole('button', { name: /promote/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Session 1 is marked complete and cannot be changed/
    )
  })

  describe('zoom', () => {
    it('starts in Full zoom with a column layout', async () => {
      renderPage()

      await screen.findByText('Session 1')
      expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(screen.getByTestId('sessions-container')).toHaveClass('flex-col')
    })

    it('switches to a wrapping row of sessions when Compact is pressed', async () => {
      renderPage()

      await screen.findByText('Session 1')
      fireEvent.click(screen.getByRole('button', { name: 'Compact' }))

      expect(screen.getByTestId('sessions-container')).toHaveClass('flex-row')
      expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    it('renders every session including completed ones in compact (no Completed divider)', async () => {
      api.completedThrough = 1
      renderPage()

      await screen.findByText('Session 2')
      fireEvent.click(screen.getByRole('button', { name: 'Compact' }))

      expect(screen.queryByText('Completed')).not.toBeInTheDocument()
      const headings = screen
        .getAllByText(/^Session \d$/)
        .map(node => node.textContent)
      expect(headings).toEqual(['Session 1', 'Session 2', 'Session 3'])
    })
  })

  describe('printing an older version', () => {
    const realConfirm = window.confirm

    afterEach(() => {
      window.confirm = realConfirm
    })

    /** Clicks Print on the first session card. */
    async function clickPrint() {
      const session1 = await screen.findByRole('region', { name: 'Session 1' })
      fireEvent.click(within(session1).getByRole('button', { name: /^print$/i }))
    }

    it('aborts the print when the confirm is declined', async () => {
      window.confirm = jest.fn(() => false)
      renderPage()

      await openVersion(/Session 3 shuffled/)
      await clickPrint()

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('older version')
      )
      await waitFor(() =>
        expect(mockAuthenticatedFetch).not.toHaveBeenCalledWith(
          expect.stringContaining('/api/assignments/seating/'),
          expect.anything()
        )
      )
    })

    it('prints when the confirm is accepted', async () => {
      window.confirm = jest.fn(() => true)
      renderPage()

      await openVersion(/Session 3 shuffled/)
      await clickPrint()

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('older version')
      )
      await waitFor(() =>
        expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/assignments/seating/1'),
          expect.objectContaining({ method: 'POST' })
        )
      )
    })

    it('asks nothing when printing the current plan', async () => {
      window.confirm = jest.fn(() => true)
      renderPage()

      await clickPrint()

      await waitFor(() =>
        expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/assignments/seating/1'),
          expect.objectContaining({ method: 'POST' })
        )
      )
      expect(window.confirm).not.toHaveBeenCalled()
    })
  })

  it('labels versions and divides them at the setup change', async () => {
    renderPage()

    fireEvent.keyDown(await screen.findByRole('button', { name: /history/i }), {
      key: 'Enter',
    })

    expect(await screen.findByText('Session 3 shuffled')).toBeInTheDocument()
    expect(screen.getByText('Original plan')).toBeInTheDocument()
    expect(screen.getByText(/before your roster change/i)).toBeInTheDocument()
  })


  it('states what the freeze costs when a session is marked complete', async () => {
    renderPage()

    const session1 = await screen.findByRole('region', { name: 'Session 1' })
    await userEvent.click(
      within(session1).getByRole('button', { name: /mark complete/i })
    )

    const receipt = await screen.findByText(/Session 1 marked complete/)
    expect(receipt).toHaveTextContent('4 seated')
    expect(receipt).toHaveTextContent('Session 1 can no longer be changed')
  })

  it('says what reopening does and does not free', async () => {
    api.completedThrough = 2
    renderPage()

    const session2 = await screen.findByRole('region', { name: 'Session 2' })
    await userEvent.click(
      within(session2).getByRole('button', { name: /reopen/i })
    )

    const receipt = await screen.findByText(/Session 2 reopened/)
    expect(receipt).toHaveTextContent('shuffled and edited again')
    expect(receipt).toHaveTextContent('Session 1 stays complete')
  })

  it('offers Undo on the completion receipt, reversing the freeze', async () => {
    renderPage()

    const session1 = await screen.findByRole('region', { name: 'Session 1' })
    await userEvent.click(
      within(session1).getByRole('button', { name: /mark complete/i })
    )

    await screen.findByText(/Session 1 marked complete/)
    const strip = screen.getByTestId('notice-strip')
    await userEvent.click(within(strip).getByRole('button', { name: 'Undo' }))

    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/assignments/completion/1'),
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(await screen.findByText(/Session 1 reopened/)).toBeInTheDocument()
  })

  describe('undo', () => {
    /** Shuffles session 2 and returns the receipt strip. */
    async function shuffleSession2() {
      const session2 = await screen.findByRole('region', { name: 'Session 2' })
      await userEvent.click(within(session2).getByRole('button', { name: /shuffle/i }))
      return screen.findByText(/Session 2 shuffled\./)
    }

    it('promotes the version that was current before the shuffle', async () => {
      renderPage()
      await shuffleSession2()

      fireEvent.click(await screen.findByRole('button', { name: /^undo$/i }))

      // v2 was the head when Shuffle was pressed. Reading the list afterwards
      // would find the shuffle's own version there instead.
      await waitFor(() => expect(api.promoted).toContain('/promote/v2'))
      expect(
        await screen.findByText(/Session 2 shuffle undone/)
      ).toBeInTheDocument()
    })

    it('is not offered for a promotion, only for a shuffle', async () => {
      renderPage()

      await openVersion(/Session 3 shuffled/)
      fireEvent.click(await screen.findByRole('button', { name: /promote/i }))

      await screen.findByText(/is now the current plan/)
      expect(screen.queryByRole('button', { name: /^undo$/i })).not.toBeInTheDocument()
    })
  })

  describe('the first-generate nudge', () => {
    beforeEach(() => localStorage.removeItem(NUDGE_KEY))

    it('points a new facilitator at Help', async () => {
      renderPage()

      expect(
        await screen.findByText(/how session management works/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show me/i })).toBeInTheDocument()
    })

    it('stays gone once a receipt has displaced it', async () => {
      const { unmount } = renderPage()

      await screen.findByText(/how session management works/i)
      const session2 = await screen.findByRole('region', { name: 'Session 2' })
      await userEvent.click(within(session2).getByRole('button', { name: /shuffle/i }))
      await screen.findByText(/Session 2 shuffled\./)

      unmount()
      renderPage()

      await screen.findAllByText('Session 1')
      expect(
        screen.queryByText(/how session management works/i)
      ).not.toBeInTheDocument()
    })
  })

  it('falls back to the timestamp for a version saved before labelling', async () => {
    renderPage()

    fireEvent.keyDown(await screen.findByRole('button', { name: /history/i }), {
      key: 'Enter',
    })

    const unlabelled = await screen.findByRole('menuitem', { name: /Feb 19/ })
    expect(unlabelled).toHaveTextContent(/Feb 19/)
    expect(unlabelled).not.toHaveTextContent(/null/)
  })

  describe('selection', () => {
    /** Every chip bearing this person's name, one per session. */
    const chips = (name: string) => screen.getAllByRole('button', { name })

    async function selectAnn() {
      const anns = await screen.findAllByRole('button', { name: 'Ann' })
      fireEvent.click(anns[0])
      return anns
    }

    it('highlights the clicked person across every session', async () => {
      renderPage()
      await selectAnn()

      chips('Ann').forEach(chip => expect(chip).not.toHaveClass('opacity-50'))
      chips('Ben').forEach(chip => expect(chip).toHaveClass('opacity-50'))
      chips('Cara').forEach(chip => expect(chip).toHaveClass('opacity-50'))
    })

    it('clears the selection when the chip is clicked again', async () => {
      renderPage()
      const anns = await selectAnn()
      fireEvent.click(anns[0])

      // With nobody selected, nothing dims.
      chips('Ben').forEach(chip => expect(chip).not.toHaveClass('opacity-50'))
    })

    it('clears the selection on Escape', async () => {
      renderPage()
      await selectAnn()

      fireEvent.keyDown(window, { key: 'Escape' })

      chips('Ben').forEach(chip => expect(chip).not.toHaveClass('opacity-50'))
    })

    it('clears the selection when anything that is not a chip is clicked', async () => {
      renderPage()
      await selectAnn()

      fireEvent.click(screen.getAllByText('Table 1')[0])

      chips('Ben').forEach(chip => expect(chip).not.toHaveClass('opacity-50'))
    })

    it('announces the selection for a screen reader', async () => {
      renderPage()
      const anns = await selectAnn()

      // Scoped by test id, not by role: NoticeStrip's container is a
      // role="status" region as well, and it is always mounted.
      expect(screen.getByTestId('selection-announcement')).toHaveTextContent(
        /Ann · .* · sits with \d+ of the other \d+ participants/
      )

      fireEvent.click(anns[0])

      // Empty rather than gone: a region that unmounts stops announcing.
      expect(screen.getByTestId('selection-announcement')).toHaveTextContent('')
    })

    it('shows the person-tracking summary line when a person is selected', async () => {
      renderPage()
      await selectAnn()

      expect(screen.getByTestId('tracking-summary')).toHaveTextContent(
        /· .* · sits with \d+ of the other \d+ participants/
      )
    })

    it('hides the summary line when no one is selected', () => {
      renderPage()
      expect(screen.queryByTestId('tracking-summary')).not.toBeInTheDocument()
    })
  })

  describe('mark absent', () => {
    /** Selects Ann, then presses Mark absent inside Session 1. */
    async function markAnnAbsent() {
      const anns = await screen.findAllByRole('button', { name: 'Ann' })
      fireEvent.click(anns[0])
      const session1 = screen.getByRole('region', { name: 'Session 1' })
      fireEvent.click(
        within(session1).getByRole('button', { name: /mark ann absent/i })
      )
    }

    it('sends the whole program with one session edited, and a label', async () => {
      renderPage()
      await markAnnAbsent()

      await waitFor(() => expect(api.saved).toBeDefined())
      const body = api.saved!
      expect(body.assignments).toHaveLength(3)
      expect(body.assignments[0].tables[1]).toEqual([null, person('Ben', 'Male')])
      expect(body.assignments[0].absentParticipants).toEqual([person('Ann')])
      // The trust clause, checked rather than asserted in prose: session 2 goes
      // back exactly as it came.
      expect(body.assignments[1]).toEqual(assignments[1])
      expect(body.assignments[2]).toEqual(assignments[2])
      expect(body.label).toBe('Ann marked absent from Session 1')
    })

    it('reports the edit with its consequence and an undo', async () => {
      renderPage()
      await markAnnAbsent()

      expect(
        await screen.findByText(
          'Ann marked absent from Session 1 \u00b7 Table 1 now seats 1 \u00b7 other sessions unchanged.'
        )
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument()
    })

    it('moves focus to the receipt, so the Undo can be reached', async () => {
      renderPage()
      await markAnnAbsent()

      const receipt = await screen.findByText(/^Ann marked absent from Session 1/)
      // The button that was pressed unmounted with the selection, so focus would
      // otherwise be on <body> with the Undo nowhere near it.
      const strip = screen.getByTestId('notice-strip')
      expect(strip).toContainElement(receipt)

      // Awaited, because focus arrives one step behind the text: the receipt is
      // in the DOM at commit, and the effect that moves focus runs after it.
      // findByText can resolve on that commit while the effect is still pending,
      // which is why a bare assertion here passes or fails with machine load.
      await waitFor(() => expect(strip).toHaveFocus())

      // And it has to still be there once everything the edit kicked off has
      // settled: onSuccess invalidates every query, so refetches re-render the
      // page around the strip a moment later. Awaiting arrival alone would go
      // green even if that re-render stole focus back or replaced the node —
      // this is the half that would catch it. `strip` is deliberately the node
      // captured above, so a replacement fails rather than being re-found.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })
      expect(strip).toHaveFocus()
      expect(strip).toContainElement(screen.getByRole('button', { name: /^undo$/i }))
    })

    it('invalidates the canonical roster, so the Roster page picks up the new absence', async () => {
      renderPage()
      await screen.findAllByRole('button', { name: 'Ann' })
      const callsBefore = mockAuthenticatedFetch.mock.calls.filter(
        ([url]) => String(url).includes('/api/roster/canonical')
      ).length

      await markAnnAbsent()

      await waitFor(() => {
        const callsAfter = mockAuthenticatedFetch.mock.calls.filter(
          ([url]) => String(url).includes('/api/roster/canonical')
        ).length
        expect(callsAfter).toBeGreaterThan(callsBefore)
      })
    })

    it('offers no Mark absent inside a completed session', async () => {
      api.completedThrough = 1
      api.absence = true
      renderPage()

      // Expanded first, and before anyone is selected: a collapsed completed
      // card renders no tables at all, so asserting against one proves nothing —
      // it passes with the card's gate removed. The chevron's click also reaches
      // the page's click-outside dismissal, which would undo a selection made
      // before it.
      fireEvent.click(
        await screen.findByRole('button', { name: /expand session 1/i })
      )
      const session1 = screen.getByRole('region', { name: 'Session 1' })
      expect(within(session1).getByText('Table 1')).toBeInTheDocument()

      // Ann is selected from a live session; selection is page-wide.
      const session2 = screen.getByRole('region', { name: 'Session 2' })
      fireEvent.click(within(session2).getByRole('button', { name: 'Ann' }))

      // The page passes onMarkAbsent to completed cards too and leans entirely
      // on the card's own `actionable` gate, so the "never change the past"
      // guarantee is asserted here, at the layer that does the wiring.
      expect(
        within(session1).queryByRole('button', { name: /mark ann absent/i })
      ).not.toBeInTheDocument()
      expect(
        within(session2).getByRole('button', { name: /mark ann absent/i })
      ).toBeInTheDocument()
    })

    it('undoes by promoting the version that was current before the edit', async () => {
      renderPage()
      await markAnnAbsent()

      fireEvent.click(await screen.findByRole('button', { name: /^undo$/i }))

      await waitFor(() => expect(api.promoted).toContain('/promote/v2'))
    })

    it('surfaces the server\u2019s refusal rather than writing its own', async () => {
      api.saveResponse = {
        status: 409,
        body: {
          detail:
            "Session 1 is complete and can't be changed. Reopen it first if you need to edit it.",
        },
      }
      renderPage()
      await markAnnAbsent()

      expect(
        await screen.findByText(/Reopen it first if you need to edit it/)
      ).toBeInTheDocument()
    })

    it('marks absent the person who was selected, though the click clears the selection', async () => {
      renderPage()
      await markAnnAbsent()

      // The button's click bubbles to the page's click-outside dismissal, so
      // the selection is gone the moment it is pressed. React runs the button's
      // own handler first, and the name travels as an argument from there, so
      // neither the payload nor the receipt can be affected.
      screen
        .getAllByRole('button', { name: 'Ben' })
        .forEach(chip => expect(chip).not.toHaveClass('opacity-50'))

      await waitFor(() => expect(api.saved).toBeDefined())
      expect(api.saved!.label).toBe('Ann marked absent from Session 1')
      expect(api.saved!.assignments[0].tables[1]).toEqual([
        null,
        person('Ben', 'Male'),
      ])
      // Raised from onSuccess, long after the clear.
      expect(
        await screen.findByText(/^Ann marked absent from Session 1/)
      ).toBeInTheDocument()
    })
  })
  describe('mark present', () => {
    /** Selects Cara, the absentee, inside session 2. */
    async function selectCara() {
      const caras = await screen.findAllByRole('button', { name: 'Cara' })
      // Session 2's chip is the absent-row one; every session renders a Cara,
      // and selection is page-wide, so any of them opens the picker.
      fireEvent.click(caras[0])
      return screen.getByRole('region', { name: 'Session 2' })
    }

    /**
     * Drives the trigger the way a mouse does. Radix opens on pointerdown and
     * lets the following click through, so keyboard activation — the project's
     * usual Radix rake — cannot see a trigger whose click bubbles away the
     * selection the picker is gated on.
     */
    function openPickerWithMouse(trigger: HTMLElement) {
      // A real MouseEvent, not fireEvent.pointerDown's init object: jsdom has
      // no PointerEvent, so `button` would never reach the handler, and Radix
      // opens only on button 0.
      fireEvent(
        trigger,
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
      )
      fireEvent.click(trigger)
    }

    it('keeps the selection when the picker is opened with a mouse', async () => {
      api.absence = true
      renderPage()
      const session2 = await selectCara()

      openPickerWithMouse(
        within(session2).getByRole('button', { name: 'Mark present' })
      )

      // The menu is the proof: it is gated on the selection, so an open menu
      // means the trigger's click did not reach the page's dismissal.
      expect(await screen.findByText('Seat Cara at\u2026')).toBeInTheDocument()
      // And said in as many words. Queried by text, not by role: an open Radix
      // menu is modal and aria-hides the rest of the page behind it.
      expect(
        screen.getAllByText(/Cara · .* · sits with \d+ of the other \d+ participants/)
          .length
      ).toBeGreaterThan(0)
    })

    it('lets Escape close the picker without losing the selection', async () => {
      api.absence = true
      renderPage()
      const session2 = await selectCara()

      openPickerWithMouse(
        within(session2).getByRole('button', { name: 'Mark present' })
      )
      const item = await screen.findByRole('menuitem', { name: /Table 2/ })

      fireEvent.keyDown(item, { key: 'Escape' })

      // The menu is gone, and the trigger that opens it is still there — so the
      // one keystroke did one thing.
      await waitFor(() =>
        expect(screen.queryByText('Seat Cara at\u2026')).not.toBeInTheDocument()
      )
      expect(
        within(session2).getByRole('button', { name: 'Mark present' })
      ).toBeInTheDocument()
    })

    it('seats the person at the chosen table and clears the absence', async () => {
      api.absence = true
      renderPage()
      const session2 = await selectCara()

      openPickerWithMouse(
        within(session2).getByRole('button', { name: 'Mark present' })
      )
      fireEvent.click(await screen.findByRole('menuitem', { name: /Table 2/ }))

      await waitFor(() => expect(api.saved).toBeDefined())
      const body = api.saved!
      expect(body.assignments).toHaveLength(3)
      expect(body.assignments[1].tables[2]).toEqual([
        person('Cara'),
        person('Dan', 'Male'),
      ])
      expect(body.assignments[1].absentParticipants).toEqual([])
      // The trust clause: session 3 goes back exactly as it came.
      expect(body.assignments[2]).toEqual(withAbsence[2])
      expect(body.label).toBe('Cara marked present in Session 2')
    })

    it('reports the seating with an undo', async () => {
      api.absence = true
      renderPage()
      const session2 = await selectCara()

      openPickerWithMouse(
        within(session2).getByRole('button', { name: 'Mark present' })
      )
      fireEvent.click(await screen.findByRole('menuitem', { name: /Table 2/ }))

      expect(
        await screen.findByText(
          'Cara marked present in Session 2 \u00b7 seated at Table 2 \u00b7 other sessions unchanged.'
        )
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument()
    })
  })
  describe('provisional rebuild', () => {
    it('shows an Accept/Undo banner and locks actions while the set is provisional', async () => {
      api.provisional = true
      api.completedThrough = 2
      renderPage()

      expect(
        await screen.findByText(
          /Sessions 1\u20132 unchanged; session 3 has new seating/
        )
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /shuffle/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /mark complete/i })
      ).not.toBeInTheDocument()
    })

    it('calls accept when Accept is pressed', async () => {
      api.provisional = true
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))

      await waitFor(() =>
        expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/assignments/accept'),
          expect.objectContaining({ method: 'POST' })
        )
      )
    })

    it('calls undo-rebuild when Undo is pressed', async () => {
      api.provisional = true
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

      await waitFor(() =>
        expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/assignments/undo-rebuild'),
          expect.objectContaining({ method: 'POST' })
        )
      )
    })
  })
})

describe('AssignmentsPage — plan check band', () => {
  it('shows the green verdict for a clean plan', async () => {
    renderPage()

    expect(
      await screen.findByText('Looks good — ready to print and hand out')
    ).toBeInTheDocument()
  })

  it('flags a couple the current plan seats together', async () => {
    api.resultsOverride = [1, 2, 3].map(session => ({
      session,
      tables: {
        1: [
          { ...person('Ann'), partner: 'Ben' },
          { ...person('Ben', 'Male'), partner: 'Ann' },
        ],
        2: [person('Cara'), person('Dan', 'Male')],
      },
    }))
    renderPage()

    expect((await screen.findAllByText(/seats Ann & Ben together/)).length).toBeGreaterThan(0)
    expect(
      screen.getByText('A few things to check before you print')
    ).toBeInTheDocument()
  })
})

describe('AssignmentsPage — plan check band, keep-apart', () => {
  it('flags a keep-apart pair the current plan seats together', async () => {
    api.canonicalParticipants = [
      { name: 'Ann', keep_apart: ['Cara'] },
      { name: 'Cara', keep_apart: ['Ann'] },
    ]
    api.resultsOverride = [1, 2, 3].map(session => ({
      session,
      tables: {
        1: [person('Ann'), person('Cara')],
        2: [person('Ben', 'Male'), person('Dan', 'Male')],
      },
    }))
    renderPage()

    expect(
      (await screen.findAllByText(/seats Ann & Cara together — you asked to keep them apart/)).length
    ).toBeGreaterThan(0)
  })
})
