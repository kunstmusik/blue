// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteProcessorChainSnapshot } from '../../shared/project-editor';
import NoteProcessorChainEditor from '../components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor';
import { useNoteProcessorClipboardStore } from '../stores/note-processor-clipboard-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeChain(
  id: string,
  processorType: 'AddProcessor' | 'MultiplyProcessor',
): NoteProcessorChainSnapshot {
  return {
    processors: [{
      id,
      processorType,
      displayName: processorType,
      supported: true,
      deferred: false,
      summary: processorType,
      parameters: { pfield: '4', val: processorType === 'AddProcessor' ? '5' : '2' },
      serializedXml: '',
    }],
    hasUnsupportedProcessors: false,
    hasDeferredProcessors: false,
  };
}

function findButton(container: Element, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

describe('shared Note Processor clipboard', () => {
  beforeEach(() => useNoteProcessorClipboardStore.getState().clearClipboard());

  afterEach(() => {
    useNoteProcessorClipboardStore.getState().clearClipboard();
    document.body.innerHTML = '';
  });

  it('copies from one chain editor and pastes an independent entry into another', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const sourceCommit = vi.fn();
    const targetCommit = vi.fn();

    act(() => {
      root.render(
        <>
          <div data-editor="source">
            <NoteProcessorChainEditor
              chain={makeChain('source-id', 'AddProcessor')}
              onCommit={sourceCommit}
            />
          </div>
          <div data-editor="target">
            <NoteProcessorChainEditor
              chain={makeChain('target-id', 'MultiplyProcessor')}
              onCommit={targetCommit}
            />
          </div>
        </>,
      );
    });

    const source = container.querySelector('[data-editor="source"]')!;
    const target = container.querySelector('[data-editor="target"]')!;
    expect(findButton(target, 'Paste').disabled).toBe(true);

    act(() => (source.querySelector('.cursor-pointer') as HTMLElement).click());
    act(() => findButton(source, 'Copy').click());

    expect(findButton(target, 'Paste').disabled).toBe(false);
    const copiedId = useNoteProcessorClipboardStore.getState().clipboard?.id;
    act(() => findButton(target, 'Paste').click());

    expect(targetCommit).toHaveBeenCalledWith({
      processors: [
        expect.objectContaining({ id: expect.any(String), processorType: 'MultiplyProcessor' }),
        expect.objectContaining({ id: expect.any(String), processorType: 'AddProcessor' }),
      ],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    });
    expect(targetCommit.mock.calls[0]?.[0].processors[1].id).not.toBe(copiedId);
    expect(sourceCommit).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it('detaches nested parameter data when capturing the shared buffer', () => {
    const entry = makeChain('source-id', 'AddProcessor').processors[0]!;
    useNoteProcessorClipboardStore.getState().setClipboard(entry);
    entry.parameters.val = '99';

    expect(useNoteProcessorClipboardStore.getState().clipboard?.parameters.val).toBe('5');
  });
});
