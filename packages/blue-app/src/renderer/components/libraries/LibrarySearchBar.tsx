import type { LibraryType } from '../../../shared/unified-library';

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
        className="min-w-0 rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text outline-none focus:border-app-accent"
        type="search"
        value={props.query}
        placeholder="Search reusable objects"
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
        <label className="min-w-0">
          <span className="sr-only">Type</span>
          <select
            aria-label="Library type"
            className="h-full w-full min-w-0 rounded border border-app-border bg-app-bg px-1 text-xs text-app-text"
            value={props.typeFilter}
            onChange={(event) => props.onTypeFilterChange(event.target.value as LibraryType | 'all')}
          >
            <option value="all">All types</option>
            <option value="instrument">Instruments</option>
            <option value="udo">UDOs</option>
            <option value="soundObject">SoundObjects</option>
            <option value="effect">Effects</option>
          </select>
        </label>
    </div>
  );
}
