/**
 * Shared assignment types.
 *
 * Lifted out of the page so the overview tree does not import from a component
 * that other pages also need to outlive.
 */

export interface Participant {
  name: string
  religion: string
  gender: string
  partner: string | null
  is_facilitator?: boolean
}

export interface Assignment {
  session: number
  tables: {
    [key: number]: (Participant | null)[]
  }
  absentParticipants?: Participant[]
}
