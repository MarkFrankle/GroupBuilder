import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { RosterParticipant } from '@/types/roster';

interface KeepApartSectionProps {
  participants: RosterParticipant[];
  /** Roster ids, each pair sorted, as the server stores them. */
  pairs: [string, string][];
  /** Rejects with the server's refusal wording, which we render as-is
   * beneath the draft row. */
  onAdd: (aId: string, bId: string) => Promise<void>;
  /** Must not reject. Removal is never refused server-side, so the only
   * realistic failure is the network, and the page surfaces that through its
   * own error handling rather than through a per-pair message here. */
  onRemove: (aId: string, bId: string) => Promise<void>;
  /** Locked: the sessions were built from this roster, so the rules are inert. */
  readOnly: boolean;
}

/** The half-written pair. There is only ever one: a second row could commit
 * the same pair as the first, and nobody has asked to write two rules at once. */
interface Draft {
  a: string | null;
  b: string | null;
  error: string | null;
  /** An add is in flight. Both selects are inert, so one pick cannot be
   * overtaken by the next. */
  pending: boolean;
}

const EMPTY_DRAFT: Draft = { a: null, b: null, error: null, pending: false };

const ERROR_ID = 'keep-apart-error';
const HEADING_ID = 'keep-apart-heading';

/** Someone was taken off the roster without their rule going with them. The
 * server prunes on delete, so this should not happen — but naming the gap
 * keeps the rule visible and removable instead of silently dropping it. */
const MISSING = 'someone no longer on the roster';

/**
 * The people who must never share a table.
 *
 * Committed pairs are plain text on purpose: a rule you already made is
 * something you read, not something you re-pick. Editing one means removing it
 * and adding it again, which at this size costs nothing and keeps the block
 * from reading as a second data-entry grid.
 */
export function KeepApartSection({
  participants, pairs, onAdd, onRemove, readOnly,
}: KeepApartSectionProps) {
  const [draft, setDraft] = useState<Draft | null>(null);

  // Alphabetical, matching the partner select on the same page.
  const people = [...participants].sort((a, b) => a.name.localeCompare(b.name));

  const nameOf = (id: string) => participants.find(p => p.id === id)?.name;

  const partnersOf = (id: string) =>
    pairs.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));

  // A duplicate pair and a self-pair are unreachable rather than explained.
  // Applied to both selects, so the order they are filled in does not matter.
  const choicesExcluding = (otherId: string | null) => {
    if (!otherId) return people;
    const taken = new Set([otherId, ...partnersOf(otherId)]);
    return people.filter(p => !taken.has(p.id));
  };

  const choose = async (side: 'a' | 'b', id: string) => {
    const next: Draft = { ...(draft ?? EMPTY_DRAFT), [side]: id, error: null };
    if (!next.a || !next.b) {
      setDraft(next);
      return;
    }
    setDraft({ ...next, pending: true });
    try {
      await onAdd(next.a, next.b);
      setDraft(null);
    } catch (err) {
      // The refusal wording is the server's; the row stays so it can be fixed.
      setDraft({ ...next, pending: false, error: (err as Error).message });
    }
  };

  const describedBy = draft?.error ? ERROR_ID : undefined;

  const personSelect = (side: 'a' | 'b', label: string) => (
    <Select
      value={draft?.[side] ?? undefined}
      disabled={draft?.pending}
      onValueChange={v => choose(side, v)}
    >
      <SelectTrigger className="w-52" aria-label={label} aria-describedby={describedBy}>
        <SelectValue placeholder="Choose a person" />
      </SelectTrigger>
      <SelectContent className="max-h-60 overflow-y-auto border shadow-md">
        {choicesExcluding(side === 'a' ? draft?.b ?? null : draft?.a ?? null).map(p => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2" role="group" aria-labelledby={HEADING_ID}>
      <h3 id={HEADING_ID} className="text-sm font-medium">Keep apart</h3>

      {/* Permanent, not an empty state: this sentence is the only place the
          feature is explained, and it is as needed a week later as on day one. */}
      <p className="text-sm text-muted-foreground">
        {(pairs.length === 0 ? 'Nobody is being kept apart yet. ' : '') +
          'People here will never be seated at the same table.'}
      </p>

      {pairs.map(([aId, bId]) => {
        const aName = nameOf(aId) ?? MISSING;
        const bName = nameOf(bId) ?? MISSING;
        return (
          <div key={`${aId}-${bId}`} className="flex items-center gap-2">
            <span className="text-sm">{`${aName} and ${bName}`}</span>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(aId, bId)}
                aria-label={`Stop keeping ${aName} and ${bName} apart`}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}

      {!readOnly && draft && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {personSelect('a', 'First person')}
            <span className="text-sm text-muted-foreground">and</span>
            {personSelect('b', 'Second person')}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft(null)}
              aria-label="Discard this row"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {draft.error && (
            <p id={ERROR_ID} role="alert" className="text-sm text-destructive">
              {draft.error}
            </p>
          )}
        </div>
      )}

      {/* One row at a time: the button comes back when this one is done. */}
      {!readOnly && !draft && (
        <Button variant="outline" size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          <Plus className="h-4 w-4 mr-1" />
          Add a pair
        </Button>
      )}
    </div>
  );
}
