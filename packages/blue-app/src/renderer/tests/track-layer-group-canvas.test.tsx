// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findTimelineHit,
  findTimelineLayerAtY,
  selectionIntersectsTimelineItem,
  snapTimelineBeat,
  timelinePointerDeltaBeats,
} from '../components/workbench/panels/score/layer-groups/score-timeline-gesture-utils';
import type { ScoreLayerSnapshot, ScoreRowObjectSnapshot } from '../components/workbench/panels/score/types';
import type { ScoreLayerGroupSnapshot, TrackLayerGroupSnapshot } from '../../shared/project-editor';
import TrackLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas';
import { useProjectStore } from '../stores/project-store';
import { useLibraryStore } from '../stores/library-store';
import { useMidiRoutingStore } from '../stores/midi-routing-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useWorkbenchStore } from '../stores/workbench-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeItem(objectId: string, startBeats: number, durationBeats: number): ScoreRowObjectSnapshot {
  return {
    objectId,
    objectType: 'GenericScore',
    name: objectId,
    startBeats,
    durationBeats,
    startTimeBase: 'BEATS',
    durationTimeBase: 'BEATS',
    backgroundColor: 0,
    isContainer: false,
    editorTarget: {
      selectionId: objectId,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: {
      kind: 'generic',
      labelLines: [objectId],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
    },
  };
}

function makeLayer(items: ScoreRowObjectSnapshot[]): ScoreLayerSnapshot {
  return {
    layerId: 'track-row',
    name: 'Track Row',
    height: 22,
    muted: false,
    solo: false,
    items,
  };
}

function withLocation(
  item: ScoreRowObjectSnapshot,
  rootGroupIndex: number,
  layerIndex: number,
  objectIndex: number,
): ScoreRowObjectSnapshot {
  return {
    ...item,
    editorTarget: {
      ...item.editorTarget!,
      location: { rootGroupIndex, containerPath: [], layerIndex, objectIndex },
    },
  };
}

function makeAudioItem(objectId: string, startBeats: number, durationBeats: number): ScoreRowObjectSnapshot {
  return {
    ...makeItem(objectId, startBeats, durationBeats),
    objectType: 'AudioClip',
    editorTarget: {
      ...makeItem(objectId, startBeats, durationBeats).editorTarget!,
      selectedObjectType: 'AudioClip',
      editorObjectType: 'AudioClip',
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    },
    barRenderer: {
      kind: 'audioClip',
      labelLines: [objectId],
      audioFilePath: '/tmp/test.wav',
      waveformKey: null,
      fileStartTimeBeats: 0,
      audioDurationBeats: 8,
      looping: true,
      fadeInBeats: 0.5,
      fadeInType: 'LINEAR',
      fadeOutBeats: 0.5,
      fadeOutType: 'LINEAR',
    },
  };
}

function makeTrackGroup(items: ScoreRowObjectSnapshot[]): TrackLayerGroupSnapshot {
  return {
    groupId: 'track-group',
    groupType: 'track',
    name: 'Tracks',
    defaultHeightIndex: 0,
    layerCount: 1,
    isOpenableContainer: false,
    layers: [{
      ...makeLayer(items.map((item, index) => withLocation(item, 1, 0, index))),
      layerId: 'track-row',
      layerKind: 'track',
      instrument: null,
      height: 44,
    }],
  };
}

function makeSoundGroup(items: ScoreRowObjectSnapshot[]): ScoreLayerGroupSnapshot {
  return {
    groupId: 'sound-group',
    groupType: 'polyObject',
    name: 'SoundObjects',
    layerCount: 1,
    isOpenableContainer: true,
    layers: [{
      ...makeLayer(items.map((item, index) => withLocation(item, 0, 0, index))),
      layerId: 'sound-row',
      height: 44,
    }],
  };
}

function renderTrackCanvas(group: TrackLayerGroupSnapshot, allLayerGroups: ScoreLayerGroupSnapshot[] = [group]) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(<TrackLayerGroupCanvas
      group={group}
      allLayerGroups={allLayerGroups}
      projectSessionId={1}
      projectRevision={1}
      scoreRootGroupId={group.groupId}
      scoreContainerPath={[]}
      totalBeats={16}
      pixelsPerBeat={25}
      snapEnabled={false}
      snapValue="BEAT"
      tempo={120}
      smpteFrameRate={30}
      meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
    />);
  });
  const surface = host.querySelector('[data-track-layer-group="true"]') as HTMLDivElement;
  Object.defineProperty(surface, 'getBoundingClientRect', { value: () => ({
    left: 0, top: 0, right: 400, bottom: 44, width: 400, height: 44, x: 0, y: 0,
    toJSON: () => undefined,
  }) });
  return { host, root, surface };
}

