import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DraftPatch, GENDERS, RELIGIONS, RosterDraft } from '@/types/roster';
import { cn } from '@/utils/cn';

interface DraftRowProps {
  draft: RosterDraft;
  readOnly?: boolean;
  /** The last draft: draws the divider between drafts and saved people. */
  last?: boolean;
  onChange: (patch: DraftPatch) => void;
  onDelete: () => void;
}

/**
 * An uploaded person who isn't on the roster yet. Partner and absences wait
 * until the person is saved, because both are stored against a roster id.
 *
 * Built to the same geometry as a saved row: same heights, same boxes. The
 * grid labels the drafts as a group, so the only per-row signal is a red
 * "Choose…" on whatever is missing.
 */
export function DraftRow({ draft, readOnly = false, last = false, onChange, onDelete }: DraftRowProps) {
  const [name, setName] = useState(draft.name);
  useEffect(() => setName(draft.name), [draft.name]);

  const commitName = () => {
    const next = name.trim();
    if (next && next !== draft.name) onChange({ name: next });
    else setName(draft.name);
  };

  const choice = (field: 'religion' | 'gender', options: readonly string[]) => (
    <TableCell className="p-1">
      <Select
        value={draft[field] ?? ''}
        disabled={readOnly}
        onValueChange={v => onChange({ [field]: v } as DraftPatch)}
      >
        <SelectTrigger
          aria-label={`${field === 'religion' ? 'Religion' : 'Gender'} for ${draft.name}`}
          className={cn(!draft[field] && 'border-red-400 text-red-700')}
        >
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </TableCell>
  );

  return (
    <TableRow className={cn('group', last && 'border-b-2')}>
      <TableCell className="p-1">
        <Input
          value={name}
          disabled={readOnly}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          aria-label={`Name for ${draft.name}`}
        />
      </TableCell>
      {choice('religion', RELIGIONS)}
      {choice('gender', GENDERS)}
      {/* Shaped like the saved rows' partner picker, greyed out: a partner is
          stored as a roster id, so it can't be chosen until this person is
          saved. The server links an uploaded partner once both are saved. */}
      <TableCell className="p-1">
        <div className="flex items-center gap-1">
          <div
            className="flex h-10 w-full min-w-0 items-center rounded-md border border-input bg-background px-3 py-2 text-sm opacity-50"
            title={draft.partner_name ? 'Partners are linked once both are saved.' : undefined}
          >
            <span className="truncate">{draft.partner_name ?? 'None'}</span>
          </div>
          <span className="w-5 shrink-0" />
        </div>
      </TableCell>
      <TableCell className="p-1 text-center">
        <input
          type="checkbox"
          checked={draft.is_facilitator}
          disabled={readOnly}
          onChange={e => onChange({ is_facilitator: e.target.checked })}
          className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
          aria-label={`Mark ${draft.name} as facilitator`}
        />
      </TableCell>
      <TableCell className="p-1">
        <span className="text-sm text-muted-foreground px-3">—</span>
      </TableCell>
      <TableCell className="p-1">
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
            aria-label={`Delete ${draft.name}`}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
