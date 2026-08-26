// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreObjectEditorDocumentSnapshot } from '../../shared/project-editor';
import { applyPatchToDocument } from '../components/workbench/panels/score-object/score-object-document-reducer';
import ObjectBuilderScoreObjectEditor from '../components/workbench/panels/score-object/editors/ObjectBuilderScoreObjectEditor';
import { resolveEditorComponent } from '../components/workbench/panels/score-object/editor-registry';
import { chooseAppSelectOption, getAppSelectOptionLabels } from './app-select-test-utils';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, mode, readOnly, javaBlueCompletionOptions, onChange }: {
    value: string;
    mode: string;
    readOnly: boolean;
    javaBlueCompletionOptions?: { bsbReplacementKeys?: Array<{ key: string }> };
    onChange: (text: string) => void;
  }) => (
    <textarea
      aria-label="ObjectBuilder code"
      data-mode={mode}
      data-bsb-keys={javaBlueCompletionOptions?.bsbReplacementKeys?.map((item) => item.key).join(',')}
      readOnly={readOnly}
      value={value}
      onChange={(event) => { onChange(event.target.value); }}
    />
  ),
}));

vi.mock('../components/workbench/panels/score-object/editors/JythonRuntimeStatusIndicator', () => ({
  default: () => <span>Jython status</span>,
}));

vi.mock('../components/workbench/panels/orchestra/bsb/BSBInterfaceEditor', () => ({
  default: () => <div>ObjectBuilder BSB interface</div>,
}));

vi.mock('../components/workbench/panels/score-object/editors/useScoreObjectTest', () => ({
  useScoreObjectTest: () => ({
    testing: false,
    testOutput: null,
    testError: null,
    runTest: vi.fn(async () => undefined),
    clearTestOutput: vi.fn(),
    clearTestError: vi.fn(),
  }),
}));

function createDocument(): ScoreObjectEditorDocumentSnapshot {
  const target = {
    selectionId: 'builder-0',
    selectedObjectType: 'ObjectBuilder',
    editorObjectType: 'ObjectBuilder',
    ownerKind: 'timeline' as const,
    displayContext: 'timeline' as const,
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };

  return {
    id: 'builder-doc',
    title: 'ObjectBuilder',
    target,
    shared: {
      target,
      name: 'ObjectBuilder',
      startTime: { value: 0, timeBase: 'BEATS' },
      subjectiveDuration: { value: 4, timeBase: 'BEATS' },
      endTimeDisplay: '4',
      backgroundColor: 0,
    },
    editor: {
      kind: 'code',
      target,
      syntax: 'python',
      text: 'score = "i1 0 1"',
      auxiliaryFlags: {
        languageType: 'PYTHON',
        commandLine: '',
        editEnabled: true,
        comment: 'notes',
      },
      bsbInstrument: {
        type: 'blueSynthBuilder',
        assignmentId: '',
        name: 'ObjectBuilder',
        enabled: true,
        comment: '',
        instrumentText: '',
        alwaysOnInstrumentText: '',
        globalOrc: '',
        globalSco: '',
        objectNames: ['amp'],
        widgets: [],
        editEnabled: true,
        gridSettings: { enabled: true, snapEnabled: true, width: 10, height: 10, gridStyle: 'DOT' },
        widgetTree: {
          id: 'root', type: 'BSBRootGroup', objectName: '', x: 0, y: 0,
          width: 0, height: 0, value: 0, minimum: 0, maximum: 0,
          editable: true, properties: {}, children: [],
        },
      },
    },
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

describe('ObjectBuilder editor parity', () => {
  it('routes ObjectBuilder JavaScript mode to its dedicated editor', () => {
    const doc = createDocument();
    if (doc.editor.kind !== 'code') throw new Error('Expected code editor');
    doc.editor.syntax = 'javascript';

    expect(resolveEditorComponent(doc.editor)).toBe(ObjectBuilderScoreObjectEditor);
  });

  it('updates optimistic syntax and flags without erasing code', () => {
    const doc = createDocument();
    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        languageType: 'CLOJURE',
        editEnabled: false,
        comment: 'updated',
        bsbInterfacePatch: { type: 'updateGridSettings', patch: { width: 24 } },
      },
    });

    expect(next.editor.kind).toBe('code');
    if (next.editor.kind !== 'code') return;
    expect(next.editor.text).toBe('score = "i1 0 1"');
    expect(next.editor.syntax).toBe('clojure');
    expect(next.editor.auxiliaryFlags).toMatchObject({
      languageType: 'CLOJURE',
      editEnabled: false,
      comment: 'updated',
    });
    expect(next.editor.bsbInstrument?.gridSettings.width).toBe(24);
    expect(doc.editor.kind === 'code' ? doc.editor.bsbInstrument?.gridSettings.width : undefined).toBe(10);
  });

  it('exposes all Java language choices and enables command line only for External', async () => {
    const onPatch = vi.fn();
    await act(async () => {
      root.render(<ObjectBuilderScoreObjectEditor document={createDocument()} onPatch={onPatch} />);
    });

    expect(container.textContent).toContain('ObjectBuilder BSB interface');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-object-builder-tab="code"]')?.click();
    });

    const language = container.querySelector<HTMLButtonElement>('[aria-label="ObjectBuilder language"]');
    const commandLine = container.querySelector<HTMLInputElement>('[aria-label="ObjectBuilder command line"]');
    const codeEditor = container.querySelector<HTMLTextAreaElement>('[aria-label="ObjectBuilder code"]');
    expect(await getAppSelectOptionLabels(language!)).toEqual([
      'Python', 'JavaScript', 'Clojure', 'External',
    ]);
    expect(commandLine?.disabled).toBe(true);
    expect(codeEditor?.dataset.bsbKeys).toBe('amp');

    await chooseAppSelectOption(language!, 'External');

    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'updateTypeSpecificEditor',
      patch: { languageType: 'EXTERNAL' },
    }));

    const externalDocument = applyPatchToDocument(createDocument(), {
      type: 'updateTypeSpecificEditor',
      target: createDocument().target,
      patch: { languageType: 'EXTERNAL' },
    });
    await act(async () => {
      root.render(<ObjectBuilderScoreObjectEditor document={externalDocument} onPatch={onPatch} />);
    });
    expect(container.querySelector<HTMLInputElement>('[aria-label="ObjectBuilder command line"]')?.disabled).toBe(false);
  });
});
