import { create } from 'zustand';
import { getProjectDocumentId, useProjectStore } from './project-store';
import type {
  ScoreObjectEditorTargetSnapshot,
  ScoreDocumentSnapshot,
  ScoreRowObjectSnapshot,
  ScoreLayerGroupSnapshot,
} from '../../shared/project-editor';
import type { ProjectHistorySelectionHint } from '../../shared/project-history';

export interface ScoreObjectClipboardEntry {
  objectId: string;
  objectType: string;
  name: string;
  startBeats: number;
  durationBeats: number;
  startTimeBase?: string;
  durationTimeBase?: string;
  backgroundColor: number;
  isContainer: boolean;
  layerIndex: number;
  groupId: string;
  trackId?: string;
  itemId?: string;
  editorTarget?: ScoreObjectEditorTargetSnapshot;
  serializedXml?: string;
  barRenderer?: ScoreRowObjectSnapshot['barRenderer'];
}

export interface ScoreSelectionEntry {
  objectId: string;
  editorTarget?: ScoreObjectEditorTargetSnapshot;
}

export interface ExternalSelectionReconciliationOptions {
  /** Identity of the view that produced the replay publication. */
  originViewId?: string;
  /** Identity of the context that produced the replay publication. */
  originContextId?: string;
  /** Identity of this renderer view, when it is known. */
  currentViewId?: string;
  /** Identity of this renderer context, when it is known. */
  currentContextId?: string;
  /** Set false when the origin view/context has already been closed. */
  originIsOpen?: boolean;
}

/** Transient relative shape used by pattern cut/copy/paste; never persisted. */
export interface PatternClipboardShape {
  cells: ReadonlyArray<{ rowOffset: number; cellOffset: number }>;
  width: number;
  height: number;
}

export interface ScoreGestureObjectProjection {
  objectId: string;
  startBeats: number;
  durationBeats: number;
  targetLayerIndex?: number;
  targetGroupId?: string;
}

export interface ScoreGestureProjection {
  gestureId: string;
  documentId?: string;
  sessionId?: number;
  objects: Readonly<Record<string, ScoreGestureObjectProjection>>;
}

interface ScoreSelectionState {
  selectedObjectIds: ReadonlySet<string>;
  selectedObjectTarget: ScoreObjectEditorTargetSnapshot | null;
  selectedObjectTargets: Readonly<Record<string, ScoreObjectEditorTargetSnapshot>>;
  liveSharedProperties: Readonly<Record<string, { startBeats?: number; durationBeats?: number }>>;
  gestureProjection: ScoreGestureProjection | null;
  clipboard: ScoreObjectClipboardEntry[];
  patternClipboard: PatternClipboardShape | null;
  audioDropGuideBeat: number | null;
  select: (
    objectId: string,
    additive: boolean,
    editorTarget?: ScoreObjectEditorTargetSnapshot,
  ) => void;
  selectAll: (allIds: string[]) => void;
  clearSelection: () => void;
  setSelection: (entries: ScoreSelectionEntry[] | string[]) => void;
  addToSelection: (entries: ScoreSelectionEntry[] | string[]) => void;
  setLiveSharedProperties: (
    updates: Array<{ objectId: string; startBeats?: number; durationBeats?: number }>,
  ) => void;
  clearLiveSharedProperties: (objectIds?: string[]) => void;
  setGestureProjection: (projection: ScoreGestureProjection | null) => void;
  clearGestureProjection: (gestureId?: string) => void;
  copySelected: (entries: ScoreObjectClipboardEntry[]) => void;
  clearClipboard: () => void;
  copyPatternShape: (shape: PatternClipboardShape) => void;
  clearPatternClipboard: () => void;
  setAudioDropGuideBeat: (beat: number | null) => void;
}

/** Only timeline-owned selections identify objects in the canonical Score. */
export function hasAuditionEligibleSelection(state: {
  selectedObjectIds: ReadonlySet<string>;
  selectedObjectTargets: Readonly<Record<string, ScoreObjectEditorTargetSnapshot>>;
}): boolean {
  if (state.selectedObjectIds.size === 0) return false;
  return [...state.selectedObjectIds].every((objectId) => {
    const target = state.selectedObjectTargets[objectId];
    // Pattern source selections point to an embedded source object; they are
    // not independently placed score objects and never resolve for audition.
    if (target?.patternSource) return false;
    return target === undefined || target.ownerKind === 'timeline';
  });
}

