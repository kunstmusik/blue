import type { LibraryType } from '../../../shared/unified-library';
import { AppSelect } from '../AppSelect';

interface LibrarySearchBarProps {
  query: string;
  typeFilter: LibraryType | 'all';
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: LibraryType | 'all') => void;
}

export function LibrarySearchBar(props: LibrarySearchBarProps): React.ReactElement {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(64px,1fr)_minmax(0,96px)] gap-1 p-1">
      <input
        aria-label="Search libraries"
        className="min-w-0 rounded border border-app-border bg-app-bg px-2 py-1 text-role-body text-app-text outline-none focus:border-app-accent"
        type="search"
        value={props.query}
        placeholder="Search reusable objects"
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
        <label className="min-w-0">
          <span className="sr-only">Type</span>
          <AppSelect
            aria-label="Library type"
            className="h-full w-full min-w-0 rounded border border-app-border bg-app-bg px-1 text-role-body text-app-text"
            value={props.typeFilter}
            onValueChange={(value) => props.onTypeFilterChange(value as LibraryType | 'all')}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'instrument', label: 'Instruments' },
              { value: 'udo', label: 'UDOs' },
              { value: 'soundObject', label: 'SoundObjects' },
              { value: 'effect', label: 'Effects' },
            ]}
          />
        </label>
    </div>
  );
}
