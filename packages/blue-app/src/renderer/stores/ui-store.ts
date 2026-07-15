import { create } from 'zustand';

export type ActivePanel = 'welcome' | 'project';

interface UIState {
  activePanel: ActivePanel;
  selectedLayer: string | null;
  zoom: number;
}

interface UIActions {
  setActivePanel: (panel: ActivePanel) => void;
  selectLayer: (id: string | null) => void;
  setZoom: (zoom: number) => void;
}

export const useUIStore = create<UIState & UIActions>()((set) => ({
  activePanel: 'welcome',
  selectedLayer: null,
  zoom: 100,

  setActivePanel: (activePanel) => set({ activePanel }),

  selectLayer: (selectedLayer) => set({ selectedLayer }),

  setZoom: (zoom) => set({ zoom }),

}));
