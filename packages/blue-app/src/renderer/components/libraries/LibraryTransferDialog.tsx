import type { LibraryInsertionMode, LibraryTransferPreview } from '../../../shared/unified-library';

interface LibraryTransferDialogProps {
  preview: LibraryTransferPreview;
  onApply: (mode: LibraryInsertionMode) => void;
  onCancel: () => void;
}

export function LibraryTransferDialog({ preview, onApply, onCancel }: LibraryTransferDialogProps): React.ReactElement {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="library-transfer-title" className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
      <div className="w-full max-w-sm rounded border border-app-border bg-app-panel p-4 shadow-2xl">
        <h2 id="library-transfer-title" className="font-semibold">Add {preview.item.displayName}</h2>
        <p className="mt-1 text-xs text-app-text-muted">Choose whether this SoundObject follows future edits to its project-library definition or becomes an independent project copy.</p>
        {preview.item.dependencies.itemOwned.length > 0 && (
          <p className="mt-3 rounded border border-app-border bg-app-bg/40 p-2 text-xs text-app-text-muted">
            The copy includes {preview.item.dependencies.itemOwned.length} item-owned {preview.item.dependencies.itemOwned.length === 1 ? 'dependency' : 'dependencies'}.
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded border border-app-border px-3 py-1 text-xs" onClick={onCancel}>Cancel</button>
          {preview.allowedModes.includes('independent') && (
            <button type="button" className="rounded border border-app-border px-3 py-1 text-xs" onClick={() => onApply('independent')}>Copy Independent</button>
          )}
          {preview.allowedModes.includes('sharedInstance') && (
            <button type="button" className="rounded bg-app-accent px-3 py-1 text-xs text-white" onClick={() => onApply('sharedInstance')}>Copy Instance</button>
          )}
        </div>
      </div>
    </div>
  );
}
