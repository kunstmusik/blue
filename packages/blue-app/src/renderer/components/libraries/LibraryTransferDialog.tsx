import type { LibraryInsertionMode, LibraryTransferPreview } from '../../../shared/unified-library';
import { useDialogFocus } from '../dialogs/use-dialog-focus';

interface LibraryTransferDialogProps {
  preview: LibraryTransferPreview;
  onApply: (mode: LibraryInsertionMode) => void;
  onCancel: () => void;
}

export function LibraryTransferDialog({
  preview,
  onApply,
  onCancel,
}: LibraryTransferDialogProps): React.ReactElement {
  const dialogRef = useDialogFocus(true, onCancel);

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-transfer-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded border border-app-border bg-app-overlay p-4 shadow-2xl"
      >
        <h2 id="library-transfer-title" className="text-role-title-2 font-semibold">
          Add {preview.item.displayName}
        </h2>
        <p className="mt-1 text-role-callout text-app-text-muted">
          Choose whether this SoundObject follows future edits to its project-library definition or
          becomes an independent project copy.
        </p>
        {preview.item.dependencies.itemOwned.length > 0 && (
          <p className="mt-3 rounded border border-app-border bg-app-bg/40 p-2 text-role-callout text-app-text-muted">
            The copy includes {preview.item.dependencies.itemOwned.length} item-owned{' '}
            {preview.item.dependencies.itemOwned.length === 1 ? 'dependency' : 'dependencies'}.
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-app-border px-3 py-1 text-role-body focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={onCancel}
          >
            Cancel
          </button>
          {preview.allowedModes.includes('independent') && (
            <button
              type="button"
              className="rounded border border-app-border px-3 py-1 text-role-body focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
              onClick={() => onApply('independent')}
            >
              Copy Independent
            </button>
          )}
          {preview.allowedModes.includes('sharedInstance') && (
            <button
              type="button"
              className="rounded bg-app-accent px-3 py-1 text-role-body text-app-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
              onClick={() => onApply('sharedInstance')}
            >
              Copy Instance
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
