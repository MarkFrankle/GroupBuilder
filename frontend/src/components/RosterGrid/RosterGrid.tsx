import { useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { RosterParticipant, Religion, Gender, RELIGIONS, GENDERS } from '@/types/roster';

interface RosterGridProps {
  participants: RosterParticipant[];
  onUpdate: (id: string, data: Omit<RosterParticipant, 'id'>) => void;
  onDelete: (id: string) => void;
  onAdd: (data: Omit<RosterParticipant, 'id'>) => void;
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

export function RosterGrid({ participants, onUpdate, onDelete, onAdd }: RosterGridProps) {
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [emptyRow, setEmptyRow] = useState<EmptyRowState>({ ...EMPTY_ROW });

  const handleNameChange = (id: string, value: string) => {
    setEditingNames(prev => ({ ...prev, [id]: value }));
  };

  const handleNameBlur = (participant: RosterParticipant) => {
    const newName = editingNames[participant.id];
    if (newName !== undefined && newName !== participant.name) {
      onUpdate(participant.id, {
        name: newName,
        religion: participant.religion,
        gender: participant.gender,
        partner_id: participant.partner_id,
        is_facilitator: participant.is_facilitator ?? false,
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
      name: editingNames[participant.id] ?? participant.name,
      religion: field === 'religion' ? value as Religion : participant.religion,
      gender: field === 'gender' ? value as Gender : participant.gender,
      partner_id: partnerValue,
      is_facilitator: participant.is_facilitator ?? false,
    });
  };

  const handleFacilitatorChange = (participant: RosterParticipant, checked: boolean) => {
    onUpdate(participant.id, {
      name: editingNames[participant.id] ?? participant.name,
      religion: participant.religion,
      gender: participant.gender,
      partner_id: participant.partner_id,
      is_facilitator: checked,
    });
  };

  const emptyRowRef = useRef<HTMLTableRowElement>(null);

  const commitEmptyRow = useCallback(() => {
    if (emptyRow.name.trim()) {
      onAdd({
        name: emptyRow.name.trim(),
        religion: emptyRow.religion,
        gender: emptyRow.gender,
        partner_id: emptyRow.partner_id,
        is_facilitator: emptyRow.is_facilitator,
      });
      setEmptyRow({ ...EMPTY_ROW });
    }
  }, [emptyRow, onAdd]);

  const handleEmptyRowFieldChange = useCallback((updater: (prev: EmptyRowState) => EmptyRowState) => {
    setEmptyRow(prev => {
      const next = updater(prev);
      if (next.name.trim()) {
        // Commit after the state update settles so onAdd sees the final values
        setTimeout(() => {
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
  }, [onAdd]);

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
      </div>
      <div className="w-full overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[150px]">Religion</TableHead>
              <TableHead className="w-[120px]">Gender</TableHead>
              <TableHead className="w-[200px]">Partner</TableHead>
              <TableHead className="w-[90px]">Facilitator</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map(p => {
              const currentName = editingNames[p.id] ?? p.name;
              const hasError = !currentName.trim() || duplicateNames.has(p.name);

              return (
                <TableRow key={p.id} className="group">
                  <TableCell className="p-1">
                    <Input
                      placeholder="Name"
                      value={currentName}
                      onChange={e => handleNameChange(p.id, e.target.value)}
                      onBlur={() => handleNameBlur(p)}
                      className={hasError ? 'border-red-500' : ''}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={p.religion} onValueChange={v => handleFieldChange(p, 'religion', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={p.gender} onValueChange={v => handleFieldChange(p, 'gender', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={p.partner_id ?? 'none'}
                      onValueChange={v => handleFieldChange(p, 'partner_id', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {participants
                          .filter(other => other.id !== p.id)
                          .map(other => (
                            <SelectItem key={other.id} value={other.id}>{other.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    <input
                      type="checkbox"
                      checked={p.is_facilitator ?? false}
                      onChange={e => handleFacilitatorChange(p, e.target.checked)}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={`Mark ${p.name} as facilitator`}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDelete(p.id)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Perpetual empty row */}
            <TableRow ref={emptyRowRef} onBlur={handleEmptyRowBlur}>
              <TableCell className="p-1">
                <Input
                  placeholder="Name"
                  value={emptyRow.name}
                  onChange={e => setEmptyRow(prev => ({ ...prev, name: e.target.value }))}
                />
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
              <TableCell className="p-1"></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