function mouse(target: EventTarget, type: string, x: number, y: number, init: MouseEventInit = {}) {
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, ...init,
  }));
}

const originalProjectActions = {
  applyProjectDocumentPatch: useProjectStore.getState().applyProjectDocumentPatch,
  moveScoreObjects: useProjectStore.getState().moveScoreObjects,
  resizeScoreObjects: useProjectStore.getState().resizeScoreObjects,
};
const originalCaptureScoreSoundObject = useLibraryStore.getState().captureScoreSoundObject;
const originalSelect = useScoreSelectionStore.getState().select;
const originalOpenPanel = useWorkbenchStore.getState().openPanel;

beforeEach(() => {
  useProjectStore.setState({
    applyProjectDocumentPatch: vi.fn().mockResolvedValue(undefined),
    moveScoreObjects: vi.fn(),
    resizeScoreObjects: vi.fn(),
    setAudioClipEditorPreview: vi.fn(),
    clearAudioClipEditorPreview: vi.fn(),
  } as Partial<ReturnType<typeof useProjectStore.getState>>);
  useScoreSelectionStore.getState().clearSelection();
  useScoreSelectionStore.getState().clearClipboard();
  useMidiRoutingStore.getState().clearFocusForProjectSession();
  useScoreSelectionStore.setState({ select: originalSelect });
  useLibraryStore.setState({ captureScoreSoundObject: vi.fn().mockResolvedValue(true) });
  useWorkbenchStore.setState({ openPanel: vi.fn() } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
});

afterEach(() => {
  useProjectStore.setState(originalProjectActions as Partial<ReturnType<typeof useProjectStore.getState>>);
  useLibraryStore.setState({ captureScoreSoundObject: originalCaptureScoreSoundObject });
  useScoreSelectionStore.setState({ select: originalSelect });
  useScoreSelectionStore.getState().clearSelection();
  useScoreSelectionStore.getState().clearClipboard();
  useMidiRoutingStore.getState().clearFocusForProjectSession();
  useWorkbenchStore.setState({ openPanel: originalOpenPanel } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
  document.body.innerHTML = '';
});

describe('Track layer timeline gestures', () => {
  it('uses the topmost overlapping item and correct row hit target', () => {
    const layers = [
      makeLayer([makeItem('bottom', 0, 4), makeItem('top', 1, 2)]),
      makeLayer([makeItem('other-row', 0, 1)]),
    ];

    expect(findTimelineLayerAtY(layers, 23, 22)?.layerIndex).toBe(1);
    const hit = findTimelineHit(layers, 1.5, 10, 20, 22);
    expect(hit?.item.objectId).toBe('top');
    expect(hit?.itemIndex).toBe(1);
  });

  it('supports marquee intersection and floor/nearest snapping', () => {
    const item = makeItem('selected', 2, 2);
    expect(selectionIntersectsTimelineItem(item, 22, 22, {
      left: 3,
      right: 4,
      top: 10,
      bottom: 30,
    })).toBe(true);
    expect(selectionIntersectsTimelineItem(item, 44, 22, {
      left: 3,
      right: 4,
      top: 10,
      bottom: 30,
    })).toBe(false);
    expect(snapTimelineBeat(1.7, true, 0.5, 'floor')).toBe(1.5);
    expect(snapTimelineBeat(1.7, true, 0.5, 'nearest')).toBe(1.5);
    expect(snapTimelineBeat(1.8, true, 0.5, 'nearest')).toBe(2);
  });

  it('derives drag movement from the local timeline coordinate', () => {
    expect(timelinePointerDeltaBeats(460, 3, 100)).toBeCloseTo(1.6);
  });

  it('focuses the Track from empty timeline and contained-object selections', () => {
    const group = makeTrackGroup([makeItem('track-object', 1, 2)]);
    const { root, surface } = renderTrackCanvas(group);

    act(() => {
      mouse(surface, 'mousedown', 300, 15);
      mouse(window, 'mouseup', 300, 15);
    });
    expect(useMidiRoutingStore.getState().focusedTarget).toMatchObject({
      kind: 'track',
      projectSessionId: 1,
      rootGroupId: 'track-group',
      trackId: 'track-row',
      displayName: 'Track Row',
    });

    act(() => {
      useMidiRoutingStore.getState().clearFocusForProjectSession();
      mouse(surface, 'mousedown', 30, 15);
      mouse(window, 'mouseup', 30, 15);
    });
    expect(useMidiRoutingStore.getState().focusedTarget).toMatchObject({
      kind: 'track',
      rootGroupId: 'track-group',
      trackId: 'track-row',
    });

    act(() => root.unmount());
  });

  it.each([
    ['Command', { metaKey: true }],
    ['Control', { ctrlKey: true }],
  ] as const)('pastes the ScoreObject buffer at an empty Track location on %s-click', (_label, modifiers) => {
    useScoreSelectionStore.setState({
      clipboard: [{
        ...makeItem('copied-object', 1, 2),
        layerIndex: 0,
        groupId: 'source-group',
      }],
    });
    const group = makeTrackGroup([]);
    const { root, surface } = renderTrackCanvas(group);

    act(() => mouse(surface, 'mousedown', 100, 15, modifiers));

    const applyPatch = useProjectStore.getState().applyProjectDocumentPatch as ReturnType<typeof vi.fn>;
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'addTrackItem',
        track: {
          rootGroupId: 'track-group',
          trackId: 'track-row',
          projectSessionId: 1,
          projectRevision: 1,
        },
        item: expect.objectContaining({ objectType: 'GenericScore', name: 'copied-object' }),
        startBeats: 4,
      },
    });
    act(() => root.unmount());
  });

  it('does not reselect a PianoRoll when double-click opens its existing editor', () => {
    const select = vi.fn(originalSelect);
    const openPanel = vi.fn();
    useScoreSelectionStore.setState({ select });
    useWorkbenchStore.setState({ openPanel } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
    const pianoRoll = {
      ...makeItem('piano-roll', 1, 2),
      objectType: 'PianoRoll',
      editorTarget: {
        ...makeItem('piano-roll', 1, 2).editorTarget!,
        selectedObjectType: 'PianoRoll',
        editorObjectType: 'PianoRoll',
      },
    };
    const group = makeTrackGroup([pianoRoll]);
    const { root, surface } = renderTrackCanvas(group);

    act(() => {
      mouse(surface, 'mousedown', 30, 15);
      mouse(window, 'mouseup', 30, 15);
      mouse(surface, 'dblclick', 30, 15);
    });

    expect(select).toHaveBeenCalledTimes(1);
    expect(openPanel).toHaveBeenCalledWith('ScoreObjectEditorTopComponent');
    act(() => root.unmount());
  });

  it('positions each rendered bar exactly once', () => {
    const group = makeTrackGroup([makeItem('track-object', 2, 2)]);
    const { host, root } = renderTrackCanvas(group);
    const bar = Array.from(host.querySelectorAll('div')).find((element) => element.style.left === '50px');
    expect(bar).toBeTruthy();
    expect(bar?.parentElement?.style.left).toBe('');
    act(() => root.unmount());
  });

  it('moves a mixed Track/SoundObject selection by one shared pointer delta', () => {
    const sound = makeSoundGroup([makeItem('sound-object', 1, 2)]);
    const track = makeTrackGroup([makeItem('track-object', 2, 2)]);
    const { root, surface } = renderTrackCanvas(track, [sound, track]);
    act(() => {
      useScoreSelectionStore.getState().setSelection([
        { objectId: 'sound-object', editorTarget: sound.layers[0]!.items[0]!.editorTarget },
        { objectId: 'track-object', editorTarget: track.layers[0]!.items[0]!.editorTarget },
      ]);
    });

    act(() => {
      mouse(surface, 'mousedown', 62, 20);
      mouse(window, 'mousemove', 87, 20);
      mouse(window, 'mouseup', 87, 20);
    });

    const applyPatch = useProjectStore.getState().applyProjectDocumentPatch as ReturnType<typeof vi.fn>;
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'moveScoreObjects',
        moves: expect.arrayContaining([
          expect.objectContaining({ targetStartBeats: 2, targetGroupId: 'sound-group' }),
          expect.objectContaining({ targetStartBeats: 3, targetGroupId: 'track-group' }),
        ]),
      },
    });
    act(() => root.unmount());
  });

  it('marquee-selects Track items and restores AudioClip fade handles on rollover', () => {
    const group = makeTrackGroup([
      makeItem('track-object', 1, 1),
      makeAudioItem('audio-object', 3, 2),
    ]);
    const { host, root, surface } = renderTrackCanvas(group);

    act(() => {
      mouse(surface, 'mousedown', 0, 5);
      mouse(window, 'mousemove', 60, 35);
      mouse(window, 'mouseup', 60, 35);
    });
    expect([...useScoreSelectionStore.getState().selectedObjectIds]).toEqual(['track-object']);

    act(() => mouse(surface, 'mousemove', 80, 15));
    expect(host.querySelector('[data-fade-handle="in"]')).toBeTruthy();
    expect(host.querySelector('[data-fade-handle="out"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('drags an AudioClip fade handle and commits the fade in seconds', () => {
    const group = makeTrackGroup([makeAudioItem('audio-object', 3, 2)]);
    const { host, root, surface } = renderTrackCanvas(group);

    act(() => mouse(surface, 'mousemove', 80, 15));
    const fadeIn = host.querySelector('[data-fade-handle="in"]') as HTMLDivElement;
    expect(fadeIn).toBeTruthy();

    act(() => {
      mouse(fadeIn, 'mousedown', 88, 4);
      mouse(window, 'mousemove', 113, 4);
      mouse(window, 'mouseup', 113, 4);
    });

    const applyPatch = useProjectStore.getState().applyProjectDocumentPatch as ReturnType<typeof vi.fn>;
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateTypeSpecificEditor',
        target: group.layers[0]!.items[0]!.editorTarget,
        patch: { fadeIn: 0.75 },
      },
    });
    act(() => root.unmount());
  });

  it('shows the Track background selection commands', () => {
    const group = makeTrackGroup([makeItem('track-object', 1, 1)]);
    const { root, surface } = renderTrackCanvas(group);

    act(() => mouse(surface, 'contextmenu', 200, 15));
    const menuText = document.body.textContent ?? '';
    expect(menuText).toContain('Select Layer');
    expect(menuText).toContain('Select All Before');
    expect(menuText).toContain('Select All After');
    act(() => root.unmount());
  });

  it('shows the requested Track object actions from Replace downward', () => {
    const group = makeTrackGroup([makeItem('track-object', 1, 1)]);
    const { root, surface } = renderTrackCanvas(group);

    act(() => mouse(surface, 'contextmenu', 30, 15));
    const menuText = document.body.textContent ?? '';
    for (const label of [
      'Replace with SoundObject in Buffer',
      'Follow the Leader',
      'Reverse',
      'Align',
      'Shift…',
      'Set Subjective Time to Objective Time',
      'Cut',
      'Copy',
      'Remove',
      'Set Color…',
      'Export…',
    ]) {
      expect(menuText).toContain(label);
    }
    act(() => root.unmount());
  });

  it('applies successive picker colors to every selected Track SoundObject', async () => {
    const group = makeTrackGroup([
      makeItem('track-object', 1, 1),
      makeItem('track-object-2', 3, 1),
    ]);
    const { host, root, surface } = renderTrackCanvas(group);
    act(() => {
      useScoreSelectionStore.getState().setSelection(group.layers[0]!.items.map((item) => ({
        objectId: item.objectId,
        editorTarget: item.editorTarget,
      })));
    });

    act(() => mouse(surface, 'contextmenu', 30, 15));
    const setColor = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent === 'Set Color…')!;
    await act(async () => {
      setColor.click();
      await Promise.resolve();
    });

    const input = document.querySelector<HTMLInputElement>('[aria-label="Hex color"]')!;
    await act(async () => {
      input.value = '#123456';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = '#654321';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const picker = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(picker.dataset.placement).toBe('bottom');
    expect(Number.parseFloat(picker.style.top)).toBeGreaterThanOrEqual(52);
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    const applyPatch = useProjectStore.getState().applyProjectDocumentPatch as ReturnType<typeof vi.fn>;
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateSharedProperties',
        target: group.layers[0]!.items[0]!.editorTarget,
        patch: { backgroundColor: 0x123456 },
      },
    });
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateSharedProperties',
        target: group.layers[0]!.items[1]!.editorTarget,
        patch: { backgroundColor: 0x123456 },
      },
    });
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateSharedProperties',
        target: group.layers[0]!.items[0]!.editorTarget,
        patch: { backgroundColor: 0x654321 },
      },
    });
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateSharedProperties',
        target: group.layers[0]!.items[1]!.editorTarget,
        patch: { backgroundColor: 0x654321 },
      },
    });
    act(() => root.unmount());
  });

  it('shares a copied Track SoundObject with library paste destinations', () => {
    const group = makeTrackGroup([makeItem('track-object', 1, 1)]);
    const { root, surface } = renderTrackCanvas(group);
    act(() => {
      useScoreSelectionStore.getState().setSelection([{
        objectId: 'track-object',
        editorTarget: group.layers[0]!.items[0]!.editorTarget,
      }]);
    });
    act(() => {
      surface.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        metaKey: true,
        key: 'c',
      }));
    });

    expect(useLibraryStore.getState().captureScoreSoundObject).toHaveBeenCalledWith({
      projectSessionId: 1,
      projectRevision: 1,
      location: { rootGroupIndex: 1, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    expect(useScoreSelectionStore.getState().clipboard).toHaveLength(1);
    act(() => root.unmount());
  });

  it('removes a cut Track SoundObject only after the portable buffer capture succeeds', async () => {
    let resolveCapture: ((captured: boolean) => void) | undefined;
    useLibraryStore.setState({
      captureScoreSoundObject: vi.fn().mockImplementation(() => new Promise<boolean>((resolve) => {
        resolveCapture = resolve;
      })),
    });
    const group = makeTrackGroup([makeItem('track-object', 1, 1)]);
    const { root, surface } = renderTrackCanvas(group);
    act(() => {
      useScoreSelectionStore.getState().setSelection([{
        objectId: 'track-object',
        editorTarget: group.layers[0]!.items[0]!.editorTarget,
      }]);
    });
    act(() => {
      surface.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        metaKey: true,
        key: 'x',
      }));
    });

    const applyPatch = useProjectStore.getState().applyProjectDocumentPatch as ReturnType<typeof vi.fn>;
    expect(applyPatch).not.toHaveBeenCalled();
    await act(async () => resolveCapture?.(true));
    expect(applyPatch).toHaveBeenCalledWith({
      score: {
        type: 'removeScoreObjects',
        targets: [group.layers[0]!.items[0]!.editorTarget],
      },
    });
    act(() => root.unmount());
  });
});
