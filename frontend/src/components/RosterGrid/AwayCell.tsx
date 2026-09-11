import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AwayCellProps {
  name: string;
  /** Session numbers the participant misses. Values outside 1..numSessions are
   * ignored for display — a mark left over from a since-reduced session count. */
  absentSessions: number[];
  numSessions: number;
  /** Locked: the sessions were built from this roster. The cell shows the
   * mirror and a click routes the coordinator to the Assignments page. */
  readOnly: boolean;
  onChange: (next: number[]) => void;
  onLockedClick: () => void;
}

function label(visible: number[], numSessions: number): string {
  if (visible.length === 0) return 'Attends all sessions';
  if (visible.length >= numSessions) return 'Misses all sessions';
  return `Misses session${visible.length === 1 ? '' : 's'} ${visible.join(', ')}`;
}

export function AwayCell({
  name,
  absentSessions,
  numSessions,
  readOnly,
  onChange,
  onLockedClick,
}: AwayCellProps) {
  const sessions = Array.from({ length: Math.max(numSessions, 0) }, (_, i) => i + 1);
  const absentSet = new Set(absentSessions);
  const visible = sessions.filter(n => absentSet.has(n));
  const text = label(visible, numSessions);
  const muted = visible.length === 0;

  const triggerClass = `text-sm px-3 py-1 text-left ${
    muted ? 'text-muted-foreground' : ''
  }`;

  if (readOnly) {
    return (
      <button type="button" className={triggerClass} onClick={onLockedClick}>
        {text}
      </button>
    );
  }

  const toggle = (n: number) => {
    const next = absentSet.has(n)
      ? visible.filter(x => x !== n)
      : [...visible, n].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${triggerClass} rounded hover:bg-gray-100`}>
        {text}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{`Which sessions will ${name} miss?`}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sessions.map(n => (
          <DropdownMenuCheckboxItem
            key={n}
            checked={absentSet.has(n)}
            onSelect={e => e.preventDefault()}
            onCheckedChange={() => toggle(n)}
          >
            {`Session ${n}`}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
