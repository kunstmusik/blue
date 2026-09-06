import React, { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../../../dialogs/use-dialog-focus';

interface FileManagerRootRenameDialogProps {
  initialLabel: string;
  path: string;
  onCancel: () => void;
  onSubmit: (label: string) => void | Promise<void>;
}

export function FileManagerRootRenameDialog({
  initialLabel,
  path,
  onCancel,
  onSubmit,
}: FileManagerRootRenameDialogProps): React.ReactElement {
  const [label, setLabel] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useDialogFocus(true, onCancel, {
    initialFocusSelector: '#file-manager-root-name',
  });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(label.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-manager-rename-root-title"
        className="w-full max-w-sm rounded-md border border-app-border bg-app-surface p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form aria-describedby="file-manager-rename-root-path" onSubmit={handleSubmit}>
          <h2
            id="file-manager-rename-root-title"
            className="text-role-title-2 font-bold text-app-text-bright"
          >
            Rename Root
          </h2>
          <label
            htmlFor="file-manager-root-name"
            className="mt-4 block text-role-body font-medium text-app-text"
          >
            Name
          </label>
          <input
            ref={inputRef}
            id="file-manager-root-name"
            name="fileManagerRootLabel"
            type="text"
            autoComplete="off"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="mt-1 w-full rounded border border-app-border bg-app-input px-2 py-1.5 text-role-body text-app-text-bright outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
          />
          <p
            id="file-manager-rename-root-path"
            className="mt-2 break-all text-role-callout text-app-text-muted"
            title={path}
          >
            {path}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-app-border px-3 py-1.5 text-role-body text-app-text hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-app-accent px-3 py-1.5 text-role-body font-medium text-app-text-bright hover:bg-app-accent/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
