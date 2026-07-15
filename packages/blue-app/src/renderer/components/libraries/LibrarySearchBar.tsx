import type { LibraryType } from '../../../shared/unified-library';
import type { LibrarySourceFilter } from '../../stores/library-store';

interface LibrarySearchBarProps {
  query: string;
  typeFilter: LibraryType | 'all';
  sourceFilter: LibrarySourceFilter;
  projectAvailable: boolean;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: LibraryType | 'all') => void;
  onSourceFilterChange: (value: LibrarySourceFilter) => void;
}

export function LibrarySearchBar(props: LibrarySearchBarProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 border-b border-app-border p-2">
      <input
        aria-label="Search libraries"
        className="w-full rounded border border-app-border bg-app-bg px-2 py-1.5 text-sm text-app-text outline-none focus:border-app-accent"
        type="search"
        value={props.query}
        placeholder="Search reusable objects"
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-app-text-muted">
          Type
          <select
            aria-label="Library type"
            className="mt-1 w-full rounded border border-app-border bg-app-bg px-1 py-1 text-sm text-app-text"
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
        <label className="text-xs text-app-text-muted">
          Source
          <select
            aria-label="Library source"
            className="mt-1 w-full rounded border border-app-border bg-app-bg px-1 py-1 text-sm text-app-text"
            value={props.sourceFilter}
            onChange={(event) => props.onSourceFilterChange(event.target.value as LibrarySourceFilter)}
          >
            <option value="all">All sources</option>
            <option value="user">User Libraries</option>
            <option value="project" disabled={!props.projectAvailable}>Current Project</option>
          </select>
        </label>
      </div>
    </div>
  );
}
