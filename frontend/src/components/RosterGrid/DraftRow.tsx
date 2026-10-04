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
  onChange: (patch: DraftPatch) => void;
  onDelete: () => void;
}

/**
 * An uploaded person who isn't on the roster yet. Partner and absences wait
 * until the person is saved, because both are stored against a roster id.
 */
export function DraftRow({ draft, readOnly = false, onChange, onDelete }: DraftRowProps) {
  const [name, setName] = useState(draft.name);
  useEffect(() => setName(draft.name), [draft.name]);

  const commitName = () => {
    const next = name.trim();
    if (next && next !== draft.name) onChange({ name: next });
    else setName(draft.name);
  };

  const choice = (field: 'religion' | 'gender', options: readonly string[]) => (
    <TableCell className={cn('p-1', !draft[field] && 'bg-red-50 ring-1 ring-inset ring-red-300')}>
      <Select
        value={draft[field] ?? ''}
        disabled={readOnly}
        onValueChange={v => onChange({ [field]: v } as DraftPatch)}
      >
        <SelectTrigger
          aria-label={`${field === 'religion' ? 'Religion' : 'Gender'} for ${draft.name}`}
          className={cn(!draft[field] && 'border-red-300 text-red-700')}
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
    <TableRow className="group bg-red-50/30">
      <TableCell className="p-1">
        {/* Stacked, not side by side: in the 200px Name column a pill beside
            the input squeezes the name to a sliver. */}
        <Input
          value={name}
          disabled={readOnly}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          aria-label={`Name for ${draft.name}`}
        />
        <span className="mt-1 inline-block rounded-full border border-red-300 bg-background px-2 text-xs font-medium text-red-700">
          Not saved
        </span>
      </TableCell>
      {choice('religion', RELIGIONS)}
      {choice('gender', GENDERS)}
      <TableCell className="p-1 text-sm italic text-muted-foreground">
        {draft.partner_name ? `${draft.partner_name} (once saved)` : 'None'}
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
      <TableCell className="p-1" />
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
