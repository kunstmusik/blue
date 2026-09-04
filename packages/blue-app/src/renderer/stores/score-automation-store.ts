import { create } from 'zustand';
import type { AutomationPointSnapshot } from '../../shared/project-editor';

interface ScoreAutomationState {
  selectedPoint: AutomationPointSelection | null;
  rangeSelection: AutomationRangeSelection | null;
  multiLinePreview: MultiLinePreview | null;
  multiLineObjectPreview: MultiLineObjectPreview | null;
  setSelectedPoint: (selection: AutomationPointSelection | null) => void;
  setRangeSelection: (selection: AutomationRangeSelection | null) => void;
  setMultiLinePreview: (preview: MultiLinePreview | null) => void;
  setMultiLineObjectPreview: (preview: MultiLineObjectPreview | null) => void;
}

export const useScoreAutomationStore = create<ScoreAutomationState>((set) => ({
  selectedPoint: null,
  rangeSelection: null,
  multiLinePreview: null,
  multiLineObjectPreview: null,
  setSelectedPoint: (selection) => set({ selectedPoint: selection }),
  setRangeSelection: (selection) => set({ rangeSelection: selection }),
  setMultiLinePreview: (preview) => set({ multiLinePreview: preview }),
  setMultiLineObjectPreview: (preview) => set({ multiLineObjectPreview: preview }),
}));
