import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createBsbRealtimeControlUpdate,
  type InstrumentPatch,
  type OrchestraPatch,
  type TrackInstrumentEditorRequest,
  type TrackInstrumentEditorSnapshot,
} from '../../../shared/project-editor';
import {
  isNewerTrackInstrumentRuntimeStatus,
  type TrackInstrumentRuntimeStatus,
} from '../../../shared/track-instrument-editor-contract';
import InstrumentEditorPanel from '../workbench/panels/orchestra/InstrumentEditorPanel';
import { useLibraryStore } from '../../stores/library-store';
import {
  mergePendingInstrumentPatch,
  toInstrumentPatch,
} from './track-instrument-patch-queue';

function closeWindow(): void {
  window.close();
}

const INACTIVE_RUNTIME_STATUS: TrackInstrumentRuntimeStatus = {
  sequence: 0,
  playbackRunning: false,
  blueLiveRunning: false,
};

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
  if (!Number.isInteger(projectSessionId) || projectSessionId < 0
    || !Number.isInteger(projectRevision) || projectRevision < 0) {
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
    (candidate) => candidate.groupType === 'track' && candidate.groupId === request.track.rootGroupId,
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
  const [runtimeStatus, setRuntimeStatus] = useState<TrackInstrumentRuntimeStatus>(INACTIVE_RUNTIME_STATUS);
  const [error, setError] = useState<string | null>(parsedRequest ? null : 'Missing Track instrument editor request');
  const requestRef = useRef<TrackInstrumentEditorRequest | null>(parsedRequest);
  const runtimeStatusSequenceRef = useRef<number | null>(null);
  const runtimeUnsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  const pendingPatchesRef = useRef<InstrumentPatch[]>([]);
  const drainingPatchesRef = useRef(false);
  const mountedRef = useRef(true);
  const editorIdentityRef = useRef<string | null>(null);

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
    if (current
      && current.track.projectSessionId === next.track.projectSessionId
      && current.track.projectRevision > next.track.projectRevision) {
      return;
    }
    requestRef.current = { track: next.track };
    if (!mountedRef.current) return;
    setSnapshot(next);
    setError(null);
    document.title = `${next.instrument.name || 'Track Instrument'} - Track Instrument Editor`;
  }, []);

  const acceptRuntimeStatus = useCallback((next: TrackInstrumentRuntimeStatus) => {
    const previous = runtimeStatusSequenceRef.current === null
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
    }).then((subscription) => {
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
    }).catch(() => {
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
    return window.blueAPI.onProjectDocumentUpdated((event) => {
      const currentRequest = requestRef.current ?? parsedRequest;
      const next = projectSnapshotToTrackInstrument(currentRequest, event);
      if (!next) {
        setError('The Track instrument is no longer available.');
        return;
      }
      acceptSnapshot(next);
    });
  }, [acceptSnapshot, parsedRequest]);

  const persistPatch = useCallback(async (patch: InstrumentPatch): Promise<boolean> => {
    while (requestRef.current) {
      const result = await window.blueAPI.updateTrackInstrumentEditorDocument({
        ...requestRef.current,
        patch,
      });
      if (!result.snapshot || result.status === 'unavailable') {
        if (mountedRef.current) setError('The Track instrument is no longer available.');
        return false;
      }

      acceptSnapshot(result.snapshot);
      if (result.status !== 'stale') return true;
    }
    return false;
  }, [acceptSnapshot]);

  const drainPatchQueue = useCallback(async () => {
    if (drainingPatchesRef.current) return;
    drainingPatchesRef.current = true;

    try {
      while (pendingPatchesRef.current.length > 0) {
        const persisted = await persistPatch(pendingPatchesRef.current.shift()!);
        if (!persisted) {
          pendingPatchesRef.current = [];
          break;
        }
      }
    } catch (patchError) {
      console.error('[track-instrument-editor] Failed to save instrument patch:', patchError);
      pendingPatchesRef.current = [];
      if (mountedRef.current) {
        setError('Unable to save the Track instrument change.');
      }
    } finally {
      drainingPatchesRef.current = false;
    }
  }, [persistPatch]);

  const applyPatch = useCallback((patch: OrchestraPatch) => {
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
        void window.blueAPI.sendBsbRealtimeControlUpdate(realtimeUpdate).catch((realtimeError) => {
          console.error('[track-instrument-editor] Failed to send realtime control update:', realtimeError);
        });
      }
    }

    const pending = pendingPatchesRef.current;
    const previous = pending[pending.length - 1];
    const merged = previous ? mergePendingInstrumentPatch(previous, instrumentPatch) : null;
    if (merged) {
      pending[pending.length - 1] = merged;
    } else {
      pending.push(instrumentPatch);
    }
    void drainPatchQueue();
  }, [drainPatchQueue]);

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
        blueX7Runtime={snapshot.instrument.type === 'blueX7' ? {
          target: {
            track: {
              projectSessionId: snapshot.track.projectSessionId,
              rootGroupId: snapshot.track.rootGroupId,
              trackId: snapshot.track.trackId,
            },
          },
          projectSessionId: snapshot.track.projectSessionId,
          enabled: editorUsable
            && (runtimeStatus.playbackRunning || runtimeStatus.blueLiveRunning),
        } : undefined}
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
