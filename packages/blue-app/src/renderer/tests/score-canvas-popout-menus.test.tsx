// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type {
  PatternLayerSnapshot,
  PatternsLayerGroupSnapshot,
} from '../components/workbench/panels/score/types';
import type {
  PolyObjectLayerGroupSnapshot,
  ScoreRowObjectSnapshot,
} from '../components/workbench/panels/score/types';
import PatternsLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas';
import TrackLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas';
import ScoreTimeCanvas from '../components/workbench/panels/score/layer-groups/ScoreTimeCanvas';
import { HostDocumentContext } from '../hooks/use-host-document';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useLibraryStore } from '../stores/library-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
    target.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: x,
        clientY: y,
      }),
    );
  });
}

/** Pattern group fixture: cell 0 is ACTIVE so the cell menu's
 * Cut/Copy/Delete items are enabled at right-click (10, 10). */
function makePatternGroup(): PatternsLayerGroupSnapshot {
  const layer: PatternLayerSnapshot = {
    layerId: 'pl-1',
    name: 'A',
    height: 44,
    muted: false,
    solo: false,
    items: [],
    sourceObject: {
      objectId: 'src-pl-1',
      objectType: 'GenericScore',
      name: 'Source A',
      backgroundColor: 0xff204020,
      editorTarget: {
        selectionId: 'src-pl-1',
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        patternSource: { groupId: 'grp', layerId: 'pl-1', sourceObjectId: 'src-pl-1' },
        supportsTimeBehavior: true,
        supportsRepeatPoint: true,
        supportsNoteProcessorChain: true,
      },
      barRenderer: {
        kind: 'generic',
        labelLines: ['Source A'],
        timeBehavior: 'NONE',
        repeatPointBeats: null,
      },
    },
    activeCellIndices: [0],
  };
  return {
    groupId: 'grp',
    groupType: 'patterns',
    name: 'Patterns',
    layerCount: 1,
    isOpenableContainer: false,
    patternBeatsLength: 4,
    effectivePatternBeatsLength: 4,
    layers: [layer],
  };
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

  function renderUnderPopout(
    node: React.ReactElement,
    rect?: { width: number; height: number },
  ): void {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>{node}</HostDocumentContext.Provider>,
      );
    });
    if (rect) {
      const surface = container.firstElementChild as HTMLElement;
      Object.defineProperty(surface, 'getBoundingClientRect', {
        value: () => ({
          left: 0,
          top: 0,
          right: rect.width,
          bottom: rect.height,
          width: rect.width,
          height: rect.height,
          x: 0,
          y: 0,
          toJSON: () => undefined,
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
      layerId: 'pl-1',
      name: 'A',
      height: 44,
      muted: false,
      solo: false,
      items: [],
      sourceObject: {
        objectId: 'src-pl-1',
        objectType: 'GenericScore',
        name: 'Source A',
        backgroundColor: 0xff204020,
        editorTarget: {
          selectionId: 'src-pl-1',
          selectedObjectType: 'GenericScore',
          editorObjectType: 'GenericScore',
          ownerKind: 'timeline',
          displayContext: 'timeline',
          patternSource: { groupId: 'grp', layerId: 'pl-1', sourceObjectId: 'src-pl-1' },
          supportsTimeBehavior: true,
          supportsRepeatPoint: true,
          supportsNoteProcessorChain: true,
        },
        barRenderer: {
          kind: 'generic',
          labelLines: ['Source A'],
          timeBehavior: 'NONE',
          repeatPointBeats: null,
        },
      },
      activeCellIndices: [0],
    };
    const group: PatternsLayerGroupSnapshot = {
      groupId: 'grp',
      groupType: 'patterns',
      name: 'Patterns',
      layerCount: 1,
      isOpenableContainer: false,
      patternBeatsLength: 4,
      effectivePatternBeatsLength: 4,
      layers: [layer],
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
      objectId: 'track-object',
      objectType: 'GenericScore',
      name: 'track-object',
      startBeats: 1,
      durationBeats: 2,
      startTimeBase: 'BEATS',
      durationTimeBase: 'BEATS',
      backgroundColor: 0,
      isContainer: false,
      editorTarget: {
        selectionId: 'track-object',
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        location: { rootGroupIndex: 1, containerPath: [], layerIndex: 0, objectIndex: 0 },
        supportsTimeBehavior: true,
        supportsRepeatPoint: true,
        supportsNoteProcessorChain: true,
      },
      barRenderer: {
        kind: 'generic',
        labelLines: ['track-object'],
        timeBehavior: 'NONE',
        repeatPointBeats: null,
      },
    };
    const group = {
      groupId: 'track-group',
      groupType: 'track',
      name: 'Tracks',
      defaultHeightIndex: 0,
      layerCount: 1,
      isOpenableContainer: false,
      layers: [
        {
          layerId: 'track-row',
          name: 'Track Row',
          height: 44,
          muted: false,
          solo: false,
          items: [item],
          layerKind: 'track',
          instrument: null,
        },
      ],
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

    const surface =
      container.querySelector<HTMLElement>(
        '[data-timeline-layer-row], [data-track-canvas], [data-group-id]',
      ) ?? (container.firstElementChild as HTMLElement);
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
      selectionId: 'score-1',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline' as const,
      displayContext: 'timeline' as const,
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
    const item: ScoreRowObjectSnapshot = {
      objectId: 'score-1',
      objectType: 'GenericScore',
      name: 'Popout me',
      startBeats: 0,
      durationBeats: 2,
      startTimeBase: 'BEATS',
      durationTimeBase: 'BEATS',
      backgroundColor: 0x336699,
      isContainer: false,
      editorTarget: target,
      barRenderer: { kind: 'fallback', labelLines: ['Popout me'], reason: 'unknown-type' },
    };
    const group: PolyObjectLayerGroupSnapshot = {
      groupId: 'root',
      groupType: 'polyObject',
      name: 'Root',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'root-layer-0',
          name: 'Layer 1',
          height: 44,
          muted: false,
          solo: false,
          items: [item],
        },
      ],
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

    const surface = (container.querySelector('[data-group-id="root"]') ??
      container.firstElementChild) as HTMLElement;
    rightClick(surface, 60, 20);
    assertMenuLivesInPopout();
    await flushDismissalListener();

    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('pointerdown', { bubbles: true }));
    });
    expect(menusIn(popoutDoc)).toBe(0);
  });

  it('menu near the popout viewport edge clamps against the HOST viewport, not the main window (FR-004)', async () => {
    // Host realm reports the 240x160 minimum supported panel; the main JSDOM
    // window stays ~1024x768. Floating UI derives the collision viewport from
    // the floating element's own document, so the menu must flip off the
    // right edge of the 240px HOST viewport — against the main window no
    // flip would occur and this assertion fails.
    const popoutHtml = popoutDoc.defaultView!;
    const originals: Array<{ target: object; key: string; descriptor: PropertyDescriptor }> = [];
    const mockHostRealm = (target: object, key: string, value: number) => {
      const original = Object.getOwnPropertyDescriptor(target, key);
      if (original) originals.push({ target, key, descriptor: original });
      Object.defineProperty(target, key, { configurable: true, get: () => value });
    };
    Object.defineProperty(popout.window, 'innerWidth', { configurable: true, value: 240 });
    Object.defineProperty(popout.window, 'innerHeight', { configurable: true, value: 160 });
    for (const element of [popoutDoc.documentElement, popoutDoc.body]) {
      mockHostRealm(element, 'clientWidth', 240);
      mockHostRealm(element, 'clientHeight', 160);
    }
    // The menu content (a host-realm element) reports a real menu box.
    mockHostRealm(popoutHtml.HTMLElement.prototype, 'offsetWidth', 180);
    mockHostRealm(popoutHtml.HTMLElement.prototype, 'offsetHeight', 120);

    try {
      renderUnderPopout(
        <PatternsLayerGroupCanvas
          group={makePatternGroup()}
          projectSessionId={1}
          projectRevision={1}
          totalBeats={64}
          pixelsPerBeat={20}
          snapEnabled={false}
          snapValue="BEAT"
          tempo={60}
          smpteFrameRate={24}
          meterMap={{ entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
        />,
        { width: 240, height: 160 },
      );
      const canvas = container.querySelector<HTMLElement>('[data-pattern-canvas]')!;
      rightClick(canvas, 236, 20);
      assertMenuLivesInPopout();
      await flushDismissalListener();

      const menu = popoutDoc.querySelector<HTMLElement>('[data-pattern-context-menu]')!;
      expect(menu.getAttribute('data-side')).toBe('left'); // flipped off the host viewport's right edge
    } finally {
      for (const { target, key, descriptor } of originals) {
        Object.defineProperty(target, key, descriptor);
      }
    }
  });

  it('keyboard parity: focus enters the host realm, arrows navigate, and Enter activates (FR-010)', async () => {
    renderUnderPopout(
      <PatternsLayerGroupCanvas
        group={makePatternGroup()}
        projectSessionId={1}
        projectRevision={1}
        totalBeats={64}
        pixelsPerBeat={20}
        snapEnabled={false}
        snapValue="BEAT"
        tempo={60}
        smpteFrameRate={24}
        meterMap={{ entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
      />,
    );
    const canvas = container.querySelector<HTMLElement>('[data-pattern-canvas]')!;
    rightClick(canvas, 10, 10); // active cell: Cut/Copy/Delete enabled
    assertMenuLivesInPopout();
    await flushDismissalListener();

    const menu = popoutDoc.querySelector<HTMLElement>('[data-pattern-context-menu]')!;
    // On open, Radix moves focus into the HOST realm's menu content.
    expect(popoutDoc.activeElement).toBeTruthy();
    expect(menu.contains(popoutDoc.activeElement)).toBe(true);

    // Arrow keys navigate items (exactly one highlighted menuitem).
    act(() => {
      (popoutDoc.activeElement ?? menu).dispatchEvent(
        new PopoutKeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
    });
    await flushDismissalListener();
    const highlighted = popoutDoc.querySelector<HTMLElement>('[data-highlighted]');
    expect(highlighted).toBeTruthy();
    expect(highlighted!.getAttribute('role')).toBe('menuitem');

    // Enter activates the highlighted command and closes the menu.
    act(() => {
      highlighted!.dispatchEvent(
        new PopoutKeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });
    await flushDismissalListener();
    expect(menusIn(popoutDoc)).toBe(0);
    expect(menusIn(document)).toBe(0);
  });
});
