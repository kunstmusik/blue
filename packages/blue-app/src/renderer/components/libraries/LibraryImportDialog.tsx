import type { ManualLibraryImportPreview } from '../../../shared/unified-library';

interface LibraryImportDialogProps {
  preview: ManualLibraryImportPreview;
  onImport: () => void;
  onCancel: () => void;
}

export function LibraryImportDialog({ preview, onImport, onCancel }: LibraryImportDialogProps): React.ReactElement {
  const validCount = preview.sources.filter((source) => !source.error && source.ambiguousFolderCount === 0).length;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="library-import-title" className="absolute inset-0 z-30 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-xl overflow-auto rounded border border-app-border bg-app-panel p-4 shadow-xl">
        <h2 id="library-import-title" className="font-semibold">Review Library Import</h2>
        <ul className="my-3 grid gap-2 text-sm">
          {preview.sources.map((source) => (
            <li key={source.sourcePath} className="rounded border border-app-border p-2">
              <p className="font-medium">{source.sourcePath.split(/[/\\]/u).at(-1)}</p>
              {source.error ? <p role="alert" className="text-red-400">{source.error}</p> : (
                <p className="text-app-text-muted">
                  {source.itemCount} items, {source.folderCount} folders, {source.unsupportedCount} unsupported;
                  {' '}{source.exactDuplicateCount} exact duplicate{source.exactDuplicateCount === 1 ? '' : 's'},
                  {' '}{source.aliasConflictCount} alias conflict{source.aliasConflictCount === 1 ? '' : 's'}
                </p>
              )}
              {source.ambiguousFolderCount > 0 && <p role="alert" className="text-amber-400">Choose destinations for ambiguous folders before importing.</p>}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-app-border px-3 py-1">Cancel</button>
          <button type="button" disabled={validCount === 0 || preview.sources.some((source) => source.ambiguousFolderCount > 0)} onClick={onImport} className="rounded bg-app-accent px-3 py-1 text-white disabled:opacity-40">Import</button>
        </div>
      </div>
    </div>
  );
}
