import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import LayerPanel from '../components/workbench/panels/score/LayerPanel';
import type {
  PolyObjectLayerGroupSnapshot,
  ScoreRowObjectSnapshot,
} from '../components/workbench/panels/score/types';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalScore = useProjectStore.getState().score;

function createItem(
  objectId: string,
  rootGroupIndex: number,
): ScoreRowObjectSnapshot {
  return {
    objectId,
    objectType: 'JavaScriptObject',
    name: objectId,
    startBeats: 0,
    durationBeats: 4,
    startTimeBase: 'BEATS',
    durationTimeBase: 'BEATS',
    backgroundColor: 0xff404040,
    isContainer: false,
    editorTarget: {
      selectionId: objectId,
      selectedObjectType: 'JavaScriptObject',
      editorObjectType: 'JavaScriptObject',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
      },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: {
      kind: 'letter',
      letter: 'J',
      labelLines: [objectId],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
    },
  };
}

function createGroup(
  groupId: string,
  rootGroupIndex: number,
  layerHeights: number[],
): PolyObjectLayerGroupSnapshot {
  return {
    groupId,
    groupType: 'polyObject',
    name: 'SoundObject Layer Group',
    layerCount: layerHeights.length,
    isOpenableContainer: true,
    layers: layerHeights.map((height, layerIndex) => ({
      layerId: `${groupId}-layer-${layerIndex}`,
      name: `Layer ${layerIndex + 1}`,
      height,
      muted: false,
      solo: false,
      items: layerIndex === 0
        ? [createItem(`${groupId}-item`, rootGroupIndex)]
        : [],
    })),
  };
}

function dispatchPrimaryMouseEvent(
  target: EventTarget,
  type: 'mousedown' | 'mouseup',
  clientX: number,
  clientY: number,
): void {
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
    clientY,
  }));
}

describe('stacked Score timeline selection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useScoreSelectionStore.getState().clearSelection();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useProjectStore.setState({ score: originalScore });
    useScoreSelectionStore.getState().clearSelection();
  });

  it('selects a visible object in a lower layer group without scrolling the timeline', () => {
    const firstGroup = createGroup('first-group', 0, [120]);
    const secondGroup = createGroup('second-group', 1, [44, 44, 44, 44, 44]);
    const layerGroups = [firstGroup, secondGroup];
    useProjectStore.setState({
      score: {
        ...useProjectStore.getState().score,
        layerGroups,
      },
    });

    act(() => {
      root.render(
        <div
          data-testid="timeline-scroll"
          style={{ width: 400, height: 200, overflow: 'auto' }}
        >
          <LayerPanel
            layerGroups={layerGroups}
            onOpenNested={() => undefined}
            projectSessionId={1}
            projectRevision={1}
            pixelsPerBeat={25}
            totalBeats={16}
            snapEnabled
            snapValue="BEAT"
            tempo={120}
            smpteFrameRate={24}
            meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
          />
        </div>,
      );
    });

    const scroller = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const secondCanvas = container.querySelector('[data-group-id="second-group"]') as HTMLDivElement;
    const rect = secondCanvas.getBoundingClientRect();
    expect(rect.top).toBeGreaterThan(0);
    expect(rect.top).toBeLessThan(scroller.getBoundingClientRect().bottom);

    const clientX = rect.left + 25;
    const clientY = rect.top + 20;
    const initialScrollTop = scroller.scrollTop;

    act(() => {
      dispatchPrimaryMouseEvent(secondCanvas, 'mousedown', clientX, clientY);
      dispatchPrimaryMouseEvent(secondCanvas, 'mouseup', clientX, clientY);
    });

    expect(scroller.scrollTop).toBe(initialScrollTop);
    expect(useScoreSelectionStore.getState().selectedObjectIds).toEqual(
      new Set(['second-group-item']),
    );
  });
});
