// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorView } from 'codemirror';
import { undo as cmUndo } from '@codemirror/commands';
import SelectedCodeEditor, {
  createEditorSetupExtensions,
} from '../components/workbench/panels/editors/SelectedCodeEditor';
import {
  dispatchHistoryAction,
  registerHistoryEditorSettlement,
  registerHostDocument,
  settleHistoryEditors,
} from '../lib/history-scope-router';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('SelectedCodeEditor history and scope integration', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let rangeRectsDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    rangeRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 0, item: () => null }),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
    if (rangeRectsDescriptor) {
      Object.defineProperty(Range.prototype, 'getClientRects', rangeRectsDescriptor);
    } else {
      delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('configures project editor without local history and draft editor with local history', () => {
    const projectExts = createEditorSetupExtensions('project');
    const draftExts = createEditorSetupExtensions('draft');

    // The draft extensions include history() and historyKeymap, so length is strictly greater
    expect(draftExts.length).toBeGreaterThan(projectExts.length);
  });

  it('renders data-history-scope attribute corresponding to historyScope prop', () => {
    act(() => {
      root?.render(
        <SelectedCodeEditor
          value="instr 1\nendin"
          onChange={vi.fn()}
          ariaLabel="Test Orc Editor"
          historyScope="project"
        />,
      );
    });

    const projectEditor = container?.querySelector('.selected-code-editor');
    expect(projectEditor?.getAttribute('data-history-scope')).toBe('project');

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value="instr 1\nendin"
          onChange={vi.fn()}
          ariaLabel="Test Orc Editor"
          historyScope="draft"
        />,
      );
    });

    const draftEditor = container?.querySelector('.selected-code-editor');
    expect(draftEditor?.getAttribute('data-history-scope')).toBe('draft');
  });

  it('supports local undo in draft scope but not in project scope', () => {
    // 1. Project scope: typing does not create a local undo step in CodeMirror
    act(() => {
      root?.render(
        <SelectedCodeEditor
          value="initial"
          onChange={vi.fn()}
          ariaLabel="Project Editor"
          historyScope="project"
        />,
      );
    });

    const projectCmEl = container?.querySelector('.cm-editor') as HTMLElement;
    expect(projectCmEl).not.toBeNull();
    const projectView = EditorView.findFromDOM(projectCmEl)!;
    expect(projectView).not.toBeNull();

    // User types in project view
    projectView.dispatch({
      changes: { from: 7, to: 7, insert: ' edit' },
      userEvent: 'input.type',
    });
    expect(projectView.state.doc.toString()).toBe('initial edit');

    // Attempt local CodeMirror undo: should be a no-op (no local history installed)
    const projectUndoResult = cmUndo(projectView);
    expect(projectUndoResult).toBe(false);
    expect(projectView.state.doc.toString()).toBe('initial edit');

    // 2. Draft scope: typing DOES create a local undo step
    act(() => {
      root?.render(
        <SelectedCodeEditor
          value="draft initial"
          onChange={vi.fn()}
          ariaLabel="Draft Editor"
          historyScope="draft"
        />,
      );
    });

    const draftCmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const draftView = EditorView.findFromDOM(draftCmEl)!;

    draftView.dispatch({
      changes: { from: 13, to: 13, insert: ' draft edit' },
      userEvent: 'input.type',
    });
    expect(draftView.state.doc.toString()).toBe('draft initial draft edit');

    // Attempt local CodeMirror undo: successfully reverts
    const draftUndoResult = cmUndo(draftView);
    expect(draftUndoResult).toBe(true);
    expect(draftView.state.doc.toString()).toBe('draft initial');
  });

  it('isolates empty local history in draft scope without falling through to project history', async () => {
    const unregister = registerHostDocument(document);
    try {
      const mockProjectUndo = vi.fn().mockResolvedValue({ status: 'committed', revision: 2 });
      (window as unknown as { blueAPI: { undoProjectHistory: typeof mockProjectUndo } }).blueAPI = {
        undoProjectHistory: mockProjectUndo,
      };

      act(() => {
        root?.render(
          <SelectedCodeEditor
            value="draft content"
            onChange={vi.fn()}
            ariaLabel="Draft Editor"
            historyScope="draft"
          />,
        );
      });

      const contentEl = container?.querySelector('.cm-content') as HTMLElement;
      contentEl.focus();

      // Dispatch undo through the history router while focused on the draft editor with empty undo history
      const result = await dispatchHistoryAction('undo', document);

      expect(result.handled).toBe(true);
      expect(result.scope).toBe('draft');
      // Under no circumstances does draft undo fall through to project history
      expect(mockProjectUndo).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it('groups typing changes within 500 ms and flushes after 500 ms of inactivity', () => {
    const onChange = vi.fn();

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value=""
          onChange={onChange}
          ariaLabel="Debounced Editor"
          typingGroupingMs={500}
        />,
      );
    });

    const cmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const view = EditorView.findFromDOM(cmEl)!;

    // Type 'a' at t=0
    act(() => {
      view.dispatch({ changes: { from: 0, to: 0, insert: 'a' }, userEvent: 'input.type' });
    });
    expect(onChange).not.toHaveBeenCalled();

    // Advance 200 ms
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).not.toHaveBeenCalled();

    // Type 'b' at t=200
    act(() => {
      view.dispatch({ changes: { from: 1, to: 1, insert: 'b' }, userEvent: 'input.type' });
    });
    expect(onChange).not.toHaveBeenCalled();

    // Advance 300 ms (t=500, but only 300 ms since last keystroke)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();

    // Advance 200 ms more (500 ms since last keystroke 'b')
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  it('classifies CodeMirror insert, delete, replacement, and boundary transactions', () => {
    const onChange = vi.fn();

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value=""
          onChange={onChange}
          ariaLabel="Operation Editor"
          typingGroupingMs={500}
          historyMetadata={{
            fieldId: 'project-code:operation-test',
            label: 'Edit Code',
          }}
        />,
      );
    });

    const cmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const view = EditorView.findFromDOM(cmEl)!;

    act(() => {
      view.dispatch({ changes: { from: 0, to: 0, insert: 'a' }, userEvent: 'input.type' });
      view.dispatch({ changes: { from: 1, to: 1, insert: 'b' }, userEvent: 'input.type' });
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]).toEqual([
      'ab',
      expect.objectContaining({
        fieldId: 'project-code:operation-test',
        phase: 'single',
      }),
    ]);
    const firstGestureId = onChange.mock.calls[0]?.[1]?.gestureId;

    // Moving the caret is an operation boundary, so the next insertion gets a
    // fresh gesture even though it is still an insertion.
    act(() => {
      view.dispatch({ selection: { anchor: 0, head: 0 } });
      view.dispatch({ changes: { from: 0, to: 0, insert: 'c' }, userEvent: 'input.type' });
      view.dispatch({ changes: { from: 1, to: 1, insert: ' ' }, userEvent: 'input.type' });
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]).toEqual(['c ab', expect.objectContaining({ phase: 'single' })]);
    expect(onChange.mock.calls[1]?.[1]?.gestureId).not.toBe(firstGestureId);

    // A paste/replacement is atomic and flushes immediately rather than being
    // merged into the surrounding typing run.
    act(() => {
      view.dispatch({
        changes: { from: 0, to: 1, insert: 'XYZ' },
        userEvent: 'input.paste',
      });
    });
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls[2]).toEqual([
      'XYZ ab',
      expect.objectContaining({ phase: 'single' }),
    ]);

    // Deletions form their own grouped operation.
    act(() => {
      view.dispatch({ changes: { from: 5, to: 6, insert: '' }, userEvent: 'delete.backward' });
    });
    expect(onChange).toHaveBeenCalledTimes(3);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange.mock.calls[3]).toEqual(['XYZ a', expect.objectContaining({ phase: 'single' })]);
  });

  it('immediately flushes pending typing changes on blur without waiting for 500 ms', () => {
    const onChange = vi.fn();

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value=""
          onChange={onChange}
          ariaLabel="Blur Flush Editor"
          typingGroupingMs={500}
        />,
      );
    });

    const cmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const view = EditorView.findFromDOM(cmEl)!;

    // Type 'xyz'
    act(() => {
      view.dispatch({ changes: { from: 0, to: 0, insert: 'xyz' }, userEvent: 'input.type' });
    });
    expect(onChange).not.toHaveBeenCalled();

    // Trigger blur on cm-content
    const content = container?.querySelector('.cm-content') as HTMLElement;
    act(() => {
      content.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    });

    // Flushed immediately
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('xyz');
  });

  it('settles pending project text before the editor is torn down', () => {
    const onChange = vi.fn();

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value=""
          onChange={onChange}
          ariaLabel="Teardown Editor"
          historyScope="project"
          typingGroupingMs={500}
        />,
      );
    });

    const cmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const view = EditorView.findFromDOM(cmEl)!;
    act(() => {
      view.dispatch({ changes: { from: 0, to: 0, insert: 'pending' }, userEvent: 'input.type' });
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('pending');
  });

  it('preserves entire IME composition without triggering intermediate debounced commits', () => {
    const onChange = vi.fn();

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value=""
          onChange={onChange}
          ariaLabel="IME Editor"
          typingGroupingMs={500}
        />,
      );
    });

    const cmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const content = container?.querySelector('.cm-content') as HTMLElement;
    const view = EditorView.findFromDOM(cmEl)!;

    // 1. Composition starts
    act(() => {
      content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });

    // 2. Intermediate phonetic characters input
    act(() => {
      view.dispatch({ changes: { from: 0, to: 0, insert: 'ni' }, userEvent: 'input.type' });
    });

    // Advance 600 ms during composition: MUST NOT trigger onChange
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onChange).not.toHaveBeenCalled();

    // 3. IME finalizes characters to '你'
    act(() => {
      view.dispatch({ changes: { from: 0, to: 2, insert: '你' }, userEvent: 'input.type' });
      content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });

    // Still within debounce interval
    expect(onChange).not.toHaveBeenCalled();

    // Advance 500 ms after compositionend
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('你');
  });

  it('fails a history settlement after one second but preserves the composition draft', async () => {
    const onChange = vi.fn();

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value=""
          onChange={onChange}
          ariaLabel="Long IME Editor"
          typingGroupingMs={500}
        />,
      );
    });

    const cmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const content = container?.querySelector('.cm-content') as HTMLElement;
    const view = EditorView.findFromDOM(cmEl)!;

    act(() => {
      content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      view.dispatch({ changes: { from: 0, to: 0, insert: 'ni' }, userEvent: 'input.type' });
    });

    const settling = expect(settleHistoryEditors(document)).rejects.toThrow(/did not settle/i);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await settling;
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).toHaveBeenCalledWith('ni');
  });

  it('propagates editor settlement failures to the history router', async () => {
    const unregister = registerHistoryEditorSettlement(document, () =>
      Promise.reject(new Error('editor failed to settle')),
    );
    try {
      await expect(settleHistoryEditors(document)).rejects.toThrow('editor failed to settle');
    } finally {
      unregister();
    }
  });

  it('clamps selection on canonical value refresh and does not echo onChange', () => {
    const onChange = vi.fn();

    act(() => {
      root?.render(
        <SelectedCodeEditor
          value="a long string that will be shortened"
          onChange={onChange}
          ariaLabel="Clamping Editor"
        />,
      );
    });

    const cmEl = container?.querySelector('.cm-editor') as HTMLElement;
    const view = EditorView.findFromDOM(cmEl)!;

    // Set selection near the end (pos 25)
    view.dispatch({
      selection: { anchor: 25, head: 25 },
    });
    expect(view.state.selection.main.anchor).toBe(25);

    // Canonical update arrives with a much shorter string (5 chars)
    act(() => {
      root?.render(
        <SelectedCodeEditor value="short" onChange={onChange} ariaLabel="Clamping Editor" />,
      );
    });

    // Document is updated
    expect(view.state.doc.toString()).toBe('short');
    // Selection is clamped to doc length (5)
    expect(view.state.selection.main.anchor).toBe(5);
    expect(view.state.selection.main.head).toBe(5);
    // Canonical refresh did NOT trigger onChange (no echo)
    expect(onChange).not.toHaveBeenCalled();
  });
});
