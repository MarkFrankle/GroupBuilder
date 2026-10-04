import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GENDERS, RELIGIONS } from '@/types/roster';
import { RosterUpload } from '@/api/roster';
import { cn } from '@/utils/cn';
import {
  CellNote,
  FIELD_LABELS,
  IMPORT_FIELDS,
  ImportField,
  ValueFixes,
  guessMapping,
  NO_FIXES,
  nameKey,
  resolveRows,
  setColumnField,
} from '@/utils/rosterImport';

interface RosterImportDialogProps {
  headers: string[];
  rows: string[][];
  /** People on the roster now. Zero means the upload adds rather than replaces. */
  currentCount: number;
  /** Current keep-apart rules as name pairs. Rules naming someone not in the file are dropped,
   * and the preview can't show that loss, so the footer says it. */
  keepApartNames: [string, string][];
  onCancel: () => void;
  onCommit: (upload: RosterUpload) => Promise<void>;
}

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

// The spreadsheet's own row number: data starts under the header, which is row 1.
const sheetRow = (r: number) => r + 2;

export function RosterImportDialog({
  headers,
  rows,
  currentCount,
  keepApartNames,
  onCancel,
  onCommit,
}: RosterImportDialogProps) {
  const [mapping, setMapping] = useState<ImportField[]>(() => guessMapping(headers, rows));
  const [fixes, setFixes] = useState<ValueFixes>(NO_FIXES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolution = useMemo(() => resolveRows(rows, mapping, fixes), [rows, mapping, fixes]);
  const notesByCell = useMemo(
    () => new Map<string, CellNote>(resolution.notes.map(n => [`${n.row}:${n.column}`, n])),
    [resolution],
  );
  const skipped = new Set(resolution.skippedRows);
  const total = resolution.participants.length + resolution.drafts.length;
  const drafts = resolution.drafts.length;
  const incoming = new Set([...resolution.participants, ...resolution.drafts].map(p => nameKey(p.name)));
  const droppedRules = resolution.missingName
    ? 0
    : keepApartNames.filter(([a, b]) => !incoming.has(nameKey(a)) || !incoming.has(nameKey(b))).length;

  const verb = currentCount === 0 ? `Add ${people(total)}` : `Replace ${people(currentCount)} with ${total}`;
  const commitLabel = drafts
    ? `${verb} (${drafts} still ${drafts === 1 ? 'needs' : 'need'} fixing)`
    : verb;

  let status: string;
  let tone: 'ok' | 'warn' | 'stop';
  if (resolution.missingName) {
    status = 'Choose which column holds names.';
    tone = 'stop';
  } else if (resolution.unmappedFields.length) {
    const missing = resolution.unmappedFields.map(f => FIELD_LABELS[f].toLowerCase()).join(' or ');
    status = `No ${missing} column, so everyone will be added as a draft.`;
    tone = 'warn';
  } else if (drafts) {
    status = `${people(resolution.participants.length)} ready. ${drafts} will be added as ${
      drafts === 1 ? 'a draft' : 'drafts'
    } to finish on the roster.`;
    tone = 'warn';
  } else {
    status = `All ${people(total)} ready.`;
    tone = 'ok';
  }
  // The one loss the table can't show. Skipped rows, notes and unused columns
  // are all visible in the table itself, so the footer doesn't repeat them.
  const keepApartWarning =
    droppedRules > 0
      ? `${droppedRules} keep-apart ${droppedRules === 1 ? 'rule' : 'rules'} will be removed because someone in ${
          droppedRules === 1 ? 'it' : 'them'
        } isn't in this file.`
      : null;

  const answer = (note: CellNote, value: string) => {
    if (!note.fix) return;
    const { field, key } = note.fix;
    setFixes(prev => ({ ...prev, [field]: { ...prev[field], [key]: value } }));
  };

  const handleCommit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onCommit({
        participants: resolution.participants,
        drafts: resolution.drafts,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this roster. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Review your roster</DialogTitle>
          <DialogDescription>
            Check what each column holds. You can answer highlighted cells here or later on the roster.
            People with unanswered cells are added as drafts.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded border">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-r bg-background" aria-label="Spreadsheet row" />
                {headers.map((header, c) => {
                  const ignored = mapping[c] === 'ignore';
                  return (
                    <th
                      key={c}
                      className={cn(
                        'sticky top-0 z-20 border-b bg-background px-2 pb-2 pt-2 text-left align-bottom font-normal',
                        ignored ? 'w-[110px] max-w-[110px]' : 'min-w-[150px]',
                      )}
                    >
                      <div
                        className={cn('mb-1 truncate text-xs', ignored ? 'text-muted-foreground/60' : 'text-muted-foreground')}
                        title={header}
                      >
                        {header}
                      </div>
                      <Select
                        value={mapping[c]}
                        onValueChange={v => setMapping(prev => setColumnField(prev, c, v as ImportField))}
                      >
                        <SelectTrigger
                          aria-label={`Column ${header}`}
                          className={cn('h-8', ignored && 'border-dashed text-muted-foreground')}
                        >
                          {/* An unused column shows a dash, not a word: "Don't import"
                              in the closed trigger read like a sixth kind of data
                              beside Name and Religion. The menu keeps the words. */}
                          <SelectValue>
                            {ignored ? (
                              <>
                                <span aria-hidden="true">–</span>
                                <span className="sr-only">{FIELD_LABELS.ignore}</span>
                              </>
                            ) : (
                              FIELD_LABELS[mapping[c]]
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {IMPORT_FIELDS.map(f => (
                            <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className={cn(skipped.has(r) && 'text-muted-foreground')}>
                  <td className="sticky left-0 z-10 border-b border-r bg-background px-2 text-right text-xs tabular-nums text-muted-foreground">
                    {sheetRow(r)}
                  </td>
                  {row.map((value, c) => {
                    const note = skipped.has(r) ? undefined : notesByCell.get(`${r}:${c}`);
                    const ignored = mapping[c] === 'ignore';
                    return (
                      <td
                        key={c}
                        title={note?.message ?? (ignored ? value : undefined)}
                        className={cn(
                          'whitespace-nowrap border-b px-2 py-1',
                          ignored && 'max-w-[110px] truncate text-muted-foreground/60',
                          note?.fix && !note.fix.answered && 'bg-red-50 ring-1 ring-inset ring-red-300',
                          note?.fix?.answered && 'bg-muted/40',
                          note?.message && 'bg-amber-50',
                        )}
                      >
                        {note?.fix ? (
                          <span className="flex items-center gap-2">
                            {value && <span>{value}</span>}
                            <Select value={fixes[note.fix.field][note.fix.key] ?? ''} onValueChange={v => answer(note, v)}>
                              <SelectTrigger
                                aria-label={`${FIELD_LABELS[note.fix.field]} for row ${sheetRow(r)}`}
                                className={cn('h-7 w-[120px]', !note.fix.answered && 'border-red-300 text-red-700')}
                              >
                                <SelectValue placeholder="Choose…" />
                              </SelectTrigger>
                              <SelectContent>
                                {(note.fix.field === 'religion' ? RELIGIONS : GENDERS).map(v => (
                                  <SelectItem key={v} value={v}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </span>
                        ) : (
                          // Struck per value, not per row: a parent's line-through
                          // can't be cancelled on the "will be skipped" label.
                          <span className={cn(skipped.has(r) && 'line-through')}>{value}</span>
                        )}
                        {skipped.has(r) && mapping[c] === 'name' && (
                          <span className="ml-2 text-xs">
                            {value ? 'listed twice, will be skipped' : 'no name, will be skipped'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div className="grid gap-0.5" role="status">
            <span className={cn('flex items-center gap-2 text-sm font-medium', error && 'text-red-600')}>
              {!error && (
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    tone === 'ok' && 'bg-green-700',
                    tone === 'warn' && 'bg-amber-700',
                    tone === 'stop' && 'bg-red-700',
                  )}
                />
              )}
              {error ?? status}
            </span>
            {!error && keepApartWarning && (
              <span className="text-xs text-muted-foreground">{keepApartWarning}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
              variant="outline"
              onClick={handleCommit}
              disabled={resolution.missingName || total === 0 || saving}
            >
              {commitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
