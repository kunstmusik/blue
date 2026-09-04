// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbWidgetNodeSnapshot,
} from '../../shared/project-editor';
import BSBInterfaceCanvas from '../components/workbench/panels/orchestra/bsb/BSBInterfaceCanvas';
import { useBsbClipboardStore } from '../stores/bsb-clipboard-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeWidgetNode(overrides: Partial<BsbWidgetNodeSnapshot> = {}): BsbWidgetNodeSnapshot {
  return {
    id: 'w1',
    type: 'BSBKnob',
    objectName: 'amp',
    x: 10,
    y: 20,
    width: 60,
    height: 60,
    value: 0.5,
    minimum: 0,
    maximum: 1,
    editable: true,
    properties: {},
    ...overrides,
  };
}

function makeInstrument(): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'Test BSB',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili <amp>, 440',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: ['amp'],
    widgets: [{ objectName: 'amp', widgetType: 'BSBKnob', value: 0.5, minimum: 0, maximum: 1 }],
    editEnabled: true,
    gridSettings: { enabled: true, snapEnabled: true, width: 10, height: 10 },
    widgetTree: {
      id: 'root',
      type: 'BSBRootGroup',
      objectName: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      editable: true,
      properties: {},
      children: [makeWidgetNode()],
    },
  };
}

function renderRoot(element: React.ReactElement): {
  container: HTMLDivElement;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  useBsbClipboardStore.getState().clearClipboard();
  document.body.innerHTML = '';
});

describe('BSB keyboard shortcut scoping', () => {
  it('handles Delete on the canvas without falling through to window listeners', () => {
    const onWidgetSelect = vi.fn();
    const onBsbInterfacePatch = vi.fn();
    const onInstrumentPatch = vi.fn();
    const windowHandler = vi.fn();

    let cleanup: (() => void) | undefined;
    window.addEventListener('keydown', windowHandler);

    try {
      const rendered = renderRoot(
        <BSBInterfaceCanvas
          instrument={makeInstrument()}
          selectedWidgetIds={new Set(['w1'])}
          editEnabled
          onWidgetSelect={onWidgetSelect}
          onBsbInterfacePatch={onBsbInterfacePatch}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
      cleanup = rendered.unmount;

      const canvas = rendered.container.querySelector(
        '[data-shortcut-scope="bsb-interface-canvas"]',
      ) as HTMLDivElement | null;
      expect(canvas).not.toBeNull();

      act(() => {
        canvas?.focus();
      });

      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        canvas?.dispatchEvent(event);
      });

      expect(onBsbInterfacePatch).toHaveBeenCalledWith({ type: 'removeWidget', widgetId: 'w1' });
      expect(onWidgetSelect).toHaveBeenCalledWith(null);
      expect(windowHandler).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', windowHandler);
      cleanup?.();
    }
  });

  it('copies selected widgets with Cmd+C into the shared BSB clipboard', () => {
    let cleanup: (() => void) | undefined;

    try {
      const rendered = renderRoot(
        <BSBInterfaceCanvas
          instrument={makeInstrument()}
          selectedWidgetIds={new Set(['w1'])}
          editEnabled
          onWidgetSelect={vi.fn()}
          onBsbInterfacePatch={vi.fn()}
          onInstrumentPatch={vi.fn()}
        />,
      );
      cleanup = rendered.unmount;

      const canvas = rendered.container.querySelector(
        '[data-shortcut-scope="bsb-interface-canvas"]',
      ) as HTMLDivElement | null;
      expect(canvas).not.toBeNull();

      act(() => {
        canvas?.focus();
      });

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        canvas?.dispatchEvent(event);
      });

      const clipboard = useBsbClipboardStore.getState().clipboard;
      expect(clipboard?.widgets).toHaveLength(1);
      expect(clipboard?.widgets[0]?.objectName).toBe('amp');
      expect(clipboard?.originX).toBe(10);
      expect(clipboard?.originY).toBe(20);
    } finally {
      cleanup?.();
    }
  });

  it('pastes the shared BSB clipboard on Cmd-click', () => {
    const onBsbInterfacePatch = vi.fn();
    useBsbClipboardStore.getState().setClipboard({
      originX: 10,
      originY: 20,
      widgets: [makeWidgetNode({ id: 'copy-source', x: 10, y: 20 })],
    });
    let cleanup: (() => void) | undefined;

    try {
      const rendered = renderRoot(
        <BSBInterfaceCanvas
          instrument={makeInstrument()}
          selectedWidgetIds={new Set()}
          editEnabled
          onWidgetSelect={vi.fn()}
          onBsbInterfacePatch={onBsbInterfacePatch}
          onInstrumentPatch={vi.fn()}
        />,
      );
      cleanup = rendered.unmount;

      const canvas = rendered.container.querySelector(
        '[data-shortcut-scope="bsb-interface-canvas"]',
      ) as HTMLDivElement | null;
      const inner = canvas?.firstElementChild as HTMLDivElement | null;
      expect(inner).not.toBeNull();
      if (!inner) {
        throw new Error('BSB canvas inner element was not rendered');
      }
      Object.defineProperty(inner, 'getBoundingClientRect', {
        value: () => ({
          left: 0,
          top: 0,
          right: 600,
          bottom: 400,
          width: 600,
          height: 400,
        }),
      });

      const event = new MouseEvent('mousedown', {
        button: 0,
        clientX: 43,
        clientY: 58,
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        inner.dispatchEvent(event);
      });

      expect(onBsbInterfacePatch).toHaveBeenCalledTimes(1);
      const patch = onBsbInterfacePatch.mock.calls[0]?.[0];
      expect(patch?.type).toBe('pasteWidgets');
      if (patch?.type === 'pasteWidgets') {
        const pasted = JSON.parse(patch.widgetData) as BsbWidgetNodeSnapshot[];
        expect(pasted[0]?.x).toBe(40);
        expect(pasted[0]?.y).toBe(50);
      }
    } finally {
      cleanup?.();
    }
  });

  it('selects a SubChannel dropdown by clicking it in edit mode', () => {
    const onWidgetSelect = vi.fn();
    let cleanup: (() => void) | undefined;
    const instrument = makeInstrument();
    instrument.widgetTree.children = [
      makeWidgetNode({
        id: 'sub-channel',
        type: 'BSBSubChannelDropdown',
        objectName: 'out',
        width: 120,
        height: 24,
        properties: { channelOutput: 'Master' },
      }),
    ];

    try {
      const rendered = renderRoot(
        <BSBInterfaceCanvas
          instrument={instrument}
          selectedWidgetIds={new Set()}
          editEnabled
          onWidgetSelect={onWidgetSelect}
          onBsbInterfacePatch={vi.fn()}
          onInstrumentPatch={vi.fn()}
        />,
      );
      cleanup = rendered.unmount;

      const button = rendered.container.querySelector(
        '[data-widget-id="sub-channel"] button',
      ) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      expect(button?.disabled).toBe(false);

      act(() => {
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      expect(onWidgetSelect).toHaveBeenCalledWith('sub-channel', false);
    } finally {
      cleanup?.();
    }
  });
});
