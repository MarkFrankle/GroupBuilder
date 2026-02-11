import { useState, useCallback } from 'react';
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
}

const EMPTY_ROW: EmptyRowState = {
  name: '', religion: 'Other', gender: 'Other', partner_id: null,
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
    });
  };

  const handleEmptyRowBlur = useCallback(() => {
    if (emptyRow.name.trim()) {
      onAdd({
        name: emptyRow.name.trim(),
        religion: emptyRow.religion,
        gender: emptyRow.gender,
        partner_id: emptyRow.partner_id,
      });
      setEmptyRow({ ...EMPTY_ROW });
    }
  }, [emptyRow, onAdd]);

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
            <TableRow>
              <TableCell className="p-1">
                <Input
                  placeholder="Name"
                  value={emptyRow.name}
                  onChange={e => setEmptyRow(prev => ({ ...prev, name: e.target.value }))}
                  onBlur={handleEmptyRowBlur}
                />
              </TableCell>
              <TableCell className="p-1">
                <Select value={emptyRow.religion} onValueChange={v => setEmptyRow(prev => ({ ...prev, religion: v as Religion }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Select value={emptyRow.gender} onValueChange={v => setEmptyRow(prev => ({ ...prev, gender: v as Gender }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <span className="text-sm text-muted-foreground px-3">—</span>
              </TableCell>
              <TableCell className="p-1"></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
