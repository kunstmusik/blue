import { useState } from 'react';
import type { ManualLibraryImportPreview } from '../../../shared/unified-library';
import { AppSelect } from '../AppSelect';

interface LibraryImportDialogProps {
  preview: ManualLibraryImportPreview;
  onImport: (folderSelections: Readonly<Record<string, string>>) => void;
  onCancel: () => void;
}

export function LibraryImportDialog({ preview, onImport, onCancel }: LibraryImportDialogProps): React.ReactElement {
  const [folderSelections, setFolderSelections] = useState<Record<string, string>>({});
  const validCount = preview.sources.filter((source) => !source.error).length;
  const conflicts = preview.sources.flatMap((source) => source.folderConflicts);
  const allConflictsResolved = conflicts.every((conflict) => Boolean(folderSelections[conflict.conflictId]));
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="library-import-title" className="absolute inset-0 z-30 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-xl overflow-auto rounded border border-app-border bg-app-overlay p-4 shadow-xl">
        <h2 id="library-import-title" className="text-role-title-2 font-semibold">Review Library Import</h2>
        <ul className="my-3 grid gap-2 text-role-body">
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
              {source.folderConflicts.map((conflict) => (
                <label key={conflict.conflictId} className="mt-2 block text-role-callout">
                  Destination for {conflict.sourceBreadcrumb.join(' / ')}
                  <AppSelect
                    aria-label={`Destination for ${conflict.sourceBreadcrumb.join(' / ')}`}
                    value={folderSelections[conflict.conflictId] ?? ''}
                    onValueChange={(value) => setFolderSelections((current) => ({
                      ...current,
                      [conflict.conflictId]: value,
                    }))}
                    options={[
                      { value: '', label: 'Choose a folder…' },
                      ...conflict.candidates.map((candidate) => ({
                        value: candidate.nodeId,
                        label: candidate.breadcrumb.join(' / '),
                      })),
                    ]}
                    className="mt-1 w-full rounded border border-app-border bg-app-input px-2 py-1 text-role-body"
                  />
                </label>
              ))}
            </li>
          ))}
        </ul>
        <p className="mb-3 text-role-callout text-app-text-muted">
          Exact duplicates in the chosen folder are skipped. Same-name items with different content receive a deterministic Imported suffix. Missing folders are created.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-app-border px-3 py-1 text-role-body">Cancel</button>
          <button type="button" disabled={validCount === 0 || !allConflictsResolved} onClick={() => onImport(folderSelections)} className="rounded bg-app-accent px-3 py-1 text-role-body text-white disabled:opacity-40">Import</button>
        </div>
      </div>
    </div>
  );
}
