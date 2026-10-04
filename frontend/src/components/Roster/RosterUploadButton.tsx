import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NO_ROWS, readRosterFile } from '@/utils/rosterImport';

export interface LoadedRoster {
  headers: string[];
  rows: string[][];
}

interface RosterUploadButtonProps {
  onLoaded: (roster: LoadedRoster) => void;
  onError: (message: string) => void;
}

export function RosterUploadButton({ onLoaded, onError }: RosterUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear it so choosing the same file again still fires a change.
    e.target.value = '';
    if (!file) return;
    try {
      const [headers, ...rows] = await readRosterFile(file);
      if (!headers || rows.length === 0) {
        onError(NO_ROWS);
        return;
      }
      onLoaded({ headers: headers.map((h, i) => h || `Column ${i + 1}`), rows });
    } catch (err) {
      onError(err instanceof Error ? err.message : NO_ROWS);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        Upload roster
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        aria-label="Roster file"
        onChange={handleChange}
      />
    </>
  );
}
