// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatternLayerSnapshot, PatternsLayerGroupSnapshot } from '../components/workbench/panels/score/types';
import PatternsLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas';
import {
  beatToPixelX,
  cellIndexAtBeat,
  cellsBetween,
  computePatternExtentBeats,
  findPatternRowAtY,
  pixelXToBeat,
  safePixelsPerBeat,
} from '../components/workbench/panels/score/layer-groups/patterns-timeline-utils';
import { mapPatternShapeToTarget } from '../components/workbench/panels/score/layer-groups/patterns-clipboard-utils';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import ScoreOverlayLines from '../components/workbench/panels/score/ScoreOverlayLines';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockProjectState } = vi.hoisted(() => ({
  mockProjectState: {
    applyProjectDocumentPatch: vi.fn(async () => undefined),
    flushPendingPatches: vi.fn(async () => undefined),
  },
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: typeof mockProjectState) => unknown) => selector(mockProjectState),
}));

const ROW_HEIGHT = 44;

function makeLayer(layerId: string, name: string, cells: number[]): PatternLayerSnapshot {
  return {
    layerId,
    name,
    height: ROW_HEIGHT,
    muted: false,
    solo: false,
    items: [],
    sourceObject: {
      objectId: `src-${layerId}`,
      objectType: 'GenericScore',
      name: `Source ${name}`,
      backgroundColor: 0xff204020,
      editorTarget: {
        selectionId: `src-${layerId}`,
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        patternSource: { groupId: 'grp', layerId, sourceObjectId: `src-${layerId}` },
        supportsTimeBehavior: true,
        supportsRepeatPoint: true,
        supportsNoteProcessorChain: true,
      },
      barRenderer: {
        kind: 'generic',
        labelLines: [`Source ${name}`],
        timeBehavior: 'NONE',
        repeatPointBeats: null,
      },
    },
    activeCellIndices: [...cells].sort((left, right) => left - right),
  };
}

function makeGroup(
  stepBeats = 4,
  layers: PatternLayerSnapshot[] = [makeLayer('pl-1', 'A', [0, 3])],
): PatternsLayerGroupSnapshot {
  return {
    groupId: 'grp',
    groupType: 'patterns',
    name: 'Patterns',
    layerCount: layers.length,
    isOpenableContainer: false,
    patternBeatsLength: stepBeats,
    effectivePatternBeatsLength: stepBeats,
    layers,
  };
}

describe('pattern grid geometry', () => {
  it('round-trips beat/pixel coordinates and guards malformed scales', () => {
    for (const pixelsPerBeat of [8, 20, 48]) {
      expect(pixelXToBeat(beatToPixelX(12.5, pixelsPerBeat), pixelsPerBeat)).toBeCloseTo(12.5, 10);
    }
    expect(safePixelsPerBeat(0)).toBe(1);
    expect(safePixelsPerBeat(Number.NaN)).toBe(1);
    expect(beatToPixelX(-1, 20)).toBe(0);
    expect(pixelXToBeat(-1, 20)).toBe(0);
  });

  it('maps beats to integer pattern cells and fills skipped indices', () => {
    expect(cellIndexAtBeat(0, 4)).toBe(0);
    expect(cellIndexAtBeat(3.99, 4)).toBe(0);
    expect(cellIndexAtBeat(4, 4)).toBe(1);
    expect(cellsBetween(1, 4)).toEqual([1, 2, 3, 4]);
    expect(cellsBetween(4, 1)).toEqual([1, 2, 3, 4]);
  });

  it('computes extents and row hit-testing from active cells and row heights', () => {
    const group = makeGroup(3, [makeLayer('pl-1', 'A', [0, 2]), makeLayer('pl-2', 'B', [])]);
    expect(computePatternExtentBeats(group)).toBe(9);
    expect(findPatternRowAtY(group.layers, 10, ROW_HEIGHT)?.layer.layerId).toBe('pl-1');
    expect(findPatternRowAtY(group.layers, 50, ROW_HEIGHT)?.layer.layerId).toBe('pl-2');
    expect(findPatternRowAtY(group.layers, 100, ROW_HEIGHT)).toBeNull();
  });

  it('maps a relative clipboard shape to valid pattern rows without mutation', () => {
    const group = makeGroup(4, [makeLayer('pl-1', 'A', []), makeLayer('pl-2', 'B', [])]);
    const shape = {
      cells: [
        { rowOffset: 0, cellOffset: 0 },
        { rowOffset: 0, cellOffset: 2 },
        { rowOffset: 1, cellOffset: 1 },
      ],
      width: 3,
      height: 2,
    };
    expect(mapPatternShapeToTarget(shape, { layerId: 'pl-1', cellIndex: 3 }, group)).toEqual([
      { layerId: 'pl-1', cellIndex: 3, active: true },
      { layerId: 'pl-1', cellIndex: 5, active: true },
      { layerId: 'pl-2', cellIndex: 4, active: true },
    ]);
    expect(shape.cells).toHaveLength(3);
  });
});

