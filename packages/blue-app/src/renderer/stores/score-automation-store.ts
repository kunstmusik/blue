import { create } from 'zustand';
import type { AutomationPointSnapshot } from '../../shared/project-editor';

export type AutomationEditMode = 'score' | 'singleLine' | 'multiLine';

export interface AutomationPointSelection {
  layerId: string;
  parameterId: string;
  pointIndex: number;
}

export interface AutomationRangeSelection {
  startBeat: number;
  endBeat: number;
  layerIds: string[];
  parameterIdsByLayer: Record<string, string[]>;
}

/**
 * Live preview of multi-line move/scale operations, keyed by parameter id.
 * Each selected automation line renders these transformed points during a drag
 * instead of the committed snapshot points, matching Java Blue's temporary-line
 * behavior. Cleared when the gesture commits (or aborts).
 */
export type MultiLinePreview = Record<string, AutomationPointSnapshot[]>;

/**
 * Live preview of score object / audio clip positions during a multi-line drag,
 * keyed by objectId. The canvases read this to visually shift objects in
 * real-time before the canonical patch is dispatched on mouseUp.
 */
export type MultiLineObjectPreview = Record<string, { startBeats: number; durationBeats: number }>;

interface ScoreAutomationState {
  mode: AutomationEditMode;
  activeLayerId: string | null;
  activeParameterId: string | null;
  selectedPoint: AutomationPointSelection | null;
  rangeSelection: AutomationRangeSelection | null;
  multiLinePreview: MultiLinePreview | null;
  multiLineObjectPreview: MultiLineObjectPreview | null;
  setMode: (mode: AutomationEditMode) => void;
  setActiveParameter: (layerId: string | null, parameterId: string | null) => void;
  setSelectedPoint: (selection: AutomationPointSelection | null) => void;
  setRangeSelection: (selection: AutomationRangeSelection | null) => void;
  setMultiLinePreview: (preview: MultiLinePreview | null) => void;
  setMultiLineObjectPreview: (preview: MultiLineObjectPreview | null) => void;
  clearAutomationState: () => void;
}

export const useScoreAutomationStore = create<ScoreAutomationState>((set) => ({
  mode: 'score',
  activeLayerId: null,
  activeParameterId: null,
  selectedPoint: null,
  rangeSelection: null,
  multiLinePreview: null,
  multiLineObjectPreview: null,
  setMode: (mode) => set({ mode }),
  setActiveParameter: (layerId, parameterId) =>
    set({ activeLayerId: layerId, activeParameterId: parameterId }),
  setSelectedPoint: (selection) => set({ selectedPoint: selection }),
  setRangeSelection: (selection) => set({ rangeSelection: selection }),
  setMultiLinePreview: (preview) => set({ multiLinePreview: preview }),
  setMultiLineObjectPreview: (preview) => set({ multiLineObjectPreview: preview }),
  clearAutomationState: () =>
    set({
      mode: 'score',
      activeLayerId: null,
      activeParameterId: null,
      selectedPoint: null,
      rangeSelection: null,
      multiLinePreview: null,
      multiLineObjectPreview: null,
    }),
}));
