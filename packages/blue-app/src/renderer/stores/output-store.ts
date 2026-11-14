import { create } from 'zustand';
import type { EngineOutputChunk, OutputLine, OutputTab } from '../../shared/io-provider';

/** Maximum number of lines kept per tab. Oldest lines are discarded when exceeded. */
export const MAX_LINES = 10_000;

export interface OutputWindowState {
  tabs: Record<string, OutputTab>;
  tabOrder: string[];
  activeTabId: string | null;

  getOrCreateTab: (name: string, newIO?: boolean) => OutputTab;
  appendToTab: (name: string, text: string, type?: 'stdout' | 'stderr') => void;
  appendChunksToTab: (name: string, chunks: readonly EngineOutputChunk[]) => void;
  resetTab: (name: string) => void;
  selectTab: (name: string) => void;
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

function applyChunksToTab(
  state: OutputWindowState,
  name: string,
  chunks: readonly EngineOutputChunk[],
): Partial<OutputWindowState> {
  if (chunks.length === 0) return state;
  const tab = ensureTab(state, name);
  let pendingText = tab.pendingText;
  let pendingType = tab.pendingType;
  let counter = tab.lineCounter;
  const newLines: OutputLine[] = [];
  for (const chunk of chunks) {
    const hadPending = pendingText.length > 0 && pendingType !== null;
    const initialLineType = hadPending ? pendingType! : chunk.type;
    const normalizedText = chunk.text.replace(/\r\n?/g, '\n');
    const combined = pendingText + normalizedText;
    const parts = combined.split('\n');
    pendingText = parts.pop() ?? '';
    for (let i = 0; i < parts.length; i += 1) {
      counter += 1;
      newLines.push({
        id: counter,
        text: parts[i]!,
        type: i === 0 ? initialLineType : chunk.type,
      });
    }
    pendingType =
      pendingText.length > 0 ? (parts.length === 0 && hadPending ? pendingType : chunk.type) : null;
  }
  const tabOrder = state.tabOrder.includes(name) ? state.tabOrder : [...state.tabOrder, name];
  if (newLines.length === 0) {
    return {
      tabs: {
        ...state.tabs,
        [name]: {
          ...tab,
          pendingText,
          pendingType,
        },
      },
      tabOrder,
      activeTabId: state.activeTabId ?? name,
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
    pendingType,
  };
  return {
    tabs: { ...state.tabs, [name]: updated },
    tabOrder,
    activeTabId: state.activeTabId ?? name,
  };
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

  appendToTab(name, text, type = 'stdout') {
    set((state) => applyChunksToTab(state, name, [{ text, type }]));
  },

  appendChunksToTab(name, chunks) {
    set((state) => applyChunksToTab(state, name, chunks));
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
}));
