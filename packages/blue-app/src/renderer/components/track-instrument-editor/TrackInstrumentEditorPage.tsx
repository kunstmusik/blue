import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createBsbRealtimeControlUpdate,
  type InstrumentPatch,
  type OrchestraPatch,
  type TrackInstrumentEditorRequest,
  type TrackInstrumentEditorSnapshot,
} from '../../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../../shared/project-history';
import {
  isNewerTrackInstrumentRuntimeStatus,
  type TrackInstrumentRuntimeStatus,
} from '../../../shared/track-instrument-editor-contract';
import InstrumentEditorPanel from '../workbench/panels/orchestra/InstrumentEditorPanel';
import { useLibraryStore } from '../../stores/library-store';
import { mergePendingInstrumentPatch, toInstrumentPatch } from './track-instrument-patch-queue';
import {
  useDedicatedProjectHistory,
  type DedicatedProjectHistoryClient,
  type DedicatedHistoryDrainResult,
} from '../../hooks/use-dedicated-project-history';

function closeWindow(): void {
  window.close();
}

const INACTIVE_RUNTIME_STATUS: TrackInstrumentRuntimeStatus = {
  sequence: 0,
  playbackRunning: false,
  blueLiveRunning: false,
};

interface PendingInstrumentPatch {
  patch: InstrumentPatch;
  metadata?: ProjectDocumentCommitMetadata;
}

function parseRequestFromLocation(): TrackInstrumentEditorRequest | null {
  const params = new URLSearchParams(window.location.search);
  const rootGroupId = params.get('rootGroupId');
  const trackId = params.get('trackId');
  if (!rootGroupId || !trackId) return null;

  const sessionText = params.get('projectSessionId');
  const revisionText = params.get('projectRevision');
  if (sessionText === null || revisionText === null) return null;
  const projectSessionId = Number(sessionText);
  const projectRevision = Number(revisionText);
  if (
    !Number.isInteger(projectSessionId) ||
    projectSessionId < 0 ||
    !Number.isInteger(projectRevision) ||
    projectRevision < 0
  ) {
    return null;
  }

  return {
    track: {
      rootGroupId,
      trackId,
      projectSessionId,
      projectRevision,
    },
  };
}

function projectSnapshotToTrackInstrument(
  request: TrackInstrumentEditorRequest,
  event: Parameters<Parameters<typeof window.blueAPI.onProjectDocumentUpdated>[0]>[0],
): TrackInstrumentEditorSnapshot | null {
  if (event.sessionId !== request.track.projectSessionId) return null;
  const group = event.snapshot.score?.layerGroups.find(
    (candidate) =>
      candidate.groupType === 'track' && candidate.groupId === request.track.rootGroupId,
  );
  if (!group || group.groupType !== 'track') return null;
  const layer = group.layers.find((candidate) => candidate.layerId === request.track.trackId);
  const instrument = layer?.instrument?.snapshot;
  if (!instrument) return null;

  return {
    track: {
      ...request.track,
      projectSessionId: event.sessionId,
      projectRevision: event.revision,
    },
    instrument,
    projectUdos: event.snapshot.projectUdos,
  };
}