function normalizeSelectionEntries(
  entries: ScoreSelectionEntry[] | string[],
): ScoreSelectionEntry[] {
  if (entries.length === 0) return [];
  if (typeof entries[0] === 'string') {
    return (entries as string[]).map((objectId) => ({ objectId }));
  }
  return entries as ScoreSelectionEntry[];
}

export const useScoreSelectionStore = create<ScoreSelectionState>((set) => ({
  selectedObjectIds: new Set<string>(),
  selectedObjectTarget: null,
  selectedObjectTargets: {},
  liveSharedProperties: {},
  gestureProjection: null,
  clipboard: [],
  patternClipboard: null,
  audioDropGuideBeat: null,

  select(objectId, additive, editorTarget) {
    set((state) => {
      const next = new Set(state.selectedObjectIds);
      const nextTargets: Record<string, ScoreObjectEditorTargetSnapshot> = {
        ...state.selectedObjectTargets,
      };
      if (additive) {
        if (next.has(objectId)) {
          next.delete(objectId);
          delete nextTargets[objectId];
        } else {
          next.add(objectId);
          if (editorTarget) {
            nextTargets[objectId] = editorTarget;
          }
        }
      } else {
        next.clear();
        next.add(objectId);
        for (const key of Object.keys(nextTargets)) {
          delete nextTargets[key];
        }
        if (editorTarget) {
          nextTargets[objectId] = editorTarget;
        }
      }

      let selectedObjectTarget: ScoreObjectEditorTargetSnapshot | null = null;
      if (next.size === 1) {
        const onlyId = [...next][0];
        selectedObjectTarget = nextTargets[onlyId] ?? null;
      }

      const nextLiveSharedProperties: Record<
        string,
        { startBeats?: number; durationBeats?: number }
      > = {};
      for (const objectId of next) {
        const live = state.liveSharedProperties[objectId];
        if (live) {
          nextLiveSharedProperties[objectId] = live;
        }
      }

      return {
        selectedObjectIds: next,
        selectedObjectTargets: nextTargets,
        selectedObjectTarget,
        liveSharedProperties: nextLiveSharedProperties,
      };
    });
  },

  selectAll(allIds) {
    set((state) => {
      const nextLiveSharedProperties: Record<
        string,
        { startBeats?: number; durationBeats?: number }
      > = {};
      for (const objectId of allIds) {
        const live = state.liveSharedProperties[objectId];
        if (live) {
          nextLiveSharedProperties[objectId] = live;
        }
      }
      return {
        selectedObjectIds: new Set(allIds),
        selectedObjectTarget: null,
        selectedObjectTargets: {},
        liveSharedProperties: nextLiveSharedProperties,
      };
    });
  },

  clearSelection() {
    set({
      selectedObjectIds: new Set(),
      selectedObjectTarget: null,
      selectedObjectTargets: {},
      liveSharedProperties: {},
      gestureProjection: null,
    });
  },

  setSelection(entries) {
    const normalized = normalizeSelectionEntries(entries);
    const selectedObjectIds = new Set(normalized.map((entry) => entry.objectId));
    const selectedObjectTargets: Record<string, ScoreObjectEditorTargetSnapshot> = {};
    for (const entry of normalized) {
      if (entry.editorTarget) {
        selectedObjectTargets[entry.objectId] = entry.editorTarget;
      }
    }
    let selectedObjectTarget: ScoreObjectEditorTargetSnapshot | null = null;
    if (selectedObjectIds.size === 1) {
      const onlyId = [...selectedObjectIds][0];
      selectedObjectTarget = selectedObjectTargets[onlyId] ?? null;
    }
    set((state) => {
      const nextLiveSharedProperties: Record<
        string,
        { startBeats?: number; durationBeats?: number }
      > = {};
      for (const objectId of selectedObjectIds) {
        const live = state.liveSharedProperties[objectId];
        if (live) {
          nextLiveSharedProperties[objectId] = live;
        }
      }
      return {
        selectedObjectIds,
        selectedObjectTargets,
        selectedObjectTarget,
        liveSharedProperties: nextLiveSharedProperties,
      };
    });
  },

  addToSelection(entries) {
    const normalized = normalizeSelectionEntries(entries);
    if (normalized.length === 0) return;
    set((state) => {
      const selectedObjectIds = new Set(state.selectedObjectIds);
      const selectedObjectTargets: Record<string, ScoreObjectEditorTargetSnapshot> = {
        ...state.selectedObjectTargets,
      };
      for (const entry of normalized) {
        selectedObjectIds.add(entry.objectId);
        if (entry.editorTarget) {
          selectedObjectTargets[entry.objectId] = entry.editorTarget;
        }
      }
      let selectedObjectTarget: ScoreObjectEditorTargetSnapshot | null = null;
      if (selectedObjectIds.size === 1) {
        const onlyId = [...selectedObjectIds][0];
        selectedObjectTarget = selectedObjectTargets[onlyId] ?? null;
      } else if (state.selectedObjectIds.size === 1 && selectedObjectIds.size > 1) {
        selectedObjectTarget = null;
      } else {
        selectedObjectTarget = state.selectedObjectTarget;
      }
      const nextLiveSharedProperties: Record<
        string,
        { startBeats?: number; durationBeats?: number }
      > = {};
      for (const objectId of selectedObjectIds) {
        const live = state.liveSharedProperties[objectId];
        if (live) {
          nextLiveSharedProperties[objectId] = live;
        }
      }
      return {
        selectedObjectIds,
        selectedObjectTargets,
        selectedObjectTarget,
        liveSharedProperties: nextLiveSharedProperties,
      };
    });
  },

  setLiveSharedProperties(updates) {
    if (updates.length === 0) return;
    set((state) => {
      const next = { ...state.liveSharedProperties };
      for (const update of updates) {
        next[update.objectId] = {
          ...next[update.objectId],
          ...(update.startBeats !== undefined ? { startBeats: update.startBeats } : {}),
          ...(update.durationBeats !== undefined ? { durationBeats: update.durationBeats } : {}),
        };
      }
      return { liveSharedProperties: next };
    });
  },

  clearLiveSharedProperties(objectIds) {
    if (!objectIds || objectIds.length === 0) {
      set({ liveSharedProperties: {} });
      return;
    }
    set((state) => {
      if (Object.keys(state.liveSharedProperties).length === 0) return state;
      const next = { ...state.liveSharedProperties };
      let changed = false;
      for (const objectId of objectIds) {
        if (objectId in next) {
          delete next[objectId];
          changed = true;
        }
      }
      return changed ? { liveSharedProperties: next } : state;
    });
  },

  setGestureProjection(projection) {
    if (!projection) {
      set({ gestureProjection: null, liveSharedProperties: {} });
      return;
    }
    const currentDocId = getProjectDocumentId?.() ?? '';
    const currentSessionId = useProjectStore?.getState?.()?.sessionId;
    if (
      (projection.documentId && currentDocId && projection.documentId !== currentDocId) ||
      (projection.sessionId !== undefined &&
        currentSessionId !== undefined &&
        projection.sessionId !== currentSessionId)
    ) {
      set({ gestureProjection: null, liveSharedProperties: {} });
      return;
    }
    const liveUpdates: Record<string, { startBeats?: number; durationBeats?: number }> = {};
    for (const [id, obj] of Object.entries(projection.objects)) {
      liveUpdates[id] = { startBeats: obj.startBeats, durationBeats: obj.durationBeats };
    }
    set({
      gestureProjection: projection,
      liveSharedProperties: liveUpdates,
    });
  },

  clearGestureProjection(gestureId) {
    set((state) => {
      if (!state.gestureProjection) return state;
      if (gestureId !== undefined && state.gestureProjection.gestureId !== gestureId) {
        return state;
      }
      return {
        gestureProjection: null,
        liveSharedProperties: {},
      };
    });
  },

  copySelected(entries) {
    set({ clipboard: entries });
  },

  clearClipboard() {
    set({ clipboard: [] });
  },

  copyPatternShape(shape) {
    set({ patternClipboard: shape });
  },

  clearPatternClipboard() {
    set({ patternClipboard: null });
  },

  setAudioDropGuideBeat(beat) {
    set({ audioDropGuideBeat: beat });
  },
}));

