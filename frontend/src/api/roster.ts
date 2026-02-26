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

export async function generateFromRoster(
  programId: string,
  numTables: number,
  numSessions: number
): Promise<string> {
  const response = await authenticatedFetch(`/api/roster/generate?program_id=${programId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_tables: numTables, num_sessions: numSessions }),
  });
  if (!response.ok) {
    throw new Error(`Failed to generate: ${response.status}`);
  }
  const data = await response.json();
  return data.session_id;
}
