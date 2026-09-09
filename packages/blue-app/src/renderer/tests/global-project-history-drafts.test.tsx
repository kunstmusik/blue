// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorView } from 'codemirror';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelectedCodeEditor from '../components/workbench/panels/editors/SelectedCodeEditor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function getEditorText(container: HTMLElement): string {
  const mount = container.querySelector('.cm-editor');
  const view = EditorView.findFromDOM(mount as HTMLElement);
  return view ? view.state.doc.toString() : '';
}

function dispatchEditorEdit(container: HTMLElement, text: string): void {
  const mount = container.querySelector('.cm-editor');
  const view = EditorView.findFromDOM(mount as HTMLElement);
  if (!view) throw new Error('EditorView not found');
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

describe('global project history draft-conflict resolution (T036, US2)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let blueApiDescriptor: PropertyDescriptor | undefined;
  let rectSpy: ReturnType<typeof vi.spyOn>;
  let rangeRectsDescriptor: PropertyDescriptor | undefined;

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
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 0, item: () => null }),
    });
    Object.defineProperty(window, 'blueAPI', {
      configurable: true,
      value: {},
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (rangeRectsDescriptor) {
      Object.defineProperty(Range.prototype, 'getClientRects', rangeRectsDescriptor);
    }
    if (blueApiDescriptor) {
      Object.defineProperty(window, 'blueAPI', blueApiDescriptor);
    }
    rectSpy.mockRestore();
  });

  function renderEditor(value: string, onChange: (text: string) => void): void {
    act(() => {
      root.render(
        React.createElement(SelectedCodeEditor, {
          value,
          ariaLabel: 'Draft test editor',
          mode: 'orc',
          onChange,
        }),
      );
    });
  }

  it('surfaces an explicit conflict instead of clobbering un-submitted drafts', () => {
    const onChange = vi.fn();
    renderEditor('sr = 44100', onChange);

    // User types local edits that have not been acknowledged yet.
    act(() => {
      dispatchEditorEdit(container, 'sr = 48000 ; local draft');
    });
    expect(onChange).toHaveBeenCalledWith('sr = 48000 ; local draft');

    // A canonical change from another view arrives for this field.
    act(() => {
      renderEditor('sr = 22050 ; canonical undo');
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    const dialog = container.querySelector('[data-testid="draft-conflict-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Document changed elsewhere');

    // The draft is retained, never silently discarded or replayed.
    expect(getEditorText(container)).toBe('sr = 48000 ; local draft');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft on dismiss without submitting it again', () => {
    const onChange = vi.fn();
    renderEditor('line one', onChange);
    act(() => {
      dispatchEditorEdit(container, 'line one edited');
    });

    act(() => {
      renderEditor('line one canonical', onChange);
    });

    const keepButton = container.querySelector('[data-action-id="keep"]');
    expect(keepButton).not.toBeNull();
    act(() => {
      (keepButton as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="draft-conflict-dialog"]')).toBeNull();
    expect(getEditorText(container)).toBe('line one edited');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('discards the draft and takes the canonical value on the destructive decision', () => {
    const onChange = vi.fn();
    renderEditor('original', onChange);
    act(() => {
      dispatchEditorEdit(container, 'original edited');
    });
    act(() => {
      renderEditor('canonical value', onChange);
    });

    const discardButton = container.querySelector('[data-action-id="discard"]');
    expect(discardButton).not.toBeNull();
    act(() => {
      (discardButton as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="draft-conflict-dialog"]')).toBeNull();
    expect(getEditorText(container)).toBe('canonical value');
    // Discarding never submits anything.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reapplies the retained draft once on Apply for current-target validation', () => {
    const onChange = vi.fn();
    renderEditor('before', onChange);
    act(() => {
      dispatchEditorEdit(container, 'before edited');
    });
    act(() => {
      renderEditor('canonical value', onChange);
    });

    const applyButton = container.querySelector('[data-action-id="apply"]');
    expect(applyButton).not.toBeNull();
    act(() => {
      (applyButton as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="draft-conflict-dialog"]')).toBeNull();
    expect(getEditorText(container)).toBe('before edited');
    // The draft is submitted exactly once for main-side revision-fenced
    // validation — never replayed automatically per canonical change.
    expect(onChange).toHaveBeenLastCalledWith('before edited');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('applies canonical updates silently when there is no local draft', () => {
    const onChange = vi.fn();
    renderEditor('first', onChange);
    expect(container.querySelector('[data-testid="draft-conflict-dialog"]')).toBeNull();

    act(() => {
      renderEditor('second', onChange);
    });
    expect(getEditorText(container)).toBe('second');
    expect(container.querySelector('[data-testid="draft-conflict-dialog"]')).toBeNull();

    // Edits that were already acknowledged do not conflict with the same
    // canonical value echoing back.
    act(() => {
      dispatchEditorEdit(container, 'second typed');
    });
    act(() => {
      renderEditor('second typed', onChange);
    });
    expect(container.querySelector('[data-testid="draft-conflict-dialog"]')).toBeNull();
    expect(getEditorText(container)).toBe('second typed');
  });
});
