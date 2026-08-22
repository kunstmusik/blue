// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteProcessorChainSnapshot } from '../../shared/project-editor';
import NoteProcessorChainEditor from '../components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor';
import { useNoteProcessorClipboardStore } from '../stores/note-processor-clipboard-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange?: (text: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel ?? 'Code editor'}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

function findButton(container: Element, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findButtonsByText(container: Element, label: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter((candidate) => candidate.textContent === label);
}

describe('PythonProcessor Add/Edit UI', () => {
  beforeEach(() => {
    useNoteProcessorClipboardStore.getState().clearClipboard();
  });

  afterEach(() => {
    useNoteProcessorClipboardStore.getState().clearClipboard();
    document.body.innerHTML = '';
  });

  it('can add PythonProcessor from the + Add menu', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCommit = vi.fn();

    const initialChain: NoteProcessorChainSnapshot = {
      processors: [],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    };

    act(() => {
      root.render(
        <NoteProcessorChainEditor
          chain={initialChain}
          onCommit={onCommit}
        />,
      );
    });

    // Click + Add button
    act(() => {
      findButton(container, '+ Add').click();
    });

    // Click PythonProcessor from dropdown
    const pythonAddBtn = findButton(container, 'PythonProcessor');
    expect(pythonAddBtn).toBeDefined();

    act(() => {
      pythonAddBtn.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      processors: [
        expect.objectContaining({
          processorType: 'PythonProcessor',
          parameters: { code: expect.stringContaining('for note in noteList:') },
        }),
      ],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    });

    act(() => root.unmount());
  });

  it('renders code parameter preview and opens edit modal', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCommit = vi.fn();

    const chain: NoteProcessorChainSnapshot = {
      processors: [
        {
          id: 'np-py-1',
          processorType: 'PythonProcessor',
          displayName: 'PythonProcessor',
          supported: true,
          deferred: false,
          summary: 'PythonProcessor',
          parameters: { code: 'for note in notes:\n    print(note)' },
          serializedXml: '',
        },
      ],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    };

    act(() => {
      root.render(
        <NoteProcessorChainEditor
          chain={chain}
          onCommit={onCommit}
        />,
      );
    });

    // Select the PythonProcessor row
    const row = container.querySelector('.cursor-pointer') as HTMLElement;
    expect(row).not.toBeNull();
    act(() => {
      row.click();
    });

    // Check properties section
    expect(container.textContent).toContain('PythonProcessor Properties');
    expect(container.textContent).toContain('2 line(s) of Python code');

    const editCodeBtn = findButton(container, 'Edit Code...');
    expect(editCodeBtn).toBeDefined();

    // Click "Edit Code..." to open modal
    act(() => {
      editCodeBtn.click();
    });

    // Modal should be open
    const modal = document.querySelector('[role="dialog"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('PythonProcessor - Edit Code');

    // Save button should be present in modal
    const saveBtn = findButton(modal!, 'Save');
    expect(saveBtn).toBeDefined();

    act(() => root.unmount());
  });

  it('saves edited Python code from the modal and commits updated chain snapshot', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCommit = vi.fn();

    const chain: NoteProcessorChainSnapshot = {
      processors: [
        {
          id: 'np-py-1',
          processorType: 'PythonProcessor',
          displayName: 'PythonProcessor',
          supported: true,
          deferred: false,
          summary: 'PythonProcessor',
          parameters: { code: '' },
          serializedXml: '',
        },
      ],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    };

    act(() => {
      root.render(
        <NoteProcessorChainEditor
          chain={chain}
          onCommit={onCommit}
        />,
      );
    });

    // Select the PythonProcessor row
    act(() => {
      (container.querySelector('.cursor-pointer') as HTMLElement).click();
    });

    // Click Edit Code...
    act(() => {
      findButton(container, 'Edit Code...').click();
    });

    const modal = document.querySelector('[role="dialog"]')!;
    expect(modal).not.toBeNull();

    // Edit code in the textarea
    const textarea = modal.querySelector('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      const newCode = 'for note in notes:\n    note.setPField(4, 5.0)';
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, newCode);
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
      textarea!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click Save in the modal
    act(() => {
      findButton(modal, 'Save').click();
    });

    // Modal should close
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // onCommit should be called with updated code
    expect(onCommit).toHaveBeenCalledWith({
      processors: [
        expect.objectContaining({
          processorType: 'PythonProcessor',
          parameters: expect.objectContaining({
            code: 'for note in notes:\n    note.setPField(4, 5.0)',
          }),
        }),
      ],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    });

    act(() => root.unmount());
  });

  it('cancels modal edits without modifying the chain snapshot', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCommit = vi.fn();

    const chain: NoteProcessorChainSnapshot = {
      processors: [
        {
          id: 'np-py-1',
          processorType: 'PythonProcessor',
          displayName: 'PythonProcessor',
          supported: true,
          deferred: false,
          summary: 'PythonProcessor',
          parameters: { code: 'initial_code = True' },
          serializedXml: '',
        },
      ],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    };

    act(() => {
      root.render(
        <NoteProcessorChainEditor
          chain={chain}
          onCommit={onCommit}
        />,
      );
    });

    // Select row & open modal
    act(() => {
      (container.querySelector('.cursor-pointer') as HTMLElement).click();
    });
    act(() => {
      findButton(container, 'Edit Code...').click();
    });

    const modal = document.querySelector('[role="dialog"]')!;
    const textarea = modal.querySelector('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      const changedCode = 'discard_this = True';
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, changedCode);
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Click Cancel
    act(() => {
      findButton(modal, 'Cancel').click();
    });

    // Modal closed and onCommit not called for the cancel action
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();

    act(() => root.unmount());
  });
});