/**
 * Applies canonical-restoration selection hints from another view's edit or
 * history command. Only hints whose score objects still exist are restored;
 * a hint set with no surviving targets reconciles to an empty selection.
 * Selection metadata never enters project XML — it rides only on
 * publications and lives in renderer state.
 */
export function reconcileExternalSelectionHints(
  hints: readonly ProjectHistorySelectionHint[],
  score: ScoreDocumentSnapshot | undefined,
  options: ExternalSelectionReconciliationOptions = {},
): void {
  reconcileSelectionWithCanonicalScore(score);

  const hasOriginIdentity =
    options.originViewId !== undefined || options.originContextId !== undefined;
  const originMatchesCurrentView =
    options.originViewId === undefined ||
    options.currentViewId === undefined ||
    options.originViewId === options.currentViewId;
  const originMatchesCurrentContext =
    options.originContextId === undefined ||
    options.currentContextId === undefined ||
    options.originContextId === options.currentContextId;
  if (
    options.originIsOpen === false ||
    (hasOriginIdentity && (!originMatchesCurrentView || !originMatchesCurrentContext))
  ) {
    return;
  }

  const objectIds = hints
    .filter((hint) => hint.targetType === 'scoreObject')
    .map((hint) => hint.targetId);
  if (objectIds.length === 0) return;

  const existing = getScoreObjectIds(score);

  const store = useScoreSelectionStore.getState();
  const restored = objectIds.filter((id) => existing.has(id));
  if (restored.length === 0) {
    store.clearSelection();
    return;
  }

  store.select(restored[0]!, false, undefined);
  for (const objectId of restored.slice(1)) {
    store.select(objectId, true, undefined);
  }
}

