import { create } from 'zustand';
import type { EngineOutputChunk, OutputLine, OutputTab } from '../../shared/io-provider';

/** Maximum number of lines kept per tab. Oldest lines are discarded when exceeded. */
export const MAX_LINES = 10_000;
const LINE_PAGE_SIZE = 128;

export function getOutputLinePageId(line: OutputLine): number {
  return Math.floor((line.id - 1) / LINE_PAGE_SIZE);
}

function withOutputLines(tab: Omit<OutputTab, 'lines'>): OutputTab {
  // Materialize the flat array only for callers that need the entire log.
  let lines: OutputLine[] | undefined;
  return Object.defineProperty(tab, 'lines', {
    get: () => (lines ??= tab.linePages.flat()),
  }) as OutputTab;
}

export function countOutputLines(tab: OutputTab | null): number {
  return tab ? Math.min(tab.lineCounter, MAX_LINES) + Number(!!tab.pendingText) : 0;
}

export function sliceOutputLines(tab: OutputTab | null, start: number, end: number): OutputLine[] {
  if (!tab || end <= start) return [];
  const lines: OutputLine[] = [];
  let offset = 0;
  for (const page of tab.linePages) {
    const next = offset + page.length;
    if (start < next) lines.push(...page.slice(Math.max(0, start - offset), end - offset));
    if (end <= next) return lines;
    offset = next;
  }
  if (tab.pendingText && start <= offset) {
    lines.push({
      id: tab.lineCounter + 1,
      text: tab.pendingText,
      type: tab.pendingType ?? 'stdout',
    });
  }
  return lines;
}

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
    state.tabs[name] ??
    withOutputLines({
      id: name,
      name,
      linePages: [],
      lineCounter: 0,
      colorOverrides: {},
      isClosed: false,
      pendingText: '',
      pendingType: null,
    })
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
        [name]: withOutputLines({
          ...tab,
          pendingText,
          pendingType,
        }),
      },
      tabOrder,
      activeTabId: state.activeTabId ?? name,
    };
  }
  let drop = Math.max(0, Math.min(tab.lineCounter, MAX_LINES) + newLines.length - MAX_LINES);
  const linePages: (readonly OutputLine[])[] = [];
  for (const page of tab.linePages) {
    if (drop >= page.length) {
      drop -= page.length;
      continue;
    }
    linePages.push(drop ? page.slice(drop) : page);
    drop = 0;
  }
  const tail = linePages.at(-1);
  const lastId = tail?.at(-1)?.id;
  const remaining =
    lastId === undefined ? 0 : (LINE_PAGE_SIZE - (lastId % LINE_PAGE_SIZE)) % LINE_PAGE_SIZE;
  if (tail && remaining > 0) {
    const fill = Math.min(remaining, newLines.length - drop);
    linePages[linePages.length - 1] = [...tail, ...newLines.slice(drop, drop + fill)];
    drop += fill;
  }
  for (let i = drop; i < newLines.length;) {
    const end = i + LINE_PAGE_SIZE - ((newLines[i]!.id - 1) % LINE_PAGE_SIZE);
    linePages.push(newLines.slice(i, end));
    i = end;
  }
  const updated = withOutputLines({
    ...tab,
    linePages,
    lineCounter: counter,
    pendingText,
    pendingType,
  });
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
      tab = withOutputLines({
        id: name,
        name,
        linePages: [],
        lineCounter: 0,
        colorOverrides: existing?.colorOverrides ?? {},
        isClosed: false,
        pendingText: '',
        pendingType: null,
      });
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
          [name]: withOutputLines({
            ...tab,
            linePages: [],
            lineCounter: 0,
            pendingText: '',
            pendingType: null,
          }),
        },
      };
    });
  },

  selectTab(name) {
    set({ activeTabId: name });
  },
}));
