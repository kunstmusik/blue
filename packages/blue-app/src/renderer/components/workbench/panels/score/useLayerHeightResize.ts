import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ProjectDocumentPatch,
  ScoreLayerGroupSnapshot,
  SetLayerHeightsPatch,
  SetLayerGroupDefaultHeightPatch,
} from '../../../../../shared/project-editor';
import {
  MIN_LAYER_HEIGHT,
  MAX_LAYER_HEIGHT,
  resolveLayerHeightTargets,
  type LayerHeightTargetResolution,
  type VisibleLayerRef,
} from './layer-selection-utils';
import { getProjectDocumentId, useProjectStore } from '../../../../stores/project-store';
import { registerHistoryEditorSettlement } from '../../../../lib/history-scope-router';

export type LayerHeightResizePhase = 'idle' | 'previewing' | 'awaitingCommit';

export interface UseLayerHeightResizeParams {
  layerGroups: ScoreLayerGroupSnapshot[];
  scopeGroupId: string | null;
  projectSessionId: number;
  projectRevision: number;
  visibleLayers?: VisibleLayerRef[];
  selectedKeys?: Set<string>;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  hostDocument?: Document | null;
}

export interface LayerHeightResizeTarget {
  groupId: string;
  layerIndex: number;
  layerSelectionId: string;
  layerId: string;
  initialHeight: number;
  layerName: string;
}

export interface LayerHeightResizeState {
  phase: LayerHeightResizePhase;
  activeTargets: LayerHeightResizeTarget[];
  activeTarget: LayerHeightResizeTarget | null;
  currentDelta: number;
  projectedHeights: Map<string, number>;
}

export interface LayerHeightCommandTarget {
  groupId: string;
  layerIndex: number;
  layerSelectionId: string;
  layerId?: string;
}

export interface LayerHeightCommandFence {
  documentId: string | null;
  sessionId: number;
  revision: number;
  scopeGroupId: string | null;
  targets: LayerHeightCommandTarget[];
  groupId?: string;
  operationId: string;
  hostDocument: Document | null;
}

export type LayerHeightCommandParams =
  | {
      kind: 'layers';
      updates: Array<LayerHeightCommandTarget & { height: number | 'default' }>;
      label: string;
      revision?: number;
      hostDocument?: Document | null;
      fence?: LayerHeightCommandFence | null;
    }
  | {
      kind: 'group-default';
      groupId: string;
      defaultHeightIndex: number;
      label: string;
      revision?: number;
      hostDocument?: Document | null;
      fence?: LayerHeightCommandFence | null;
    };

export interface StartResizeResult {
  ok: boolean;
  disabledReason?: string;
  activeTargets?: LayerHeightResizeTarget[];
}

