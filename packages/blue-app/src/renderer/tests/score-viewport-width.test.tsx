// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { useProjectStore } from '../stores/project-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import { deriveTempoRegions } from '../components/workbench/panels/score/tempo-map-utils';
import { deriveMeterRegions } from '../components/workbench/panels/score/meter-map-utils';
import { __testOnly } from '../components/workbench/panels/score/ColumnHeader';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type ResizeCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void;
let resizeObserverCallback: ResizeCallback | null = null;
let observedElements: HTMLElement[] = [];

class MockResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeObserverCallback = callback;
  }
  observe(target: HTMLElement): void {
    observedElements.push(target);
  }
  unobserve(target: HTMLElement): void {
    observedElements = observedElements.filter((el) => el !== target);
  }
  disconnect(): void {
    observedElements = [];
  }
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

function seedTestProject(zoomIterations = 0): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.score.timeState.zoomIterations = zoomIterations;
  snapshot.score.layerGroups = [
    {
      groupId: 'track-group',
      groupType: 'track',
      name: 'Track Group',
      layerCount: 1,
      isOpenableContainer: false,
      layers: [
        {
          layerId: 'layer-1',
          name: 'Track 1',
          height: 80,
          muted: false,
          solo: false,
          items: [
            {
              objectId: 'item-1',
              name: 'Score Object',
              startBeats: 0,
              durationBeats: 64,
              color: null,
              editorTarget: {
                location: {
                  groupId: 'track-group',
                  layerId: 'layer-1',
                  objectIndex: 0,
                  objectId: 'item-1',
                },
                selectedObjectType: 'soundObject',
                editorObjectType: 'soundObject',
              },
              barRenderer: {
                kind: 'generic',
                name: 'Score Object',
                color: null,
                displayName: 'Score Object',
                description: '',
                labelLines: ['Score Object'],
                timeBehavior: 0,
              },
            },
          ],
          automation: {
            layerId: 'layer-1',
            layerKind: 'track',
            parameterIds: [],
            parameters: [],
            targetGroups: [],
            missingParameterIds: [],
          },
        },
      ],
    },
  ];

  useProjectStore.getState().setProjectInfo({
    title: 'Test Project',
    author: 'Test Author',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/path/to/test.blue',
    sessionId: 1,
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: { ...snapshot.orchestra, loaded: true },
    projectProperties: snapshot.projectProperties,
    transport: snapshot.transport,
    score: snapshot.score,
  });
}

beforeEach(() => {
  useProjectStore.getState().clearProject();
  useLayerSelectionStore.getState().clear();
  resizeObserverCallback = null;
  observedElements = [];
  (window as any).blueAPI = {
    commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1, sessionId: 1 }),
    getNestedPolyObjectSnapshot: vi.fn().mockResolvedValue(null),
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Score timeline width for viewport', () => {
  it('extends tempo regions to the full totalBeats when zoomed out', () => {
    const tempoMap = {
      enabled: true,
      visible: true,
      points: [
        { beat: 0, tempo: 120, curveType: 'constant' as const },
        { beat: 32, tempo: 140, curveType: 'constant' as const },
      ],
    };

    // When zoomed out, totalBeats is 400 (e.g. 1000px / 2.5 ppb).
    const regions = deriveTempoRegions(tempoMap, 400);
    expect(regions).toHaveLength(2);
    expect(regions[0]?.startBeat).toBe(0);
    expect(regions[0]?.endBeat).toBe(32);
    expect(regions[1]?.startBeat).toBe(32);
    expect(regions[1]?.endBeat).toBe(400);
  });

  it('extends meter (time signature) regions to the full totalBeats when zoomed out', () => {
    const meterMap = {
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
        { measure: 9, numBeats: 3, beatLength: 4, startBeat: 32 },
      ],
    };

    const regions = deriveMeterRegions(meterMap, 400);
    expect(regions).toHaveLength(2);
    expect(regions[0]?.startBeat).toBe(0);
    expect(regions[0]?.endBeat).toBe(32);
    expect(regions[1]?.startBeat).toBe(32);
    expect(regions[1]?.endBeat).toBe(400);
  });

  it('computes ruler marks spanning the entire totalBeats', () => {
    const tempoMap = { enabled: false, visible: false, points: [] };
    const meters = [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }];
    const totalBeats = 400;
    const pixelsPerBeat = 2.5;

    const marks = __testOnly.computeMarks(
      '0', // Measure / Beat
      totalBeats,
      pixelsPerBeat,
      tempoMap,
      meters,
      30,
      44100,
    );

    expect(marks.length).toBeGreaterThan(0);
    const lastMark = marks[marks.length - 1];
    expect(lastMark).toBeDefined();
    // Last mark should be near 400 beats * 2.5 pixels = 1000px.
    expect(lastMark!.x).toBeGreaterThanOrEqual(950);
  });

  it('measures clientWidth and expands totalBeats across the viewport when zoomed out', () => {
    // Zoomed out: -170 zoomIterations produces ppb ≈ 2.5
    seedTestProject(-170);

    // Mock clientWidth on the scroll container element
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    );
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if (
          this.getAttribute('data-score-timeline-header') !== null ||
          this.classList.contains('score-timeline-scroll')
        ) {
          return 1000;
        }
        return 0;
      },
    });

    try {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(<ScorePanel />);
      });

      // Find the scroll container and timeline header
      const scrollEl = container.querySelector('.score-timeline-scroll') as HTMLDivElement | null;
      expect(scrollEl).not.toBeNull();

      const headerEl = container.querySelector(
        '[data-score-timeline-header]',
      ) as HTMLDivElement | null;
      expect(headerEl).not.toBeNull();

      // Trigger ResizeObserver callback with 1000px width
      act(() => {
        resizeObserverCallback?.([{ contentRect: { width: 1000, height: 400 } }]);
      });

      // In LayerPanel, contentWidth should be at least 1000px
      const layerPanelContainer = scrollEl?.firstElementChild as HTMLDivElement | null;
      expect(layerPanelContainer).not.toBeNull();
      const minWidthPx = parseFloat(layerPanelContainer?.style.minWidth ?? '0');
      expect(minWidthPx).toBeGreaterThanOrEqual(1000);

      // In TrackLayerGroupCanvas, width should be 100% and minWidth >= 1000px
      const trackGroupEl = container.querySelector(
        '[data-track-layer-group="true"]',
      ) as HTMLDivElement | null;
      expect(trackGroupEl).not.toBeNull();
      expect(trackGroupEl?.style.width).toBe('100%');
      const trackMinWidthPx = parseFloat(trackGroupEl?.style.minWidth ?? '0');
      expect(trackMinWidthPx).toBeGreaterThanOrEqual(1000);

      act(() => {
        root.unmount();
      });
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
      }
    }
  });

  it('keeps natural score padding when zoomed in and does not truncate score bounds', () => {
    // Zoomed in: 0 zoomIterations produces ppb = 100
    seedTestProject(0);

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if (this.classList.contains('score-timeline-scroll')) {
          return 1000;
        }
        return 0;
      },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ScorePanel />);
    });

    const scrollEl = container.querySelector('.score-timeline-scroll') as HTMLDivElement | null;
    const layerPanelContainer = scrollEl?.firstElementChild as HTMLDivElement | null;

    // Score object is 64 beats duration, so computeTotalBeats is 64 + 16 = 80 beats.
    // At 100 ppb, contentWidth is 80 * 100 = 8000px (well above the 1000px container).
    const minWidthPx = parseFloat(layerPanelContainer?.style.minWidth ?? '0');
    expect(minWidthPx).toBe(8000);

    act(() => {
      root.unmount();
    });
  });
});
