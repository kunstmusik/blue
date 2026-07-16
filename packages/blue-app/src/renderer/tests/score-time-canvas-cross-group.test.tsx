// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScoreTimeCanvas from '../components/workbench/panels/score/layer-groups/ScoreTimeCanvas';
import type {
  AudioLayerGroupSnapshot,
  PolyObjectLayerGroupSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreRowObjectSnapshot,
} from '../components/workbench/panels/score/types';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();

function createSoundItem(
  objectId: string,
  name: string,
  layerIndex: number,
  objectIndex: number,
  startBeats: number,
  durationBeats: number,
): ScoreRowObjectSnapshot {
  return {
    objectId,
    objectType: 'GenericScore',
    name,
    startBeats,
    durationBeats,
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
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex,
        objectIndex,
      },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: {
      kind: 'fallback',
      labelLines: [name],
      reason: 'unknown-type',
    },
  };
}

function createAudioItem(
  objectId: string,
  name: string,
  layerIndex: number,
  objectIndex: number,
  startBeats: number,
  durationBeats: number,
): ScoreRowObjectSnapshot {
  const filePath = `/tmp/${name.toLowerCase()}.wav`;
  return {
    objectId,
    objectType: 'AudioClip',
    name,
    startBeats,
    durationBeats,
    startTimeBase: 'BEATS',
    durationTimeBase: 'BEATS',
    backgroundColor: 0x669966,
    isContainer: false,
    editorTarget: {
      selectionId: objectId,
      selectedObjectType: 'AudioClip',
      editorObjectType: 'AudioClip',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 1,
        containerPath: [],
        layerIndex,
        objectIndex,
      },
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    },
    barRenderer: {
      kind: 'audioClip',
      labelLines: [name],
      audioFilePath: filePath,
      waveformKey: `aclp:${filePath}`,
      fileStartTimeBeats: 0,
      audioDurationBeats: durationBeats,
      looping: true,
      fadeInBeats: 0,
      fadeInType: 'LINEAR',
      fadeOutBeats: 0,
      fadeOutType: 'LINEAR',
    },
  };
}

function createSoundGroup(itemsByLayer: ScoreRowObjectSnapshot[][]): PolyObjectLayerGroupSnapshot {
  return {
    groupId: 'sound-group',
    groupType: 'polyObject',
    name: 'SoundObject Layer Group',
    layerCount: itemsByLayer.length,
    isOpenableContainer: true,
    layers: itemsByLayer.map((items, index) => ({
      layerId: `sound-group-layer-${index}`,
      name: `Layer ${index + 1}`,
      height: 44,
      muted: false,
      solo: false,
      items,
    })),
  };
}

function createAudioGroup(itemsByLayer: ScoreRowObjectSnapshot[][]): AudioLayerGroupSnapshot {
  return {
    groupId: 'audio-group',
    groupType: 'audio',
    name: 'Audio Layer Group',
    layerCount: itemsByLayer.length,
    isOpenableContainer: false,
    layers: itemsByLayer.map((items, index) => ({
      layerId: `audio-group-layer-${index}`,
      name: `Layer ${index + 1}`,
      height: 44,
      muted: false,
      solo: false,
      items,
    })),
  };
}

function renderCanvas(
  group: PolyObjectLayerGroupSnapshot,
  allLayerGroups: ScoreLayerGroupSnapshot[],
  options?: { pixelsPerBeat?: number; totalBeats?: number },
): {
  root: Root;
  surface: HTMLDivElement;
} {
  const pixelsPerBeat = options?.pixelsPerBeat ?? 25;
  const totalBeats = options?.totalBeats ?? 16;

  useProjectStore.setState({
    score: {
      ...useProjectStore.getState().score,
      layerGroups: allLayerGroups,
    },
  } as Partial<ReturnType<typeof useProjectStore.getState>>);

  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  act(() => {
    root.render(
      <ScoreTimeCanvas
        projectSessionId={1}
        projectRevision={1}
        scoreRootGroupId="group-1"
        scoreContainerPath={[]}
        group={group}
        totalBeats={totalBeats}
        pixelsPerBeat={pixelsPerBeat}
        snapEnabled
        snapValue="BEAT"
        tempo={120}
        smpteFrameRate={30}
        meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
      />,
    );
  });

  const surface = container.querySelector('[data-group-id="sound-group"]') as HTMLDivElement;
  Object.defineProperty(surface, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      right: 400,
      bottom: 44,
      width: 400,
      height: 44,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    }),
  });

  return { root, surface };
}

