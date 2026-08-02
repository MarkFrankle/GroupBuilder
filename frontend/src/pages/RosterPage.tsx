import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RosterGrid } from '@/components/RosterGrid/RosterGrid';
import { RosterParticipant } from '@/types/roster';
import {
  upsertParticipant, deleteParticipant as apiDeleteParticipant,
  generateFromRoster,
} from '@/api/roster';
import { useRoster, useSessionsList } from '@/hooks/queries';
import { useProgram } from '@/contexts/ProgramContext';
import { useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/utils/apiClient';
import { fetchWithRetry } from '@/utils/fetchWithRetry';
import { API_BASE_URL } from '@/config/api';
import { MAX_TABLES, MAX_SESSIONS } from '@/constants';
import { AlertCircle, Loader2 } from 'lucide-react';
import { movePartnerAdjacent, sortPartnersAdjacent } from '@/utils/sortWithPartnerAdjacency';

type SaveStatus = 'saved' | 'saving' | 'error';

interface SessionSummary {
  session_id: string;
  num_tables: number;
  num_sessions: number;
}

interface AbsentParticipant {
  name: string;
  religion: string;
  gender: string;
  partner: string | null;
  is_facilitator?: boolean;
}

interface SessionResult {
  session: number;
  absentParticipants?: AbsentParticipant[];
}

export function RosterPage() {
  const navigate = useNavigate();
  const { currentProgram } = useProgram();
  const queryClient = useQueryClient();
  const { data: rosterData, isLoading: loading, error: fetchError } = useRoster();
  const { data: sessionsData } = useSessionsList(currentProgram?.id ?? null);
  const hasExistingSessions = Array.isArray(sessionsData) && sessionsData.length > 0;
  const sourceSession: SessionSummary | null = hasExistingSessions
    ? (sessionsData as SessionSummary[])[0]
    : null;

  const [participants, setParticipants] = useState<RosterParticipant[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const [numTables, setNumTables] = useState('4');
  const [numSessions, setNumSessions] = useState('5');
  const [generating, setGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [maintainAbsences, setMaintainAbsences] = useState(true);
  const [sourceAbsences, setSourceAbsences] = useState<SessionResult[] | null>(null);
  const [absencesLoading, setAbsencesLoading] = useState(false);

  useEffect(() => {
    if (!sourceSession) return;
    setAbsencesLoading(true);
    authenticatedFetch(`/api/assignments/results/${sourceSession.session_id}`)
      .then(res => res.ok ? res.json() : null)
      .then((results: SessionResult[] | null) => setSourceAbsences(results ?? []))
      .catch(() => setSourceAbsences([]))
      .finally(() => setAbsencesLoading(false));
  }, [sourceSession?.session_id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleGenerate = async () => {
    setError(null);
    const facilitatorCount = participants.filter(p => p.is_facilitator).length;
    if (facilitatorCount > 0 && facilitatorCount < parseInt(numTables)) {
      setError(`Need at least ${numTables} facilitators for ${numTables} tables (have ${facilitatorCount})`);
      return;
    }
    setGenerating(true);
    setLoadingMessage('Creating session from roster...');
    try {
      const sessionId = await generateFromRoster(
        currentProgram!.id, parseInt(numTables), parseInt(numSessions)
      );
      setLoadingMessage('Generating assignments...');
      const response = await fetchWithRetry(
        `${API_BASE_URL}/api/assignments/?session_id=${sessionId}&max_time_seconds=120`
      );
      if (!response.ok) throw new Error('Assignment generation failed');
      queryClient.invalidateQueries({ queryKey: ['sessions', currentProgram?.id] });
      navigate(`/table-assignments?session=${sessionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate assignments');
      setGenerating(false);
      setLoadingMessage('');
    }
  };

  const handleRegenerateExisting = async () => {
    if (!sourceSession) return;
    setError(null);

    const { num_tables: srcTables, num_sessions: srcSessions, session_id: srcSessionId } = sourceSession;

    const facilitatorCount = participants.filter(p => p.is_facilitator).length;
    if (facilitatorCount > 0 && facilitatorCount < srcTables) {
      setError(`Need at least ${srcTables} facilitators for ${srcTables} tables (have ${facilitatorCount})`);
      return;
    }
    if (participants.length < srcTables) {
      setError(`Need at least ${srcTables} participants for ${srcTables} tables`);
      return;
    }

    setGenerating(true);

    try {
      // Reuse the per-session absences already loaded on mount; only fall back to
      // a fetch if they haven't finished loading yet.
      let sessionsWithAbsences: { sessionNumber: number; absent: AbsentParticipant[] }[] = [];
      if (maintainAbsences) {
        let sourceResults = sourceAbsences;
        if (sourceResults === null) {
          setLoadingMessage('Reading saved absences...');
          const resultsRes = await authenticatedFetch(`/api/assignments/results/${srcSessionId}`);
          sourceResults = resultsRes.ok ? await resultsRes.json() : [];
        }
        sessionsWithAbsences = (sourceResults ?? [])
          .map(s => ({ sessionNumber: s.session, absent: s.absentParticipants || [] }))
          .filter(s => s.absent.length > 0);
      }

      // Create new session from current roster
      setLoadingMessage('Creating session from roster...');
      const newSessionId = await generateFromRoster(currentProgram!.id, srcTables, srcSessions);

      // Solve all sessions, applying absences, in a single backend call
      setLoadingMessage('Generating assignments...');
      const perSessionAbsences = sessionsWithAbsences.map(s => ({
        session_number: s.sessionNumber,
        absent_participants: s.absent,
      }));
      const solveRes = await authenticatedFetch(
        `/api/assignments/regenerate/${newSessionId}/with_absences?max_time_seconds=120`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(perSessionAbsences),
        }
      );
      if (!solveRes.ok) throw new Error('Assignment generation failed');

      queryClient.invalidateQueries({ queryKey: ['sessions', currentProgram?.id] });
      navigate(`/table-assignments?session=${newSessionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate assignments');
      setGenerating(false);
      setLoadingMessage('');
    }
  };

  const canGenerate = participants.length >= parseInt(numTables) && participants.length > 0;
  const canRegenerateExisting = sourceSession
    ? participants.length >= sourceSession.num_tables && participants.length > 0
    : false;

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center">
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
              <CardDescription>Manage your participants</CardDescription>
            </div>
            <span className="text-sm text-muted-foreground">
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Save failed'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <RosterGrid
            participants={participants}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
            onKeepTogetherToggle={handleKeepTogetherToggle}
          />

          {hasExistingSessions ? (
            <Tabs defaultValue="update">
              <TabsList className="w-full h-auto p-0 bg-transparent border-b rounded-none gap-0">
                <TabsTrigger
                  value="update"
                  className="flex-1 rounded-none rounded-tl-md border border-b-0 py-2.5 font-medium text-sm transition-colors data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:text-foreground data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/70"
                >
                  Regenerate
                </TabsTrigger>
                <TabsTrigger
                  value="fresh"
                  className="flex-1 rounded-none rounded-tr-md border border-l-0 border-b-0 py-2.5 font-medium text-sm transition-colors data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:text-foreground data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/70"
                >
                  Fresh Start
                </TabsTrigger>
              </TabsList>

              <TabsContent value="update" className="space-y-4 border border-t-0 rounded-b-md p-4 mt-0">
                <p className="text-sm text-muted-foreground">
                  Regenerate all sessions using your current roster and constraints.
                  {sourceSession && (
                    <span className="ml-1">
                      Keeps the existing layout: {sourceSession.num_tables} tables &times; {sourceSession.num_sessions} sessions.
                    </span>
                  )}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="maintain-absences"
                      checked={maintainAbsences}
                      onCheckedChange={(checked: boolean | 'indeterminate') => setMaintainAbsences(checked === true)}
                    />
                    <Label htmlFor="maintain-absences">Maintain saved absences</Label>
                  </div>
                  <div className="ml-6 text-xs text-muted-foreground space-y-0.5">
                    {absencesLoading ? (
                      <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading absences…</span>
                    ) : sourceAbsences === null ? null : sourceAbsences.every(s => !s.absentParticipants?.length) ? (
                      <span>No absences recorded in the most recent session.</span>
                    ) : (
                      sourceAbsences
                        .slice()
                        .sort((a, b) => a.session - b.session)
                        .map(s => (
                          <div key={s.session}>
                            <span className="font-medium">Session {s.session}:</span>{' '}
                            {s.absentParticipants?.length
                              ? s.absentParticipants.map(p => p.name).join(', ')
                              : 'no absences'}
                          </div>
                        ))
                    )}
                  </div>
                </div>
                {(error || fetchError) && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error || (fetchError as Error)?.message}</AlertDescription>
                  </Alert>
                )}
                {generating && loadingMessage && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Generating</AlertTitle>
                    <AlertDescription>{loadingMessage}</AlertDescription>
                  </Alert>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleRegenerateExisting}
                  disabled={!canRegenerateExisting || generating}
                >
                  {generating ? 'Generating...' : 'Regenerate All Sessions'}
                </Button>
              </TabsContent>

              <TabsContent value="fresh" className="space-y-4 border border-t-0 rounded-b-md p-4 mt-0">
                <p className="text-sm text-muted-foreground">
                  Create a completely new set of sessions. All existing assignments and saved absences will be lost.
                </p>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Label htmlFor="num-tables">Number of Tables</Label>
                    <Select value={numTables} onValueChange={setNumTables}>
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
                    <Select value={numSessions} onValueChange={setNumSessions}>
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
                {(error || fetchError) && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error || (fetchError as Error)?.message}</AlertDescription>
                  </Alert>
                )}
                {generating && loadingMessage && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Generating</AlertTitle>
                    <AlertDescription>{loadingMessage}</AlertDescription>
                  </Alert>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!canGenerate || generating}
                >
                  {generating ? 'Generating...' : 'Generate Assignments'}
                </Button>
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="num-tables">Number of Tables</Label>
                  <Select value={numTables} onValueChange={setNumTables}>
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
                  <Select value={numSessions} onValueChange={setNumSessions}>
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
              {(error || fetchError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error || (fetchError as Error)?.message}</AlertDescription>
                </Alert>
              )}
              {generating && loadingMessage && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Generating</AlertTitle>
                  <AlertDescription>{loadingMessage}</AlertDescription>
                </Alert>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGenerate}
                disabled={!canGenerate || generating}
              >
                {generating ? 'Generating...' : 'Generate Assignments'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
