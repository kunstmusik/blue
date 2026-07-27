// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from 'codemirror';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelectedCodeEditor from '../components/workbench/panels/editors/SelectedCodeEditor';
import type { JavaBlueCsoundCompletionOptions } from '../components/workbench/panels/editors/editor-adapter-types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

  beforeEach(() => {
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300,
      toJSON: () => ({}),
    } as DOMRect);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    rectSpy.mockRestore();
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
    renderWith({ projectUdos: [{ name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' }] });

    const viewBefore = getView();
    expect(viewBefore).not.toBeNull();
    const docBefore = viewBefore!.state.doc.toString();

    // Simulate the project store handing back a fresh array (new identity,
    // same content) on a project-document-updated broadcast.
    renderWith({ projectUdos: [{ name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' }] });

    const viewAfter = getView();
    // The view was NOT destroyed and rebuilt — same instance survives.
    expect(viewAfter).toBe(viewBefore);
    // The document content is unchanged.
    expect(viewAfter!.state.doc.toString()).toBe(docBefore);
  });

  it('still applies new completion options without rebuilding the view', () => {
    renderWith({ projectUdos: [{ name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' }] });
    const viewBefore = getView();
    expect(viewBefore).not.toBeNull();

    // Different options content (a new UDO) — must reconfigure, not rebuild.
    renderWith({ projectUdos: [
      { name: 'A', style: 'CLASSIC', outTypes: 'a', inTypes: 'a', inputArguments: '' },
      { name: 'B', style: 'CLASSIC', outTypes: 'a', inTypes: 'k', inputArguments: '' },
    ] });

    const viewAfter = getView();
    expect(viewAfter).toBe(viewBefore);
  });
});
