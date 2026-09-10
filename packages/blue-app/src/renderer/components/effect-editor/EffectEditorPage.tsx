import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  EffectEditorRequest,
  EffectEditorSnapshot,
  EffectEditablePatch,
  UdoDefinitionSnapshot,
} from '../../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../../shared/project-history';
import {
  useDedicatedProjectHistory,
  type DedicatedProjectHistoryClient,
  type DedicatedHistoryDrainResult,
} from '../../hooks/use-dedicated-project-history';

type LoadedEffectEditor = React.ComponentType<{
  snapshot: EffectEditorSnapshot;
  onPatch: (patch: EffectEditablePatch, metadata?: ProjectDocumentCommitMetadata) => void;
}>;

interface PendingEffectPatch {
  patch: EffectEditablePatch;
  metadata?: ProjectDocumentCommitMetadata;
}

function closeWindow(): void {
  window.close();
}

function parseRequestFromLocation(): {
  request: EffectEditorRequest;
  mode: 'interface' | 'edit';
} | null {
  const params = new URLSearchParams(window.location.search);
  const effectId = params.get('effectId');
  const ownerType = params.get('ownerType');
  const mode = params.get('mode') === 'interface' ? 'interface' : 'edit';

  if (!effectId || (ownerType !== 'project' && ownerType !== 'library')) {
    return null;
  }

  const baseRequest: EffectEditorRequest = {
    effectId,
    ownerType,
  };

  if (ownerType === 'project') {
    const channelId = params.get('channelId');
    const chain = params.get('chain');
    const entryId = params.get('entryId');
    if (channelId && (chain === 'pre' || chain === 'post') && entryId) {
      baseRequest.projectRef = { channelId, chain, entryId };
    }
  } else {
    const libraryEffectId = params.get('libraryEffectId');
    if (libraryEffectId) {
      baseRequest.libraryRef = { libraryEffectId };
    }
  }

  return { request: baseRequest, mode };
}

