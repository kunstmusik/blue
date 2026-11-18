import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { JMaskGenerationMode } from '@blue/data';
import { portalEventIsolationProps } from '../../../../../../hooks/host-portals';
import { usePortalContainer } from '../../../../../../hooks/use-host-document';

const modes = [
  {
    value: 1,
    name: 'Mode 1 (Legacy)',
    description: 'Rounds instrument IDs to whole numbers and keeps legacy event timing.',
  },
  {
    value: 2,
    name: 'Mode 2 (Corrected)',
    description:
      'Preserves fractional instrument IDs, sweeps oscillator frequency across the full object, and stops generation at the end.',
  },
] as const;

export default function GenerationModeControl({
  mode,
  onApply,
}: {
  mode: JMaskGenerationMode;
  onApply: (mode: JMaskGenerationMode) => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const container = usePortalContainer();
  const [selection, setSelection] = useState<{
    baseline: JMaskGenerationMode;
    value: JMaskGenerationMode;
  }>();
  const isOpen = selection !== undefined;
  if (selection && selection.baseline !== mode) {
    setSelection({ baseline: mode, value: mode });
  }
  const draft = selection?.value ?? mode;
  useLayoutEffect(() => {
    const modal = dialog.current;
    if (isOpen && modal && !modal.open) modal.showModal();
  }, [container, isOpen]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Generation mode, Mode ${mode}`}
        title="Change generation mode"
        className="rounded border border-blue-border px-2 py-0.5 text-role-body text-app-text hover:border-blue-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
        onClick={() => setSelection({ baseline: mode, value: mode })}
      >
        Mode {mode}
      </button>
      {isOpen &&
        container &&
        createPortal(
          <dialog
            {...portalEventIsolationProps}
            ref={dialog}
            onClose={() => setSelection(undefined)}
            aria-labelledby={titleId}
            className="m-auto max-h-[calc(100vh-2rem)] w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-app-border bg-app-overlay p-4 text-app-text shadow-2xl backdrop:overflow-hidden backdrop:overscroll-contain backdrop:bg-black/60"
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                dialog.current?.close();
                if (draft !== mode) onApply(draft);
              }}
            >
              <h2 id={titleId} className="text-role-title-2 font-bold text-app-text-bright">
                JMask Generation Mode
              </h2>
              <fieldset className="space-y-2" aria-labelledby={titleId}>
                {modes.map(({ value, name, description }) => (
                  <label
                    key={value}
                    htmlFor={`${titleId}-choice-${value}`}
                    className="flex cursor-pointer items-start gap-2 rounded border border-app-border p-2 text-role-body hover:bg-app-hover"
                  >
                    <input
                      id={`${titleId}-choice-${value}`}
                      type="radio"
                      name={titleId}
                      checked={draft === value}
                      onChange={() => setSelection({ baseline: mode, value })}
                      aria-labelledby={`${titleId}-label-${value}`}
                      aria-describedby={`${titleId}-${value}`}
                      className="mt-1"
                    />
                    <span>
                      <span id={`${titleId}-label-${value}`} className="block font-semibold">
                        {name}
                      </span>
                      <span id={`${titleId}-${value}`} className="block text-app-text-muted">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="flex justify-end gap-2 border-t border-app-border pt-3">
                <button
                  type="button"
                  className="rounded border border-app-border px-3 py-1 text-role-body hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
                  onClick={() => dialog.current?.close()}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-blue-accent/20 px-3 py-1 text-role-body font-semibold hover:bg-blue-accent/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
                >
                  Apply
                </button>
              </div>
            </form>
          </dialog>,
          container,
        )}
    </>
  );
}
