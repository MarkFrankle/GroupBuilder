import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import SessionCard from '@/components/Assignments/SessionCard'
import { CoupleSlotsContext } from '@/components/Assignments/coupleSlotsContext'
import { buildCoupleSlots } from '@/utils/chipPalettes'
import NoticeStrip, { Notice } from '@/components/Assignments/NoticeStrip'
import PlanCheckBand from '@/components/Assignments/PlanCheckBand'
import ProgramHeader from '@/components/Assignments/ProgramHeader'
import ViewBar from '@/components/Assignments/ViewBar'
import { authenticatedFetch } from '@/utils/apiClient'
import {
  seatedCount,
  rebuildReceipt,
  shuffleReceipt,
  tableNumbers,
  personTrackingSummary,
} from '@/utils/assignmentStats'
import { markAbsent, markPresent } from '@/utils/assignmentEdits'
import { checkPlan, keepApartPairs } from '@/utils/planCheck'
import {
  resultsQueryKey,
  useAcceptRebuild,
  useAssignmentResults,
  useAssignmentSetMetadata,
  useCanonicalRoster,
  useResultVersions,
  useSessionCompletion,
  useUndoRebuild,
} from '@/hooks/queries'
import { useProgram } from '@/contexts/ProgramContext'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Assignment,
  AttributeFocus,
  Participant,
  ResultVersion,
  ZoomLevel,
} from '@/types/assignments'

function formatVersionDate(createdAt: number): string {
  return new Date(createdAt * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Reads the user-facing `detail` an API refusal carries.
 *
 * Every refusal in the completion and shuffle paths names its own remedy, and
 * the wording is settled — the page surfaces it rather than writing a second
 * version that can drift out of step with the server's.
 */
async function refusalDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json()
    return body?.detail || fallback
  } catch {
    return fallback
  }
}

function nudgeKey(uid: string): string {
  return `groupbuilder_assignments_nudge_seen_${uid}`
}

/** "Session 1" or "Sessions 1–3", for a prefix that always starts at one. */
function prefix(through: number): string {
  return through === 1 ? 'Session 1' : `Sessions 1–${through}`
}

/**
 * Completion's receipts state the consequence, not just the fact. The freeze is
 * invisible otherwise — a coordinator meets it later as a refusal and has to
 * work out what caused it. Naming it as it is created costs one clause.
 */
function completionReceipt(sessionNumber: number, seated: number): string {
  return (
    `Session ${sessionNumber} marked complete · ${seated} seated · ` +
    `${prefix(sessionNumber)} can no longer be changed.`
  )
}

function reopenReceipt(sessionNumber: number): string {
  const stillFrozen =
    sessionNumber > 1
      ? ` ${prefix(sessionNumber - 1)} ${sessionNumber === 2 ? 'stays' : 'stay'} complete.`
      : ''
  return `Session ${sessionNumber} reopened · it can be shuffled and edited again.${stillFrozen}`
}

const AssignmentsPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentProgram, loading: programLoading } = useProgram()
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const programId = currentProgram?.id ?? null

  // null is the current plan; anything else is a look at the past, and looking
  // is free while acting is not — see readOnly below. The whole version is held
  // rather than its id, because ids are minted per set and so `v1` exists in
  // every set: an id alone no longer names one version.
  const [viewing, setViewing] = useState<ResultVersion | null>(null)

  // Selection is cross-session by design — that is the trust demo, watching one
  // person move every week — so it lives here rather than in a session card.
  const [selectedName, setSelectedName] = useState<string | null>(null)
  // Transient view preference — not persisted; religion is the right landing default.
  const [focus, setFocus] = useState<AttributeFocus>('religion')
  // A zoom level on the same page, not a persisted preference: reload lands in
  // Full, the only place the plan can be edited.
  const [zoom, setZoom] = useState<ZoomLevel>('full')
  const compact = zoom === 'compact'
  const toggleSelected = (name: string) =>
    setSelectedName(current => (current === name ? null : name))

  const { data: metadata } = useAssignmentSetMetadata(programId)
  const { data: fetchedAssignments, isLoading } = useAssignmentResults(
    programId,
    viewing?.version_id,
    viewing?.assignment_set_id
  )
  const { data: completedThrough = 0 } = useSessionCompletion(programId)
  const { data: versions = [] } = useResultVersions(programId)

  // A mid-program rebuild mints a provisional set (accepted: false). Until the
  // user accepts or undoes it, every mutating endpoint 409s, so the page threads
  // readOnly through the same prop that a history view uses.
  const provisional = metadata?.accepted === false
  const readOnly = viewing !== null || provisional
  const acceptMutation = useAcceptRebuild(programId)
  const undoMutation = useUndoRebuild(programId)

  const [notice, setNotice] = useState<Notice | null>(null)

  // Mirrors `notice` so a replacement can retire the one it displaces. The
  // side effect cannot live in a setState updater, which React may run twice.
  const noticeRef = useRef<Notice | null>(null)
  const showNotice = (next: Notice | null) => {
    noticeRef.current?.onDismiss?.()
    noticeRef.current = next
    setNotice(next)
  }
  const [shufflingSession, setShufflingSession] = useState<number | null>(null)

  // The version that was current when Shuffle was pressed — captured up front,
  // because undo must not depend on an invalidated version list having
  // resettled, nor on no other tab having written in between.
  //
  // Shared with editMutation, which writes it too: an edit landing while a
  // shuffle is still in flight would overwrite the shuffle's undo target, and
  // its Undo would then rewind to the wrong version. Left as one ref knowingly
  // — both mutations take about a second and the UI gives no way to start the
  // second before the first has settled. Split it per mutation if a path ever
  // appears that can.
  const undoTarget = useRef<ResultVersion | null>(null)

  // Held so a shuffle can be diffed against what was on screen before it ran.
  const beforeShuffle = useRef<Assignment[]>([])

  const assignments: Assignment[] = useMemo(
    () => (Array.isArray(fetchedAssignments) ? fetchedAssignments : []),
    [fetchedAssignments]
  )

  const sorted = useMemo(
    () => [...assignments].sort((a, b) => a.session - b.session),
    [assignments]
  )
  const live = useMemo(
    () => sorted.filter(a => a.session > completedThrough),
    [sorted, completedThrough]
  )
  const completed = useMemo(
    () => sorted.filter(a => a.session <= completedThrough),
    [sorted, completedThrough]
  )

  const { data: canonicalRoster } = useCanonicalRoster(programId)
  const planCheck = useMemo(
    () =>
      checkPlan(
        live,
        keepApartPairs(canonicalRoster?.participants ?? []),
        metadata?.pairwise_floor ?? metadata?.pairwise_cap,
        metadata?.table_overlap_floor ?? metadata?.table_overlap_cap
      ),
    [
      live,
      canonicalRoster,
      metadata?.pairwise_floor,
      metadata?.pairwise_cap,
      metadata?.table_overlap_floor,
      metadata?.table_overlap_cap,
    ]
  )

  const allParticipants = useMemo<Participant[]>(
    () =>
      sorted.flatMap(a =>
        tableNumbers(a).flatMap(n => a.tables[n].filter((p): p is Participant => !!p))
      ),
    [sorted]
  )

  const coupleSlots = useMemo(() => buildCoupleSlots(allParticipants), [allParticipants])

  // Collapsing a card reflows everything below it, so the anchor is lost. Put
  // the next thing to do back under the user's eyes.
  const firstLiveRef = useRef<HTMLDivElement | null>(null)
  const scrollToFirstLive = () => {
    firstLiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /**
   * Item 13's second push: the one place a once-only user is told there is
   * anything to read. Once per user, and recorded the moment it leaves the
   * strip — including when a receipt displaces it — so it never nags.
   */
  useEffect(() => {
    if (!uid || sorted.length === 0) return
    if (localStorage.getItem(nudgeKey(uid))) return
    showNotice({
      tone: 'info',
      message: "Assignments created. New to this? Here's how session management works.",
      actions: [
        { label: 'Show me', onClick: () => navigate('/help#editing-sessions') },
      ],
      onDismiss: () => localStorage.setItem(nudgeKey(uid), 'true'),
    })
    // Fires once per program load; the flag stops it from returning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sorted.length])

  // Three dismissals, deliberately over-provided: the chip again, any non-chip
  // click, and Escape. A user who has just dimmed the whole page needs an
  // obvious way back, and any one of these is the one someone will not try.
  useEffect(() => {
    if (selectedName === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Radix does not stop Escape propagating out of an open menu, so without
      // this one keystroke both backs out of the table picker and clears the
      // selection the picker is gated on — the user loses their place instead of
      // reconsidering a table. Inside a menu, Escape belongs to the menu.
      if ((event.target as HTMLElement | null)?.closest?.('[role="menu"]')) return
      setSelectedName(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedName])

  const invalidateAll = () => {
    // A prefix, deliberately not resultsQueryKey: this must match every
    // results query for the program, versioned ones included.
    queryClient.invalidateQueries({ queryKey: ['results', programId] })
    queryClient.invalidateQueries({ queryKey: ['versions', programId] })
    queryClient.invalidateQueries({ queryKey: ['completion', programId] })
    // Mark absent/present rewrites this session's absentParticipants, which is
    // exactly what the Roster page's locked Away column mirrors. Without this,
    // the canonical roster query (2 min staleTime) keeps serving the old
    // absences until it happens to refetch on its own.
    queryClient.invalidateQueries({ queryKey: ['canonical-roster', programId] })
  }

  const completionMutation = useMutation({
    mutationFn: async ({
      sessionNumber,
      method,
    }: {
      sessionNumber: number
      method: 'POST' | 'DELETE'
    }) => {
      const response = await authenticatedFetch(
        `/api/assignments/completion/${sessionNumber}?program_id=${programId}`,
        { method }
      )
      if (!response.ok) {
        throw new Error(
          await refusalDetail(response, 'Could not update this session. Please try again.')
        )
      }
      return response.json()
    },
    onSuccess: (_data, { sessionNumber, method }) => {
      // Completion does not move anyone, so `sorted` is still the right seating
      // to count from — nothing has to refetch before the sentence is true.
      const seated = sorted.find(a => a.session === sessionNumber)
      // Undo here is not "promote the previous version" — completion is not a
      // version write. It is the plain inverse verb on the same idempotent
      // endpoint, mirroring the button that also sits on the session card.
      const inverse: 'POST' | 'DELETE' = method === 'POST' ? 'DELETE' : 'POST'
      showNotice({
        tone: 'info',
        message:
          method === 'POST'
            ? completionReceipt(sessionNumber, seated ? seatedCount(seated) : 0)
            : reopenReceipt(sessionNumber),
        actions: [
          {
            label: 'Undo',
            onClick: () => completionMutation.mutate({ sessionNumber, method: inverse }),
          },
        ],
      })
      invalidateAll()
      scrollToFirstLive()
    },
    onError: (error: Error) => {
      showNotice({ tone: 'error', message: error.message })
    },
  })

  const shuffleMutation = useMutation({
    mutationFn: async (sessionNumber: number) => {
      beforeShuffle.current = sorted
      // The first version in a set has nothing behind it, and a version from an
      // older set cannot be promoted — either way there is nothing to undo to.
      undoTarget.current = versions[0]?.promotable ? versions[0] : null
      // Absences are solver input and must survive the shuffle — resend the
      // session's recorded absentees so the solver keeps their seats empty.
      const absentParticipants =
        sorted.find(a => a.session === sessionNumber)?.absentParticipants ?? []
      const response = await authenticatedFetch(
        `/api/assignments/regenerate/session/${sessionNumber}?program_id=${programId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(absentParticipants),
        }
      )
      if (!response.ok) {
        throw new Error(
          await refusalDetail(response, 'Could not shuffle this session. Please try again.')
        )
      }
      return sessionNumber
    },
    onMutate: (sessionNumber: number) => setShufflingSession(sessionNumber),
    onSettled: () => setShufflingSession(null),
    onSuccess: async (sessionNumber: number) => {
      invalidateAll()
      // No queryFn: this reads the results query useAssignmentResults already
      // registered, which is why both sides build the key from the same helper.
      const fresh = await queryClient.fetchQuery<Assignment[]>({
        queryKey: resultsQueryKey(programId),
      })
      const target = undoTarget.current
      showNotice({
        tone: 'info',
        message: shuffleReceipt(beforeShuffle.current, fresh ?? [], sessionNumber),
        actions: target
          ? [
              {
                label: 'Undo',
                onClick: () =>
                  promoteMutation.mutate({ version: target, undoOf: sessionNumber }),
              },
            ]
          : undefined,
      })
    },
    onError: (error: Error) => {
      showNotice({ tone: 'error', message: error.message })
    },
  })

  /**
   * A manual edit is a version write, so undo is "promote the previous version"
   * with no new machinery — unlike completion, which is not a version write and
   * is why its own undo is still an open question.
   */
  const editMutation = useMutation({
    mutationFn: async ({
      assignments: edited,
      label,
    }: {
      assignments: Assignment[]
      label: string
      receipt: string
    }) => {
      undoTarget.current = versions[0]?.promotable ? versions[0] : null
      const response = await authenticatedFetch(
        `/api/assignments/results/save?program_id=${programId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: edited, label }),
        }
      )
      if (!response.ok) {
        throw new Error(
          await refusalDetail(response, 'Could not save this change. Please try again.')
        )
      }
      return response.json()
    },
    onSuccess: (_data, { label, receipt }) => {
      invalidateAll()
      setSelectedName(null)
      const target = undoTarget.current
      showNotice({
        tone: 'info',
        message: receipt,
        // The control that was just pressed is gone — Mark absent unmounts with
        // the selection, and choosing a table unmounts the whole picker — so
        // focus has nowhere to fall back to. The receipt takes it, which is also
        // where the Undo is.
        focusOnAppear: true,
        actions: target
          ? [
              {
                label: 'Undo',
                onClick: () => promoteMutation.mutate({ version: target, undoLabel: label }),
              },
            ]
          : undefined,
      })
    },
    onError: (error: Error) => showNotice({ tone: 'error', message: error.message }),
  })

  /**
   * "other sessions unchanged" is the trust clause, and the reason the banner
   * exists. It is truthful here by construction: the edit touches one session's
   * array and nothing else.
   *
   * The receipt is computed here, before the mutation, because the counts it
   * states are about the array being sent — waiting for a refetch would let the
   * sentence and the plan disagree.
   */
  const handleMarkAbsent = (sessionNumber: number, name: string) => {
    const before = sorted.find(a => a.session === sessionNumber)
    const edited = markAbsent(sorted, sessionNumber, name)
    const session = edited.find(a => a.session === sessionNumber)
    if (!before || !session) return

    const table = tableNumbers(before).find(n =>
      before.tables[n].some(seat => seat?.name === name)
    )
    if (table === undefined) return
    const seats = session.tables[table].filter(Boolean).length

    editMutation.mutate({
      assignments: edited,
      label: `${name} marked absent from Session ${sessionNumber}`,
      receipt:
        `${name} marked absent from Session ${sessionNumber} · ` +
        `Table ${table} now seats ${seats} · other sessions unchanged.`,
    })
  }

  /**
   * The table comes from the user, never from the app: filing a corrected
   * attendance at the wrong table teaches the solver a history that did not
   * happen. See the picker in SessionCard for why nothing is auto-placed.
   */
  const handleMarkPresent = (
    sessionNumber: number,
    name: string,
    tableNumber: number
  ) => {
    editMutation.mutate({
      assignments: markPresent(sorted, sessionNumber, name, tableNumber),
      label: `${name} marked present in Session ${sessionNumber}`,
      receipt:
        `${name} marked present in Session ${sessionNumber} · ` +
        `seated at Table ${tableNumber} · other sessions unchanged.`,
    })
  }

  /**
   * Promotion is not a rewind: the server writes the old content as a new
   * version at the head, so a success lands us back on the current plan rather
   * than deeper into the past.
   */
  const promoteMutation = useMutation({
    mutationFn: async ({
      version,
    }: {
      version: ResultVersion
      undoOf?: number
      undoLabel?: string
    }) => {
      const response = await authenticatedFetch(
        `/api/assignments/results/promote/${version.version_id}` +
          `?program_id=${programId}&assignment_set_id=${version.assignment_set_id}`,
        { method: 'POST' }
      )
      if (!response.ok) {
        throw new Error(await refusalDetail(response, 'Could not restore this version.'))
      }
      return response.json()
    },
    onSuccess: (data: { label: string }, { undoOf, undoLabel }) => {
      setViewing(null)
      invalidateAll()
      // An undo is a promotion underneath, but saying `Restored "…" is now the
      // current plan.` buries the thing the user actually did — and since the
      // server's label can itself already be a `Restored "…"` string, quoting
      // it again would nest indefinitely across repeated undos.
      showNotice({
        tone: 'info',
        message:
          undoOf !== undefined
            ? `Session ${undoOf} shuffle undone. ${
                sorted.length === 1
                  ? 'Session 1 is'
                  : `Sessions 1–${sorted.length} are`
              } back to where they were.`
            : undoLabel !== undefined
              ? `Undid "${undoLabel}".`
              : `${data.label} is now the current plan.`,
      })
    },
    onError: (error: Error) => showNotice({ tone: 'error', message: error.message }),
  })

  /**
   * Print stays available while viewing an older version — a coordinator may
   * genuinely want yesterday's plan on paper. What it must not be is an
   * accident, and the sheet itself carries no version marking, so the only
   * place that fact can be told is here, before the paper exists.
   */
  const confirmPrintingOldVersion = (): boolean => {
    if (!viewing) return true
    const name = viewing.label ?? formatVersionDate(viewing.created_at)
    return window.confirm(
      `You're printing an older version — "${name}". The sheet will not say so.`
    )
  }

  const handlePrintRoster = () => {
    if (!confirmPrintingOldVersion()) return
    navigate('/table-assignments/roster-print', {
      state: { assignments: sorted, programId },
    })
  }

  /**
   * Copy Link is program-scoped by construction: item 0 took the generation id
   * out of the URL, so a shared link always resolves to the current plan and
   * there is no version for it to carry.
   */
  const handleCopyLink = async () => {
    if (!programId) return
    const link = `${window.location.origin}${window.location.pathname}?program=${programId}`
    try {
      await navigator.clipboard.writeText(link)
      showNotice({ tone: 'info', message: 'Link copied.' })
    } catch {
      showNotice({ tone: 'error', message: 'Could not copy the link. Copy it from the address bar instead.' })
    }
  }

  /**
   * A version from an earlier set cannot be promoted — it was built against a
   * different roster. The strip states that as a fact rather than offering a
   * disabled Promote button, which is how the rest of the app refuses things.
   */
  const viewVersion = (version: ResultVersion) => {
    setViewing(version)
    const name = version.label ?? formatVersionDate(version.created_at)
    const backToCurrent = {
      label: 'Back to current',
      onClick: () => {
        setViewing(null)
        showNotice(null)
      },
    }

    showNotice({
      tone: 'info',
      message: version.promotable
        ? `You're viewing "${name}" from ${formatVersionDate(version.created_at)}.`
        : `You're viewing "${name}" from ${formatVersionDate(version.created_at)}. ` +
          `${version.not_promotable_reason}`,
      actions: version.promotable
        ? [{ label: 'Promote', onClick: () => promoteMutation.mutate({ version }) }, backToCurrent]
        : [backToCurrent],
    })
  }

  const handlePrintSession = (sessionNumber: number) => {
    const sessionAssignment = sorted.find(a => a.session === sessionNumber)
    if (!sessionAssignment || !programId) return
    if (!confirmPrintingOldVersion()) return
    navigate('/table-assignments/roster-print', {
      state: { assignments: [sessionAssignment], programId },
    })
  }

  if (programLoading || isLoading) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!programId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Select a program to view its assignments.
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <p className="text-sm text-muted-foreground">
          This program has no assignments yet.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/roster')}>
          Go to Roster
        </Button>
      </div>
    )
  }

  const totalSessions = metadata?.num_sessions ?? sorted.length

  const trackingSummary =
    selectedName !== null ? personTrackingSummary(selectedName, sorted) : null

  // Computed, not transient: while the set is provisional this notice must hold
  // the strip against every receipt, so it is passed ahead of `notice` rather
  // than pushed through showNotice. The mutations surface their own failures.
  const provisionalNotice: Notice | null = provisional
    ? {
        tone: 'info',
        message: rebuildReceipt(completedThrough, totalSessions),
        actions: [
          {
            label: 'Accept',
            onClick: () =>
              acceptMutation.mutate(undefined, {
                onError: (error: Error) =>
                  showNotice({ tone: 'error', message: error.message }),
              }),
          },
          {
            label: 'Undo',
            onClick: () =>
              undoMutation.mutate(undefined, {
                onError: (error: Error) =>
                  showNotice({ tone: 'error', message: error.message }),
              }),
          },
        ],
      }
    : null

  // The moment the current set was minted is the moment the setup changed, so
  // it is the date the divider carries.
  const setChangeDate = metadata?.created_at
    ? formatVersionDate(metadata.created_at)
    : null

  const historyMenu = versions.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-1.5 h-3.5 w-3.5" />
          History
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] overflow-y-auto"
      >
        <DropdownMenuItem
          disabled={!readOnly}
          onSelect={() => {
            setViewing(null)
            showNotice(null)
          }}
        >
          Latest
        </DropdownMenuItem>
        {/*
          Left in server order — current set first, newest first within each
          set. Re-sorting by timestamp would scramble the grouping the divider
          depends on.
        */}
        {versions.map((version: ResultVersion, index: number) => {
          const startsNewSet =
            index > 0 &&
            version.assignment_set_id !== versions[index - 1].assignment_set_id

          return (
            <React.Fragment
              key={`${version.assignment_set_id}:${version.version_id}`}
            >
              {startsNewSet && (
                <div className="border-t px-2 py-1.5 text-xs text-muted-foreground">
                  {setChangeDate
                    ? `Before your roster change on ${setChangeDate}`
                    : 'Before your roster change'}
                </div>
              )}
              <DropdownMenuItem
                disabled={
                  viewing?.version_id === version.version_id &&
                  viewing?.assignment_set_id === version.assignment_set_id
                }
                onSelect={() => viewVersion(version)}
              >
                <div className="flex flex-col items-start">
                  <span>
                    {version.label ?? formatVersionDate(version.created_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatVersionDate(version.created_at)}
                  </span>
                </div>
              </DropdownMenuItem>
            </React.Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex flex-col pb-10" onClick={() => setSelectedName(null)}>
      {/*
        Selecting a person dims 100+ chips across every session, and that has no
        non-visual equivalent — a chip cannot announce it, because a chip does
        not know the others dimmed. It belongs to the page that owns the state.
        Rendered empty rather than unmounted: a region that unmounts stops being
        announced on the next selection in some screen readers.
      */}
      <div
        role="status"
        aria-live="polite"
        // NoticeStrip's container is a role="status" region too, and it is now
        // always mounted, so the two are told apart by this rather than by role.
        data-testid="selection-announcement"
        className="sr-only"
      >
        {trackingSummary ?? ''}
      </div>
      <ProgramHeader
        programName={currentProgram?.name ?? 'Assignments'}
        onPrintRoster={handlePrintRoster}
        onCopyLink={handleCopyLink}
        history={historyMenu}
      />

      <CoupleSlotsContext.Provider value={coupleSlots}>
      <div className="flex flex-col gap-4 px-8">
      {live.length > 0 && (
        <PlanCheckBand result={planCheck} />
      )}
      <NoticeStrip notice={provisionalNotice ?? notice} onDismiss={() => showNotice(null)} />

      <div className="sticky top-14 z-10 -mx-8 border-b bg-white px-8">
        <ViewBar
          focus={focus}
          onFocusChange={setFocus}
          zoom={zoom}
          onZoomChange={setZoom}
          participants={allParticipants}
        />
      </div>

      <div
        data-testid="sessions-container"
        className={compact ? 'flex flex-row flex-wrap items-start gap-4' : 'flex flex-col gap-5'}
      >
        {compact ? (
          sorted.map(assignment => (
            <SessionCard
              key={assignment.session}
              assignment={assignment}
              compact
              readOnly={readOnly}
              selectedName={selectedName}
              onSelect={toggleSelected}
              focus={focus}
              onMarkAbsent={(name: string) => handleMarkAbsent(assignment.session, name)}
              onMarkPresent={(name: string, tableNumber: number) =>
                handleMarkPresent(assignment.session, name, tableNumber)
              }
            />
          ))
        ) : (
          <>
        {live.map((assignment, index) => (
          <div key={assignment.session} ref={index === 0 ? firstLiveRef : undefined}>
            <SessionCard
              assignment={assignment}
              readOnly={readOnly}
              isShuffling={shufflingSession === assignment.session}
              selectedName={selectedName}
              onSelect={toggleSelected}
              focus={focus}
              onShuffle={() => shuffleMutation.mutate(assignment.session)}
              canImproveByShuffle={
                planCheck.verdict !== 'lessThanIdeal' ||
                planCheck.improvableSessions.includes(assignment.session)
              }
              onPrint={() => handlePrintSession(assignment.session)}
              onMarkComplete={() =>
                completionMutation.mutate({
                  sessionNumber: assignment.session,
                  method: 'POST',
                })
              }
              onMarkAbsent={(name: string) => handleMarkAbsent(assignment.session, name)}
              onMarkPresent={(name: string, tableNumber: number) =>
                handleMarkPresent(assignment.session, name, tableNumber)
              }
            />
          </div>
        ))}

        {live.length === 0 && (
          <p className="text-sm font-medium">
            {totalSessions === 1
              ? 'This session is complete.'
              : `All ${totalSessions} sessions complete.`}
          </p>
        )}

        {completed.length > 0 && (
          <>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Completed
            </div>
            {completed.map(assignment => (
              <SessionCard
                key={assignment.session}
                assignment={assignment}
                completed
                readOnly={readOnly}
                selectedName={selectedName}
                onSelect={toggleSelected}
                focus={focus}
                onPrint={() => handlePrintSession(assignment.session)}
                onMarkAbsent={(name: string) => handleMarkAbsent(assignment.session, name)}
                onMarkPresent={(name: string, tableNumber: number) =>
                  handleMarkPresent(assignment.session, name, tableNumber)
                }
                onReopen={
                  assignment.session === completedThrough
                    ? () =>
                        completionMutation.mutate({
                          sessionNumber: assignment.session,
                          method: 'DELETE',
                        })
                    : undefined
                }
              />
            ))}
          </>
        )}
          </>
        )}
      </div>
      </div>
      </CoupleSlotsContext.Provider>
    </div>
  )
}

export default AssignmentsPage
