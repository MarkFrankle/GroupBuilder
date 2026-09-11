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
   * mirror as plain text — inert, like every other locked field. Absences are
   * managed on the Assignments page instead. */
  readOnly: boolean;
  onChange: (next: number[]) => void;
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
}: AwayCellProps) {
  const sessions = Array.from({ length: Math.max(numSessions, 0) }, (_, i) => i + 1);
  const absentSet = new Set(absentSessions);
  const visible = sessions.filter(n => absentSet.has(n));
  const text = label(visible, numSessions);
  const muted = visible.length === 0;

  const triggerClass = `flex items-center h-10 px-3 text-sm text-left whitespace-nowrap ${
    muted ? 'text-muted-foreground' : ''
  }`;

  if (readOnly) {
    return <span className={triggerClass}>{text}</span>;
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
