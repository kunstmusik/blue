import { create } from 'zustand';
import type { BsbWidgetNodeSnapshot } from '../../shared/project-editor';
import type { BsbCanvasClipboard } from '../../shared/unified-library';

export type { BsbCanvasClipboard } from '../../shared/unified-library';

interface BsbClipboardState {
  clipboard: BsbCanvasClipboard | null;
  setClipboard: (clipboard: BsbCanvasClipboard | null) => void;
  receiveClipboard: (clipboard: BsbCanvasClipboard | null) => void;
  clearClipboard: () => void;
}

function cloneClipboard(clipboard: BsbCanvasClipboard | null): BsbCanvasClipboard | null {
  if (!clipboard) {
    return null;
  }

  return {
    originX: clipboard.originX,
    originY: clipboard.originY,
    widgets: clipboard.widgets.map((widget) =>
      JSON.parse(JSON.stringify(widget)) as BsbWidgetNodeSnapshot),
  };
}

function publishClipboard(clipboard: BsbCanvasClipboard | null): void {
  const publish = typeof window === 'undefined'
    ? undefined
    : window.blueAPI?.setBsbClipboard;
  if (typeof publish === 'function') {
    void publish(cloneClipboard(clipboard)).catch(() => undefined);
  }
}

export const useBsbClipboardStore = create<BsbClipboardState>((set) => ({
  clipboard: null,
  setClipboard: (clipboard) => {
    const copy = cloneClipboard(clipboard);
    set({ clipboard: copy });
    publishClipboard(copy);
  },
  receiveClipboard: (clipboard) => set({ clipboard: cloneClipboard(clipboard) }),
  clearClipboard: () => {
    set({ clipboard: null });
    publishClipboard(null);
  },
}));
