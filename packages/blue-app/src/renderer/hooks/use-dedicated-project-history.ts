import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import type {
  PrepareHistoryBoundaryEvent,
  ProjectDocumentCommitMetadata,
  ProjectHistorySelectionHint,
  ProjectHistoryStateProjection,
  ReleaseHistoryBoundaryEvent,
} from '../../shared/project-history';
import type { NativeMenuCommand } from '../../shared/workbench-menu';
import {
  dispatchHistoryAction,
  flushFocusedProjectEditor,
  publishFocusedHistoryAvailability,
  resolveHistoryScope,
  settleHistoryEditors,
} from '../lib/history-scope-router';
import { setProjectHistoryProjection } from './use-project-history';

export interface DedicatedHistoryDrainResult {
  outstandingPrefixCount: number;
  failedPrefixCount: number;
  unresolvedPrefixCount: number;
}

export interface DedicatedProjectHistoryClient {
  contextId: string;
  isPaused(): boolean;
  getDocumentIdentity(): string | null;
  getRevision(): number;
  setRevision(revision: number): void;
  setDocumentIdentity(documentId: string | null, revision?: number): void;
  nextContext(
    metadata?: Pick<
      ProjectDocumentCommitMetadata,
      'label' | 'gestureId' | 'fieldId' | 'phase' | 'origin'
    >,
  ): {
    contextId: string;
    contextSequence: number;
    expectedRevision?: number;
    operationId: string;
    label?: string;
    gestureId?: string;
    fieldId?: string;
    phase?: ProjectDocumentCommitMetadata['phase'];
    viewId: string;
    selection?: ProjectHistorySelectionHint[];
    barrierId?: string;
  };
}

interface DedicatedHistoryState {
  contextId: string;
  contextSequence: number;
  documentId: string | null;
  revision: number;
  paused: boolean;
  activeBarrierId: string | null;
  boundaryDrain: Promise<DedicatedHistoryDrainResult> | null;
  registered: boolean;
}

interface DedicatedProjectHistoryOptions {
  viewId: string;
  /** Pass true only for the already-captured prefix during a boundary. */
  drain: (allowPaused?: boolean) => Promise<DedicatedHistoryDrainResult | void>;
  enabled?: boolean;
}

function getRevisionFromHistoryResult(result: unknown): number | undefined {
  if (!result || typeof result !== 'object' || 'status' in result) return undefined;
  const revision = (result as { revision?: unknown }).revision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0
    ? revision
    : undefined;
}

function isUndoRedoCommand(command: NativeMenuCommand): command is { type: 'undo' | 'redo' } {
  return command.type === 'undo' || command.type === 'redo';
}

function normalizeDrainResult(
  result: DedicatedHistoryDrainResult | void,
): DedicatedHistoryDrainResult {
  return {
    outstandingPrefixCount: result?.outstandingPrefixCount ?? 0,
    failedPrefixCount: result?.failedPrefixCount ?? 0,
    unresolvedPrefixCount: result?.unresolvedPrefixCount ?? 0,
  };
}

/**
 * Gives an OS-level editor window its own trusted history participant. The
 * page supplies a drain function so the boundary can pause new input, settle
 * queued editor work, and acknowledge the exact prefix before undo/redo runs.
 */