/** Removes selections and clears or prunes stale gesture projections that no longer resolve in the newly published Score. */
export function reconcileSelectionWithCanonicalScore(
  score: ScoreDocumentSnapshot | undefined,
): void {
  const existing = getScoreObjectIds(score);
  const state = useScoreSelectionStore.getState();

  if (state.gestureProjection) {
    const currentDocId = getProjectDocumentId?.() ?? '';
    const currentSessionId = useProjectStore?.getState?.()?.sessionId;
    if (
      (state.gestureProjection.documentId &&
        currentDocId &&
        state.gestureProjection.documentId !== currentDocId) ||
      (state.gestureProjection.sessionId !== undefined &&
        currentSessionId !== undefined &&
        state.gestureProjection.sessionId !== currentSessionId)
    ) {
      state.clearGestureProjection();
    } else {
      const survivingProjection: Record<string, ScoreGestureObjectProjection> = {};
      let pruned = false;
      for (const [id, obj] of Object.entries(state.gestureProjection.objects)) {
        if (existing.has(id)) {
          survivingProjection[id] = obj;
        } else {
          pruned = true;
        }
      }
      if (pruned) {
        if (Object.keys(survivingProjection).length === 0) {
          state.clearGestureProjection();
        } else {
          state.setGestureProjection({
            ...state.gestureProjection,
            objects: survivingProjection,
          });
        }
      }
    }
  }

  const surviving = [...state.selectedObjectIds].filter((objectId) => existing.has(objectId));
  if (surviving.length === state.selectedObjectIds.size) return;

  state.setSelection(
    surviving.map((objectId) => ({
      objectId,
      editorTarget: state.selectedObjectTargets[objectId],
    })),
  );
}

/**
 * Composes canonical or display layer groups with a transient score gesture projection.
 * Relocates moved objects across groups and layers, updates timings, and leaves
 * non-projected items unchanged without mutating input groups.
 */
