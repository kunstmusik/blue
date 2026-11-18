// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PolyObjectLayerGroupSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectEditorTargetSnapshot,
  ScoreRowObjectSnapshot,
} from '../../shared/project-editor';
import { setProjectHistoryProjection } from '../hooks/use-project-history';
import ScoreObjectEditorPanel from '../components/workbench/panels/ScoreObjectEditorPanel';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';


const originalProjectState = useProjectStore.getState();
const originalBlueAPI = window.blueAPI;

function target(selectionId: string, objectIndex: number): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId,
    selectedObjectType: 'UnknownScoreObject',
    editorObjectType: 'UnknownScoreObject',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function item(editorTarget: ScoreObjectEditorTargetSnapshot): ScoreRowObjectSnapshot {
  return {
    objectId: editorTarget.selectionId,
    objectType: 'UnknownScoreObject',
    name: editorTarget.selectionId,
    startBeats: 0,
    durationBeats: 1,
    startTimeBase: 'BEATS',
    durationTimeBase: 'BEATS',
    backgroundColor: 0,
    isContainer: false,
    editorTarget,
    barRenderer: { kind: 'fallback', labelLines: [], reason: 'unknown-type' },
  };
}

function editorDocument(
  editorTarget: ScoreObjectEditorTargetSnapshot,
  message: string,
): ScoreObjectEditorDocumentSnapshot {
  return {
    target: editorTarget,
    shared: {
      target: editorTarget,
      name: message,
      startTime: { value: 0, timeBase: 'BEATS', displayText: '0' },
      subjectiveDuration: { value: 1, timeBase: 'BEATS', displayText: '1' },
      endTimeDisplay: '1',
      backgroundColor: 0,
    },
    editor: {
      kind: 'fallback',
      target: editorTarget,
      reason: 'unsupported',
      message,
    },
    timeContext: {
      meterEntries: [],
      tempoEnabled: true,
      initialTempo: 60,
      sampleRate: 44100,
    },
  };
}

describe('ScoreObjectEditorPanel selection loading', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const firstTarget = target('first', 0);
    const secondTarget = target('second', 1);
    const group: PolyObjectLayerGroupSnapshot = {
      groupId: 'root',
      groupType: 'polyObject',
      name: 'Root',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'layer-1',
          name: 'Layer 1',
          height: 44,
          muted: false,
          solo: false,
          items: [item(firstTarget), item(secondTarget)],
        },
      ],
    };

    useProjectStore.setState({
      loaded: true,
      score: { ...originalProjectState.score, layerGroups: [group] },
      projectUdos: [],
      applyProjectDocumentPatch: vi.fn().mockResolvedValue(undefined),
      flushPendingPatches: vi.fn().mockResolvedValue(undefined),
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useScoreSelectionStore
      .getState()
      .setSelection([{ objectId: 'first', editorTarget: firstTarget }]);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.blueAPI = originalBlueAPI;
    setProjectHistoryProjection(null);
    useScoreSelectionStore.getState().clearSelection();
    useProjectStore.setState({
      loaded: originalProjectState.loaded,
      score: originalProjectState.score,
      projectUdos: originalProjectState.projectUdos,
      applyProjectDocumentPatch: originalProjectState.applyProjectDocumentPatch,
      flushPendingPatches: originalProjectState.flushPendingPatches,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
  });

  it('refreshes the selected JMask on history changes and retires its controls when selection changes', async () => {
    const jmaskTarget = {
      ...target('jmask', 0),
      selectedObjectType: 'JMask',
      editorObjectType: 'JMask',
    };
    const nextTarget = target('next', 1);
    let mode: 1 | 2 = 2;
    let resolveNext!: (value: ScoreObjectEditorDocumentSnapshot) => void;
    window.blueAPI = {
      getScoreObjectEditorDocument: vi.fn(({ target: requestedTarget }) =>
        requestedTarget.selectionId === jmaskTarget.selectionId
          ? Promise.resolve({
              ...editorDocument(jmaskTarget, 'JMask'),
              editor: {
                kind: 'structured',
                target: jmaskTarget,
                editorFamily: 'JMask',
                payloadSummary: '',
                payload: {
                  generationMode: mode,
                  seedUsed: false,
                  seed: '0',
                  field: { parameters: [] },
                },
              },
            })
          : new Promise<ScoreObjectEditorDocumentSnapshot>((resolve) => {
              resolveNext = resolve;
            }),
      ),
    } as typeof window.blueAPI;
    useScoreSelectionStore
      .getState()
      .setSelection([{ objectId: 'jmask', editorTarget: jmaskTarget }]);

    await act(async () => root.render(<ScoreObjectEditorPanel />));
    expect(container.querySelector('[aria-label="Generation mode, Mode 2"]')).toBeTruthy();

    await act(async () => {
      mode = 1;
      useProjectStore.setState({
        flushPendingPatches: vi.fn().mockRejectedValue(new Error('History settlement in progress')),
      });
      setProjectHistoryProjection({
        canUndo: false,
        canRedo: true,
        undoLabel: null,
        redoLabel: 'Set JMask Generation Mode',
        cursor: 0,
        length: 1,
        retainedBytes: 0,
        stateId: 'undo',
        savedStateId: 'undo',
        revision: 2,
      });
    });
    expect(container.querySelector('[aria-label="Generation mode, Mode 1"]')).toBeTruthy();

    await act(async () => {
      useScoreSelectionStore
        .getState()
        .setSelection([{ objectId: 'next', editorTarget: nextTarget }]);
    });
    expect(container.querySelector('[aria-label^="Generation mode"]')).toBeNull();
    expect(container.textContent).toContain('Loading...');
    await act(async () => resolveNext(editorDocument(nextTarget, 'Next editor')));
    expect(container.textContent).toContain('Next editor');
  });

  it('keeps the current same-type editor mounted while the next selection loads', async () => {
    const firstTarget = target('first', 0);
    const secondTarget = target('second', 1);
    let resolveSecond!: (document: ScoreObjectEditorDocumentSnapshot) => void;
    window.blueAPI = {
      getScoreObjectEditorDocument: vi.fn(({ target: requestedTarget }) =>
        requestedTarget.selectionId === 'first'
          ? Promise.resolve(editorDocument(firstTarget, 'First editor'))
          : new Promise<ScoreObjectEditorDocumentSnapshot>((resolve) => {
              resolveSecond = resolve;
            }),
      ),
    } as typeof window.blueAPI;

    await act(async () => {
      root.render(<ScoreObjectEditorPanel />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('First editor');
    const mountedEditor = container.querySelector('.max-w-sm');

    await act(async () => {
      useScoreSelectionStore
        .getState()
        .setSelection([{ objectId: 'second', editorTarget: secondTarget }]);
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('Loading...');
    expect(container.textContent).toContain('First editor');
    expect(container.querySelector('.max-w-sm')).toBe(mountedEditor);

    await act(async () => {
      resolveSecond(editorDocument(secondTarget, 'Second editor'));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Second editor');
    expect(container.textContent).not.toContain('First editor');
    expect(container.querySelector('.max-w-sm')).toBe(mountedEditor);
  });
});
