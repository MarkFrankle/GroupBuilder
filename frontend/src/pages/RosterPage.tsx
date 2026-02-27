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
import { RosterParticipant } from '@/types/roster';
import {
  upsertParticipant, deleteParticipant as apiDeleteParticipant,
  generateFromRoster,
} from '@/api/roster';
import { useRoster } from '@/hooks/queries';
import { useProgram } from '@/contexts/ProgramContext';
import { fetchWithRetry } from '@/utils/fetchWithRetry';
import { API_BASE_URL } from '@/config/api';
import { MAX_TABLES, MAX_SESSIONS } from '@/constants';
import { AlertCircle, Loader2 } from 'lucide-react';
import { movePartnerAdjacent } from '@/utils/sortWithPartnerAdjacency';

type SaveStatus = 'saved' | 'saving' | 'error';

export function RosterPage() {
  const navigate = useNavigate();
  const { currentProgram } = useProgram();
  const { data: rosterData, isLoading: loading, error: fetchError } = useRoster();
  const [participants, setParticipants] = useState<RosterParticipant[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const [numTables, setNumTables] = useState('4');
  const [numSessions, setNumSessions] = useState('5');
  const [generating, setGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    if (rosterData) {
      setParticipants(rosterData);
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
      const assignments = await response.json();
      navigate(`/table-assignments?session=${sessionId}`, {
        state: { assignments, sessionId },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate assignments');
      setGenerating(false);
      setLoadingMessage('');
    }
  };

  const canGenerate = participants.length >= parseInt(numTables) && participants.length > 0;

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
        </CardContent>
      </Card>
    </div>
  );
}
