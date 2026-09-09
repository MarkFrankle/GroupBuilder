import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RosterGrid } from '@/components/RosterGrid/RosterGrid';
import { PopulationStats } from '@/components/Roster/PopulationStats';
import { ChangesetPanel } from '@/components/Roster/ChangesetPanel';
import { KeepApartSection } from '@/components/Roster/KeepApartSection';
import { RosterParticipant } from '@/types/roster';
import {
  upsertParticipant, deleteParticipant as apiDeleteParticipant,
  generateFromRoster, discardRosterChanges,
  addKeepApart, removeKeepApart,
} from '@/api/roster';
import {
  useRoster, useAssignmentSetMetadata, useCanonicalRoster, useKeepApart,
} from '@/hooks/queries';
import { computeChangeset, CanonicalParticipant } from '@/utils/rosterDiff';
import { useProgram } from '@/contexts/ProgramContext';
import { useQueryClient } from '@tanstack/react-query';
import { MAX_TABLES, MAX_SESSIONS } from '@/constants';
import { AlertCircle, Loader2, Pencil } from 'lucide-react';
import { movePartnerAdjacent, sortPartnersAdjacent } from '@/utils/sortWithPartnerAdjacency';

type SaveStatus = 'saved' | 'saving' | 'error';

interface AssignmentSetSummary {
  assignment_set_id: string;
  num_tables: number;
  num_sessions: number;
}

interface CanonicalRoster {
  participants: CanonicalParticipant[];
  num_tables: number | null;
  num_sessions: number | null;
}

/**
 * The draft roster in the shape the assignment set froze. The canonical copy
 * stores a partner *name*, not an id, so a partnered person would read as
 * changed on every comparison unless the draft is translated first.
 *
 * Keep-apart rules get the same treatment, mirroring the server's
 * `_roster_to_participant_list` exactly: each pair stamps each person's name
 * on the other, sorted and deduped, and a pair naming an id that no longer
 * resolves is dropped — just as a dangling partner_id resolves to null. The
 * stamp is keyed by name, so two people sharing a name both receive a rule
 * aimed at either of them, which is the safe direction and what the server
 * does. Any divergence here would have the page report changes that aren't
 * real, or miss ones that are.
 */
function toCanonical(
  participants: RosterParticipant[],
  keepApartPairs: [string, string][],
): CanonicalParticipant[] {
  const nameById = new Map(participants.map(p => [p.id, p.name]));

  const keepApartNames = new Map<string, string[]>();
  participants.forEach(p => keepApartNames.set(p.name, []));
  keepApartPairs.forEach(([aId, bId]) => {
    const aName = nameById.get(aId);
    const bName = nameById.get(bId);
    if (!aName || !bName || aName === bName) return;
    keepApartNames.get(aName)!.push(bName);
    keepApartNames.get(bName)!.push(aName);
  });

  return participants.map(p => ({
    name: p.name,
    religion: p.religion,
    gender: p.gender,
    partner: p.partner_id ? nameById.get(p.partner_id) ?? null : null,
    is_facilitator: p.is_facilitator ?? false,
    keep_together: p.keep_together ?? false,
    keep_apart: Array.from(new Set(keepApartNames.get(p.name) ?? [])).sort(),
  }));
}

