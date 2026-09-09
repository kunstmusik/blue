import { create } from 'zustand';
import type {
  ScoreObjectEditorTargetSnapshot,
  ScoreDocumentSnapshot,
  ScoreRowObjectSnapshot,
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

/** Transient relative shape used by pattern cut/copy/paste; never persisted. */
export interface PatternClipboardShape {
  cells: ReadonlyArray<{ rowOffset: number; cellOffset: number }>;
  width: number;
  height: number;
}

interface ScoreSelectionState {
  selectedObjectIds: ReadonlySet<string>;
  selectedObjectTarget: ScoreObjectEditorTargetSnapshot | null;
  selectedObjectTargets: Readonly<Record<string, ScoreObjectEditorTargetSnapshot>>;
  liveSharedProperties: Readonly<Record<string, { startBeats?: number; durationBeats?: number }>>;
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
): void {
  const objectIds = hints
    .filter((hint) => hint.targetType === 'scoreObject')
    .map((hint) => hint.targetId);
  if (objectIds.length === 0) return;

  const existing = new Set<string>();
  if (score) {
    for (const group of score.layerGroups) {
      for (const layer of group.layers) {
        for (const item of layer.items) {
          existing.add(item.objectId);
        }
      }
    }
  }

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
