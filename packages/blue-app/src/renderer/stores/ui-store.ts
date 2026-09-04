import { create } from 'zustand';

export type ActivePanel = 'welcome' | 'workspace' | 'project';

interface UIState {
  activePanel: ActivePanel;
}

interface UIActions {
  setActivePanel: (panel: ActivePanel) => void;
}

export const useUIStore = create<UIState & UIActions>()((set) => ({
  activePanel: 'welcome',

  setActivePanel: (activePanel) => set({ activePanel }),
}));
