// @vitest-environment jsdom

import { vi } from 'vitest';

/**
 * Stub `window.blueAPI` so renderer code can import the MIDI surface without
 * loading Electron's preload. Tests extend this object as needed.
 */
const callbacks = new Map<string, Set<(payload: unknown) => void>>();

window.blueAPI = {
  initializeMidiInputService: vi.fn(async () => ({
    preferences: { devices: [] },
    cachedSnapshot: null,
  })),
  reportMidiInputServiceSnapshot: vi.fn(),
  acknowledgeMidiInputCommand: vi.fn(),
  onMidiInputServiceCommand: vi.fn((cb) => {
    const set = callbacks.get('command') ?? new Set();
    set.add(cb as (payload: unknown) => void);
    callbacks.set('command', set);
    return () => {
      set.delete(cb as (payload: unknown) => void);
    };
  }),
  getMidiInputServiceSnapshot: vi.fn(async () => null),
  requestMidiInputRescan: vi.fn(async () => ({ accepted: true })),
  onMidiInputServiceSnapshot: vi.fn((cb) => {
    const set = callbacks.get('snapshot') ?? new Set();
    set.add(cb as (payload: unknown) => void);
    callbacks.set('snapshot', set);
    return () => {
      set.delete(cb as (payload: unknown) => void);
    };
  }),
  onProjectRuntimeOutcome: vi.fn((_cb) => () => {}),
} as unknown as typeof window.blueAPI;

export interface MockHistoryBoundaryEvent {
  barrierId: string;
  reason: string;
}

export interface MockHistoryAck {
  barrierId: string;
  contextId: string;
  lastAcknowledgedRevision: number;
  lastAcknowledgedSequence: number;
  outstandingPrefixCount: number;
}

export interface MockHistoryCommitRequest {
  documentId: string;
  operationId: string;
  expectedRevision: number;
  contextSequence: number;
  label: string;
  patches?: unknown[];
  barrierId?: string;
}

export interface MockProjectHistoryBridge {
  /** Canonical publications received from main. */
  documentUpdatedEvents: Array<Record<string, unknown>>;
  /** Boundary acknowledgements sent by participating views. */
  acks: MockHistoryAck[];
  /** Patch batches committed through the legacy bridge. */
  commits: Array<{ patches: unknown[]; metadata?: Record<string, unknown> }>;
  /** Emits a prepare-history-boundary to every subscribed view. */
  dispatchPrepareBoundary(event: MockHistoryBoundaryEvent): void;
  /** Emits a release-history-boundary to every subscribed view. */
  dispatchReleaseBoundary(event: {
    barrierId: string;
    status: 'ready' | 'aborted';
    reason?: string;
  }): void;
  /** Emits a project-document-updated publication to every subscribed view. */
  dispatchDocumentUpdated(event: Record<string, unknown>): void;
}

/**
 * Installs the project-history surface on `window.blueAPI` for two-document
 * settlement tests. The undo command resolves only after the test drives the
 * prepare → prefix-drain → acknowledge → release settlement sequence.
 */
export function installMockProjectHistoryBridge(options?: {
  revision?: number;
}): MockProjectHistoryBridge {
  const bridge: MockProjectHistoryBridge = {
    documentUpdatedEvents: [],
    acks: [],
    commits: [],
    dispatchPrepareBoundary(event) {
      for (const cb of boundaryListeners.get('prepare') ?? []) {
        cb(event);
      }
    },
    dispatchReleaseBoundary(event) {
      for (const cb of boundaryListeners.get('release') ?? []) {
        cb(event);
      }
    },
    dispatchDocumentUpdated(event) {
      bridge.documentUpdatedEvents.push(event);
      for (const cb of documentUpdatedListeners) {
        cb(event);
      }
    },
  };

  const boundaryListeners = new Map<string, Set<(event: unknown) => void>>();
  const documentUpdatedListeners = new Set<(event: unknown) => void>();
  let revision = options?.revision ?? 0;

  const currentBlueApi = window.blueAPI as Record<string, unknown>;
  currentBlueApi.registerHistoryParticipant = vi.fn(async () => ({ ok: true }));
  currentBlueApi.unregisterHistoryParticipant = vi.fn(async () => undefined);
  currentBlueApi.acknowledgeHistoryBoundary = vi.fn(async (ack: MockHistoryAck) => {
    bridge.acks.push(ack);
  });
  currentBlueApi.commitProjectDocumentPatches = vi.fn(
    async (patches: unknown[], metadata?: Record<string, unknown>) => {
      bridge.commits.push({ patches, metadata });
      revision += 1;
      return { changed: true, revision, sessionId: 7 };
    },
  );
  currentBlueApi.undoProjectHistory = vi.fn(
    (request: { documentId: string; operationId: string }) =>
      new Promise((resolve) => {
        const barrierId = `barrier-for-${request.operationId}`;
        bridge.dispatchPrepareBoundary({ barrierId, reason: 'undo' });
        // Resolve once every participating view acknowledged the barrier.
        const check = vi.fn(() => {
          const allSettled = bridge.acks.some((ack) => ack.barrierId === barrierId);
          if (!allSettled) {
            setTimeout(check, 5);
            return;
          }
          bridge.dispatchReleaseBoundary({ barrierId, status: 'ready' });
          revision += 1;
          resolve({
            status: 'committed',
            operationId: request.operationId,
            documentId: request.documentId,
            revision,
            stateId: `state-${revision}`,
            isDirty: true,
            history: {
              canUndo: true,
              canRedo: false,
              undoLabel: null,
              redoLabel: null,
              cursor: revision,
              length: revision,
              retainedBytes: 0,
              savedStateId: null,
              stateId: `state-${revision}`,
            },
          });
        });
        setTimeout(check, 5);
      }),
  );
  currentBlueApi.onPrepareHistoryBoundary = vi.fn((cb: (event: unknown) => void) => {
    const set = boundaryListeners.get('prepare') ?? new Set();
    set.add(cb);
    boundaryListeners.set('prepare', set);
    return () => {
      set.delete(cb);
    };
  });
  currentBlueApi.onReleaseHistoryBoundary = vi.fn((cb: (event: unknown) => void) => {
    const set = boundaryListeners.get('release') ?? new Set();
    set.add(cb);
    boundaryListeners.set('release', set);
    return () => {
      set.delete(cb);
    };
  });
  currentBlueApi.onProjectDocumentUpdated = vi.fn((cb: (event: unknown) => void) => {
    documentUpdatedListeners.add(cb);
    return () => {
      documentUpdatedListeners.delete(cb);
    };
  });

  return bridge;
}