export function RosterPage() {
  const navigate = useNavigate();
  const { currentProgram } = useProgram();
  const queryClient = useQueryClient();
  const { data: rosterData, isLoading: rosterLoading, error: fetchError } = useRoster();
  const { data: metadata, isLoading: metadataLoading } = useAssignmentSetMetadata(
    currentProgram?.id ?? null,
  );
  const currentSet: AssignmentSetSummary | null =
    (metadata as AssignmentSetSummary | undefined) ?? null;
  const {
    data: canonicalData,
    isLoading: canonicalLoading,
    error: canonicalError,
  } = useCanonicalRoster(currentProgram?.id ?? null);
  const canonical = (canonicalData as CanonicalRoster | undefined) ?? null;
  const { data: keepApartData } = useKeepApart(currentProgram?.id ?? null);
  const keepApartPairs = keepApartData ?? [];

  // Every one of the three, not just the roster. The lock is derived from all
  // of them, so rendering before they land shows an established program as a
  // brand-new one: unlocked, offering "Generate assignments", with an editable
  // grid that autosaves each keystroke. A guard that is off for the first paint
  // is not a guard.
  const loading = rosterLoading || metadataLoading || canonicalLoading;

  const [participants, setParticipants] = useState<RosterParticipant[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const [numTables, setNumTables] = useState('4');
  const [numSessions, setNumSessions] = useState('5');
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Deliberately not persisted: "I pressed Edit but changed nothing" is not
  // worth remembering, and a reload should put the guard back.
  const [armed, setArmed] = useState(false);

  // The selects have to start on the plan's real shape, or a program built as
  // anything other than the 4x5 default would read as changed forever.
  useEffect(() => {
    if (!currentSet) return;
    setNumTables(String(currentSet.num_tables));
    setNumSessions(String(currentSet.num_sessions));
  }, [currentSet?.assignment_set_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rosterData) {
      setParticipants(sortPartnersAdjacent(rosterData));
    }
  }, [rosterData]);

  const handleUpdate = useCallback(async (id: string, data: Omit<RosterParticipant, 'id'>) => {
    setSaveStatus('saving');
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));

    const oldParticipant = participants.find(p => p.id === id);
    const oldPartnerId = oldParticipant?.partner_id;
    const newPartnerId = data.partner_id;

    try {
      await upsertParticipant(currentProgram!.id, id, data);

      if (oldPartnerId !== newPartnerId) {
        if (oldPartnerId) {
          const oldPartner = participants.find(p => p.id === oldPartnerId);
          if (oldPartner && oldPartner.partner_id === id) {
            await upsertParticipant(currentProgram!.id, oldPartnerId, { ...oldPartner, partner_id: null, keep_together: false });
            setParticipants(prev => prev.map(p =>
              p.id === oldPartnerId ? { ...p, partner_id: null, keep_together: false } : p
            ));
          }
        }
        if (newPartnerId) {
          const newPartner = participants.find(p => p.id === newPartnerId);
          if (newPartner) {
            await upsertParticipant(currentProgram!.id, newPartnerId, { ...newPartner, partner_id: id });
            setParticipants(prev => {
              const updated = prev.map(p =>
                p.id === newPartnerId ? { ...p, partner_id: id } : p
              );
              return movePartnerAdjacent(updated, id);
            });
          }
        }
      }

      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [participants, currentProgram]);

  const handleDelete = useCallback(async (id: string) => {
    setSaveStatus('saving');
    setParticipants(prev => prev.filter(p => p.id !== id));
    try {
      await apiDeleteParticipant(currentProgram!.id, id);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [currentProgram]);

  const handleAdd = useCallback(async (data: Omit<RosterParticipant, 'id'>) => {
    const newId = uuidv4();
    const newParticipant: RosterParticipant = { id: newId, ...data };
    setSaveStatus('saving');
    setParticipants(prev => [...prev, newParticipant]);
    try {
      await upsertParticipant(currentProgram!.id, newId, data);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [currentProgram]);

  const handleKeepTogetherToggle = useCallback(async (id: string) => {
    const participant = participants.find(p => p.id === id);
    if (!participant?.partner_id) return;

    const newValue = !participant.keep_together;
    const partnerId = participant.partner_id;

    // Optimistic update on both sides
    setParticipants(prev => prev.map(p => {
      if (p.id === id || p.id === partnerId) {
        return { ...p, keep_together: newValue };
      }
      return p;
    }));

    setSaveStatus('saving');
    try {
      const partnerObj = participants.find(p => p.id === partnerId);
      await upsertParticipant(currentProgram!.id, id, { ...participant, keep_together: newValue });
      if (partnerObj) {
        await upsertParticipant(currentProgram!.id, partnerId, { ...partnerObj, keep_together: newValue });
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [participants, currentProgram]);

  const invalidateKeepApart = () => {
    const programId = currentProgram!.id;
    queryClient.invalidateQueries({ queryKey: ['keep-apart', programId] });
    queryClient.invalidateQueries({ queryKey: ['roster', programId] });
    queryClient.invalidateQueries({ queryKey: ['canonical-roster', programId] });
  };

  /** Deliberately not caught: the section renders the server's refusal inline,
   * beside the two selects that caused it, rather than at the top of the page. */
  const handleAddKeepApart = async (aId: string, bId: string) => {
    await addKeepApart(currentProgram!.id, aId, bId);
    invalidateKeepApart();
  };

  /** Removal is never refused, so the only realistic failure is the network.
   * The section's contract is that this must not reject, so it is reported
   * through the page's own error alert. */
  const handleRemoveKeepApart = async (aId: string, bId: string) => {
    try {
      await removeKeepApart(currentProgram!.id, aId, bId);
      invalidateKeepApart();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const invalidateAssignmentQueries = () => {
    const programId = currentProgram?.id;
    queryClient.invalidateQueries({ queryKey: ['assignment-set-metadata', programId] });
    queryClient.invalidateQueries({ queryKey: ['versions', programId] });
    queryClient.invalidateQueries({ queryKey: ['results', programId] });
  };

  /**
   * One request. The server refuses, solves, and repoints the program itself,
   * so there is nothing left for the page to do but wait and report back.
   */
  const handleRebuild = async () => {
    setError(null);
    setNotice(null);
    setGenerating(true);
    try {
      const result = await generateFromRoster(
        currentProgram!.id, parseInt(numTables), parseInt(numSessions)
      );
      invalidateAssignmentQueries();
      queryClient.invalidateQueries({ queryKey: ['canonical-roster', currentProgram!.id] });
      if (result.rebuilt) {
        navigate(`/table-assignments?program=${currentProgram!.id}`);
        return;
      }
      // Nothing about the sessions moved, so sending the coordinator to look
      // at them would be a non-sequitur.
      setNotice(result.message);
      // The change was accepted, so the guard goes back on - the page stays put
      // and would otherwise leave the grid editable after a successful save.
      setArmed(false);
      setGenerating(false);
    } catch (err: any) {
      // The server's wording is the user-facing wording; don't rewrite it.
      setError(err.message);
      setGenerating(false);
    }
  };

  const handleDiscard = async () => {
    const count = changeset.total;
    if (!window.confirm(`Discard ${count} roster change${count === 1 ? '' : 's'}?`)) return;
    setError(null);
    setNotice(null);
    try {
      await discardRosterChanges(currentProgram!.id);
      setArmed(false);
      // The selects are React state, and discard does not change the set id, so
      // the effect that syncs them will not re-run. Without this a discarded
      // session-count change stays on screen and the page goes on reporting an
      // unsaved change that Discard can no longer clear.
      if (canonical?.num_tables) setNumTables(String(canonical.num_tables));
      if (canonical?.num_sessions) setNumSessions(String(canonical.num_sessions));
      queryClient.invalidateQueries({ queryKey: ['roster', currentProgram!.id] });
      queryClient.invalidateQueries({ queryKey: ['canonical-roster', currentProgram!.id] });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const changeset = computeChangeset(
    canonical?.participants ?? [],
    toCanonical(participants, keepApartPairs),
    { tables: canonical?.num_tables ?? null, sessions: canonical?.num_sessions ?? null },
    { tables: parseInt(numTables), sessions: parseInt(numSessions) },
  );
  // The lock is derived, never stored: a current set exists, the roster still
  // matches the one it was built from, and the coordinator hasn't asked to edit.
  const locked = !!currentSet && !changeset.isDirty && !armed;

  // Matches check_shortfalls on the server: a table with one person is not a
  // discussion group. Disagreeing meant enabling the button and refusing the
  // request a round trip later.
  const canGenerate = participants.length >= parseInt(numTables) * 2;
  // computeChangeset reports a brand-new program as clean - there is no
  // canonical roster to differ from - so dirtiness alone would hide the button
  // on exactly the program that needs it.
  const hasAssignmentSet = !!currentSet;
  const showActions = changeset.isDirty || !hasAssignmentSet;

  if (loading) {
    return (
      <div
        className="container mx-auto p-4 flex justify-center"
        role="status"
        aria-label="Loading roster"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Roster</CardTitle>
              <CardDescription>
                {locked
                  ? 'Locked \u2014 these are the people your sessions were built from'
                  : changeset.total > 0
                    ? `${changeset.total} change${changeset.total === 1 ? '' : 's'} not yet in your sessions`
                    : 'Manage your participants'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'error' && 'Save failed'}
              </span>
              {locked && (
                <Button variant="outline" size="sm" onClick={() => setArmed(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit roster
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <PopulationStats participants={participants} keepApartPairs={keepApartPairs} />

          <RosterGrid
            participants={participants}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
            onKeepTogetherToggle={handleKeepTogetherToggle}
            readOnly={locked}
          />

          {changeset.isDirty && <ChangesetPanel changeset={changeset} />}

          <div className="flex space-x-4">
            <div className="flex-1">
              <Label htmlFor="num-tables">Number of Tables</Label>
              <Select value={numTables} disabled={locked} onValueChange={setNumTables}>
                <SelectTrigger id="num-tables">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_TABLES }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="num-sessions">Number of Sessions</Label>
              <Select value={numSessions} disabled={locked} onValueChange={setNumSessions}>
                <SelectTrigger id="num-sessions">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_SESSIONS }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <KeepApartSection
            participants={participants}
            pairs={keepApartPairs}
            onAdd={handleAddKeepApart}
            onRemove={handleRemoveKeepApart}
            readOnly={locked}
          />

          {(error || fetchError || canonicalError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              {/* A failure to load is not a refusal to rebuild, and a canonical
                  failure is neither - without it the page renders a confident
                  Locked and silently offers no way to save what gets typed. */}
              <AlertTitle>
                {error
                  ? 'Can’t rebuild yet'
                  : canonicalError
                    ? 'Can’t tell whether your roster matches your sessions'
                    : 'Couldn’t load your roster'}
              </AlertTitle>
              <AlertDescription>
                {error ||
                  (fetchError as Error)?.message ||
                  'Reload the page before making changes — edits made now may not be saved to your sessions.'}
              </AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {generating ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-md border p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Rebuilding your sessions… this can take up to two minutes.
              </p>
            </div>
          ) : showActions && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRebuild}
                disabled={!canGenerate}
              >
                {hasAssignmentSet ? 'Save and rebuild sessions' : 'Generate assignments'}
              </Button>
              {hasAssignmentSet && (
                <Button variant="outline" onClick={handleDiscard}>
                  Discard changes
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