export default function EffectEditorPage(): React.ReactElement {
  const parsed = useMemo(() => parseRequestFromLocation(), []);
  const request = parsed?.request ?? null;
  const mode = parsed?.mode ?? 'edit';
  const isProjectEffect = request?.ownerType === 'project';
  const [snapshot, setSnapshot] = useState<EffectEditorSnapshot | null>(null);
  // Live project UDO projection for project effects; updated by the main
  // process when project globals change while this window stays open (US4).
  const [liveProjectUdos, setLiveProjectUdos] = useState<UdoDefinitionSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [LoadedEditor, setLoadedEditor] = useState<LoadedEffectEditor | null>(null);
  const editorImportStarted = useRef(false);
  const snapshotRef = useRef<EffectEditorSnapshot | null>(null);
  const pendingPatchesRef = useRef<PendingEffectPatch[]>([]);
  const drainingPatchesRef = useRef(false);
  const drainPromiseRef = useRef<Promise<DedicatedHistoryDrainResult> | null>(null);
  const historyRef = useRef<DedicatedProjectHistoryClient | null>(null);
  const canonicalRevisionRef = useRef(0);

  const drainPatches = useCallback(
    async (allowPaused = false): Promise<DedicatedHistoryDrainResult> => {
      const previousDrain = drainPromiseRef.current;
      if (previousDrain) {
        await previousDrain.catch(() => undefined);
        if (!allowPaused) {
          return {
            outstandingPrefixCount: 0,
            failedPrefixCount: 0,
            unresolvedPrefixCount: 0,
          };
        }
      }
      if (drainingPatchesRef.current) {
        return {
          outstandingPrefixCount: 0,
          failedPrefixCount: 0,
          unresolvedPrefixCount: 0,
        };
      }
      drainingPatchesRef.current = true;
      const prefix = allowPaused ? pendingPatchesRef.current.splice(0) : null;
      const run = (async (): Promise<DedicatedHistoryDrainResult> => {
        let failedPrefixCount = 0;
        let unresolved: PendingEffectPatch | undefined;
        let outstandingPrefixCount = 0;
        try {
          while ((prefix ? prefix.length : pendingPatchesRef.current.length) > 0) {
            const history = historyRef.current;
            if (isProjectEffect && history?.isPaused() && !allowPaused) {
              break;
            }
            const currentPending = (prefix ? prefix.shift() : pendingPatchesRef.current.shift())!;
            const historyContext =
              isProjectEffect && history ? history.nextContext(currentPending.metadata) : undefined;
            try {
              const next = await window.blueAPI.updateEffectEditorDocument({
                ...request!,
                patch: currentPending.patch,
                ...(historyContext ? { historyContext } : {}),
              });
              if (!next) {
                unresolved = currentPending;
                failedPrefixCount += allowPaused ? 1 : 0;
                if (isProjectEffect) setError('The effect is no longer available in the project.');
                break;
              }
              snapshotRef.current = next;
              setSnapshot(next);
              document.title = `${next.name || 'Effect'} - ${mode === 'interface' ? 'Interface' : 'Effect Editor'}`;
            } catch (patchError) {
              unresolved = currentPending;
              failedPrefixCount += allowPaused ? 1 : 0;
              setError(patchError instanceof Error ? patchError.message : String(patchError));
              break;
            }
          }
        } finally {
          if (prefix) {
            if (unresolved) prefix.unshift(unresolved);
            outstandingPrefixCount = prefix.length;
            pendingPatchesRef.current.unshift(...prefix);
          } else if (unresolved) {
            pendingPatchesRef.current.unshift(unresolved);
          }
        }
        return {
          outstandingPrefixCount: allowPaused ? outstandingPrefixCount : 0,
          failedPrefixCount,
          unresolvedPrefixCount: allowPaused ? outstandingPrefixCount : 0,
        };
      })();
      drainPromiseRef.current = run;
      try {
        return await run;
      } finally {
        if (drainPromiseRef.current === run) drainPromiseRef.current = null;
        drainingPatchesRef.current = false;
      }
    },
    [isProjectEffect, mode, request],
  );

  const history = useDedicatedProjectHistory({
    enabled: isProjectEffect,
    viewId: request ? `effect:${request.effectId}:${mode}` : 'effect:unavailable',
    drain: drainPatches,
  });
  historyRef.current = history;

  useEffect(() => {
    if (!request) {
      setError('Missing effect editor request');
      return;
    }

    let cancelled = false;
    void window.blueAPI.getEffectEditorDocument(request).then((loaded) => {
      if (cancelled) return;

      if (!loaded) {
        setError('Unable to load effect editor document');
        return;
      }

      snapshotRef.current = loaded;
      setSnapshot(loaded);
      setLiveProjectUdos(loaded.projectUdos);
      document.title = `${loaded.name || 'Effect'} - ${mode === 'interface' ? 'Interface' : 'Effect Editor'}`;
    });

    return () => {
      cancelled = true;
    };
  }, [request, mode]);

  useEffect(() => {
    if (!request || editorImportStarted.current) return;
    editorImportStarted.current = true;
    const loading =
      mode === 'interface' ? import('./EffectInterfacePanel') : import('./EffectEditorPanel');
    void loading
      .then((module) => {
        setLoadedEditor(() => module.default);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, [mode, request]);

  // Reuse the canonical project-document event. The main process routes it only
  // to project-owned effect windows; library effects never subscribe.
  useEffect(() => {
    if (!isProjectEffect) return;
    const historyClient = historyRef.current;
    if (!historyClient) return;
    return window.blueAPI.onProjectDocumentUpdated((event) => {
      const currentDocumentId = historyClient.getDocumentIdentity();
      if (currentDocumentId && event.documentId && event.documentId !== currentDocumentId) return;
      if (event.documentId && event.documentId !== currentDocumentId) {
        canonicalRevisionRef.current = 0;
      }
      if (event.revision < canonicalRevisionRef.current) return;
      canonicalRevisionRef.current = event.revision;
      if (event.documentId) {
        historyClient.setDocumentIdentity(event.documentId, event.revision);
      } else {
        historyClient.setRevision(event.revision);
      }
      setLiveProjectUdos(event.snapshot.projectUdos);
      // Refresh the actually edited effect after a canonical publication so
      // undo/redo from any window is visible here. A deleted effect marks the
      // window unavailable instead of forcing it to reopen.
      if (!request) return;
      const eventRevision = event.revision;
      const eventDocumentId = event.documentId;
      void window.blueAPI
        .getEffectEditorDocument(request)
        .then((next) => {
          if (
            (eventDocumentId && historyClient.getDocumentIdentity() !== eventDocumentId) ||
            eventRevision < canonicalRevisionRef.current
          ) {
            return;
          }
          if (!next) {
            setError('This effect no longer exists in the project.');
            return;
          }
          const serialized = JSON.stringify(next);
          if (serialized !== JSON.stringify(snapshotRef.current)) {
            snapshotRef.current = next;
            setSnapshot(next);
          }
        })
        .catch(() => undefined);
    });
  }, [isProjectEffect, request]);

  const snapshotWithLiveUdos = useMemo<EffectEditorSnapshot | null>(() => {
    if (!snapshot) return null;
    if (!isProjectEffect || liveProjectUdos === null) return snapshot;
    return { ...snapshot, projectUdos: liveProjectUdos };
  }, [snapshot, isProjectEffect, liveProjectUdos]);

  const applyPatch = useCallback(
    (patch: EffectEditablePatch, metadata?: ProjectDocumentCommitMetadata) => {
      if (!request) return;
      pendingPatchesRef.current.push({ patch, metadata });
      void drainPatches();
    },
    [drainPatches, request],
  );

  useEffect(() => {
    if (request && mode === 'edit') {
      window.blueAPI.openEffectEditor(request).catch(() => {});
    }
  }, [request, mode]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-app-bg px-6 text-role-body text-app-text-muted">
        <div className="flex max-w-md flex-col items-center gap-4 rounded border border-app-border bg-app-surface-strong px-6 py-5 text-center shadow-xl">
          <div>{error}</div>
          <button
            type="button"
            className="rounded border border-app-border bg-app-input px-3 py-1.5 text-role-body text-app-text-strong hover:border-app-accent"
            onClick={closeWindow}
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  if (!snapshotWithLiveUdos || !request || !LoadedEditor) {
    return <div aria-hidden="true" className="h-screen bg-app-bg" />;
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-app-bg text-app-text-strong">
      <LoadedEditor snapshot={snapshotWithLiveUdos} onPatch={applyPatch} />
    </div>
  );
}
