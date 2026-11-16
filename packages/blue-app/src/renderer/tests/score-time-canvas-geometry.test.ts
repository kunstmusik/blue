import { describe, expect, it } from 'vitest';
import {
  argbToRGB,
  brighten,
  buildGlobalLayerData,
  collectAllItemSelectionEntries,
  colorToCSS,
  darken,
  findItemOnLayer,
  findLayerAtY,
  getGlobalLayerIndexForY,
  getLayerAdjustBounds,
  rgbToCSS,
  sameLocation,
  sameTarget,
  textColorForBackground,
} from '../components/workbench/panels/score/layer-groups/score-time-canvas-geometry';
import { findTimelineItemAtX } from '../components/workbench/panels/score/layer-groups/score-timeline-gesture-utils';
import type {
  PolyObjectLayerGroupSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreLayerSnapshot,
  ScoreRowObjectSnapshot,
} from '../components/workbench/panels/score/types';

function makeItem(
  objectId: string,
  startBeats: number,
  durationBeats: number,
): ScoreRowObjectSnapshot {
  return {
    objectId,
    objectType: 'GenericScore',
    name: objectId,
    startBeats,
    durationBeats,
    backgroundColor: 0xff336699,
    barRenderer: {
      kind: 'generic',
      labelLines: [objectId],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
    },
  };
}

function makeLayer(
  layerId: string,
  height: number,
  items: ScoreRowObjectSnapshot[],
): ScoreLayerSnapshot {
  return {
    layerId,
    layerKind: 'soundObject',
    name: layerId,
    height,
    muted: false,
    solo: false,
    items,
  };
}

describe('score-time-canvas-geometry', () => {
  it('distinguishes ScoreTimeCanvas exact authored-duration hit-testing from timeline 4px minimum hit width', () => {
    const shortClip = makeItem('short-clip', 2.0, 0.05);
    const layer = makeLayer('l1', 44, [shortClip]);
    const pixelsPerBeat = 20; // 4px minimum hit width = 4 / 20 = 0.20 beats

    // Within authored duration [2.0, 2.05]: both hit
    expect(findItemOnLayer(layer, 2.04)?.objectId).toBe('short-clip');
    expect(findTimelineItemAtX(layer, 2.04, pixelsPerBeat)?.item.objectId).toBe('short-clip');

    // Beyond authored duration (2.05) but within 4px minimum hit width (2.20):
    // ScoreTimeCanvas uses exact authored duration -> miss
    // Track/timeline gesture utils applies 4px minimum hit width -> hit
    expect(findItemOnLayer(layer, 2.1)).toBeNull();
    expect(findTimelineItemAtX(layer, 2.1, pixelsPerBeat)?.item.objectId).toBe('short-clip');

    // Beyond 4px minimum hit width: both miss
    expect(findTimelineItemAtX(layer, 2.25, pixelsPerBeat)).toBeNull();
  });

  it('finds topmost overlapping item and layer offsets accurately', () => {
    const first = makeItem('first', 1, 3);
    const second = makeItem('second', 2, 2);
    const l1 = makeLayer('l1', 30, [first, second]);
    const l2 = makeLayer('l2', 40, []);

    expect(findItemOnLayer(l1, 2.5)?.objectId).toBe('second');
    expect(findLayerAtY([l1, l2], 0)).toEqual({ layer: l1, index: 0, yOffset: 0 });
    expect(findLayerAtY([l1, l2], 35)).toEqual({ layer: l2, index: 1, yOffset: 30 });
    expect(findLayerAtY([l1, l2], 70)).toBeNull();
  });

  it('computes global layer maps, indices, adjust bounds, and selection entries across groups', () => {
    const polyA: PolyObjectLayerGroupSnapshot = {
      groupId: 'poly-a',
      groupType: 'polyObject',
      name: 'Poly A',
      defaultHeightIndex: 1,
      layerCount: 2,
      isOpenableContainer: true,
      layers: [makeLayer('pa-1', 20, [makeItem('o1', 0, 2)]), makeLayer('pa-2', 30, [])],
    };
    const trackB: ScoreLayerGroupSnapshot = {
      groupId: 'track-b',
      groupType: 'track',
      name: 'Track B',
      defaultHeightIndex: 1,
      layerCount: 1,
      isOpenableContainer: true,
      layers: [{ ...makeLayer('tb-1', 40, []), layerKind: 'track', instrument: null }],
    };

    const data = buildGlobalLayerData([polyA, trackB]);
    expect(data.layerMap).toEqual([
      { groupId: 'poly-a', localIndex: 0, acceptsScoreObject: true },
      { groupId: 'poly-a', localIndex: 1, acceptsScoreObject: true },
      { groupId: 'track-b', localIndex: 0, acceptsScoreObject: false },
    ]);
    expect(data.groupStartIndexById.get('poly-a')).toBe(0);
    expect(data.groupStartIndexById.get('track-b')).toBe(2);
    expect(getGlobalLayerIndexForY([polyA, trackB], 25)).toBe(1);
    const boundsAtZero = getLayerAdjustBounds(data.layerMap, 0);
    expect(boundsAtZero.min === 0 && boundsAtZero.max === 1).toBe(true);
    expect(getLayerAdjustBounds(data.layerMap, 1)).toEqual({ min: -1, max: 0 });
    expect(collectAllItemSelectionEntries(polyA).map((entry) => entry.objectId)).toEqual(['o1']);
  });

  it('compares locations/targets and converts ARGB colors cleanly', () => {
    const locA = {
      rootGroupIndex: 0,
      containerPath: [{ layerIndex: 1, objectIndex: 2 }],
      layerIndex: 0,
      objectIndex: 3,
    };
    const locB = {
      rootGroupIndex: 0,
      containerPath: [{ layerIndex: 1, objectIndex: 2 }],
      layerIndex: 0,
      objectIndex: 3,
    };
    const locC = {
      rootGroupIndex: 0,
      containerPath: [{ layerIndex: 1, objectIndex: 9 }],
      layerIndex: 0,
      objectIndex: 3,
    };

    expect(sameLocation(locA, locB)).toBe(true);
    expect(sameLocation(locA, locC)).toBe(false);
    expect(
      sameTarget(
        {
          selectionId: 'a',
          selectedObjectType: 'GenericScore',
          editorObjectType: 'GenericScore',
          ownerKind: 'timeline',
          displayContext: 'timeline',
          location: locA,
          supportsTimeBehavior: true,
          supportsRepeatPoint: true,
          supportsNoteProcessorChain: true,
        },
        {
          selectionId: 'b',
          selectedObjectType: 'GenericScore',
          editorObjectType: 'GenericScore',
          ownerKind: 'timeline',
          displayContext: 'timeline',
          location: locB,
          supportsTimeBehavior: true,
          supportsRepeatPoint: true,
          supportsNoteProcessorChain: true,
        },
      ),
    ).toBe(true);

    expect(argbToRGB(0xff123456)).toBe(0x123456);
    expect(rgbToCSS(0x010203)).toBe('#010203');
    expect(colorToCSS(0xffabcdef)).toBe('#abcdef');
    expect(brighten(0x404040, 2)).toBe(0x808080);
    expect(darken(0x808080, 0.5)).toBe(0x404040);
    expect(textColorForBackground(0xffffffff)).toBe('#000000');
    expect(textColorForBackground(0xff101010)).toBe('#ffffff');
  });
});