export default function TrackInstrumentEditorPage(): React.ReactElement {
  const parsedRequest = useMemo(parseRequestFromLocation, []);
  const [snapshot, setSnapshot] = useState<TrackInstrumentEditorSnapshot | null>(null);
  const [editorUsable, setEditorUsable] = useState(false);
  const [runtimeStatus, setRuntimeStatus] =
    useState<TrackInstrumentRuntimeStatus>(INACTIVE_RUNTIME_STATUS);
  const [error, setError] = useState<string | null>(
    parsedRequest ? null : 'Missing Track instrument editor request',
  );
  const requestRef = useRef<TrackInstrumentEditorRequest | null>(parsedRequest);
  const runtimeStatusSequenceRef = useRef<number | null>(null);
  const runtimeUnsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  const pendingPatchesRef = useRef<PendingInstrumentPatch[]>([]);
  const drainingPatchesRef = useRef(false);
  const drainPromiseRef = useRef<Promise<DedicatedHistoryDrainResult> | null>(null);
  const mountedRef = useRef(true);
  const editorIdentityRef = useRef<string | null>(null);
  const historyRef = useRef<DedicatedProjectHistoryClient | null>(null);

  const handleEditorUsable = useCallback(() => {
    setEditorUsable(true);
    void useLibraryStore.getState().initialize();
  }, []);

  const acceptSnapshot = useCallback((next: TrackInstrumentEditorSnapshot) => {
    const nextEditorIdentity = [
      next.track.projectSessionId,
      next.track.rootGroupId,
      next.track.trackId,
      next.instrument.assignmentId,
      next.instrument.type,
    ].join(':');
    if (editorIdentityRef.current !== nextEditorIdentity) {
      editorIdentityRef.current = nextEditorIdentity;
      setEditorUsable(false);
    }
    const current = requestRef.current;
    if (
      current &&
      current.track.projectSessionId === next.track.projectSessionId &&
      current.track.projectRevision > next.track.projectRevision
    ) {
      return;
    }
    requestRef.current = { track: next.track };
    historyRef.current?.setRevision(next.track.projectRevision);
    if (!mountedRef.current) return;
    setSnapshot(next);
    setError(null);
    document.title = `${next.instrument.name || 'Track Instrument'} - Track Instrument Editor`;
  }, []);

  const acceptRuntimeStatus = useCallback((next: TrackInstrumentRuntimeStatus) => {
    const previous =
      runtimeStatusSequenceRef.current === null
        ? null
        : { ...INACTIVE_RUNTIME_STATUS, sequence: runtimeStatusSequenceRef.current };
    if (!isNewerTrackInstrumentRuntimeStatus(next, previous)) return;
    runtimeStatusSequenceRef.current = next.sequence;
    if (mountedRef.current) setRuntimeStatus(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runtimeStatusSequenceRef.current = null;
      const unsubscribe = runtimeUnsubscribeRef.current;
      runtimeUnsubscribeRef.current = null;
      if (unsubscribe) void unsubscribe().catch(() => undefined);
      useLibraryStore.getState().dispose();
    };
  }, []);

  useEffect(() => {
    if (!parsedRequest) return;

    let cancelled = false;
    runtimeStatusSequenceRef.current = null;
    setRuntimeStatus(INACTIVE_RUNTIME_STATUS);

    const subscribe = window.blueAPI?.subscribeTrackInstrumentRuntimeStatus;
    if (typeof subscribe !== 'function') return;

    void subscribe(parsedRequest, (next) => {
      if (!cancelled) acceptRuntimeStatus(next);
    })
      .then((subscription) => {
        if (cancelled) {
          if (subscription) void subscription.unsubscribe();
          return;
        }
        if (!subscription) {
          setRuntimeStatus(INACTIVE_RUNTIME_STATUS);
          return;
        }
        runtimeUnsubscribeRef.current = subscription.unsubscribe;
        acceptRuntimeStatus(subscription.status);
      })
      .catch(() => {
        if (!cancelled) setRuntimeStatus(INACTIVE_RUNTIME_STATUS);
      });

    return () => {
      cancelled = true;
      runtimeStatusSequenceRef.current = null;
      const unsubscribe = runtimeUnsubscribeRef.current;
      runtimeUnsubscribeRef.current = null;
      if (unsubscribe) void unsubscribe().catch(() => undefined);
    };
  }, [acceptRuntimeStatus, parsedRequest]);

  useEffect(() => {
    if (!parsedRequest) return;
    let cancelled = false;
    void window.blueAPI.getTrackInstrumentEditorDocument(parsedRequest).then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        setError('The Track instrument is no longer available.');
        return;
      }
      acceptSnapshot(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [acceptSnapshot, parsedRequest]);

  useEffect(() => {
    if (!parsedRequest) return;
    const historyClient = historyRef.current;
    return window.blueAPI.onProjectDocumentUpdated((event) => {
      if (historyClient) {
        const currentDocumentId = historyClient.getDocumentIdentity();
        if (currentDocumentId && event.documentId && event.documentId !== currentDocumentId) return;
        if (event.documentId) {
          historyClient.setDocumentIdentity(event.documentId, event.revision);
        } else {
          historyClient.setRevision(event.revision);
        }
      }
      const currentRequest = requestRef.current ?? parsedRequest;
      const next = projectSnapshotToTrackInstrument(currentRequest, event);
      if (!next) {
        setError('The Track instrument is no longer available.');
        return;
      }
      acceptSnapshot(next);
    });
  }, [acceptSnapshot, parsedRequest]);

  const persistPatch = useCallback(
    async (
      patch: InstrumentPatch,
      metadata?: ProjectDocumentCommitMetadata,
      allowPaused = false,
    ): Promise<boolean> => {
      // Bounded precondition-aware resolution: a stale snapshot is refreshed
      // and retried a bounded number of times; exhaustion retains the patch
      // as a pending draft instead of retrying forever.
      const MAX_STALE_RETRIES = 3;
      for (let attempt = 0; attempt <= MAX_STALE_RETRIES; attempt += 1) {
        const request = requestRef.current;
        if (!request) return false;
        const history = historyRef.current;
        if (history?.isPaused() && !allowPaused) return false;
        const historyContext = history
          ? {
              ...history.nextContext(metadata),
              expectedRevision: request.track.projectRevision,
            }
          : undefined;
        const result = await window.blueAPI.updateTrackInstrumentEditorDocument({
          ...request,
          patch,
          ...(historyContext ? { historyContext } : {}),
        });
        if (!result.snapshot || result.status === 'unavailable') {
          if (mountedRef.current) setError('The Track instrument is no longer available.');
          return false;
        }

        acceptSnapshot(result.snapshot);
        if (result.status !== 'stale') return true;
      }
      return false;
    },
    [acceptSnapshot],
  );

  const drainPatchQueue = useCallback(
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
        let unresolved: PendingInstrumentPatch | undefined;
        let failedPrefixCount = 0;
        let currentPending: PendingInstrumentPatch | undefined;
        let outstandingPrefixCount = 0;
        try {
          while ((prefix ? prefix.length : pendingPatchesRef.current.length) > 0) {
            currentPending = (prefix ? prefix.shift() : pendingPatchesRef.current.shift())!;
            const persisted = await persistPatch(
              currentPending.patch,
              currentPending.metadata,
              allowPaused,
            );
            if (!persisted) {
              unresolved = currentPending;
              failedPrefixCount += allowPaused ? 1 : 0;
              break;
            }
            currentPending = undefined;
          }
        } catch (patchError) {
          console.error('[track-instrument-editor] Failed to save instrument patch:', patchError);
          failedPrefixCount += allowPaused ? 1 : 0;
          unresolved = currentPending;
          if (mountedRef.current) {
            setError('Unable to save the Track instrument change.');
          }
        } finally {
          if (prefix) {
            if (unresolved) prefix.unshift(unresolved);
            outstandingPrefixCount = prefix.length;
            pendingPatchesRef.current.unshift(...prefix);
          } else if (unresolved && requestRef.current && mountedRef.current) {
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
    [persistPatch],
  );

  const applyPatch = useCallback(
    (patch: OrchestraPatch, metadata?: ProjectDocumentCommitMetadata) => {
      const instrumentPatch = toInstrumentPatch(patch);
      if (!instrumentPatch) return;

      const request = requestRef.current;
      if (request && instrumentPatch.bsbInterface) {
        const realtimeUpdate = createBsbRealtimeControlUpdate(
          {
            track: {
              projectSessionId: request.track.projectSessionId,
              rootGroupId: request.track.rootGroupId,
              trackId: request.track.trackId,
            },
          },
          instrumentPatch.bsbInterface,
        );
        if (realtimeUpdate) {
          void window.blueAPI
            .sendBsbRealtimeControlUpdate(realtimeUpdate)
            .catch((realtimeError) => {
              console.error(
                '[track-instrument-editor] Failed to send realtime control update:',
                realtimeError,
              );
            });
        }
      }

      const pending = pendingPatchesRef.current;
      const previous = pending[pending.length - 1];
      const merged = previous ? mergePendingInstrumentPatch(previous.patch, instrumentPatch) : null;
      if (merged) {
        let mergedMetadata = metadata ?? previous?.metadata;
        if (
          previous?.metadata?.gestureId &&
          metadata?.gestureId &&
          previous.metadata.gestureId === metadata.gestureId
        ) {
          if (previous.metadata.phase === 'begin' && metadata.phase === 'update') {
            mergedMetadata = { ...metadata, phase: 'begin' };
          } else if (previous.metadata.phase === 'begin' && metadata.phase === 'end') {
            mergedMetadata = { ...metadata, phase: 'single' };
          }
        }
        pending[pending.length - 1] = {
          patch: merged,
          metadata: mergedMetadata,
        };
      } else {
        pending.push({ patch: instrumentPatch, metadata });
      }
      if (!historyRef.current?.isPaused()) void drainPatchQueue();
    },
    [drainPatchQueue],
  );

  const history = useDedicatedProjectHistory({
    enabled: parsedRequest !== null,
    viewId: parsedRequest
      ? `track-instrument:${parsedRequest.track.rootGroupId}:${parsedRequest.track.trackId}`
      : 'track-instrument:unavailable',
    drain: drainPatchQueue,
  });
  historyRef.current = history;

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

  if (!snapshot) {
    return <div aria-hidden="true" className="h-screen bg-app-bg" />;
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-app-bg text-app-text-strong">
      <InstrumentEditorPanel
        instrument={snapshot.instrument}
        projectUdos={snapshot.projectUdos}
        onOrchestraPatch={applyPatch}
        blueX7Runtime={
          snapshot.instrument.type === 'blueX7'
            ? {
                target: {
                  track: {
                    projectSessionId: snapshot.track.projectSessionId,
                    rootGroupId: snapshot.track.rootGroupId,
                    trackId: snapshot.track.trackId,
                  },
                },
                projectSessionId: snapshot.track.projectSessionId,
                enabled:
                  editorUsable && (runtimeStatus.playbackRunning || runtimeStatus.blueLiveRunning),
                performanceKind: runtimeStatus.playbackRunning ? 'timeline' : 'blueLive',
              }
            : undefined
        }
        onEditorUsable={handleEditorUsable}
        embeddedUdoTarget={{
          projectSessionId: snapshot.track.projectSessionId,
          projectRevision: snapshot.track.projectRevision,
          track: {
            rootGroupId: snapshot.track.rootGroupId,
            trackId: snapshot.track.trackId,
          },
        }}
      />
    </div>
  );
}
