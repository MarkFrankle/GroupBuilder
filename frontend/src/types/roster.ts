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
