import type { LibraryType } from '../../../shared/unified-library';

interface LibraryActionsMenuProps {
  selectedType: LibraryType | 'all';
  onImport: () => void;
  onExportCurrent: () => void;
  onExportAll: () => void;
  onHistory: () => void;
}

export function LibraryActionsMenu({ selectedType, onImport, onExportCurrent, onExportAll, onHistory }: LibraryActionsMenuProps): React.ReactElement {
  return (
    <div aria-label="Library actions" className="flex flex-wrap items-center gap-1 border-b border-app-border px-2 py-1 text-xs">
      <button type="button" onClick={onImport} className="rounded border border-app-border px-2 py-1">Import XML…</button>
      <button type="button" disabled={selectedType === 'all'} onClick={onExportCurrent} className="rounded border border-app-border px-2 py-1 disabled:opacity-40">Export Current…</button>
      <button type="button" onClick={onExportAll} className="rounded border border-app-border px-2 py-1">Export All</button>
      <button type="button" onClick={onHistory} className="rounded border border-app-border px-2 py-1">History</button>
    </div>
  );
}
