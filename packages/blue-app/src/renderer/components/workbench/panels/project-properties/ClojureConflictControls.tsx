import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmationDialog } from '../../../dialogs/ConfirmationDialog';
import { useHostDocument } from '../../../../hooks/use-host-document';
import { portalEventIsolationProps } from '../../../../hooks/host-portals';
import {
  resolveClojureFieldConflict,
  reviewClojureFieldConflict,
  useProjectStore,
} from '../../../../stores/project-store';
import type { ClojureConflictReview } from '../../../../stores/project-store/project-patch-queue';

/** Retained drafts are renderer state, not additional project fields. */
export function ClojureConflictControls(): React.ReactElement | null {
  const conflicts = useProjectStore((state) => state.clojureFieldConflicts);
  const libraries = useProjectStore((state) => state.clojureProject.libraryEntries);
  const hostDocument = useHostDocument();
  const [review, setReview] = useState<ClojureConflictReview | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openReview = async (id: string): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const next = await reviewClojureFieldConflict(id);
      setValue(next.conflict.value);
      setReview(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (action: string): Promise<void> => {
    const selected = review;
    setReview(null);
    if (!selected || (action !== 'apply' && action !== 'discard')) return;
    setBusy(true);
    setError('');
    try {
      await resolveClojureFieldConflict(selected, action === 'apply' ? value : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (conflicts.length === 0 && !error) return null;
  return (
    <section aria-label="Clojure library conflicts" className="space-y-2 text-role-body">
      {conflicts.length > 0 && (
        <p>These drafts could not be applied. Review them before saving or undoing.</p>
      )}
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="flex items-center gap-2">
          <span>
            {libraries.find((entry) => entry.entryId === conflict.entryId)?.dependencyCoordinates ??
              'Removed library'}
            {' — '}
            {conflict.field === 'version' ? 'Version' : 'Library coordinates'}: {conflict.value}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void openReview(conflict.id);
            }}
            className="rounded border border-app-border px-3 py-1 disabled:opacity-50"
          >
            Review draft
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      {hostDocument &&
        review &&
        conflicts.some((conflict) => conflict.id === review.conflict.id) &&
        createPortal(
          <div {...portalEventIsolationProps}>
            <ConfirmationDialog
              open
              title="Resolve Clojure library draft"
              description={
                review.canonicalValue === null
                  ? 'This library was removed. You can discard this draft; applying it cannot restore the library.'
                  : `Current project value: ${review.canonicalValue}`
              }
              cancelActionId="cancel"
              initialFocusActionId="cancel"
              actions={[
                { id: 'cancel', label: 'Cancel', intent: 'cancel' },
                { id: 'discard', label: 'Use project value', intent: 'destructive' },
                {
                  id: 'apply',
                  label: 'Apply draft',
                  intent: 'destructive',
                  disabled: review.canonicalValue === null,
                },
              ]}
              onDecision={(action) => {
                void decide(action);
              }}
            >
              <label className="block text-role-body">
                Draft value
                <input
                  aria-label="Draft value"
                  data-history-scope="draft"
                  type="text"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="mt-1 w-full rounded border border-app-border bg-app-surface px-2 py-1 text-role-body"
                />
              </label>
            </ConfirmationDialog>
          </div>,
          hostDocument.body,
        )}
    </section>
  );
}