export function useLayerHeightResize({
  layerGroups,
  scopeGroupId,
  projectSessionId,
  projectRevision,
  visibleLayers = [],
  selectedKeys,
  scrollContainerRef,
  hostDocument,
}: UseLayerHeightResizeParams) {
  const [phase, setPhase] = useState<LayerHeightResizePhase>('idle');
  const [activeTargets, setActiveTargets] = useState<LayerHeightResizeTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<LayerHeightResizeTarget | null>(null);
  const [currentDelta, setCurrentDelta] = useState<number>(0);
  const [projectedHeights, setProjectedHeights] = useState<Map<string, number>>(() => new Map());

  const capturedFenceRef = useRef<{
    revision: number;
    sessionId: number;
    scopeGroupId: string | null;
    targets: LayerHeightResizeTarget[];
    startY: number;
    hostWindow: Window | null;
    hostDocument: Document | null;
    documentId: string | null;
    operationId: string;
  } | null>(null);

  const pendingCommitPromiseRef = useRef<Promise<void> | null>(null);
  const latestVisibleLayersRef = useRef(visibleLayers);
  latestVisibleLayersRef.current = visibleLayers;
  const latestLayerGroupsRef = useRef(layerGroups);
  latestLayerGroupsRef.current = layerGroups;
  const latestScopeGroupIdRef = useRef(scopeGroupId);
  latestScopeGroupIdRef.current = scopeGroupId;
  const latestProjectSessionIdRef = useRef(projectSessionId);
  latestProjectSessionIdRef.current = projectSessionId;
  const hostDocumentRef = useRef(hostDocument);
  hostDocumentRef.current = hostDocument;

  const pendingClientYRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);
  const refreshCanonicalSnapshot = useProjectStore((s) => s.refreshCanonicalSnapshot);

  const getCurrentRevision = useCallback(
    () => useProjectStore.getState().getProjectDocumentRevision?.() ?? projectRevision,
    [projectRevision],
  );

  const getHostDocument = useCallback(
    (hostWindow?: Window | null): Document | null =>
      hostDocumentRef.current ??
      hostWindow?.document ??
      (typeof document !== 'undefined' ? document : null),
    [],
  );

  const createOperationId = useCallback(
    () =>
      `layer-height-${
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      }`,
    [],
  );

  const targetsMatchCurrentRows = useCallback((targets: LayerHeightCommandFence['targets']) => {
    const current = latestVisibleLayersRef.current;
    return targets.every((target) => {
      const row = current.find(
        (candidate) =>
          candidate.groupId === target.groupId && candidate.localIndex === target.layerIndex,
      );
      return (
        row?.layerSelectionId === target.layerSelectionId &&
        (target.layerId === undefined || row.layerId === target.layerId)
      );
    });
  }, []);

  const groupMatchesCurrentScope = useCallback((groupId: string) => {
    return latestLayerGroupsRef.current.some((group) => group.groupId === groupId);
  }, []);

  const fenceIsCurrent = useCallback(
    (fence: {
      revision: number;
      sessionId: number;
      scopeGroupId: string | null;
      targets: LayerHeightCommandTarget[];
      groupId?: string;
      hostDocument: Document | null;
      documentId: string | null;
    }) => {
      const currentHostDocument = getHostDocument();
      return (
        fence.documentId === getProjectDocumentId() &&
        fence.sessionId === useProjectStore.getState().sessionId &&
        fence.revision === getCurrentRevision() &&
        fence.scopeGroupId === latestScopeGroupIdRef.current &&
        (fence.groupId === undefined || groupMatchesCurrentScope(fence.groupId)) &&
        (fence.hostDocument === null ||
          currentHostDocument === null ||
          fence.hostDocument === currentHostDocument) &&
        targetsMatchCurrentRows(fence.targets)
      );
    },
    [getCurrentRevision, getHostDocument, groupMatchesCurrentScope, targetsMatchCurrentRows],
  );

  const finishResize = useCallback(() => {
    capturedFenceRef.current = null;
    setPhase('idle');
    setActiveTargets([]);
    setActiveTarget(null);
    setCurrentDelta(0);
    setProjectedHeights(new Map());
  }, []);

  const cancelResize = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingClientYRef.current = null;

    if (scrollContainerRef?.current) {
      scrollContainerRef.current.style.overflowAnchor = '';
    }

    finishResize();
  }, [finishResize, scrollContainerRef]);

  // Cancel preview if active score path / scopeGroupId changes or session reset occurs.
  useEffect(() => {
    if (phase === 'previewing') {
      cancelResize();
    }
  }, [scopeGroupId, projectSessionId, cancelResize]);

  useEffect(() => {
    if (phase !== 'previewing') return;
    const fence = capturedFenceRef.current;
    if (!fence || fenceIsCurrent(fence)) return;
    cancelResize();
    void refreshCanonicalSnapshot();
  }, [
    phase,
    projectRevision,
    hostDocument,
    visibleLayers,
    fenceIsCurrent,
    cancelResize,
    refreshCanonicalSnapshot,
  ]);

  // Register with history settlement router for both the live preview and the
  // submitted-but-not-yet-acknowledged commit. History commands may proceed
  // only after the latter has settled.
  useEffect(() => {
    if (phase === 'idle') return;
    const hostDoc = capturedFenceRef.current?.hostDocument ?? getHostDocument();
    if (!hostDoc) return;
    return registerHistoryEditorSettlement(hostDoc, () => {
      if (phase === 'previewing') {
        cancelResize();
        return;
      }
      return pendingCommitPromiseRef.current ?? undefined;
    });
  }, [phase, cancelResize, getHostDocument]);

  const startResize = useCallback(
    ({
      clientY,
      groupId,
      layerIndex,
      layerSelectionId,
      hostWindow = window,
    }: {
      clientY: number;
      groupId: string;
      layerIndex: number;
      layerSelectionId: string;
      hostWindow?: Window;
    }): StartResizeResult => {
      // Disallow starting a new resize if already in flight
      if (phase !== 'idle') {
        return { ok: false, disabledReason: 'Resize already in progress' };
      }

      const resolution: LayerHeightTargetResolution = resolveLayerHeightTargets({
        clickedGroupId: groupId,
        clickedLayerIndex: layerIndex,
        clickedLayerSelectionId: layerSelectionId,
        visibleLayers,
        selectedKeys,
      });

      if (!resolution.ok || resolution.targets.length === 0) {
        return { ok: false, disabledReason: resolution.disabledReason };
      }

      const targets: LayerHeightResizeTarget[] = resolution.targets.map((t) => ({
        groupId: t.groupId,
        layerIndex: t.layerIndex,
        layerSelectionId: t.layerSelectionId,
        layerId: t.layerId,
        initialHeight: t.initialHeight,
        layerName: t.layerName,
      }));

      const revision = getCurrentRevision();
      const resolvedHostDocument = getHostDocument(hostWindow);

      capturedFenceRef.current = {
        revision,
        sessionId: projectSessionId,
        scopeGroupId,
        targets,
        startY: clientY,
        hostWindow,
        hostDocument: resolvedHostDocument,
        documentId: getProjectDocumentId(),
        operationId: createOperationId(),
      };

      if (scrollContainerRef?.current) {
        scrollContainerRef.current.style.overflowAnchor = 'none';
      }

      const initialMap = new Map<string, number>();
      for (const t of targets) {
        initialMap.set(`${t.groupId}:${t.layerIndex}`, t.initialHeight);
      }

      setActiveTargets(targets);
      setActiveTarget(
        targets.find((target) => target.groupId === groupId && target.layerIndex === layerIndex) ??
          targets[0]!,
      );
      setCurrentDelta(0);
      setProjectedHeights(initialMap);
      setPhase('previewing');

      return { ok: true, activeTargets: targets };
    },
    [
      phase,
      visibleLayers,
      selectedKeys,
      getCurrentRevision,
      getHostDocument,
      createOperationId,
      projectRevision,
      projectSessionId,
      scopeGroupId,
      scrollContainerRef,
    ],
  );

  const captureCommandFence = useCallback(
    (
      targets: LayerHeightCommandFence['targets'],
      revision = getCurrentRevision(),
      groupId?: string,
      commandHostDocument = getHostDocument(),
    ): LayerHeightCommandFence | null => {
      if (
        (targets.length === 0 && groupId === undefined) ||
        (targets.length > 0 && !targetsMatchCurrentRows(targets)) ||
        (groupId !== undefined && !groupMatchesCurrentScope(groupId))
      )
        return null;
      return {
        documentId: getProjectDocumentId(),
        sessionId: projectSessionId,
        revision,
        scopeGroupId,
        targets: targets.map((target) => ({ ...target })),
        ...(groupId !== undefined ? { groupId } : {}),
        operationId: createOperationId(),
        hostDocument: commandHostDocument,
      };
    },
    [
      createOperationId,
      getCurrentRevision,
      getHostDocument,
      groupMatchesCurrentScope,
      projectSessionId,
      scopeGroupId,
      targetsMatchCurrentRows,
    ],
  );

  const commitHeightCommand = useCallback(
    async (command: LayerHeightCommandParams) => {
      const targets =
        command.kind === 'layers'
          ? command.updates.map(({ height: _height, ...target }) => target)
          : [];
      const commandFence =
        command.fence ??
        captureCommandFence(
          targets,
          command.revision ?? getCurrentRevision(),
          command.kind === 'group-default' ? command.groupId : undefined,
          command.hostDocument,
        );

      if (!commandFence || !fenceIsCurrent(commandFence)) {
        await refreshCanonicalSnapshot();
        return;
      }

      const patch: ProjectDocumentPatch = {
        score:
          command.kind === 'layers'
            ? ({
                type: 'setLayerHeights',
                scopeGroupId: commandFence.scopeGroupId,
                updates: command.updates.map(({ layerId: _layerId, ...update }) => update),
              } satisfies SetLayerHeightsPatch)
            : ({
                type: 'setLayerGroupDefaultHeight',
                scopeGroupId: commandFence.scopeGroupId,
                groupId: command.groupId,
                defaultHeightIndex: command.defaultHeightIndex,
              } satisfies SetLayerGroupDefaultHeightPatch),
      };

      try {
        await flushPendingPatches();

        if (!fenceIsCurrent(commandFence)) {
          await refreshCanonicalSnapshot();
          return;
        }

        await applyProjectDocumentPatch(patch, {
          label: command.label,
          phase: 'single',
          expectedRevision: commandFence.revision,
          operationId: commandFence.operationId,
        });
        await flushPendingPatches();
      } catch (error) {
        console.error('Failed to commit layer height command:', error);
        await refreshCanonicalSnapshot();
      }
    },
    [
      applyProjectDocumentPatch,
      captureCommandFence,
      fenceIsCurrent,
      flushPendingPatches,
      getCurrentRevision,
      refreshCanonicalSnapshot,
    ],
  );

  const updateResize = useCallback((clientY: number) => {
    const fence = capturedFenceRef.current;
    if (!fence) return;

    pendingClientYRef.current = clientY;

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const latestY = pendingClientYRef.current;
        if (latestY === null || !capturedFenceRef.current) return;

        const delta = Math.round(latestY - capturedFenceRef.current.startY);
        setCurrentDelta(delta);

        const nextMap = new Map<string, number>();
        for (const t of capturedFenceRef.current.targets) {
          const newHeight =
            delta === 0
              ? t.initialHeight
              : Math.max(
                  MIN_LAYER_HEIGHT,
                  Math.min(MAX_LAYER_HEIGHT, Math.round(t.initialHeight + delta)),
                );
          nextMap.set(`${t.groupId}:${t.layerIndex}`, newHeight);
        }
        setProjectedHeights(nextMap);
      });
    }
  }, []);

  const performCommitResize = useCallback(
    async (clientY: number) => {
      const fence = capturedFenceRef.current;
      if (!fence) {
        cancelResize();
        return;
      }

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (scrollContainerRef?.current) {
        scrollContainerRef.current.style.overflowAnchor = '';
      }

      const delta = Math.round(clientY - fence.startY);
      const targets = fence.targets;
      const capturedRev = fence.revision;
      const capturedScopeGroupId = fence.scopeGroupId;

      if (delta === 0) {
        // A no-motion gesture must preserve even legacy heights outside the
        // editable range and must not create a history entry.
        cancelResize();
        return;
      }

      const finalHeights = targets.map((t) =>
        Math.max(MIN_LAYER_HEIGHT, Math.min(MAX_LAYER_HEIGHT, Math.round(t.initialHeight + delta))),
      );

      const hasChange = targets.some((t, i) => finalHeights[i] !== t.initialHeight);
      if (!hasChange) {
        // No-op gesture: return directly to idle without history entry
        cancelResize();
        return;
      }

      setCurrentDelta(delta);
      setProjectedHeights(
        new Map(
          targets.map((target, index) => [
            `${target.groupId}:${target.layerIndex}`,
            finalHeights[index]!,
          ]),
        ),
      );
      setPhase('awaitingCommit');

      const updates = targets.map((t, i) => ({
        groupId: t.groupId,
        layerIndex: t.layerIndex,
        layerSelectionId: t.layerSelectionId,
        layerId: t.layerId,
        height: finalHeights[i],
      }));

      const commandFence: LayerHeightCommandFence = {
        documentId: fence.documentId,
        sessionId: fence.sessionId,
        revision: capturedRev,
        scopeGroupId: capturedScopeGroupId,
        targets: targets.map(({ groupId, layerIndex, layerSelectionId, layerId }) => ({
          groupId,
          layerIndex,
          layerSelectionId,
          layerId,
        })),
        operationId: fence.operationId,
        hostDocument: fence.hostDocument,
      };

      try {
        await commitHeightCommand({
          kind: 'layers',
          updates,
          label: targets.length > 1 ? 'Resize Selected Layers' : 'Resize Layer',
          fence: commandFence,
        });
      } finally {
        finishResize();
      }
    },
    [cancelResize, commitHeightCommand, finishResize, scrollContainerRef],
  );

  const commitResize = useCallback(
    (clientY: number) => {
      const promise = performCommitResize(clientY);
      pendingCommitPromiseRef.current = promise;
      void promise.finally(() => {
        if (pendingCommitPromiseRef.current === promise) {
          pendingCommitPromiseRef.current = null;
        }
      });
      return promise;
    },
    [performCommitResize],
  );

  const commitAbsoluteHeight = useCallback(
    async ({
      targets,
      height,
      label,
      fence,
      revision,
      hostDocument,
    }: {
      targets: LayerHeightCommandTarget[];
      height: number | 'default';
      label: string;
      fence?: LayerHeightCommandFence | null;
      revision?: number;
      hostDocument?: Document | null;
    }) => {
      if (targets.length === 0) return;
      await commitHeightCommand({
        kind: 'layers',
        updates: targets.map((target) => ({ ...target, height })),
        label,
        fence,
        revision,
        hostDocument,
      });
    },
    [commitHeightCommand],
  );

  // Host-window and scroll listeners during preview
  useEffect(() => {
    if (phase !== 'previewing') return;

    const fence = capturedFenceRef.current;
    const hostDoc = fence?.hostDocument ?? getHostDocument(fence?.hostWindow);
    const hostWin = fence?.hostWindow ?? hostDoc?.defaultView ?? window;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelResize();
      }
    };

    const handleBlur = () => {
      cancelResize();
    };

    const handleScroll = () => {
      cancelResize();
    };

    const handleHostGeometryChange = () => {
      cancelResize();
    };

    hostWin.addEventListener('keydown', handleKeyDown);
    hostWin.addEventListener('blur', handleBlur);
    hostWin.addEventListener('resize', handleHostGeometryChange);
    hostWin.addEventListener('pagehide', handleHostGeometryChange);
    hostWin.addEventListener('beforeunload', handleHostGeometryChange);
    hostWin.visualViewport?.addEventListener('resize', handleHostGeometryChange);

    hostDoc?.addEventListener('scroll', handleScroll, true);

    const scrollEl = scrollContainerRef?.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleScroll);
    }

    return () => {
      hostWin.removeEventListener('keydown', handleKeyDown);
      hostWin.removeEventListener('blur', handleBlur);
      hostWin.removeEventListener('resize', handleHostGeometryChange);
      hostWin.removeEventListener('pagehide', handleHostGeometryChange);
      hostWin.removeEventListener('beforeunload', handleHostGeometryChange);
      hostWin.visualViewport?.removeEventListener('resize', handleHostGeometryChange);
      hostDoc?.removeEventListener('scroll', handleScroll, true);
      if (scrollEl) {
        scrollEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, [phase, cancelResize, getHostDocument, scrollContainerRef]);

  // Projected layer groups memo
  const projectedLayerGroups = useMemo(() => {
    if (phase === 'idle' || projectedHeights.size === 0) {
      return layerGroups;
    }

    return layerGroups.map((group) => {
      let groupChanged = false;
      const nextLayers = group.layers.map((layer, index) => {
        const projected = projectedHeights.get(`${group.groupId}:${index}`);
        if (projected !== undefined && projected !== layer.height) {
          groupChanged = true;
          return { ...layer, height: projected };
        }
        return layer;
      });
      if (!groupChanged) return group;
      return { ...group, layers: nextLayers };
    });
  }, [layerGroups, phase, projectedHeights]);

  return {
    phase,
    activeTargets,
    currentDelta,
    projectedHeights,
    activeTarget,
    projectedLayerGroups,
    startResize,
    updateResize,
    commitResize,
    cancelResize,
    commitAbsoluteHeight,
    commitHeightCommand,
    captureCommandFence,
  };
}

