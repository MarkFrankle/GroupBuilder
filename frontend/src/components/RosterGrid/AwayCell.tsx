import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

/** Shown on the cells and the column header once sessions are built. */
export const ABSENCES_ON_ASSIGNMENTS = 'Change absences on the Assignments page.';

interface AwayCellProps {
  name: string;
  /** Session numbers the participant misses. Values outside 1..numSessions are
   * ignored for display — a mark left over from a since-reduced session count. */
  absentSessions: number[];
  numSessions: number;
  /** Set once sessions are built, locked or not. The plan owns absences from
   * then on, so the cell is inert text with a hover pointing to Assignments.
   * Saving from the roster would write a field nothing reads after the build. */
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
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className={`${triggerClass} cursor-help`}>{text}</span>
          </TooltipTrigger>
          <TooltipContent>{ABSENCES_ON_ASSIGNMENTS}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
