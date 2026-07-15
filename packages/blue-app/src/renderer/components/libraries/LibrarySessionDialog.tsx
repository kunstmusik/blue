interface LibrarySessionDialogProps {
  title: string;
  message: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onCancel?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function LibrarySessionDialog({
  title,
  message,
  onPrimary,
  onSecondary,
  onCancel,
  primaryLabel = 'Continue',
  secondaryLabel = 'Alternative',
}: LibrarySessionDialogProps): React.ReactElement {
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="library-session-dialog-title" className="absolute inset-0 z-20 grid place-items-center bg-black/50 p-4">
      <div className="max-w-md rounded border border-app-border bg-app-panel p-4 shadow-xl">
        <h2 id="library-session-dialog-title" className="font-semibold">{title}</h2>
        <p className="my-3 text-sm text-app-text-muted">{message}</p>
        <div className="flex justify-end gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="rounded border border-app-border px-3 py-1 text-xs">Cancel</button>}
          {onSecondary && <button type="button" onClick={onSecondary} className="rounded border border-app-border px-3 py-1 text-xs">{secondaryLabel}</button>}
          <button type="button" onClick={onPrimary} className="rounded bg-app-accent px-3 py-1 text-xs text-white">{primaryLabel}</button>
        </div>
      </div>
    </div>
  );
}
