import { authenticatedFetch } from '@/utils/apiClient';
import { RosterParticipant } from '@/types/roster';

export async function getRoster(): Promise<RosterParticipant[]> {
  const response = await authenticatedFetch('/api/roster/');
  if (!response.ok) {
    throw new Error(`Failed to fetch roster: ${response.status}`);
  }
  const data = await response.json();
  return data.participants;
}

export async function upsertParticipant(
  participantId: string,
  data: Omit<RosterParticipant, 'id'>
): Promise<RosterParticipant> {
  const response = await authenticatedFetch(`/api/roster/${participantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to save participant: ${response.status}`);
  }
  return response.json();
}

export async function deleteParticipant(participantId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/roster/${participantId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete participant: ${response.status}`);
  }
}

export async function importRoster(file: File): Promise<RosterParticipant[]> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch('/api/roster/import', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Failed to import roster: ${response.status}`);
  }
  const data = await response.json();
  return data.participants;
}

export async function generateFromRoster(
  numTables: number,
  numSessions: number
): Promise<string> {
  const response = await authenticatedFetch('/api/roster/generate', {
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
