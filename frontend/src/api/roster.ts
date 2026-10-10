import { authenticatedFetch } from '@/utils/apiClient';
import { DraftPatch, RosterDraft, RosterParticipant } from '@/types/roster';
import { ImportedDraft, ImportedParticipant } from '@/utils/rosterImport';
import { compareLastName } from '@/utils/rosterSort';

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

/** Store the grid's row order. Allowed while the roster is locked. */
export async function saveRosterOrder(programId: string, ids: string[]): Promise<void> {
  const response = await authenticatedFetch(`/api/roster/order?program_id=${programId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save roster order: ${response.status}`);
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

export interface RosterUpload {
  participants: ImportedParticipant[];
  drafts: ImportedDraft[];
}

/** Replace the whole roster with an upload. The server's refusal is written for the coordinator. */
export async function uploadRoster(programId: string, upload: RosterUpload): Promise<void> {
  // An upload arrives in last-name order, the printed roster's rule. The
  // server stores rows in the order they're sent.
  const participants = [...upload.participants].sort((a, b) => compareLastName(a.name, b.name));
  const response = await authenticatedFetch(`/api/roster/?program_id=${programId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...upload, participants }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || 'Could not upload this roster. Please try again.');
  }
}

export async function getRosterDrafts(
  programId: string,
): Promise<{ drafts: RosterDraft[] }> {
  const response = await authenticatedFetch(`/api/roster/drafts?program_id=${programId}`);
  if (!response.ok) throw new Error(`Failed to fetch drafts: ${response.status}`);
  return response.json();
}

/** Edit a draft. When the edit completes it, the server saves the person and returns them. */
export async function updateRosterDraft(
  programId: string,
  draftId: string,
  patch: DraftPatch,
): Promise<{ draft: RosterDraft | null; participant: RosterParticipant | null }> {
  const response = await authenticatedFetch(`/api/roster/drafts/${draftId}?program_id=${programId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || 'Could not save that change. Please try again.');
  return data;
}

export async function deleteRosterDraft(programId: string, draftId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/roster/drafts/${draftId}?program_id=${programId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Could not remove that person. Please try again.');
}

/** The pairs who must never share a table: roster ids, each pair sorted. */
export async function getKeepApart(programId: string): Promise<[string, string][]> {
  const response = await authenticatedFetch(`/api/roster/keep-apart?program_id=${programId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch keep-apart pairs: ${response.status}`);
  }
  const data = await response.json();
  return data.pairs ?? [];
}

/**
 * Keep two people apart.
 *
 * A refusal comes back worded for the coordinator, so it is thrown as-is
 * rather than replaced with our own.
 */
export async function addKeepApart(
  programId: string,
  aId: string,
  bId: string
): Promise<[string, string][]> {
  const response = await authenticatedFetch(`/api/roster/keep-apart?program_id=${programId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ a_id: aId, b_id: bId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || 'Something went wrong. Please try again.');
  }
  return data.pairs;
}

export async function removeKeepApart(
  programId: string,
  aId: string,
  bId: string
): Promise<[string, string][]> {
  const response = await authenticatedFetch(
    `/api/roster/keep-apart/${aId}/${bId}?program_id=${programId}`,
    { method: 'DELETE' }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || 'Could not remove that pair. Please try again.');
  }
  return data.pairs;
}
