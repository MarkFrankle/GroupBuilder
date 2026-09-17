import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/utils/cn';

export interface PersonComboboxOption {
  id: string;
  name: string;
}

interface PersonComboboxProps {
  options: PersonComboboxOption[];
  value: string | null;
  onSelect: (id: string | null) => void;
  /** Shown on the trigger when nothing is selected. */
  placeholder?: string;
  /** Shown inside the search field once the list is open. */
  searchPlaceholder?: string;
  /** When set, an extra option clears the selection back to null. */
  noneLabel?: string;
  disabled?: boolean;
  'aria-label': string;
  'aria-describedby'?: string;
  className?: string;
}

export function PersonCombobox({
  options, value, onSelect, placeholder = 'Select…', searchPlaceholder = 'Search…', noneLabel,
  disabled, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, className,
}: PersonComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedName = options.find(o => o.id === value)?.name;

  const pick = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <span className={cn('flex-1 truncate text-left', !selectedName && 'text-muted-foreground')}>
            {selectedName ?? placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 min-w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {noneLabel && (
                <CommandItem value={noneLabel} onSelect={() => pick(null)}>
                  {noneLabel}
                </CommandItem>
              )}
              {options.map(o => (
                <CommandItem key={o.id} value={o.name} onSelect={() => pick(o.id)}>
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