export function useDedicatedProjectHistory(
  options: DedicatedProjectHistoryOptions,
): DedicatedProjectHistoryClient {
  const stateRef = useRef<DedicatedHistoryState | null>(null);
  if (!stateRef.current) {
    stateRef.current = {
      contextId: `dedicated-${crypto.randomUUID()}`,
      contextSequence: 0,
      documentId: null,
      revision: 0,
      paused: false,
      activeBarrierId: null,
      boundaryDrain: null,
      registered: false,
    };
  }

  const drainRef = useRef(options.drain);
  const viewIdRef = useRef(options.viewId);
  const projectHistoryProjectionRef = useRef<ProjectHistoryStateProjection | null>(null);
  drainRef.current = options.drain;
  viewIdRef.current = options.viewId;

  const setDocumentIdentity = useCallback((documentId: string | null, revision?: number) => {
    const state = stateRef.current!;
    if (documentId !== null && state.documentId !== documentId) {
      state.documentId = documentId;
      state.revision = 0;
    }
    if (revision !== undefined && Number.isSafeInteger(revision) && revision >= 0) {
      state.revision = Math.max(state.revision, revision);
    }
  }, []);

  const nextContext = useCallback(
    (
      metadata?: Pick<
        ProjectDocumentCommitMetadata,
        'label' | 'gestureId' | 'fieldId' | 'phase' | 'origin'
      >,
    ) => {
      const state = stateRef.current!;
      state.contextSequence += 1;
      return {
        contextId: state.contextId,
        contextSequence: state.contextSequence,
        expectedRevision: state.documentId ? state.revision : undefined,
        operationId: `history-${crypto.randomUUID()}`,
        label: metadata?.label,
        gestureId: metadata?.gestureId,
        fieldId: metadata?.fieldId,
        phase: metadata?.phase,
        viewId: metadata?.origin?.viewId ?? viewIdRef.current,
        selection: metadata?.origin?.selection,
        barrierId: state.activeBarrierId ?? undefined,
      };
    },
    [],
  );

  const isPaused = useCallback(() => stateRef.current!.paused, []);
  const getDocumentIdentity = useCallback(() => stateRef.current!.documentId, []);
  const getRevision = useCallback(() => stateRef.current!.revision, []);
  const setRevision = useCallback((revision: number) => {
    if (Number.isSafeInteger(revision) && revision >= 0) {
      stateRef.current!.revision = Math.max(stateRef.current!.revision, revision);
    }
  }, []);

  useEffect(() => {
    if (options.enabled === false) return undefined;
    const api = window.blueAPI;
    const state = stateRef.current!;
    let disposed = false;

    const acceptProjection = (
      projection: ProjectHistoryStateProjection,
      documentId: string,
      revision: number,
      publish = true,
    ): boolean => {
      if (disposed || state.documentId !== documentId || revision < state.revision) return false;
      setDocumentIdentity(documentId, revision);
      projectHistoryProjectionRef.current = projection;
      setProjectHistoryProjection(projection);
      if (publish) publishFocusedHistoryAvailability(projection, window.document);
      return true;
    };

    const register = async (): Promise<void> => {
      if (typeof api.getProjectDocument !== 'function') return;
      const snapshot = await api.getProjectDocument();
      if (disposed || !snapshot?.documentId) return;

      const documentId = snapshot.documentId;
      setDocumentIdentity(documentId);
      if (typeof api.readProjectHistory === 'function') {
        const history = await api.readProjectHistory({ documentId });
        const revision = getRevisionFromHistoryResult(history);
        setDocumentIdentity(documentId, revision);
        if (!('status' in history)) {
          // The initial read seeds the shared projection for this renderer
          // context. Native-menu publication waits for focus or a canonical
          // event, so registration cannot publish stale state over a focused
          // workbench window.
          acceptProjection(history, documentId, revision ?? state.revision, false);
        }
      }
      if (disposed || state.registered || typeof api.registerHistoryParticipant !== 'function') {
        return;
      }

      const response = await api.registerHistoryParticipant({
        contextId: state.contextId,
        documentId,
        acceptedRevision: state.revision,
      });
      if (disposed) return;
      state.registered = response.ok;
      if (response.activeBarrier) {
        startBoundary(response.activeBarrier);
      }
    };

    const executeHistoryCommand = async (command: 'undo' | 'redo'): Promise<void> => {
      if (disposed || state.paused || !state.documentId) return;
      flushFocusedProjectEditor();
      const context = nextContext();
      const request = {
        documentId: state.documentId,
        operationId: context.operationId,
        expectedRevision: state.revision,
        contextSequence: context.contextSequence,
        origin: { contextId: state.contextId, viewId: viewIdRef.current },
      };
      const response =
        command === 'undo'
          ? await api.undoProjectHistory(request)
          : await api.redoProjectHistory(request);
      if (disposed) return;
      if (response.status === 'committed' || response.status === 'unchanged') {
        acceptProjection(response.history, response.documentId, response.revision);
      } else if (response.status === 'stale') {
        setDocumentIdentity(response.documentId, response.currentRevision);
      }
      if (response.status === 'failed') {
        toast.error(`${command === 'undo' ? 'Undo' : 'Redo'} failed: ${response.error}`);
      } else if (response.status === 'invalid') {
        toast.error(`${command === 'undo' ? 'Undo' : 'Redo'} failed: ${response.reason}`);
      }
    };

    const handleNativeMenuCommand = (command: NativeMenuCommand): void => {
      if (!isUndoRedoCommand(command)) return;
      if (resolveHistoryScope(window.document).scope !== 'project') {
        void dispatchHistoryAction(command.type, window.document).catch((error: unknown) => {
          console.error(
            '[dedicated-project-history] Failed to execute local history command:',
            error,
          );
        });
        return;
      }
      void executeHistoryCommand(command.type).catch((error: unknown) => {
        console.error('[dedicated-project-history] Failed to execute history command:', error);
      });
    };

    const handleFocus = (): void => {
      const projection = projectHistoryProjectionRef.current;
      if (projection) publishFocusedHistoryAvailability(projection, window.document);
    };

    const unsubscribeProjectDocumentUpdated =
      typeof api.getProjectDocument === 'function' &&
      typeof api.onProjectDocumentUpdated === 'function'
        ? api.onProjectDocumentUpdated((event) => {
            if (event.documentId !== state.documentId) return;
            acceptProjection(event.history, event.documentId, event.revision);
          })
        : undefined;

    const startBoundary = (
      event: PrepareHistoryBoundaryEvent,
    ): Promise<DedicatedHistoryDrainResult> => {
      if (state.activeBarrierId === event.barrierId && state.boundaryDrain) {
        return state.boundaryDrain;
      }
      state.paused = true;
      state.activeBarrierId = event.barrierId;
      state.boundaryDrain = (async () => {
        let result: DedicatedHistoryDrainResult = {
          outstandingPrefixCount: 0,
          failedPrefixCount: 0,
          unresolvedPrefixCount: 0,
        };
        try {
          await settleHistoryEditors(window.document);
          result = normalizeDrainResult(await drainRef.current(true));
        } catch (error) {
          result = {
            outstandingPrefixCount: 1,
            failedPrefixCount: 1,
            unresolvedPrefixCount: 1,
          };
          console.error('[dedicated-project-history] Failed to drain editor history:', error);
        }
        if (disposed || state.activeBarrierId !== event.barrierId) return result;
        if (typeof api.acknowledgeHistoryBoundary !== 'function') return result;
        const ack = await api.acknowledgeHistoryBoundary({
          barrierId: event.barrierId,
          contextId: state.contextId,
          lastAcknowledgedRevision: state.revision,
          lastAcknowledgedSequence: state.contextSequence,
          ...result,
        });
        if (!ack.ok) {
          console.error(
            '[dedicated-project-history] Boundary acknowledgement rejected:',
            ack.reason,
          );
        }
        return result;
      })();
      return state.boundaryDrain;
    };

    const handleReleaseBoundary = (event: ReleaseHistoryBoundaryEvent): void => {
      if (state.activeBarrierId !== event.barrierId) return;
      state.activeBarrierId = null;
      state.boundaryDrain = null;
      state.paused = false;
      if (event.status === 'ready') {
        void drainRef.current().catch((error: unknown) => {
          console.error('[dedicated-project-history] Failed to resume editor history:', error);
        });
      }
    };

    const unsubscribePrepare =
      typeof api.onPrepareHistoryBoundary === 'function'
        ? api.onPrepareHistoryBoundary((event) => {
            void startBoundary(event);
          })
        : undefined;
    const unsubscribeRelease =
      typeof api.onReleaseHistoryBoundary === 'function'
        ? api.onReleaseHistoryBoundary(handleReleaseBoundary)
        : undefined;
    const unsubscribeNativeMenu =
      typeof api.onNativeMenuCommand === 'function'
        ? api.onNativeMenuCommand(handleNativeMenuCommand)
        : undefined;
    window.addEventListener('focus', handleFocus);
    window.addEventListener('focusin', handleFocus);

    void register().catch((error: unknown) => {
      if (!disposed) {
        console.error('[dedicated-project-history] Failed to register history participant:', error);
      }
    });

    return () => {
      disposed = true;
      unsubscribePrepare?.();
      unsubscribeRelease?.();
      unsubscribeNativeMenu?.();
      unsubscribeProjectDocumentUpdated?.();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('focusin', handleFocus);
      state.paused = false;
      state.activeBarrierId = null;
      state.boundaryDrain = null;
      if (state.registered && typeof api.unregisterHistoryParticipant === 'function') {
        void api
          .unregisterHistoryParticipant({ contextId: state.contextId })
          .catch(() => undefined);
      }
      state.registered = false;
      setProjectHistoryProjection(null);
    };
  }, [nextContext, options.enabled, setDocumentIdentity]);

  return {
    contextId: stateRef.current.contextId,
    isPaused,
    getDocumentIdentity,
    getRevision,
    setRevision,
    setDocumentIdentity,
    nextContext,
  };
}
