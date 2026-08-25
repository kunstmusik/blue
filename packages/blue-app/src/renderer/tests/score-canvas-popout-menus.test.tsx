// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type { PatternLayerSnapshot, PatternsLayerGroupSnapshot } from '../components/workbench/panels/score/types';
import type { PolyObjectLayerGroupSnapshot, ScoreRowObjectSnapshot } from '../components/workbench/panels/score/types';
import PatternsLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas';
import TrackLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas';
import ScoreTimeCanvas from '../components/workbench/panels/score/layer-groups/ScoreTimeCanvas';
import { HostDocumentContext } from '../hooks/use-host-document';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useLibraryStore } from '../stores/library-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The "popout window": a second JSDOM realm whose document hosts a floated
// panel's content, mirroring the Dockview popout mechanism.
const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;

  function menusIn(doc: Document): number {
    return doc.querySelectorAll('[role="menu"]').length;
  }

  /** Radix DismissableLayer attaches its outside-pointerdown listener after a 0ms timeout. */
  async function flushDismissalListener(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

function rightClick(target: EventTarget, x = 30, y = 15): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: x,
      clientY: y,
    }));
  });
}

describe('score canvas context menus in a floated (popout) panel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    useScoreSelectionStore.getState().clearSelection();
    useLibraryStore.setState({ clipboard: null, error: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    popoutDoc.body.innerHTML = '';
    useScoreSelectionStore.getState().clearSelection();
  });

  function renderUnderPopout(node: React.ReactElement, rect?: { width: number; height: number }): void {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          {node}
        </HostDocumentContext.Provider>,
      );
    });
    if (rect) {
      const surface = container.firstElementChild as HTMLElement;
      Object.defineProperty(surface, 'getBoundingClientRect', {
        value: () => ({
          left: 0, top: 0, right: rect.width, bottom: rect.height,
          width: rect.width, height: rect.height, x: 0, y: 0, toJSON: () => undefined,
        }),
        configurable: true,
      });
    }
  }

  function assertMenuLivesInPopout(): void {
    expect(menusIn(popoutDoc)).toBeGreaterThan(0);
    expect(menusIn(document)).toBe(0);
  }

  it('PatternsLayerGroupCanvas: cell menu renders, retains inside clicks, and dismisses via the popout document', async () => {
    const ancestorMouseDown = vi.fn();
    const layer: PatternLayerSnapshot = {
      layerId: 'pl-1', name: 'A', height: 44, muted: false, solo: false,
      items: [],
      sourceObject: {
        objectId: 'src-pl-1', objectType: 'GenericScore', name: 'Source A',
        backgroundColor: 0xff204020,
        editorTarget: {
          selectionId: 'src-pl-1', selectedObjectType: 'GenericScore',
          editorObjectType: 'GenericScore', ownerKind: 'timeline',
          displayContext: 'timeline',
          patternSource: { groupId: 'grp', layerId: 'pl-1', sourceObjectId: 'src-pl-1' },
          supportsTimeBehavior: true, supportsRepeatPoint: true, supportsNoteProcessorChain: true,
        },
        barRenderer: { kind: 'generic', labelLines: ['Source A'], timeBehavior: 'NONE', repeatPointBeats: null },
      },
      activeCellIndices: [0],
    };
    const group: PatternsLayerGroupSnapshot = {
      groupId: 'grp', groupType: 'patterns', name: 'Patterns', layerCount: 1,
      isOpenableContainer: false, patternBeatsLength: 4, effectivePatternBeatsLength: 4, layers: [layer],
    };

    renderUnderPopout(
      <div onMouseDown={ancestorMouseDown}>
        <PatternsLayerGroupCanvas
          group={group}
          projectSessionId={1}
          projectRevision={1}
          totalBeats={64}
          pixelsPerBeat={20}
          snapEnabled={false}
          snapValue="BEAT"
          tempo={60}
          smpteFrameRate={24}
          meterMap={{ entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
        />
      </div>,
    );

    const canvas = container.querySelector<HTMLElement>('[data-pattern-canvas]')!;
    expect(canvas).toBeTruthy();
    rightClick(canvas, 10, 10);
    assertMenuLivesInPopout();
    await flushDismissalListener();

    // A mousedown INSIDE the menu must not dismiss it (foreign-realm target).
    // Radix DismissableLayer listens for pointerdown on the layer document.
    const menu = popoutDoc.querySelector<HTMLElement>('[role="menu"]')!;
    act(() => {
      menu.dispatchEvent(new PopoutMouseEvent('pointerdown', { bubbles: true }));
      menu.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    await flushDismissalListener();
    expect(menusIn(popoutDoc)).toBeGreaterThan(0);
    expect(ancestorMouseDown).not.toHaveBeenCalled();

    // Main-document input must not dismiss a popout-hosted menu.
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(menusIn(popoutDoc)).toBeGreaterThan(0);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(menusIn(popoutDoc)).toBeGreaterThan(0);

    // Outside mousedown and Escape within the popout document DO dismiss.
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('pointerdown', { bubbles: true }));
    });
    expect(menusIn(popoutDoc)).toBe(0);

    rightClick(canvas, 10, 10);
    assertMenuLivesInPopout();
    act(() => {
      popoutDoc.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(menusIn(popoutDoc)).toBe(0);
  });

  it('TrackLayerGroupCanvas: background menu is hosted and dismissed entirely by the popout document', async () => {
    const item: ScoreRowObjectSnapshot = {
      objectId: 'track-object', objectType: 'GenericScore', name: 'track-object',
      startBeats: 1, durationBeats: 2, startTimeBase: 'BEATS', durationTimeBase: 'BEATS',
      backgroundColor: 0, isContainer: false,
      editorTarget: {
        selectionId: 'track-object', selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore', ownerKind: 'timeline', displayContext: 'timeline',
        location: { rootGroupIndex: 1, containerPath: [], layerIndex: 0, objectIndex: 0 },
        supportsTimeBehavior: true, supportsRepeatPoint: true, supportsNoteProcessorChain: true,
      },
      barRenderer: { kind: 'generic', labelLines: ['track-object'], timeBehavior: 'NONE', repeatPointBeats: null },
    };
    const group = {
      groupId: 'track-group', groupType: 'track', name: 'Tracks', defaultHeightIndex: 0,
      layerCount: 1, isOpenableContainer: false,
      layers: [{
        layerId: 'track-row', name: 'Track Row', height: 44, muted: false, solo: false,
        items: [item], layerKind: 'track', instrument: null,
      }],
    } as React.ComponentProps<typeof TrackLayerGroupCanvas>['group'];

    renderUnderPopout(
      <TrackLayerGroupCanvas
        group={group}
        allLayerGroups={[group]}
        projectSessionId={1}
        projectRevision={1}
        scoreRootGroupId="track-group"
        scoreContainerPath={[]}
        totalBeats={16}
        pixelsPerBeat={25}
        snapEnabled={false}
        snapValue="BEAT"
        tempo={120}
        tempoMap={{ entries: [] }}
        meterMap={{ entries: [] }}
      />,
    );

    const surface = container.querySelector<HTMLElement>('[data-timeline-layer-row], [data-track-canvas], [data-group-id]') ?? (container.firstElementChild as HTMLElement);
    rightClick(surface, 200, 15);
    assertMenuLivesInPopout();
    await flushDismissalListener();

    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(menusIn(popoutDoc)).toBeGreaterThan(0);
    act(() => {
      popoutDoc.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(menusIn(popoutDoc)).toBe(0);
  });

  it('ScoreTimeCanvas: object menu is hosted and dismissed entirely by the popout document', async () => {
    const target = {
      selectionId: 'score-1', selectedObjectType: 'GenericScore', editorObjectType: 'GenericScore',
      ownerKind: 'timeline' as const, displayContext: 'timeline' as const,
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true, supportsRepeatPoint: true, supportsNoteProcessorChain: true,
    };
    const item: ScoreRowObjectSnapshot = {
      objectId: 'score-1', objectType: 'GenericScore', name: 'Popout me', startBeats: 0,
      durationBeats: 2, startTimeBase: 'BEATS', durationTimeBase: 'BEATS', backgroundColor: 0x336699,
      isContainer: false, editorTarget: target,
      barRenderer: { kind: 'fallback', labelLines: ['Popout me'], reason: 'unknown-type' },
    };
    const group: PolyObjectLayerGroupSnapshot = {
      groupId: 'root', groupType: 'polyObject', name: 'Root', layerCount: 1,
      isOpenableContainer: true,
      layers: [{ layerId: 'root-layer-0', name: 'Layer 1', height: 44, muted: false, solo: false, items: [item] }],
    };
    useProjectStore.setState({
      score: { ...useProjectStore.getState().score, layerGroups: [group] },
      flushPendingPatches: vi.fn().mockResolvedValue(undefined),
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    window.blueAPI = {
      onRenderOperationStatus: () => () => {},
      onFreezeItemStatus: () => () => {},
    } as typeof window.blueAPI;

    renderUnderPopout(
      <ScoreTimeCanvas
        projectSessionId={1}
        projectRevision={1}
        scoreRootGroupId="root"
        scoreContainerPath={[]}
        group={group}
        totalBeats={16}
        pixelsPerBeat={50}
        snapEnabled={false}
        snapValue="BEAT"
        tempo={120}
        smpteFrameRate={30}
        meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
      />,
      { width: 800, height: 80 },
    );

    const surface = (container.querySelector('[data-group-id="root"]') ?? container.firstElementChild) as HTMLElement;
    rightClick(surface, 60, 20);
    assertMenuLivesInPopout();
    await flushDismissalListener();

    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('pointerdown', { bubbles: true }));
    });
    expect(menusIn(popoutDoc)).toBe(0);
  });
});
