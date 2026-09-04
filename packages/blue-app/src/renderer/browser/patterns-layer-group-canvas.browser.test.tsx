import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PatternsLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas';
import ScoreOverlayLines from '../components/workbench/panels/score/ScoreOverlayLines';
import type {
  PatternLayerSnapshot,
  PatternsLayerGroupSnapshot,
} from '../components/workbench/panels/score/types';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import type { ProjectDocumentPatch } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const ROW_HEIGHT = 44;
const PPB = 20;
const capturedPatches: ProjectDocumentPatch[] = [];
const LAYOUT_STYLE_ID = 'patterns-layer-group-canvas-layout';
const LAYOUT_CSS = `
.relative { position: relative; }
.absolute { position: absolute; }
.inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
.inset-y-0 { top: 0; bottom: 0; }
.pointer-events-none { pointer-events: none; }
.overflow-hidden { overflow: hidden; }
`;

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

describe('Patterns Layer-Group canvas (Chromium)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    if (!document.getElementById(LAYOUT_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = LAYOUT_STYLE_ID;
      style.textContent = LAYOUT_CSS;
      document.head.appendChild(style);
    }
    capturedPatches.length = 0;
    useScoreSelectionStore.getState().clearSelection();
    useScoreSelectionStore.getState().clearPatternClipboard();
    useProjectStore.setState({
      applyProjectDocumentPatch: async (patch: ProjectDocumentPatch) => {
        capturedPatches.push(patch);
      },
      flushPendingPatches: async () => undefined,
    });
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

  function mount(group: PatternsLayerGroupSnapshot, pixelsPerBeat = PPB, withOverlay = false) {
    act(() => {
      root.render(
        <div style={{ position: 'relative', width: 1600, height: 400 }}>
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
            meterMap={{ entries: [] }}
          />
          {withOverlay && (
            <ScoreOverlayLines
              renderStartTime={0}
              renderEndTime={0}
              timePointerBeats={6}
              pixelsPerBeat={pixelsPerBeat}
              totalBeats={64}
              scrollLeft={0}
            />
          )}
        </div>,
      );
    });
  }

  function canvas(): HTMLElement {
    const element = container.querySelector<HTMLElement>('[data-pattern-canvas]');
    if (!element) throw new Error('pattern canvas not rendered');
    return element;
  }

  function mouse(target: EventTarget, type: string, clientX: number, clientY: number) {
    act(() => {
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX,
          clientY,
        }),
      );
    });
  }

  it('renders empty rows and active cells as a Java-style grid', () => {
    mount(makeGroup(4, [makeLayer('pl-1', 'A', []), makeLayer('pl-2', 'B', [0, 2])]));
    expect(canvas().querySelectorAll('[data-pattern-row-id]')).toHaveLength(2);
    expect(canvas().querySelectorAll('[data-pattern-grid]')).toHaveLength(2);
    expect(canvas().querySelectorAll('[data-pattern-cell]')).toHaveLength(2);
    expect(canvas().querySelectorAll('[data-pattern-occurrence-id]')).toHaveLength(0);
    expect(canvas().textContent).not.toContain('Source B');
  });

  it('keeps active block edges on the shared pixelsPerBeat mapping at zoom changes', () => {
    mount(makeGroup(3, [makeLayer('pl-1', 'A', [0, 2, 5])]), 40);
    const canvasRect = canvas().getBoundingClientRect();
    for (const cellIndex of [0, 2, 5]) {
      const cell = canvas().querySelector<HTMLElement>(`[data-pattern-cell-index="${cellIndex}"]`)!;
      const rect = cell.getBoundingClientRect();
      expect(rect.left - canvasRect.left).toBeCloseTo(cellIndex * 3 * 40, 1);
      expect(rect.width).toBeCloseTo(3 * 40, 1);
    }
  });

  it('paints a contiguous range with one canonical patch and does not cross rows', () => {
    mount(makeGroup(4, [makeLayer('pl-1', 'A', []), makeLayer('pl-2', 'B', [])]));
    mouse(canvas(), 'mousedown', 10, 10);
    mouse(window, 'mousemove', 170, ROW_HEIGHT + 10);
    mouse(window, 'mouseup', 170, ROW_HEIGHT + 10);
    expect(capturedPatches).toEqual([
      {
        score: {
          type: 'updatePatternCells',
          groupId: 'grp',
          changes: [
            { layerId: 'pl-1', cellIndex: 0, active: true },
            { layerId: 'pl-1', cellIndex: 1, active: true },
            { layerId: 'pl-1', cellIndex: 2, active: true },
          ],
        },
      },
    ]);
  });

  it('co-renders one shared playhead at the same beat-to-pixel position', () => {
    mount(makeGroup(4, [makeLayer('pl-1', 'A', [0]), makeLayer('pl-2', 'B', [1])]), PPB, true);
    const pointer = [
      ...container.querySelectorAll<HTMLElement>('[data-score-overlay-content] > div'),
    ].find((element) => element.style.left === '120px');
    expect(pointer).toBeDefined();
  });

  it('renders a dense representative group without occurrence nodes', () => {
    const layers = Array.from({ length: 64 }, (_, row) =>
      makeLayer(
        `pl-${row}`,
        `Row ${row}`,
        Array.from({ length: 256 }, (_, cell) => cell),
      ),
    );
    const start = performance.now();
    mount(makeGroup(4, layers));
    const elapsed = performance.now() - start;
    expect(canvas().querySelectorAll('[data-pattern-cell]')).toHaveLength(64 * 256);
    expect(canvas().querySelectorAll('[data-pattern-occurrence-id]')).toHaveLength(0);
    expect(elapsed).toBeLessThan(5000);
  });
});
