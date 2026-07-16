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
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(90px,1fr)_auto_auto] gap-1 p-1">
      <input
        aria-label="Search libraries"
        className="min-w-0 rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text outline-none focus:border-app-accent"
        type="search"
        value={props.query}
        placeholder="Search reusable objects"
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
        <label>
          <span className="sr-only">Type</span>
          <select
            aria-label="Library type"
            className="h-full max-w-28 rounded border border-app-border bg-app-bg px-1 text-xs text-app-text"
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
        <label>
          <span className="sr-only">Source</span>
          <select
            aria-label="Library source"
            className="h-full max-w-28 rounded border border-app-border bg-app-bg px-1 text-xs text-app-text"
            value={props.sourceFilter}
            onChange={(event) => props.onSourceFilterChange(event.target.value as LibrarySourceFilter)}
          >
            <option value="all">All sources</option>
            <option value="user">User Libraries</option>
            <option value="project" disabled={!props.projectAvailable}>Current Project</option>
          </select>
        </label>
    </div>
  );
}
