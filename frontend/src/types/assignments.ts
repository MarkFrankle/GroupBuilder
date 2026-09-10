/**
 * Shared assignment types.
 *
 * Lifted out of the page so the overview tree does not import from a component
 * that other pages also need to outlive.
 */

/** What the chiclets are coloured *about* — the view-controls focus switch (Item 12). */
export type AttributeFocus = 'religion' | 'gender' | 'couples'

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

export interface ResultVersion {
  version_id: string
  created_at: number
  assignment_set_id: string
  label: string | null
  promotable: boolean
  not_promotable_reason: string | null
}
