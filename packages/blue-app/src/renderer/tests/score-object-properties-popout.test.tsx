// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type {
  PolyObjectLayerGroupSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectEditorTargetSnapshot,
  ScoreRowObjectSnapshot,
} from '../../shared/project-editor';
import ScoreObjectPropertiesPanel from '../components/workbench/panels/ScoreObjectPropertiesPanel';
import { HostDocumentContext } from '../hooks/use-host-document';
import { __testClearPendingPatches, useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();
const originalBlueAPI = window.blueAPI;

function target(): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'object-1',
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

function item(editorTarget: ScoreObjectEditorTargetSnapshot): ScoreRowObjectSnapshot {
  return {
    objectId: editorTarget.selectionId,
    objectType: 'GenericScore',
    name: 'Object 1',
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
): ScoreObjectEditorDocumentSnapshot {
  return {
    target: editorTarget,
    shared: {
      target: editorTarget,
      name: 'Object 1',
      startTime: { value: 0, timeBase: 'BEATS', displayText: '0' },
      subjectiveDuration: { value: 1, timeBase: 'BEATS', displayText: '1' },
      endTimeDisplay: '1',
      backgroundColor: 0,
      timeBehavior: 'SCALE',
      repeatPoint: null,
      noteProcessorChain: null,
    },
    editor: { kind: 'fallback', target: editorTarget, reason: 'unsupported', message: 'test' },
    timeContext: {
      meterEntries: [],
      tempoEnabled: false,
      initialTempo: 60,
      sampleRate: 44100,
    },
  };
}

describe('ScoreObjectPropertiesPanel color picker in a popout', () => {
  let popout: JSDOM;
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const editorTarget = target();
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
          items: [item(editorTarget)],
        },
      ],
    };

    useProjectStore.setState({
      loaded: true,
      score: { ...originalProjectState.score, layerGroups: [group] },
      applyProjectDocumentPatch: originalProjectState.applyProjectDocumentPatch,
      flushPendingPatches: originalProjectState.flushPendingPatches,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useScoreSelectionStore.getState().setSelection(['object-1']);
    __testClearPendingPatches();

    window.blueAPI = {
      ...originalBlueAPI,
      getNamedChainNames: vi.fn().mockResolvedValue([]),
      getScoreObjectEditorDocument: vi.fn().mockResolvedValue(editorDocument(editorTarget)),
      commitProjectDocumentPatches: vi
        .fn()
        .mockResolvedValue({ changed: true, sessionId: 0, revision: 1 }),
      getProjectDocument: vi.fn().mockResolvedValue(null),
    } as typeof window.blueAPI;

    popout = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://properties-popout.test',
    });
    host = popout.window.document.createElement('div');
    popout.window.document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    popout?.window.close();
    __testClearPendingPatches();
    useScoreSelectionStore.getState().clearSelection();
    useProjectStore.setState(originalProjectState);
    window.blueAPI = originalBlueAPI;
  });

  it('keeps the properties picker open while applying a color edit', async () => {
    await act(async () => {
      root.render(
        <HostDocumentContext.Provider value={popout.window.document}>
          <ScoreObjectPropertiesPanel />
        </HostDocumentContext.Provider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const pickerButton = popout.window.document.querySelector<HTMLButtonElement>(
      '[aria-label="Score object color"]',
    );
    expect(pickerButton).toBeTruthy();

    act(() => pickerButton!.click());
    expect(
      popout.window.document.querySelector('[role="dialog"][aria-label="Color picker"]'),
    ).toBeTruthy();

    // A score refresh can recreate the selection target object while it still
    // refers to the same timeline location. The properties form must remain
    // mounted during that refresh so an active picker is not dismissed.
    const refreshedTarget =
      useProjectStore.getState().score.layerGroups[0]!.layers[0]!.items[0]!.editorTarget!;
    act(() => {
      useScoreSelectionStore.getState().setSelection([
        {
          objectId: 'object-1',
          editorTarget: {
            ...refreshedTarget,
            location: { ...refreshedTarget.location, rootGroupId: 'root' },
          },
        },
      ]);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      popout.window.document.querySelector('[role="dialog"][aria-label="Color picker"]'),
    ).toBeTruthy();

    const hex = popout.window.document.querySelector<HTMLInputElement>('[aria-label="Hex color"]')!;
    act(() => {
      hex.value = '#654321';
      hex.dispatchEvent(new popout.window.Event('input', { bubbles: true }));
    });

    expect(
      popout.window.document.querySelector('[role="dialog"][aria-label="Color picker"]'),
    ).toBeTruthy();

    act(() => {
      popout.window.document
        .querySelector<HTMLButtonElement>('[aria-label="Set color #ef4444"]')!
        .click();
    });
    expect(
      popout.window.document.querySelector('[role="dialog"][aria-label="Color picker"]'),
    ).toBeTruthy();

    const hue = popout.window.document.querySelector<HTMLInputElement>('[aria-label="Hue"]')!;
    act(() => {
      hue.value = '180';
      hue.dispatchEvent(new popout.window.MouseEvent('mousedown', { bubbles: true }));
      hue.dispatchEvent(new popout.window.Event('input', { bubbles: true }));
      hue.dispatchEvent(new popout.window.Event('change', { bubbles: true }));
      hue.dispatchEvent(new popout.window.MouseEvent('mouseup', { bubbles: true }));
      hue.dispatchEvent(new popout.window.MouseEvent('click', { bubbles: true }));
    });

    expect(
      popout.window.document.querySelector('[role="dialog"][aria-label="Color picker"]'),
    ).toBeTruthy();
  });
});
