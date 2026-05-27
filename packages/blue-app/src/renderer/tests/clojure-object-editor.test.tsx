// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClojureObjectEditor from '../components/workbench/panels/score-object/editors/ClojureObjectEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useScoreObjectTestMock = vi.fn(() => ({
  testing: false,
  testOutput: null,
  testError: null,
  runTest: vi.fn(async () => undefined),
  clearTestOutput: vi.fn(),
  clearTestError: vi.fn(),
}));

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Clojure code editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('../components/workbench/panels/score-object/editors/GeneratedScoreModal', () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('../components/workbench/panels/score-object/editors/useScoreObjectTest', () => ({
  useScoreObjectTest: (...args: unknown[]) => useScoreObjectTestMock(...args),
}));

function createDocument() {
  const target = {
    selectionId: 'clojure-0',
    selectedObjectType: 'ClojureObject',
    editorObjectType: 'ClojureObject',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };

  return {
    id: 'clojure-doc',
    title: 'Clojure Object',
    target,
    editor: {
      kind: 'code',
      target,
      syntax: 'text',
      text: '(defn phrase [] score)',
      auxiliaryFlags: {
        onLoadProcessable: true,
      },
    },
  } as any;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useScoreObjectTestMock.mockClear();
  useScoreObjectTestMock.mockReturnValue({
    testing: false,
    testOutput: null,
    testError: null,
    runTest: vi.fn(async () => undefined),
    clearTestOutput: vi.fn(),
    clearTestError: vi.fn(),
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
  vi.unstubAllGlobals();
});

describe('ClojureObjectEditor', () => {
  it('calls the preload reinitialize action from the editor control', async () => {
    const reinitializeClojureRuntime = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('window', {
      ...window,
      blueAPI: { reinitializeClojureRuntime },
    });

    await act(async () => {
      root.render(<ClojureObjectEditor document={createDocument()} onPatch={vi.fn()} />);
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Reinitialize',
    );

    await act(async () => {
      button?.click();
    });

    expect(reinitializeClojureRuntime).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Error:');
  });

  it('shows the runtime error returned by a failed reinitialize action', async () => {
    const reinitializeClojureRuntime = vi.fn(async () => ({ ok: false, error: 'Java runtime is unavailable' }));
    vi.stubGlobal('window', {
      ...window,
      blueAPI: { reinitializeClojureRuntime },
    });

    await act(async () => {
      root.render(<ClojureObjectEditor document={createDocument()} onPatch={vi.fn()} />);
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Reinitialize',
    );

    await act(async () => {
      button?.click();
    });

    expect(container.textContent).toContain('Java runtime is unavailable');
  });
});