function dispatchMouseEvent(
  target: EventTarget,
  type: string,
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

beforeEach(() => {
  useProjectStore.setState({
    applyProjectDocumentPatch: vi.fn().mockResolvedValue(undefined),
    moveScoreObjects: vi.fn(),
    resizeScoreObjects: vi.fn(),
  } as Partial<ReturnType<typeof useProjectStore.getState>>);
  useScoreSelectionStore.getState().clearSelection();
});

afterEach(() => {
  useProjectStore.setState({
    score: originalProjectState.score,
    applyProjectDocumentPatch: originalProjectState.applyProjectDocumentPatch,
    moveScoreObjects: originalProjectState.moveScoreObjects,
    resizeScoreObjects: originalProjectState.resizeScoreObjects,
  } as Partial<ReturnType<typeof useProjectStore.getState>>);
  useScoreSelectionStore.getState().clearSelection();
  document.body.innerHTML = '';
});

describe('ScoreTimeCanvas cross-group gestures', () => {
  it('resizes selected soundObject and audio objects from a soundObject edge drag', async () => {
    const soundGroup = createSoundGroup([
      [createSoundItem('sound-1', 'Sine', 0, 0, 0, 2)],
    ]);
    const audioGroup = createAudioGroup([
      [createAudioItem('audio-1', 'Kick', 0, 0, 1, 2)],
    ]);

    useScoreSelectionStore.getState().setSelection([
      { objectId: 'sound-1', editorTarget: soundGroup.layers[0]!.items[0]!.editorTarget },
      { objectId: 'audio-1', editorTarget: audioGroup.layers[0]!.items[0]!.editorTarget },
    ]);

    const { root, surface } = renderCanvas(soundGroup, [soundGroup, audioGroup]);
    const resizeScoreObjects = useProjectStore.getState().resizeScoreObjects as unknown as ReturnType<typeof vi.fn>;

    await act(async () => {
      dispatchMouseEvent(surface, 'mousedown', 49, 10);
      dispatchMouseEvent(window, 'mousemove', 74, 10);
      dispatchMouseEvent(window, 'mouseup', 74, 10);
      await Promise.resolve();
    });

    expect(resizeScoreObjects).toHaveBeenCalledWith([
      expect.objectContaining({
        objectId: 'sound-1',
        targetStartBeats: 0,
        targetDurationBeats: 3,
      }),
      expect.objectContaining({
        objectId: 'audio-1',
        targetStartBeats: 1,
        targetDurationBeats: 3,
      }),
    ]);

    act(() => {
      root.unmount();
    });
  });

  it('stops soundObject-origin left resize for all selected objects when any selected object reaches beat zero', async () => {
    const soundGroup = createSoundGroup([
      [createSoundItem('sound-1', 'Sine', 0, 0, 1, 2)],
    ]);
    const audioGroup = createAudioGroup([
      [createAudioItem('audio-1', 'Kick', 0, 0, 3, 2)],
    ]);

    useScoreSelectionStore.getState().setSelection([
      { objectId: 'sound-1', editorTarget: soundGroup.layers[0]!.items[0]!.editorTarget },
      { objectId: 'audio-1', editorTarget: audioGroup.layers[0]!.items[0]!.editorTarget },
    ]);

    const { root, surface } = renderCanvas(soundGroup, [soundGroup, audioGroup]);
    const resizeScoreObjects = useProjectStore.getState().resizeScoreObjects as unknown as ReturnType<typeof vi.fn>;

    await act(async () => {
      dispatchMouseEvent(surface, 'mousedown', 26, 10);
      dispatchMouseEvent(window, 'mousemove', -50, 10);
      dispatchMouseEvent(window, 'mouseup', -50, 10);
      await Promise.resolve();
    });

    expect(resizeScoreObjects).toHaveBeenCalledWith([
      expect.objectContaining({
        objectId: 'sound-1',
        targetStartBeats: 0,
        targetDurationBeats: 3,
      }),
      expect.objectContaining({
        objectId: 'audio-1',
        targetStartBeats: 2,
        targetDurationBeats: 3,
      }),
    ]);

    act(() => {
      root.unmount();
    });
  });

  it('renders snap lines without using an oversized row canvas on long scores', () => {
    const soundGroup = createSoundGroup([
      [createSoundItem('sound-1', 'Sine', 0, 0, 0, 2)],
    ]);

    const { root, surface } = renderCanvas(soundGroup, [soundGroup], {
      pixelsPerBeat: 25,
      totalBeats: 1400,
    });

    expect(surface.querySelector('canvas')).toBeNull();

    const snapLines = surface.querySelector('[data-snap-lines-layer="sound-group-layer-0"]');
    expect(snapLines).not.toBeNull();
    expect(snapLines?.getAttribute('width')).toBe('35000');

    act(() => {
      root.unmount();
    });
  });
});
