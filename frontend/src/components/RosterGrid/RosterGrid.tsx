import { useState, useCallback, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PersonCombobox } from '@/components/ui/PersonCombobox';
import { Trash2, Link, Unlink } from 'lucide-react';
import { DraftPatch, RosterDraft, RosterParticipant, Religion, Gender, RELIGIONS, GENDERS } from '@/types/roster';
import { AwayCell } from './AwayCell';
import { DraftRow } from './DraftRow';
import { nameKey } from '@/utils/rosterImport';

interface RosterGridProps {
  participants: RosterParticipant[];
  onUpdate: (id: string, data: Omit<RosterParticipant, 'id'>) => void;
  onDelete: (id: string) => void;
  onAdd: (data: Omit<RosterParticipant, 'id'>) => void;
  onKeepTogetherToggle: (id: string) => void;
  /** The current Number of Sessions value — drives the Away popover's checkbox
   * count and which marks the Away cell shows. */
  numSessions: number;
  /** Locked: the assignments were built from this roster and editing it would
   * invalidate them. Every field is inert and the add-row is gone. */
  readOnly?: boolean;
  /** Uploaded people not yet saved. Rendered first so they're seen. */
  drafts?: RosterDraft[];
  onDraftChange?: (id: string, patch: DraftPatch) => void;
  onDraftDelete?: (id: string) => void;
}

interface EmptyRowState {
  name: string;
  religion: Religion;
  gender: Gender;
  partner_id: string | null;
  is_facilitator: boolean;
}

const EMPTY_ROW: EmptyRowState = {
  name: '', religion: 'Other', gender: 'Other', partner_id: null, is_facilitator: false,
};

const nameTakenMessage = (name: string) =>
  `Someone named ${name} is already on the roster. Add a last initial or a nickname.`;

