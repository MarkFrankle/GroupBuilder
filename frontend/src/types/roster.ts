export interface RosterParticipant {
  id: string;
  name: string;
  religion: "Christian" | "Jewish" | "Muslim" | "Other";
  gender: "Male" | "Female" | "Other";
  partner_id: string | null;
}

export type Religion = RosterParticipant["religion"];
export type Gender = RosterParticipant["gender"];

export const RELIGIONS: Religion[] = ["Christian", "Jewish", "Muslim", "Other"];
export const GENDERS: Gender[] = ["Male", "Female", "Other"];
