import { authenticatedFetch } from '@/utils/apiClient';
import { RosterParticipant } from '@/types/roster';

export async function getRoster(programId: string): Promise<RosterParticipant[]> {
  const response = await authenticatedFetch(`/api/roster/?program_id=${programId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch roster: ${response.status}`);
  }
  const data = await response.json();
  return data.participants;
}

export async function upsertParticipant(
  programId: string,
  participantId: string,
  data: Omit<RosterParticipant, 'id'>
): Promise<RosterParticipant> {
  const response = await authenticatedFetch(`/api/roster/${participantId}?program_id=${programId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to save participant: ${response.status}`);
  }
  return response.json();
}

export async function deleteParticipant(programId: string, participantId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/roster/${participantId}?program_id=${programId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete participant: ${response.status}`);
  }
}

export interface GenerateResult {
  assignment_set_id: string;
  rebuilt: boolean;
  message: string;
}

/**
 * Rebuild the program from the live roster — one blocking call.
 *
 * The server refuses, solves, and repoints the program on its own. A refusal
 * comes back with wording meant for the coordinator, so it is thrown as-is
 * rather than replaced with our own.
 */
export async function generateFromRoster(
  programId: string,
  numTables: number,
  numSessions: number
): Promise<GenerateResult> {
  const response = await authenticatedFetch(`/api/roster/generate?program_id=${programId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_tables: numTables, num_sessions: numSessions }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || 'Something went wrong. Please try again.');
  }
  return data as GenerateResult;
}

/** Throw away every unsaved roster change and go back to the sessions' roster. */
export async function discardRosterChanges(programId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/roster/discard?program_id=${programId}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || 'Could not undo those changes. Please try again.');
  }
}