describe('PatternsLayerGroupCanvas', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.mocked(mockProjectState.applyProjectDocumentPatch).mockClear();
    useScoreSelectionStore.getState().clearSelection();
    useScoreSelectionStore.getState().clearPatternClipboard();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useScoreSelectionStore.getState().clearSelection();
    useScoreSelectionStore.getState().clearPatternClipboard();
  });

  function render(group: PatternsLayerGroupSnapshot, pixelsPerBeat = 20) {
    act(() => {
      root.render(
        <PatternsLayerGroupCanvas
          group={group}
          projectSessionId={1}
          projectRevision={1}
          totalBeats={64}
          pixelsPerBeat={pixelsPerBeat}
          snapEnabled={false}
          snapValue="BEAT"
          tempo={60}
          smpteFrameRate={24}
          meterMap={{ entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
        />,
      );
    });
  }

  function canvasEl(): HTMLElement {
    const canvas = container.querySelector<HTMLElement>('[data-pattern-canvas]');
    if (!canvas) throw new Error('pattern canvas not rendered');
    return canvas;
  }

  function mouse(target: EventTarget, type: string, x: number, y: number): void {
    act(() => {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: x,
        clientY: y,
      }));
    });
  }

  it('renders Java-style row grids and solid active blocks, without source-object bars', () => {
    render(makeGroup(4, [makeLayer('pl-1', 'A', [0, 2]), makeLayer('pl-2', 'B', [])]));

    expect(canvasEl().querySelectorAll('[data-pattern-row-id]')).toHaveLength(2);
    expect(canvasEl().querySelectorAll('[data-pattern-grid]')).toHaveLength(2);
    expect(canvasEl().querySelectorAll('[data-pattern-cell]')).toHaveLength(2);
    expect(canvasEl().querySelectorAll('[data-pattern-occurrence-id]')).toHaveLength(0);
    expect(canvasEl().textContent).not.toContain('Source A');

    const first = canvasEl().querySelector<HTMLElement>('[data-pattern-cell-index="0"]')!;
    const second = canvasEl().querySelector<HTMLElement>('[data-pattern-cell-index="2"]')!;
    expect(first.style.left).toBe('0px');
    expect(first.style.width).toBe('80px');
    expect(second.style.left).toBe('160px');
    expect(canvasEl().querySelector('[data-pattern-row-id="pl-2"] [data-pattern-cell]')).toBeNull();
  });

  it('scales cell boundaries with pixelsPerBeat', () => {
    render(makeGroup(4, [makeLayer('pl-1', 'A', [1])]), 40);
    const cell = canvasEl().querySelector<HTMLElement>('[data-pattern-cell-index="1"]')!;
    expect(cell.style.left).toBe('160px');
    expect(cell.style.width).toBe('160px');
    expect(canvasEl().querySelector<HTMLElement>('[data-pattern-grid]')!.dataset.patternStepWidth).toBe('160');
  });

  it('paints every skipped cell using the first pressed cell mode', () => {
    render(makeGroup(4, [makeLayer('pl-1', 'A', [])]));
    const canvas = canvasEl();
    mouse(canvas, 'mousedown', 10, 10);
    mouse(window, 'mousemove', 170, 10);
    mouse(window, 'mouseup', 170, 10);

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'updatePatternCells',
        groupId: 'grp',
        changes: [
          { layerId: 'pl-1', cellIndex: 0, active: true },
          { layerId: 'pl-1', cellIndex: 1, active: true },
          { layerId: 'pl-1', cellIndex: 2, active: true },
        ],
      },
    });
  });

  it('turns active cells off and keeps a vertical drag in the pressed row', () => {
    render(makeGroup(4, [makeLayer('pl-1', 'A', [0, 1, 2]), makeLayer('pl-2', 'B', [0])]));
    const canvas = canvasEl();
    mouse(canvas, 'mousedown', 10, 10);
    mouse(window, 'mousemove', 170, ROW_HEIGHT + 10);
    mouse(window, 'mouseup', 170, ROW_HEIGHT + 10);

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'updatePatternCells',
        groupId: 'grp',
        changes: [
          { layerId: 'pl-1', cellIndex: 0, active: false },
          { layerId: 'pl-1', cellIndex: 1, active: false },
          { layerId: 'pl-1', cellIndex: 2, active: false },
        ],
      },
    });
  });

  it('opens cell-targeted context commands without creating an occurrence selection', () => {
    render(makeGroup(4, [makeLayer('pl-1', 'A', [0])]));
    act(() => {
      canvasEl().dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 10,
        clientY: 10,
      }));
    });

    const menu = document.querySelector<HTMLElement>('[data-pattern-context-menu]');
    expect(menu).not.toBeNull();
    const item = (label: string) => [...menu!.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((candidate) => candidate.textContent?.trim() === label);
    expect(item('Cut')?.getAttribute('aria-disabled')).toBeNull();
    expect(item('Copy')?.getAttribute('aria-disabled')).toBeNull();
    expect(item('Properties')?.getAttribute('aria-disabled')).toBeNull();
    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });

  it('keeps the shared playhead aligned with the canvas mapping', () => {
    act(() => {
      root.render(
        <div style={{ position: 'relative', width: 1600, height: 200 }}>
          <PatternsLayerGroupCanvas
            group={makeGroup(4, [makeLayer('pl-1', 'A', [0])])}
            projectSessionId={1}
            projectRevision={1}
            totalBeats={64}
            pixelsPerBeat={20}
            snapEnabled={false}
            snapValue="BEAT"
            tempo={60}
            smpteFrameRate={24}
            meterMap={{ entries: [] }}
          />
          <ScoreOverlayLines
            renderStartTime={0}
            renderEndTime={0}
            timePointerBeats={6}
            pixelsPerBeat={20}
            totalBeats={64}
            scrollLeft={0}
          />
        </div>,
      );
    });
    const pointer = [...container.querySelectorAll<HTMLElement>('[data-score-overlay-content] > div')]
      .find((element) => element.style.left === '120px');
    expect(pointer).toBeDefined();
  });
});
