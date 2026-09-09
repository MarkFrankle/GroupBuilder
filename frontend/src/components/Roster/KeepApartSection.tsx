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

interface Draft {
  key: number;
  a: string | null;
  b: string | null;
  error: string | null;
}

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
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const nameOf = (id: string) => participants.find(p => p.id === id)?.name;

  const partnersOf = (id: string) =>
    pairs.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));

  // A duplicate pair and a self-pair are unreachable rather than explained.
  const choicesExcluding = (otherId: string | null) => {
    if (!otherId) return participants;
    const taken = new Set([otherId, ...partnersOf(otherId)]);
    return participants.filter(p => !taken.has(p.id));
  };

  const updateDraft = (key: number, changes: Partial<Draft>) =>
    setDrafts(prev => prev.map(d => (d.key === key ? { ...d, ...changes } : d)));

  const choose = async (draft: Draft, side: 'a' | 'b', id: string) => {
    const next = { ...draft, [side]: id, error: null };
    updateDraft(draft.key, { [side]: id, error: null });
    if (!next.a || !next.b) return;
    try {
      await onAdd(next.a, next.b);
      setDrafts(prev => prev.filter(d => d.key !== draft.key));
    } catch (err) {
      // The refusal wording is the server's; the row stays so it can be fixed.
      updateDraft(draft.key, { error: (err as Error).message });
    }
  };

  // Stays up while a draft row is open: this sentence is the only place the
  // feature is explained, and opening a row is exactly when someone is asking
  // what the block does.
  const showEmptyLine = pairs.length === 0;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Keep apart</div>

      {showEmptyLine && (
        <p className="text-sm text-muted-foreground">
          No pairs. People here will never be seated at the same table.
        </p>
      )}

      {pairs.map(([aId, bId]) => {
        const aName = nameOf(aId);
        const bName = nameOf(bId);
        if (!aName || !bName) return null;
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

      {!readOnly && drafts.map(draft => (
        <div key={draft.key} className="space-y-1">
          <div className="flex items-center gap-2">
            <Select
              value={draft.a ?? undefined}
              onValueChange={v => choose(draft, 'a', v)}
            >
              <SelectTrigger className="w-52"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto border shadow-md">
                {choicesExcluding(draft.b).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">and</span>
            <Select
              value={draft.b ?? undefined}
              onValueChange={v => choose(draft, 'b', v)}
            >
              <SelectTrigger className="w-52"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto border shadow-md">
                {choicesExcluding(draft.a).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrafts(prev => prev.filter(d => d.key !== draft.key))}
              aria-label="Discard this pair"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {draft.error && (
            <p className="text-sm text-destructive">{draft.error}</p>
          )}
        </div>
      ))}

      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDrafts(prev => [
            ...prev, { key: Date.now() + prev.length, a: null, b: null, error: null },
          ])}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add a pair
        </Button>
      )}
    </div>
  );
}
