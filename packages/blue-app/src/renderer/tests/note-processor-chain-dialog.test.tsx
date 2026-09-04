// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteProcessorChainSnapshot } from '../../shared/project-editor';
import NoteProcessorChainDialog from '../components/workbench/panels/score-object/note-processors/NoteProcessorChainDialog';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { mockProjectState } = vi.hoisted(() => ({
  mockProjectState: {
    applyProjectDocumentPatch: vi.fn(),
  },
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: typeof mockProjectState) => unknown) =>
    selector(mockProjectState),
}));

const CHAIN: NoteProcessorChainSnapshot = {
  processors: [
    {
      id: 'np-test',
      processorType: 'AddProcessor',
      displayName: 'AddProcessor',
      supported: true,
      deferred: false,
      summary: 'AddProcessor',
      parameters: { pfield: '4', val: '5' },
      serializedXml: '',
    },
  ],
  hasUnsupportedProcessors: false,
  hasDeferredProcessors: false,
};

function renderDialog(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <NoteProcessorChainDialog
        title="Note Processors"
        chain={CHAIN}
        onClose={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
  });

  return { container, root };
}

function findButton(container: HTMLDivElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('NoteProcessorChainDialog', () => {
  beforeEach(() => {
    mockProjectState.applyProjectDocumentPatch.mockClear();
    Object.assign(window, {
      blueAPI: {
        getNamedChainNames: vi.fn().mockResolvedValue([]),
        getNamedChain: vi.fn().mockResolvedValue(null),
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as Window & { blueAPI?: unknown }).blueAPI;
  });

  it('saves named chains through the project document patch path', () => {
    const { container, root } = renderDialog();

    act(() => {
      findButton(container, 'Save As...').click();
    });

    const input = container.querySelector(
      'input[placeholder="Chain name"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();

    act(() => {
      setInputValue(input!, 'Favorite Chain');
      findButton(container, 'OK').click();
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'saveNamedNoteProcessorChain',
        name: 'Favorite Chain',
        chain: expect.objectContaining({
          processors: [expect.objectContaining({ processorType: 'AddProcessor' })],
        }),
      },
    });

    act(() => {
      root.unmount();
    });
  });
});
