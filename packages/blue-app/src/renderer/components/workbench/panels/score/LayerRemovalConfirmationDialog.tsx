import { useEffect, useRef, useState } from 'react';
import type { LayerRemovalPlan } from './layer-selection-utils';

interface Props {
  plan: LayerRemovalPlan;
  onCancel: () => void;
  onConfirm: (deleteEmptyLayerGroups: boolean) => void;
}

export default function LayerRemovalConfirmationDialog({ plan, onCancel, onConfirm }: Props) {
  const [deleteEmptyLayerGroups, setDeleteEmptyLayerGroups] = useState(plan.deleteEmptyLayerGroups);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="layer-removal-title"
        aria-describedby="layer-removal-description"
        data-layer-removal-dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded border border-app-border bg-app-overlay p-4 text-app-text shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="layer-removal-title" className="text-role-title-2 font-bold">
          Remove Layers
        </h2>
        <p id="layer-removal-description" className="mt-2 text-role-body text-app-text-muted">
          Delete {plan.totalLayerCount} layer{plan.totalLayerCount === 1 ? '' : 's'}?
        </p>
        {plan.emptyGroupIds.length > 0 && (
          <label className="mt-3 flex items-center gap-2 text-role-body text-app-text">
            <input
              type="checkbox"
              data-delete-empty-layer-groups
              checked={deleteEmptyLayerGroups}
              onChange={(event) => setDeleteEmptyLayerGroups(event.target.checked)}
            />
            Delete empty Layer Groups
          </label>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            data-layer-removal-cancel
            className="rounded border border-app-border/50 px-3 py-1 text-role-body text-app-text-muted hover:bg-app-hover"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            data-layer-removal-confirm
            className="rounded border border-app-accent bg-app-accent/20 px-3 py-1 text-role-body text-app-text hover:bg-app-accent/30"
            onClick={() => onConfirm(deleteEmptyLayerGroups)}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