export function RosterGrid({
  participants,
  onUpdate,
  onDelete,
  onAdd,
  onKeepTogetherToggle,
  numSessions,
  readOnly = false,
  drafts = [],
  onDraftChange,
  onDraftDelete,
}: RosterGridProps) {

  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [emptyRow, setEmptyRow] = useState<EmptyRowState>({ ...EMPTY_ROW });
  // A typed name that collides with someone else's is never saved. It stays in
  // the input, with this message under it, until it's changed.
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [emptyRowError, setEmptyRowError] = useState<string | null>(null);

  // Names are unique per program under nameKey, which is also how the server
  // checks. Drafts count: they will be on the roster once fixed.
  const ownerByKey = useMemo(() => {
    const owners = new Map<string, string>();
    participants.forEach(p => owners.set(nameKey(p.name), p.id));
    drafts.forEach(d => owners.set(nameKey(d.name), d.id));
    return owners;
  }, [participants, drafts]);
  const isTaken = useCallback(
    (name: string, selfId: string | null) => {
      const owner = ownerByKey.get(nameKey(name));
      return owner !== undefined && owner !== selfId;
    },
    [ownerByKey],
  );

  // The name to send with any other field's change. A pending rename onto a
  // taken name would make the server refuse the whole edit, so it isn't sent.
  const nameToSave = (participant: RosterParticipant) => {
    const pending = editingNames[participant.id];
    return pending === undefined || isTaken(pending, participant.id) ? participant.name : pending;
  };

  const handleNameChange = (id: string, value: string) => {
    setEditingNames(prev => ({ ...prev, [id]: value }));
    setNameErrors(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleNameBlur = (participant: RosterParticipant) => {
    const newName = editingNames[participant.id];
    if (newName !== undefined && newName !== participant.name && isTaken(newName, participant.id)) {
      setNameErrors(prev => ({ ...prev, [participant.id]: nameTakenMessage(newName.trim()) }));
      return;
    }
    if (newName !== undefined && newName !== participant.name) {
      onUpdate(participant.id, {
        name: newName,
        religion: participant.religion,
        gender: participant.gender,
        partner_id: participant.partner_id,
        is_facilitator: participant.is_facilitator ?? false,
        keep_together: participant.keep_together,
        absent_sessions: participant.absent_sessions ?? [],
      });
    }
    setEditingNames(prev => {
      const next = { ...prev };
      delete next[participant.id];
      return next;
    });
  };

  const handleFieldChange = (
    participant: RosterParticipant,
    field: 'religion' | 'gender' | 'partner_id',
    value: string,
  ) => {
    const partnerValue = field === 'partner_id' ? (value === 'none' ? null : value) : participant.partner_id;
    onUpdate(participant.id, {
      name: nameToSave(participant),
      religion: field === 'religion' ? value as Religion : participant.religion,
      gender: field === 'gender' ? value as Gender : participant.gender,
      partner_id: partnerValue,
      is_facilitator: participant.is_facilitator ?? false,
      keep_together: participant.keep_together,
      absent_sessions: participant.absent_sessions ?? [],
    });
  };

  const handleFacilitatorChange = (participant: RosterParticipant, checked: boolean) => {
    onUpdate(participant.id, {
      name: nameToSave(participant),
      religion: participant.religion,
      gender: participant.gender,
      partner_id: participant.partner_id,
      is_facilitator: checked,
      keep_together: participant.keep_together,
      absent_sessions: participant.absent_sessions ?? [],
    });
  };

  const handleAwayChange = (participant: RosterParticipant, next: number[]) => {
    onUpdate(participant.id, {
      name: nameToSave(participant),
      religion: participant.religion,
      gender: participant.gender,
      partner_id: participant.partner_id,
      is_facilitator: participant.is_facilitator ?? false,
      keep_together: participant.keep_together,
      absent_sessions: next,
    });
  };

  const emptyRowRef = useRef<HTMLTableRowElement>(null);

  const commitEmptyRow = useCallback(() => {
    if (emptyRow.name.trim()) {
      if (isTaken(emptyRow.name, null)) {
        setEmptyRowError(nameTakenMessage(emptyRow.name.trim()));
        return;
      }
      onAdd({
        name: emptyRow.name.trim(),
        religion: emptyRow.religion,
        gender: emptyRow.gender,
        partner_id: emptyRow.partner_id,
        is_facilitator: emptyRow.is_facilitator,
      });
      setEmptyRow({ ...EMPTY_ROW });
    }
  }, [emptyRow, onAdd, isTaken]);

  const handleEmptyRowFieldChange = useCallback((updater: (prev: EmptyRowState) => EmptyRowState) => {
    setEmptyRow(prev => {
      const next = updater(prev);
      if (next.name.trim()) {
        // Commit after the state update settles so onAdd sees the final values
        setTimeout(() => {
          if (isTaken(next.name, null)) {
            setEmptyRowError(nameTakenMessage(next.name.trim()));
            return;
          }
          onAdd({
            name: next.name.trim(),
            religion: next.religion,
            gender: next.gender,
            partner_id: next.partner_id,
            is_facilitator: next.is_facilitator,
          });
          setEmptyRow({ ...EMPTY_ROW });
        }, 0);
      }
      return next;
    });
  }, [onAdd, isTaken]);

  const handleEmptyRowBlur = useCallback(() => {
    // Delay check so focus has time to settle (Radix Select portals the dropdown)
    setTimeout(() => {
      const active = document.activeElement;
      // If focus moved to something inside the row, don't commit yet
      if (emptyRowRef.current?.contains(active)) return;
      // Also check for open Radix popper content (portaled outside the row)
      if (active?.closest('[data-radix-popper-content-wrapper]')) return;
      commitEmptyRow();
    }, 0);
  }, [commitEmptyRow]);

  const duplicateNames = new Set<string>();
  const nameCounts: Record<string, number> = {};
  for (const p of participants) {
    nameCounts[p.name] = (nameCounts[p.name] || 0) + 1;
    if (nameCounts[p.name] > 1) duplicateNames.add(p.name);
  }

  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">
        {participants.length} participant{participants.length !== 1 ? 's' : ''}
        {drafts.length > 0 && `, plus ${drafts.length} not saved yet`}
      </div>
      <div className="w-full overflow-auto border rounded-md">
        {/* Fixed layout, or the widths below are only hints: auto layout sizes by
            content, and a text input has none, so Name got whatever was left and
            clipped ordinary names. The widths add up to the card's inner width
            (max-w-4xl less padding), and min-w scrolls rather than crushes. */}
        <Table className="table-fixed min-w-[842px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Name</TableHead>
              <TableHead className="w-[112px]">Religion</TableHead>
              <TableHead className="w-[106px]">Gender</TableHead>
              <TableHead className="w-[168px]">Partner</TableHead>
              <TableHead className="w-[92px] px-2">Facilitator</TableHead>
              <TableHead className="w-[136px]">Absences</TableHead>
              <TableHead className="w-[48px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Drafts are labelled as a group rather than row by row, so their
                rows keep the same shape as everyone else's. */}
            {drafts.length > 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-2 pb-1 pt-3 text-xs font-medium text-red-700">
                  Not saved yet
                </TableCell>
              </TableRow>
            )}
            {[...drafts]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((d, i, sorted) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  readOnly={readOnly}
                  last={i === sorted.length - 1}
                  onChange={patch => onDraftChange?.(d.id, patch)}
                  onDelete={() => onDraftDelete?.(d.id)}
                />
              ))}
            {participants.map(p => {
              const currentName = editingNames[p.id] ?? p.name;
              const nameError = nameErrors[p.id];
              const hasError = !currentName.trim() || duplicateNames.has(p.name) || !!nameError;

              return (
                <TableRow key={p.id} className="group">
                  <TableCell className="p-1">
                    <Input
                      placeholder="Name"
                      value={currentName}
                      onChange={e => handleNameChange(p.id, e.target.value)}
                      onBlur={() => handleNameBlur(p)}
                      disabled={readOnly}
                      className={hasError ? 'border-red-500' : ''}
                    />
                    {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={p.religion} disabled={readOnly} onValueChange={v => handleFieldChange(p, 'religion', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={p.gender} disabled={readOnly} onValueChange={v => handleFieldChange(p, 'gender', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <div className="flex items-center gap-1">
                      <PersonCombobox
                        className="min-w-0"
                        aria-label={`Partner for ${currentName || 'this row'}`}
                        value={p.partner_id}
                        disabled={readOnly}
                        placeholder="None"
                        searchPlaceholder="Search for a partner"
                        noneLabel="None"
                        onSelect={id => handleFieldChange(p, 'partner_id', id ?? 'none')}
                        options={[...participants]
                          .filter(other => other.id !== p.id && (!other.partner_id || other.partner_id === p.id))
                          .sort((a, b) => a.name.localeCompare(b.name))}
                      />
                      <span className="flex w-5 shrink-0 items-center justify-center">
                      {p.partner_id && (
                        <button
                          onClick={() => onKeepTogetherToggle(p.id)}
                          disabled={readOnly}
                          className="p-0.5 rounded hover:bg-gray-100 shrink-0 disabled:cursor-not-allowed"
                          title={p.keep_together ? "Partner will be at the same table (click to separate)" : "Partner will be at a different table (click to keep together)"}
                        >
                          {p.keep_together ? (
                            <Link className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Unlink className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    <input
                      type="checkbox"
                      checked={p.is_facilitator ?? false}
                      onChange={e => handleFacilitatorChange(p, e.target.checked)}
                      disabled={readOnly}
                      className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                      aria-label={`Mark ${p.name} as facilitator`}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <AwayCell
                      name={p.name}
                      absentSessions={p.absent_sessions ?? []}
                      numSessions={numSessions}
                      readOnly={readOnly}
                      onChange={next => handleAwayChange(p, next)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDelete(p.id)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Perpetual empty row - there is nothing to add to a locked roster */}
            {!readOnly && (
            <TableRow ref={emptyRowRef} onBlur={handleEmptyRowBlur}>
              <TableCell className="p-1">
                <Input
                  placeholder="Name"
                  value={emptyRow.name}
                  onChange={e => {
                    setEmptyRowError(null);
                    setEmptyRow(prev => ({ ...prev, name: e.target.value }));
                  }}
                  className={emptyRowError ? 'border-red-500' : ''}
                />
                {emptyRowError && <p className="mt-1 text-xs text-red-600">{emptyRowError}</p>}
              </TableCell>
              <TableCell className="p-1">
                <Select value={emptyRow.religion} onValueChange={v => handleEmptyRowFieldChange(prev => ({ ...prev, religion: v as Religion }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Select value={emptyRow.gender} onValueChange={v => handleEmptyRowFieldChange(prev => ({ ...prev, gender: v as Gender }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <span className="text-sm text-muted-foreground px-3">—</span>
              </TableCell>
              <TableCell className="p-1 text-center">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="h-4 w-4"
                  aria-label="Facilitator (save name first)"
                  onChange={() => {}}
                />
              </TableCell>
              <TableCell className="p-1">
                <span className="text-sm text-muted-foreground px-3">—</span>
              </TableCell>
              <TableCell className="p-1"></TableCell>
            </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