export interface LayerHeightResizeContextValue {
  phase: LayerHeightResizePhase;
  activeTargets: LayerHeightResizeTarget[];
  activeTarget: LayerHeightResizeTarget | null;
  projectedHeights: Map<string, number>;
  startResize: (params: {
    clientY: number;
    groupId: string;
    layerIndex: number;
    layerSelectionId: string;
    hostWindow?: Window;
  }) => StartResizeResult;
  updateResize: (clientY: number) => void;
  commitResize: (clientY: number) => Promise<void>;
  cancelResize: () => void;
  commitAbsoluteHeight: (params: {
    targets: LayerHeightCommandTarget[];
    height: number | 'default';
    label: string;
    fence?: LayerHeightCommandFence | null;
    revision?: number;
    hostDocument?: Document | null;
  }) => Promise<void>;
  commitHeightCommand: (params: LayerHeightCommandParams) => Promise<void>;
  captureCommandFence: (
    targets: LayerHeightCommandFence['targets'],
    revision?: number,
    groupId?: string,
    hostDocument?: Document | null,
  ) => LayerHeightCommandFence | null;
}

import React from 'react';
export const LayerHeightResizeContext = React.createContext<LayerHeightResizeContextValue | null>(
  null,
);

export function useLayerHeightResizeContext(): LayerHeightResizeContextValue | null {
  return React.useContext(LayerHeightResizeContext);
}
