// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  NoteProcessorChainSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectEditorTargetSnapshot,
  TimeConversionContext,
} from '../../shared/project-editor';
import ScoreObjectPropertiesForm from '../components/workbench/panels/score-object/ScoreObjectPropertiesForm';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DEFAULT_TIME_CONTEXT: TimeConversionContext = {
  meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
  tempoEnabled: false,
  initialTempo: 60,
  sampleRate: 44100,
};

function makeTarget(selectionId: string): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId,
    selectedObjectType: 'GenericScore',
    editorObjectType: 'GenericScore',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function makeChain(processorType: 'AddProcessor' | 'MultiplyProcessor'): NoteProcessorChainSnapshot {
  return {
    processors: [{
      id: `np-${processorType}`,
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

function makeDocument(selectionId: string, processorType: 'AddProcessor' | 'MultiplyProcessor'): ScoreObjectEditorDocumentSnapshot {
  const target = makeTarget(selectionId);
  return {
    target,
    shared: {
      target,
      name: selectionId,
      startTime: { value: 0, timeBase: 'BEATS', displayText: '0.0000' },
      subjectiveDuration: { value: 4, timeBase: 'BEATS', displayText: '4.0000' },
      endTimeDisplay: '4.0000',
      backgroundColor: 0,
      timeBehavior: 'NONE',
      repeatPoint: null,
      noteProcessorChain: makeChain(processorType),
    },
    editor: { kind: 'code', target, syntax: 'csound-score', text: 'i1 0 1 440' },
    timeContext: DEFAULT_TIME_CONTEXT,
  };
}

function renderForm(document: ScoreObjectEditorDocumentSnapshot): { container: HTMLDivElement; root: Root; onPatch: ReturnType<typeof vi.fn> } {
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  const root = createRoot(container);
  const onPatch = vi.fn();

  act(() => {
    root.render(<ScoreObjectPropertiesForm document={document} onPatch={onPatch} />);
  });

  return { container, root, onPatch };
}

function findButton(container: HTMLDivElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ScoreObjectPropertiesForm note processor editor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resets the embedded chain editor when the selected target changes', () => {
    const { container, root, onPatch } = renderForm(makeDocument('object-a', 'AddProcessor'));
    expect(container.innerHTML).toContain('AddProcessor');

    act(() => {
      root.render(<ScoreObjectPropertiesForm document={makeDocument('object-b', 'MultiplyProcessor')} onPatch={onPatch} />);
    });

    expect(container.innerHTML).toContain('MultiplyProcessor');
    expect(container.innerHTML).not.toContain('AddProcessor</span>');

    act(() => {
      root.unmount();
    });
  });

  it('keeps the score-object properties form on the compact inspector field classes', () => {
    const { container, root } = renderForm(makeDocument('object-a', 'AddProcessor'));

    expect(container.innerHTML).toContain('w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-body text-gray-100 focus:border-blue-accent focus:outline-none');
    expect(container.innerHTML).toContain('w-28 shrink-0 text-right text-body text-app-text');
    expect(container.innerHTML).not.toContain('px-3 py-2 text-sm');
    expect(container.innerHTML).not.toContain('w-28 shrink-0 text-right text-sm text-blue-muted');

    act(() => {
      root.unmount();
    });
  });

  it('saves named chains from the embedded object properties editor', () => {
    const { container, root, onPatch } = renderForm(makeDocument('object-a', 'AddProcessor'));

    act(() => {
      findButton(container, 'Save As...').click();
    });

    const input = container.querySelector('input[placeholder="Chain name"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    act(() => {
      setInputValue(input!, 'Object Chain');
      findButton(container, 'OK').click();
    });

    const patch = onPatch.mock.calls[0]?.[0];
    expect(patch).toMatchObject({
      type: 'saveNamedNoteProcessorChain',
      name: 'Object Chain',
      chain: {
        processors: [{ processorType: 'AddProcessor' }],
      },
    });

    act(() => {
      root.unmount();
    });
  });
});
