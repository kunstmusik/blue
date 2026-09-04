// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from 'codemirror';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelectedCodeEditor from '../components/workbench/panels/editors/SelectedCodeEditor';
import type { JavaBlueCsoundCompletionOptions } from '../components/workbench/panels/editors/editor-adapter-types';
import { useCodeRepositoryStore } from '../stores/code-repository-store';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Regression coverage for the cursor-reset bug fixed by reconfiguring the
 * autocompletion extension through a Compartment instead of destroying and
 * rebuilding the EditorView when `javaBlueCompletionOptions` changes identity.
 *
 * The project store replaces `projectUdos` (and instrument `udolist`) with a
 * fresh array on every project broadcast, so the host `useMemo` produces a new
 * options object after each keystroke's debounced commit. Before the fix, that
 * new identity tore down the whole editor and reset the cursor to position 0.
 */
describe('SelectedCodeEditor completion reconfigure', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let rectSpy: ReturnType<typeof vi.spyOn>;
  let rangeRectsDescriptor: PropertyDescriptor | undefined;
  let blueApiDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      toJSON: () => ({}),
    } as DOMRect);
    rangeRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
    blueApiDescriptor = Object.getOwnPropertyDescriptor(window, 'blueAPI');
    useCodeRepositoryStore.getState().dispose();
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 0, item: () => null }),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    rectSpy.mockRestore();
    if (rangeRectsDescriptor) {
      Object.defineProperty(Range.prototype, 'getClientRects', rangeRectsDescriptor);
    } else {
      delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    }
    useCodeRepositoryStore.getState().dispose();
    if (blueApiDescriptor) {
      Object.defineProperty(window, 'blueAPI', blueApiDescriptor);
    } else {
      delete (window as { blueAPI?: unknown }).blueAPI;
    }
    container.remove();
  });

  function renderWith(options: JavaBlueCsoundCompletionOptions, value = 'instr 1\nendin'): void {
    act(() => {
      root.render(
        React.createElement(SelectedCodeEditor, {
          value,
          ariaLabel: 'test editor',
          onChange: () => undefined,
          javaBlueCompletionOptions: options,
        }),
      );
    });
  }

  function getView(): EditorView | null {
    const editorEl = container.querySelector('.cm-editor') as HTMLElement | null;
    if (!editorEl) return null;
    return EditorView.findFromDOM(editorEl);
  }

  it('preserves the EditorView instance and document when completion options identity changes', () => {
    renderWith({
      projectUdos: [
        { name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' },
      ],
    });

    const viewBefore = getView();
    expect(viewBefore).not.toBeNull();
    const docBefore = viewBefore!.state.doc.toString();

    // Simulate the project store handing back a fresh array (new identity,
    // same content) on a project-document-updated broadcast.
    renderWith({
      projectUdos: [
        { name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' },
      ],
    });

    const viewAfter = getView();
    // The view was NOT destroyed and rebuilt — same instance survives.
    expect(viewAfter).toBe(viewBefore);
    // The document content is unchanged.
    expect(viewAfter!.state.doc.toString()).toBe(docBefore);
  });

  it('still applies new completion options without rebuilding the view', () => {
    renderWith({
      projectUdos: [
        { name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' },
      ],
    });
    const viewBefore = getView();
    expect(viewBefore).not.toBeNull();

    // Different options content (a new UDO) — must reconfigure, not rebuild.
    renderWith({
      projectUdos: [
        { name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' },
        { name: 'B', style: 'CLASSIC', outTypes: 'a', inTypes: 'k', inputArguments: '' },
      ],
    });

    const viewAfter = getView();
    expect(viewAfter).toBe(viewBefore);
  });

  it('updates the rendered Add to Code Repository menu item from the live selection', async () => {
    renderWith({});
    const view = getView();
    expect(view).not.toBeNull();
    const trigger = container.querySelector('.selected-code-editor') as HTMLElement;

    act(() =>
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 12,
          clientY: 12,
        }),
      ),
    );
    let addItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes('Add to Code Repository'),
    );
    expect(addItem?.getAttribute('data-disabled')).not.toBeNull();

    act(() => {
      view!.dispatch({ selection: { anchor: 0, head: 5 } });
    });
    act(() =>
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 12,
          clientY: 12,
        }),
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    addItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes('Add to Code Repository'),
    );
    expect(addItem?.getAttribute('data-disabled')).toBeNull();
  });

  it('initializes repository snapshots and the local Add flow in a standalone editor', async () => {
    const snapshot = {
      root: {
        id: CODE_REPOSITORY_ROOT_ID,
        kind: 'root' as const,
        name: 'Code Repository',
        parentId: null,
        order: 0,
        children: [],
      },
      contentRevision: 4,
      initialized: true,
    };
    const onCodeRepositoryChanged = vi.fn(() => () => undefined);
    const getCodeRepositorySnapshot = vi.fn(async () => ({ ok: true as const, value: snapshot }));
    Object.defineProperty(window, 'blueAPI', {
      configurable: true,
      value: { onCodeRepositoryChanged, getCodeRepositorySnapshot },
    });

    renderWith({}, 'selected Csound');
    await act(async () => {
      await Promise.resolve();
    });
    expect(onCodeRepositoryChanged).toHaveBeenCalledOnce();
    expect(getCodeRepositorySnapshot).toHaveBeenCalledOnce();
    expect(useCodeRepositoryStore.getState().snapshot).toEqual(snapshot);

    const view = getView()!;
    const trigger = container.querySelector('.selected-code-editor') as HTMLElement;
    act(() => view.dispatch({ selection: { anchor: 0, head: 8 } }));
    act(() =>
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 12,
          clientY: 12,
        }),
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const addItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes('Add to Code Repository'),
    );
    expect(addItem).toBeTruthy();
    await act(async () => {
      addItem!.click();
      await Promise.resolve();
    });
    expect(
      [...document.body.querySelectorAll('h2')].some(
        (heading) => heading.textContent === 'Add to Code Repository',
      ),
    ).toBe(true);
    expect(document.body.textContent).toContain('selected');
  });
});
