import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import type { MissingAudioAssetRow } from '../../../../shared/missing-audio-assets';

/**
 * Renders the Java Blue "Locate Missing Audio Files" repair table when a
 * missing-audio session is active. Browse chooses a replacement per row via the
 * main-process native file picker; OK applies non-empty mappings and refreshes
 * the project snapshot; Cancel/Escape/overlay close dismiss without changes.
 */
export default function MissingAudioAssetsModal(): React.ReactElement | null {
  const session = useProjectStore((state) => state.missingAudioSession);
  const setMissingAudioSession = useProjectStore((state) => state.setMissingAudioSession);
  const applyMissingAudioResolvedSnapshot = useProjectStore(
    (state) => state.applyMissingAudioResolvedSnapshot,
  );

  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);
  const okButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!session) {
      setReplacements({});
      return;
    }
    const initial: Record<string, string> = {};
    for (const row of session.missingFiles) {
      initial[row.originalPath] = row.replacementPath;
    }
    setReplacements(initial);
    setResolving(false);
    okButtonRef.current?.focus();
  }, [session]);

  const closeWithoutChanges = useCallback(
    (sessionId: string) => {
      void window.blueAPI.dismissMissingAudioAssets({ sessionId }).catch(() => {});
      setMissingAudioSession(null);
    },
    [setMissingAudioSession],
  );

  const handleBrowse = useCallback(
    async (originalPath: string) => {
      if (!session) return;
      const currentReplacementPath = replacements[originalPath];
      const selected = await window.blueAPI.chooseMissingAudioReplacement({
        sessionId: session.sessionId,
        originalPath,
        currentReplacementPath: currentReplacementPath || undefined,
      });
      if (selected === null || selected === undefined) {
        return;
      }
      setReplacements((prev) => ({ ...prev, [originalPath]: selected }));
    },
    [replacements, session],
  );

  const handleClear = useCallback((originalPath: string) => {
    setReplacements((prev) => ({ ...prev, [originalPath]: '' }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!session || resolving) return;
    setResolving(true);
    try {
      const replacementRows: MissingAudioAssetRow[] = session.missingFiles.map((row) => ({
        originalPath: row.originalPath,
        replacementPath: replacements[row.originalPath] ?? '',
      }));

      const result = await window.blueAPI.resolveMissingAudioAssets({
        sessionId: session.sessionId,
        replacements: replacementRows,
      });

      if (result.stale) {
        setMissingAudioSession(null);
        return;
      }

      if (result.changed && result.project) {
        applyMissingAudioResolvedSnapshot(result.project);
      }
      setMissingAudioSession(null);
    } finally {
      setResolving(false);
    }
  }, [applyMissingAudioResolvedSnapshot, replacements, resolving, session, setMissingAudioSession]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!session) return;
      if (event.target === event.currentTarget) {
        closeWithoutChanges(session.sessionId);
      }
    },
    [closeWithoutChanges, session],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!session) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWithoutChanges(session.sessionId);
      }
    },
    [closeWithoutChanges, session],
  );

  if (!session) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-[80vw] flex-col rounded-lg border border-app-hover bg-app-overlay shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-audio-title"
      >
        <div className="flex items-center justify-between border-b border-app-hover px-4 py-3">
          <h2 id="missing-audio-title" className="text-sm font-medium text-app-text-bright">
            Locate Missing Audio Files
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-black px-4 py-3">
          <table className="w-full border-collapse text-left text-sm text-app-text">
            <thead>
              <tr className="border-b border-app-hover text-app-text-muted">
                <th scope="col" className="px-2 py-2 font-medium">Original File</th>
                <th scope="col" className="px-2 py-2 font-medium">New File</th>
                <th scope="col" className="px-2 py-2 font-medium" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {session.missingFiles.map((row) => {
                const replacementPath = replacements[row.originalPath] ?? '';
                return (
                  <tr key={row.originalPath} className="border-b border-app-hover/60">
                    <td className="break-all px-2 py-2 align-top">{row.originalPath}</td>
                    <td className="break-all px-2 py-2 align-top" data-testid={`replacement-${row.originalPath}`}>
                      {replacementPath || <span className="text-app-text-muted">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-top text-right">
                      <button
                        type="button"
                        className="rounded border border-app-hover px-2 py-1 text-xs text-app-text hover:bg-app-hover"
                        onClick={() => void handleBrowse(row.originalPath)}
                      >
                        Browse
                      </button>
                      {replacementPath && (
                        <button
                          type="button"
                          className="ml-1 rounded border border-app-hover px-2 py-1 text-xs text-app-text hover:bg-app-hover"
                          onClick={() => handleClear(row.originalPath)}
                        >
                          Clear
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-app-hover px-4 py-3">
          <button
            type="button"
            className="rounded border border-app-hover px-3 py-1.5 text-sm text-app-text hover:bg-app-hover"
            onClick={() => closeWithoutChanges(session.sessionId)}
          >
            Cancel
          </button>
          <button
            ref={okButtonRef}
            type="button"
            className="rounded bg-blue-accent px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
            onClick={() => void handleConfirm()}
            disabled={resolving}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
