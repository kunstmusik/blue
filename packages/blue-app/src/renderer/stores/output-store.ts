import { create } from 'zustand';
import type { OutputLine, OutputTab, OutputType } from '../../shared/io-provider';

/** Maximum number of lines kept per tab. Oldest lines are discarded when exceeded. */
export const MAX_LINES = 10_000;

export interface OutputWindowState {
  tabs: Record<string, OutputTab>;
  tabOrder: string[];
  activeTabId: string | null;

  getOrCreateTab: (name: string, newIO?: boolean) => OutputTab;
  closeTab: (name: string) => void;
  appendToTab: (name: string, text: string, type?: 'stdout' | 'stderr') => void;
  resetTab: (name: string) => void;
  selectTab: (name: string) => void;
  setTabColor: (name: string, outputType: OutputType, color: string) => void;
}

function ensureTab(state: OutputWindowState, name: string): OutputTab {
  return (
    state.tabs[name] ?? {
      id: name,
      name,
      lines: [],
      lineCounter: 0,
      colorOverrides: {},
      isClosed: false,
      pendingText: '',
      pendingType: null,
    }
  );
}

export const useOutputStore = create<OutputWindowState>((set) => ({
  tabs: {},
  tabOrder: [],
  activeTabId: null,

  getOrCreateTab(name, newIO = false) {
    let tab: OutputTab;
    set((state) => {
      const existing = state.tabs[name];
      if (existing && !newIO) {
        tab = existing;
        return state;
      }
      tab = {
        id: name,
        name,
        lines: [],
        lineCounter: 0,
        colorOverrides: existing?.colorOverrides ?? {},
        isClosed: false,
        pendingText: '',
        pendingType: null,
      };
      const tabOrder = state.tabOrder.includes(name) ? state.tabOrder : [...state.tabOrder, name];
      return {
        tabs: { ...state.tabs, [name]: tab },
        tabOrder,
        activeTabId: state.activeTabId ?? name,
      };
    });
    return tab!;
  },

  closeTab(name) {
    set((state) => {
      const { [name]: _, ...rest } = state.tabs;
      return {
        tabs: rest,
        tabOrder: state.tabOrder.filter((t) => t !== name),
        activeTabId:
          state.activeTabId === name
            ? (state.tabOrder.find((t) => t !== name) ?? null)
            : state.activeTabId,
      };
    });
  },

  appendToTab(name, text, type = 'stdout') {
    set((state) => {
      const tab = ensureTab(state, name);
      const normalizedText = text.replace(/\r\n?/g, '\n');
      const combined = tab.pendingText + normalizedText;
      const parts = combined.split('\n');
      const pendingText = parts.pop() ?? '';
      const newLines: OutputLine[] = [];
      let counter = tab.lineCounter;
      for (const line of parts) {
        if (line.length === 0) continue;
        counter += 1;
        newLines.push({ id: counter, text: line, type });
      }
      if (newLines.length === 0) {
        return {
          ...state,
          tabs: {
            ...state.tabs,
            [name]: {
              ...tab,
              pendingText,
              pendingType: pendingText.length > 0 ? type : null,
            },
          },
        };
      }
      let allLines = [...tab.lines, ...newLines];
      if (allLines.length > MAX_LINES) {
        allLines = allLines.slice(allLines.length - MAX_LINES);
      }
      const updated: OutputTab = {
        ...tab,
        lines: allLines,
        lineCounter: counter,
        pendingText,
        pendingType: pendingText.length > 0 ? type : null,
      };
      const tabOrder = state.tabOrder.includes(name) ? state.tabOrder : [...state.tabOrder, name];
      return {
        tabs: { ...state.tabs, [name]: updated },
        tabOrder,
        activeTabId: state.activeTabId ?? name,
      };
    });
  },

  resetTab(name) {
    set((state) => {
      const tab = state.tabs[name];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [name]: { ...tab, lines: [], lineCounter: 0, pendingText: '', pendingType: null },
        },
      };
    });
  },

  selectTab(name) {
    set({ activeTabId: name });
  },

  setTabColor(name, outputType, color) {
    set((state) => {
      const tab = state.tabs[name];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [name]: {
            ...tab,
            colorOverrides: { ...tab.colorOverrides, [outputType]: color },
          },
        },
      };
    });
  },
}));
