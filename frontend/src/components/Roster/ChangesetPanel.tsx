import { RosterChangeset } from '@/utils/rosterDiff';

function Group({ heading, note, items }: {
  heading: string;
  note?: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-sm font-medium">{heading}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
      <ul className="text-sm text-muted-foreground">
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

/** How a value reads on screen. Booleans come from yes/no fields like
 * "facilitator", where "true" would be jargon. */
const value = (v: string | boolean | null): string => {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return v ?? 'none';
};

/**
 * What differs between the roster on screen and the roster the current
 * sessions were built from.
 *
 * Renames get their own group on purpose: they are the one change that costs
 * nothing, because the new spelling is written through the saved sessions
 * instead of the seating being solved again.
 */
export function ChangesetPanel({ changeset }: { changeset: RosterChangeset }) {
  if (!changeset.isDirty) return null;

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="text-sm font-medium">Not yet in your sessions</div>
      <Group heading="Added" items={changeset.added} />
      <Group heading="Removed" items={changeset.removed} />
      <Group
        heading="Changed"
        items={changeset.changed.map(c =>
          `${c.name}: ${c.field} ${value(c.from)} → ${value(c.to)}`)}
      />
      <Group
        heading="Renamed"
        note="Just a spelling fix — your sessions keep their seating, no new assignments needed."
        items={changeset.renamed.map(r => `${r.from} → ${r.to}`)}
      />
      <Group
        heading="Plan size"
        items={changeset.shape.map(s => `${s.from ?? 'none'} ${s.field} → ${s.to ?? 'none'}`)}
      />
    </div>
  );
}
