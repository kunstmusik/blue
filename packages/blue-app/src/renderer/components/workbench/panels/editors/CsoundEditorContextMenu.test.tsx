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

    expect(view.state.doc.toString()).toBe('ares oscil xamp, xcps [, ifn, iphs]');
  });
});
