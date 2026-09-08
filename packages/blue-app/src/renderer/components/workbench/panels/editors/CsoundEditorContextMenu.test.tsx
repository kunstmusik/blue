// @vitest-environment jsdom

import React, { act } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import CsoundEditorContextMenu from './CsoundEditorContextMenu';
import { createOpcodesSubmenu } from './csound-opcode-menu';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function findMenuItem(label: string): HTMLElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === label,
  );
}

describe('CsoundEditorContextMenu opcode insertion', () => {
  let container: HTMLDivElement;
  let root: Root;
  let editorHost: HTMLDivElement;
  let view: EditorView;
  let rangeRectsDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    rangeRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 0, item: () => null }),
    });
    container = document.createElement('div');
    editorHost = document.createElement('div');
    container.appendChild(editorHost);
    document.body.appendChild(container);
    root = createRoot(container);
    view = new EditorView({
      state: EditorState.create({ doc: 'placeholder' }),
      parent: editorHost,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    view.destroy();
    if (rangeRectsDescriptor) {
      Object.defineProperty(Range.prototype, 'getClientRects', rangeRectsDescriptor);
    } else {
      delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    }
    container.remove();
  });

  it('opens the nested opcode menu and replaces the selected editor text', async () => {
    const editorViewRef = { current: view };
    act(() => {
      root.render(
        <CsoundEditorContextMenu editorViewRef={editorViewRef} menuItems={[createOpcodesSubmenu()]}>
          <button type="button">Editor</button>
        </CsoundEditorContextMenu>,
      );
    });

    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger!.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 10,
          clientY: 10,
        }),
      );
      await Promise.resolve();
    });
    const opcodes = findMenuItem('Opcodes');
    expect(opcodes).not.toBeUndefined();
    await act(async () => {
      opcodes!.click();
      await Promise.resolve();
    });

    const signalGenerators = findMenuItem('Signal Generators');
    expect(signalGenerators).not.toBeUndefined();
    await act(async () => {
      signalGenerators!.click();
      await Promise.resolve();
    });

    const basicOscillators = findMenuItem('Basic Oscillators');
    expect(basicOscillators).not.toBeUndefined();
    await act(async () => {
      basicOscillators!.click();
      await Promise.resolve();
    });

    const oscil = findMenuItem('oscil');
    expect(oscil).not.toBeUndefined();
    await act(async () => {
      oscil!.click();
      await Promise.resolve();
    });

    expect(view.state.doc.toString()).toBe('ares = oscil(xamp, xcps)');
  });

  it('triggers Open Manual for opcode at caret via context menu command', async () => {
    const openCsoundManual = vi.fn().mockResolvedValue({
      disposition: 'opened',
      availability: 'available',
      targetUrl: 'https://csound.com/manual/opcodes/oscili/',
    });
    window.blueAPI = {
      ...(window.blueAPI ?? {}),
      openCsoundManual,
    } as unknown as typeof window.blueAPI;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'a1 oscili 0.5, 440' },
      selection: { anchor: 5, head: 5 }, // Inside 'oscili'
    });

    const editorViewRef = { current: view };
    act(() => {
      root.render(
        <CsoundEditorContextMenu
          editorViewRef={editorViewRef}
          menuItems={[
            {
              kind: 'command',
              id: 'open-manual',
              label: 'Open Manual',
              command: 'open-manual',
            },
          ]}
        >
          <button type="button">Editor</button>
        </CsoundEditorContextMenu>,
      );
    });

    const trigger = container.querySelector('button');
    await act(async () => {
      trigger!.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 10,
          clientY: 10,
        }),
      );
      await Promise.resolve();
    });

    const openManualItem = findMenuItem('Open Manual');
    expect(openManualItem).not.toBeUndefined();
    await act(async () => {
      openManualItem!.click();
      await Promise.resolve();
    });

    expect(openCsoundManual).toHaveBeenCalledWith({ manualId: 'oscili' });
    expect(view.state.doc.toString()).toBe('a1 oscili 0.5, 440');
    expect(view.state.selection.main.head).toBe(5);
  });

  it('handles display-name/manual-id differences (e.g. opcode a uses manualId opa)', async () => {
    const openCsoundManual = vi.fn().mockResolvedValue({
      disposition: 'opened',
      availability: 'available',
      targetUrl: 'https://csound.com/manual/opcodes/opa/',
    });
    window.blueAPI = {
      ...(window.blueAPI ?? {}),
      openCsoundManual,
    } as unknown as typeof window.blueAPI;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'a1 a k1' },
      selection: { anchor: 3, head: 4 }, // Selected 'a'
    });

    const editorViewRef = { current: view };
    act(() => {
      root.render(
        <CsoundEditorContextMenu
          editorViewRef={editorViewRef}
          menuItems={[
            {
              kind: 'command',
              id: 'open-manual',
              label: 'Open Manual',
              command: 'open-manual',
            },
          ]}
        >
          <button type="button">Editor</button>
        </CsoundEditorContextMenu>,
      );
    });

    const trigger = container.querySelector('button');
    await act(async () => {
      trigger!.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 10,
          clientY: 10,
        }),
      );
      await Promise.resolve();
    });

    const openManualItem = findMenuItem('Open Manual');
    await act(async () => {
      openManualItem!.click();
      await Promise.resolve();
    });

    expect(openCsoundManual).toHaveBeenCalledWith({ manualId: 'opa' });
  });

  it('performs no navigation when caret is on an unrecognized identifier', async () => {
    const openCsoundManual = vi.fn();
    window.blueAPI = {
      ...(window.blueAPI ?? {}),
      openCsoundManual,
    } as unknown as typeof window.blueAPI;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'myCustomVariable = 123' },
      selection: { anchor: 5, head: 5 },
    });

    const editorViewRef = { current: view };
    act(() => {
      root.render(
        <CsoundEditorContextMenu
          editorViewRef={editorViewRef}
          menuItems={[
            {
              kind: 'command',
              id: 'open-manual',
              label: 'Open Manual',
              command: 'open-manual',
            },
          ]}
        >
          <button type="button">Editor</button>
        </CsoundEditorContextMenu>,
      );
    });

    const trigger = container.querySelector('button');
    await act(async () => {
      trigger!.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 10,
          clientY: 10,
        }),
      );
      await Promise.resolve();
    });

    const openManualItem = findMenuItem('Open Manual');
    await act(async () => {
      openManualItem!.click();
      await Promise.resolve();
    });

    expect(openCsoundManual).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe('myCustomVariable = 123');
    expect(view.state.selection.main.head).toBe(5);
  });

  it('shows non-blocking toast and leaves editor unchanged when open manual returns fallback', async () => {
    const openCsoundManual = vi.fn().mockResolvedValue({
      disposition: 'fallback',
      availability: 'missing',
      reason: 'missing',
      targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      message: 'Csound manual entry not found (404)',
    });
    window.blueAPI = {
      ...(window.blueAPI ?? {}),
      openCsoundManual,
    } as unknown as typeof window.blueAPI;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'a1 = oscili(0.5, 440)' },
      selection: { anchor: 7, head: 7 },
    });

    const editorViewRef = { current: view };
    act(() => {
      root.render(
        <CsoundEditorContextMenu
          editorViewRef={editorViewRef}
          menuItems={[
            {
              kind: 'command',
              id: 'open-manual',
              label: 'Open Manual',
              command: 'open-manual',
            },
          ]}
        >
          <button type="button">Editor</button>
        </CsoundEditorContextMenu>,
      );
    });

    const trigger = container.querySelector('button');
    await act(async () => {
      trigger!.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 10,
          clientY: 10,
        }),
      );
      await Promise.resolve();
    });

    const openManualItem = findMenuItem('Open Manual');
    await act(async () => {
      openManualItem!.click();
      await Promise.resolve();
    });

    expect(openCsoundManual).toHaveBeenCalledWith({ manualId: 'oscili' });
    expect(view.state.doc.toString()).toBe('a1 = oscili(0.5, 440)');
    expect(view.state.selection.main.head).toBe(7);
  });
});
