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
import { useLayerSelectionStore } from '../stores/layer-selection-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();

function soundItem(
  objectId: string,
  layerIndex: number,
  objectIndex: number,
): ScoreRowObjectSnapshot {
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

function makeGroup(): PolyObjectLayerGroupSnapshot {
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
        items: [soundItem('a', 0, 0)],
      },
    ],
  };
}

function dispatchMouseDown(
  target: EventTarget,
  shiftKey: boolean,
  clientX: number,
  clientY: number,
): void {
  target.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      shiftKey,
      clientX,
      clientY,
    }),
  );
}

describe('ScoreTimeCanvas marquee initiation on background', () => {
  let container: HTMLDivElement;
  let root: Root;
  let surface: HTMLDivElement;

  beforeEach(() => {
    useProjectStore.setState({
      score: {
        ...originalProjectState.score,
        layerGroups: [makeGroup()],
      },
      applyProjectDocumentPatch: vi.fn().mockResolvedValue(undefined),
      moveScoreObjects: vi.fn(),
      resizeScoreObjects: vi.fn(),
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useScoreSelectionStore.getState().clearSelection();
    useLayerSelectionStore.getState().clear();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <ScoreTimeCanvas
          projectSessionId={1}
          projectRevision={1}
          scoreRootGroupId="group-1"
          scoreContainerPath={[]}
          group={makeGroup()}
          totalBeats={16}
          pixelsPerBeat={50}
          snapEnabled={false}
          snapValue="BEAT"
          tempo={120}
          smpteFrameRate={30}
          meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
        />,
      );
    });

    surface = container.querySelector('[data-group-id="g1"]') as HTMLDivElement;
    // Canvas is taller than its single 44px layer, so clicks at y >= 44 land in
    // the background area outside any layer row.
    Object.defineProperty(surface, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 120,
        width: 800,
        height: 120,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    useProjectStore.setState({
      score: originalProjectState.score,
      applyProjectDocumentPatch: originalProjectState.applyProjectDocumentPatch,
      moveScoreObjects: originalProjectState.moveScoreObjects,
      resizeScoreObjects: originalProjectState.resizeScoreObjects,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useScoreSelectionStore.getState().clearSelection();
    useLayerSelectionStore.getState().clear();
    container.remove();
    document.body.innerHTML = '';
  });

  it('clears the selection on a plain background click outside layer rows', () => {
    useScoreSelectionStore
      .getState()
      .setSelection([{ objectId: 'a', editorTarget: soundItem('a', 0, 0).editorTarget }]);
    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(1);

    dispatchMouseDown(surface, false, 10, 80);
    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);
  });

  it('preserves the selection on a shift background click outside layer rows (additive marquee)', () => {
    useScoreSelectionStore
      .getState()
      .setSelection([{ objectId: 'a', editorTarget: soundItem('a', 0, 0).editorTarget }]);

    dispatchMouseDown(surface, true, 10, 80);
    expect([...useScoreSelectionStore.getState().selectedObjectIds]).toEqual(['a']);
  });

  it('keeps selection state accessible without highlighting SoundObject timeline rows', () => {
    const row = container.querySelector<HTMLElement>('[data-timeline-layer-row]')!;
    expect(row.getAttribute('aria-selected')).toBe('false');
    expect(row.style.backgroundColor).toBe('var(--color-app-canvas)');

    act(() => {
      useLayerSelectionStore.getState().selectSingle(
        'g1:g1-layer-0',
        [
          {
            scopeKey: 'test',
            groupId: 'g1',
            groupType: 'polyObject',
            layerSelectionId: 'g1-layer-0',
            layerId: 'g1-layer-0',
            localIndex: 0,
            globalIndex: 0,
            layer: makeGroup().layers[0]!,
          },
        ],
        'test',
      );
    });

    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.dataset.selectedLayer).toBe('true');
    expect(row.className).not.toContain('border-l-app-accent');
    expect(row.className).not.toContain('bg-app-selection');
    expect(row.style.backgroundColor).toBe('var(--color-app-canvas)');
  });
});
