export interface RosterParticipant {
  id: string;
  name: string;
  religion: "Christian" | "Jewish" | "Muslim" | "Other";
  gender: "Male" | "Female" | "Other";
  partner_id: string | null;
  keep_together?: boolean;
  is_facilitator?: boolean;
  /** Session numbers this participant will miss. Editable on the Roster page
   * before the first build; a read-only mirror of the assignment set's
   * per-session absences afterward. */
  absent_sessions?: number[];
}

export type Religion = RosterParticipant["religion"];
export type Gender = RosterParticipant["gender"];

export const RELIGIONS: Religion[] = ["Christian", "Jewish", "Muslim", "Other"];
export const GENDERS: Gender[] = ["Male", "Female", "Other"];

/**
 * An uploaded person not yet on the roster because their religion or gender
 * couldn't be read. Stored on the server beside the roster, never in it.
 */
export interface RosterDraft {
  id: string;
  name: string;
  religion: Religion | null;
  gender: Gender | null;
  is_facilitator: boolean;
  partner_name: string | null;
}

export type DraftPatch = Partial<Pick<RosterDraft, 'name' | 'is_facilitator'>> & {
  religion?: Religion;
  gender?: Gender;
};
