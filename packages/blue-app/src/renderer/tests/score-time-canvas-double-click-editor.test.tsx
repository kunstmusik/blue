// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScoreTimeCanvas from '../components/workbench/panels/score/layer-groups/ScoreTimeCanvas';
import type {
  PolyObjectLayerGroupSnapshot,
  ScoreRowObjectSnapshot,
} from '../components/workbench/panels/score/types';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useWorkbenchStore } from '../stores/workbench-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();
const originalWorkbenchState = useWorkbenchStore.getState();

function soundItem(objectId: string, layerIndex: number, objectIndex: number): ScoreRowObjectSnapshot {
  return {
    objectId,
    objectType: 'GenericScore',
    name: objectId,
    startBeats: 0,
    durationBeats: 2,
    startTimeBase: 'BEATS',
    durationTimeBase: 'BEATS',
    backgroundColor: 0x336699,
    isContainer: false,
    editorTarget: {
      selectionId: objectId,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex, objectIndex },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: {
      kind: 'fallback',
      labelLines: [objectId],
      reason: 'unknown-type',
    },
  };
}

function polyObjectItem(objectId: string, layerIndex: number, objectIndex: number): ScoreRowObjectSnapshot {
  return {
    ...soundItem(objectId, layerIndex, objectIndex),
    objectType: 'PolyObject',
    isContainer: true,
  };
}

function makeGroup(item: ScoreRowObjectSnapshot): PolyObjectLayerGroupSnapshot {
  return {
    groupId: 'g1',
    groupType: 'polyObject',
    name: 'Group',
    layerCount: 1,
    isOpenableContainer: true,
    layers: [
      {
        layerId: 'g1-layer-0',
        name: 'L1',
        height: 44,
        muted: false,
        solo: false,
        items: [item],
      },
    ],
  };
}

function dispatchAt(target: EventTarget, type: string, clientX: number, clientY: number): void {
  act(() => {
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, button: 0, clientX, clientY,
    }));
  });
}

describe('ScoreTimeCanvas double-click editor parity', () => {
  let container: HTMLDivElement;
  let root: Root;
  let surface: HTMLDivElement;
  let openPanel: ReturnType<typeof vi.fn>;

  function render(item: ScoreRowObjectSnapshot): void {
    useProjectStore.setState({
      score: {
        ...originalProjectState.score,
        layerGroups: [makeGroup(item)],
      },
      applyProjectDocumentPatch: vi.fn().mockResolvedValue(undefined),
      moveScoreObjects: vi.fn(),
      resizeScoreObjects: vi.fn(),
    } as Partial<ReturnType<typeof useProjectStore.getState>>);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <ScoreTimeCanvas
          group={makeGroup(item)}
          totalBeats={16}
          pixelsPerBeat={50}
          snapEnabled={false}
          snapValue="BEAT"
          tempo={120}
          smpteFrameRate={30}
          meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
          onDoubleClickObject={onDoubleClickObject}
        />,
      );
    });

    surface = container.querySelector('[data-group-id="g1"]') as HTMLDivElement;
    Object.defineProperty(surface, 'getBoundingClientRect', {
      value: () => ({
        left: 0, top: 0, right: 800, bottom: 120, width: 800, height: 120, x: 0, y: 0,
        toJSON: () => undefined,
      }),
    });
  }

  let onDoubleClickObject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openPanel = vi.fn();
    useWorkbenchStore.setState({ openPanel } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
    useScoreSelectionStore.getState().clearSelection();
    onDoubleClickObject = vi.fn();
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    useProjectStore.setState({
      score: originalProjectState.score,
      applyProjectDocumentPatch: originalProjectState.applyProjectDocumentPatch,
      moveScoreObjects: originalProjectState.moveScoreObjects,
      resizeScoreObjects: originalProjectState.resizeScoreObjects,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useWorkbenchStore.setState({ openPanel: originalWorkbenchState.openPanel } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
    useScoreSelectionStore.getState().clearSelection();
    container.remove();
    document.body.innerHTML = '';
  });

  it('opens/focuses the Score Object Editor on double-click of a selected non-container score object', () => {
    render(soundItem('a', 0, 0));

    dispatchAt(surface, 'mousedown', 10, 10);
    dispatchAt(surface, 'dblclick', 10, 10);

    expect(openPanel).toHaveBeenCalledWith('ScoreObjectEditorTopComponent');
    expect(onDoubleClickObject).not.toHaveBeenCalled();
  });

  it('drills into a PolyObject one layer down instead of opening the editor', () => {
    render(polyObjectItem('poly1', 0, 0));

    dispatchAt(surface, 'mousedown', 10, 10);
    dispatchAt(surface, 'dblclick', 10, 10);

    expect(onDoubleClickObject).toHaveBeenCalledWith('poly1');
    expect(openPanel).not.toHaveBeenCalled();
  });

  it('does not open the editor when multiple objects are selected', () => {
    const itemA = soundItem('a', 0, 0);
    render(itemA);
    useScoreSelectionStore.getState().setSelection([
      { objectId: 'a', editorTarget: itemA.editorTarget },
      { objectId: 'b', editorTarget: itemA.editorTarget },
    ]);

    dispatchAt(surface, 'dblclick', 10, 10);

    expect(openPanel).not.toHaveBeenCalled();
  });
});