export function projectScoreLayerGroupsWithGesture(
  groups: ScoreLayerGroupSnapshot[],
  projection: ScoreGestureProjection | null | undefined,
): ScoreLayerGroupSnapshot[] {
  if (!projection || Object.keys(projection.objects).length === 0) {
    return groups;
  }
  const currentDocId = getProjectDocumentId?.() ?? '';
  const currentSessionId = useProjectStore?.getState?.()?.sessionId;
  if (
    (projection.documentId && currentDocId && projection.documentId !== currentDocId) ||
    (projection.sessionId !== undefined &&
      currentSessionId !== undefined &&
      projection.sessionId !== currentSessionId)
  ) {
    return groups;
  }

  const projectedObjectIds = new Set(Object.keys(projection.objects));
  const itemById = new Map<string, ScoreRowObjectSnapshot>();
  const originalLocationById = new Map<string, { groupId: string; layerIndex: number }>();

  for (const group of groups) {
    for (let li = 0; li < group.layers.length; li++) {
      const layer = group.layers[li];
      for (const item of layer.items) {
        if (projectedObjectIds.has(item.objectId)) {
          itemById.set(item.objectId, item);
          originalLocationById.set(item.objectId, { groupId: group.groupId, layerIndex: li });
        }
      }
    }
  }

  const additionsByGroupAndLayer = new Map<string, Map<number, ScoreRowObjectSnapshot[]>>();

  for (const [id, proj] of Object.entries(projection.objects)) {
    const orig = itemById.get(id);
    const origLoc = originalLocationById.get(id);
    if (!orig || !origLoc) continue;

    const targetGroupId = proj.targetGroupId ?? origLoc.groupId;
    const targetLayerIndex = proj.targetLayerIndex ?? origLoc.layerIndex;

    const isRelocated =
      targetGroupId !== origLoc.groupId || targetLayerIndex !== origLoc.layerIndex;
    if (isRelocated) {
      let groupMap = additionsByGroupAndLayer.get(targetGroupId);
      if (!groupMap) {
        groupMap = new Map();
        additionsByGroupAndLayer.set(targetGroupId, groupMap);
      }
      let layerList = groupMap.get(targetLayerIndex);
      if (!layerList) {
        layerList = [];
        groupMap.set(targetLayerIndex, layerList);
      }
      layerList.push({
        ...orig,
        startBeats: Math.max(0, proj.startBeats),
        durationBeats: Math.max(0.001, proj.durationBeats),
        editorTarget: orig.editorTarget?.location
          ? {
              ...orig.editorTarget,
              location: {
                ...orig.editorTarget.location,
                layerIndex: targetLayerIndex,
              },
            }
          : orig.editorTarget,
      });
    }
  }

  return groups.map((group, groupIndex) => {
    const groupAdditions = additionsByGroupAndLayer.get(group.groupId);
    const newLayers = group.layers.map((layer, layerIndex) => {
      const remainingItems: ScoreRowObjectSnapshot[] = [];
      for (const item of layer.items) {
        const proj = projection.objects[item.objectId];
        if (!proj) {
          remainingItems.push(item);
          continue;
        }
        const origLoc = originalLocationById.get(item.objectId);
        const targetGroupId = proj.targetGroupId ?? origLoc?.groupId ?? group.groupId;
        const targetLayerIndex = proj.targetLayerIndex ?? origLoc?.layerIndex ?? layerIndex;

        const isRelocated = targetGroupId !== group.groupId || targetLayerIndex !== layerIndex;
        if (isRelocated) {
          continue;
        }

        remainingItems.push({
          ...item,
          startBeats: Math.max(0, proj.startBeats),
          durationBeats: Math.max(0.001, proj.durationBeats),
        });
      }

      const additions = groupAdditions?.get(layerIndex) ?? [];
      if (additions.length === 0) {
        return { ...layer, items: remainingItems };
      }

      return {
        ...layer,
        items: [
          ...remainingItems,
          ...additions.map((item, idx) => ({
            ...item,
            editorTarget: item.editorTarget?.location
              ? {
                  ...item.editorTarget,
                  location: {
                    ...item.editorTarget.location,
                    rootGroupIndex: groupIndex,
                    layerIndex,
                    objectIndex: remainingItems.length + idx,
                  },
                }
              : item.editorTarget,
          })),
        ],
      };
    });

    return {
      ...group,
      layers: newLayers,
    } as ScoreLayerGroupSnapshot;
  });
}

function getScoreObjectIds(score: ScoreDocumentSnapshot | undefined): Set<string> {
  const existing = new Set<string>();
  if (!score) return existing;
  for (const group of score.layerGroups) {
    for (const layer of group.layers) {
      for (const item of layer.items) {
        existing.add(item.objectId);
      }
    }
  }
  return existing;
}
