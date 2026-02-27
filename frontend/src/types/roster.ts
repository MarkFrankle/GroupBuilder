export interface RosterParticipant {
  id: string;
  name: string;
  religion: "Christian" | "Jewish" | "Muslim" | "Other";
  gender: "Male" | "Female" | "Other";
  partner_id: string | null;
  keep_together?: boolean;
  is_facilitator?: boolean;
}

export type Religion = RosterParticipant["religion"];
export type Gender = RosterParticipant["gender"];

export const RELIGIONS: Religion[] = ["Christian", "Jewish", "Muslim", "Other"];
export const GENDERS: Gender[] = ["Male", "Female", "Other"];
