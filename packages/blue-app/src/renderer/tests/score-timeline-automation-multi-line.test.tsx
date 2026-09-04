// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  PolyObject,
  Channel,
  AudioClip,
  TrackLayer,
  TrackLayerGroup,
  GenericScore,
  TimePosition,
  TimeDuration,
  timePositionToBeats,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createScoreDocumentSnapshot,
} from '../../shared/project-editor';
import MultiLineOverlay from '../components/workbench/panels/score/automation/MultiLineOverlay';
import type { ScoreLayerGroupSnapshot } from '../components/workbench/panels/score/types';
import {
  buildLayerRowGeometry,
  totalLayerContentHeight,
  layersIntersectingYRange,
  buildRangeRefForLayers,
  computeMultiLinePreview,
} from '../components/workbench/panels/score/automation/automation-selection-utils';
import { useProjectStore } from '../stores/project-store';
import { useScoreAutomationStore } from '../stores/score-automation-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';

function automationWithParams(...parameterIds: string[]) {
  return {
    layerId: 'x',
    layerKind: 'soundObject' as const,
    parameterIds,
    selectedParameterId: parameterIds[0],
    parameters: parameterIds.map((parameterId) => ({
      parameterId,
      points: [{ time: 0, value: 0 }],
    })),
    targetGroups: [],
    missingParameterIds: [],
  };
}

/**
 * @param supportsAutomation When true (default), the layer gets an `automation`
 *   field even if parameterIds is empty — matching real polyObject/audio layer
 *   snapshots. Pass false for patterns-style layers that never support automation.
 */
function layerSnapshot(
  layerId: string,
  height: number,
  parameterIds: string[] = [],
  supportsAutomation = true,
) {
  return {
    layerId,
    name: layerId,
    height,
    items: [],
    muted: false,
    solo: false,
    automation: !supportsAutomation
      ? undefined
      : parameterIds.length > 0
        ? automationWithParams(...parameterIds)
        : { ...automationWithParams(), parameterIds: [], parameters: [] },
  } as unknown as ScoreLayerGroupSnapshot['layers'][number];
}

describe('multi-line layer geometry', () => {
  it('accumulates row tops with the group spacer between groups', () => {
    const groups = [
      {
        groupId: 'g0',
        groupType: 'polyObject',
        name: 'g0',
        layerCount: 2,
        isOpenableContainer: false,
        layers: [layerSnapshot('l0', 44, ['p0']), layerSnapshot('l1', 66, ['p1'])],
      },
      {
        groupId: 'g1',
        groupType: 'track',
        name: 'g1',
        layerCount: 1,
        isOpenableContainer: false,
        layers: [layerSnapshot('l2', 44)],
      },
    ] as unknown as ScoreLayerGroupSnapshot[];

    const rows = buildLayerRowGeometry(groups);
    expect(rows[0]).toMatchObject({ layerId: 'l0', top: 0, height: 44, automatable: true });
    expect(rows[1]).toMatchObject({ layerId: 'l1', top: 44, height: 66, automatable: true });
    expect(rows[2]).toMatchObject({ layerId: 'l2', top: 110 + 36, automatable: true }); // Track, no params but still automatable
    expect(totalLayerContentHeight(rows)).toBe(110 + 36 + 44 + 36);
  });

  it('selects automatable rows intersected by a vertical drag (incl. parameter-less polyObject layers)', () => {
    const groups = [
      {
        groupId: 'g0',
        groupType: 'polyObject',
        name: 'g0',
        layerCount: 4,
        isOpenableContainer: false,
        layers: [
          layerSnapshot('l0', 44, ['p0']),
          layerSnapshot('l1', 44), // polyObject, no params → still automatable
          layerSnapshot('l2', 44, ['p2']),
          layerSnapshot('l3', 44, [], false), // patterns-style → not automatable
        ],
      },
    ] as unknown as ScoreLayerGroupSnapshot[];
    const rows = buildLayerRowGeometry(groups);
    // Drag from y=10 (l0) down to y=132 (l3), spanning l0..l3.
    // l0 (automatable), l1 (automatable, no params), l2 (automatable) are included;
    // l3 (patterns, no automation field) is excluded.
    const hit = layersIntersectingYRange(rows, 10, 132);
    expect(hit.map((r) => r.layerId)).toEqual(['l0', 'l1', 'l2']);
  });

  it('builds a range ref including parameter-less layers in layerIds but not parameterIdsByLayer', () => {
    const groups = [
      {
        groupId: 'g0',
        groupType: 'polyObject',
        name: 'g0',
        layerCount: 3,
        isOpenableContainer: false,
        layers: [
          layerSnapshot('l0', 44, ['p0', 'p1']),
          layerSnapshot('l1', 44), // no params, but automatable
          layerSnapshot('l2', 44, [], false), // patterns → excluded entirely
        ],
      },
    ] as unknown as ScoreLayerGroupSnapshot[];
    const rows = buildLayerRowGeometry(groups);
    const ref = buildRangeRefForLayers(rows, 1, 4);
    expect(ref.layerIds).toEqual(['l0', 'l1']);
    expect(ref.parameterIdsByLayer['l0']).toEqual(['p0', 'p1']);
    expect(ref.parameterIdsByLayer['l1']).toBeUndefined();
  });
});

describe('multi-line preview computation', () => {
  it('transforms committed points per parameter in the range', () => {
    const groups = [
      {
        groupId: 'g0',
        groupType: 'polyObject',
        name: 'g0',
        layerCount: 1,
        isOpenableContainer: false,
        layers: [
          {
            layerId: 'l0',
            name: 'l0',
            height: 44,
            items: [],
            muted: false,
            solo: false,
            automation: {
              layerId: 'l0',
              layerKind: 'soundObject' as const,
              parameterIds: ['p0'],
              selectedParameterId: 'p0',
              parameters: [
                {
                  parameterId: 'p0',
                  points: [
                    { time: 0, value: 0 },
                    { time: 2, value: 1 },
                  ],
                },
              ],
              targetGroups: [],
              missingParameterIds: [],
            },
          },
        ],
      },
    ] as unknown as ScoreLayerGroupSnapshot[];

    const ref = { startBeat: 1, endBeat: 4, layerIds: ['l0'], parameterIdsByLayer: { l0: ['p0'] } };
    const preview = computeMultiLinePreview(groups, ref, (points) =>
      points.map((p) => ({ ...p, time: p.time + 2 })),
    );
    expect(preview['p0']!.map((p) => p.time)).toEqual([2, 4]);
  });
});

function startBeats(
  obj: { getStartTime(): ReturnType<typeof TimePosition.beats> },
  data: BlueData,
): number {
  return timePositionToBeats(obj.getStartTime(), data.getScore().getTimeContext());
}

function dispatchMouseEvent(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
  init: MouseEventInit = {},
): void {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX,
      clientY,
      ...init,
    }),
  );
}

describe('multi-line range patches across layers', () => {
  it('moves in-range points on every selected layer and leaves an unselected layer unchanged', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    poly.newLayerAt(1);
    poly.newLayerAt(2);
    score.push(poly);

    const ch0 = new Channel();
    ch0.setName('C0');
    const ch1 = new Channel();
    ch1.setName('C1');
    const ch2 = new Channel();
    ch2.setName('C2');
    data.getMixer().getChannels().splice(0, 0, ch0, ch1, ch2);

    const p0 = ch0.getLevelParameter().getUniqueId();
    const p1 = ch1.getLevelParameter().getUniqueId();
    const p2 = ch2.getLevelParameter().getUniqueId();
    poly[0]!.getAutomationParameters().addParameterId(p0);
    poly[1]!.getAutomationParameters().addParameterId(p1);
    poly[2]!.getAutomationParameters().addParameterId(p2);

    for (const ch of [ch0, ch1, ch2]) {
      ch.getLevelParameter().addPoint(0, 0);
      ch.getLevelParameter().addPoint(3, 0.5);
      ch.getLevelParameter().addPoint(6, 1);
    }

    const snap = createScoreDocumentSnapshot(data);
    const l0 = snap.layerGroups[0]!.layers[0]!.layerId;
    const l1 = snap.layerGroups[0]!.layers[1]!.layerId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 5,
          layerIds: [l0, l1],
          parameterIdsByLayer: { [l0]: [p0], [l1]: [p1] },
        },
        beatDelta: 2,
      },
    });

    // Anchored transform: boundary points at 1 (sel start), 3 (trans start),
    // 5 (moved point from 3), discontinuity pair at 7 (trans end = 5+2).
    expect(
      ch0
        .getLevelParameter()
        .getPoints()
        .map((p) => p.time),
    ).toEqual([0, 1, 3, 5, 7, 7]);
    expect(
      ch1
        .getLevelParameter()
        .getPoints()
        .map((p) => p.time),
    ).toEqual([0, 1, 3, 5, 7, 7]);
    // Layer 2 was not in the selection — its points are untouched.
    expect(
      ch2
        .getLevelParameter()
        .getPoints()
        .map((p) => p.time),
    ).toEqual([0, 3, 6]);
  });
});

describe('multi-line object / clip alignment (FR-014)', () => {
  it('moves a score object on a selected layer with the automation range', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    score.push(poly);

    const channel = new Channel();
    channel.setName('C');
    data.getMixer().getChannels().splice(0, 0, channel);
    const paramId = channel.getLevelParameter().getUniqueId();
    poly[0]!.getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(6, 1);

    const obj = new GenericScore();
    obj.setStartTime(TimePosition.beats(2));
    poly[0]!.push(obj);

    const snap = createScoreDocumentSnapshot(data);
    const layerId = snap.layerGroups[0]!.layers[0]!.layerId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 4,
          layerIds: [layerId],
          parameterIdsByLayer: { [layerId]: [paramId] },
        },
        beatDelta: 2,
        includeScoreObjects: true,
      },
    });

    // Anchored transform: boundary at 1 (sel start), 3 (trans start), moved
    // point 2→4, discontinuity pair at 6 (trans end = 4+2).
    expect(
      channel
        .getLevelParameter()
        .getPoints()
        .map((p) => p.time),
    ).toEqual([0, 1, 3, 4, 6, 6]);
    expect(startBeats(obj, data)).toBeCloseTo(4, 5);
  });

  it('scales a score object around the anchor with the automation range', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    score.push(poly);

    const channel = new Channel();
    channel.setName('C');
    data.getMixer().getChannels().splice(0, 0, channel);
    const paramId = channel.getLevelParameter().getUniqueId();
    poly[0]!.getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(6, 1);

    const obj = new GenericScore();
    obj.setStartTime(TimePosition.beats(2));
    obj.setSubjectiveDuration(TimeDuration.beats(2));
    poly[0]!.push(obj);

    const snap = createScoreDocumentSnapshot(data);
    const layerId = snap.layerGroups[0]!.layers[0]!.layerId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'scaleAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 4,
          layerIds: [layerId],
          parameterIdsByLayer: { [layerId]: [paramId] },
        },
        anchorBeat: 1,
        scaleFactor: 2,
        includeScoreObjects: true,
      },
    });

    // Anchored transform: boundary at 1 (domain start), 3 (scaled point 2→3),
    // discontinuity pair at 7 (scaled end 4→7).
    expect(
      channel
        .getLevelParameter()
        .getPoints()
        .map((p) => p.time),
    ).toEqual([0, 1, 3, 7, 7]);
    expect(startBeats(obj, data)).toBeCloseTo(3, 5);
  });

  it('scales both start and duration of a score object (FR-014 / Java MultiLineScaleMouseListener parity)', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    score.push(poly);

    const channel = new Channel();
    channel.setName('C');
    data.getMixer().getChannels().splice(0, 0, channel);
    const paramId = channel.getLevelParameter().getUniqueId();
    poly[0]!.getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(6, 1);

    const obj = new GenericScore();
    obj.setStartTime(TimePosition.beats(2));
    obj.setSubjectiveDuration(TimeDuration.beats(2));
    poly[0]!.push(obj);

    const snap = createScoreDocumentSnapshot(data);
    const layerId = snap.layerGroups[0]!.layers[0]!.layerId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'scaleAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 4,
          layerIds: [layerId],
          parameterIdsByLayer: { [layerId]: [paramId] },
        },
        anchorBeat: 1,
        scaleFactor: 2,
        includeScoreObjects: true,
      },
    });

    const ctx = data.getScore().getTimeContext();
    // start: 2 (offset 1 from anchor 1) -> 1 + 1*2 = 3
    // end:   4 (offset 3 from anchor 1) -> 1 + 3*2 = 7
    // duration: 7 - 3 = 4 (was 2)
    expect(startBeats(obj, data)).toBeCloseTo(3, 5);
    expect(obj.getSubjectiveDuration().toBeats(ctx)).toBeCloseTo(4, 5);
  });

  it('moves an audio clip on a selected Track with the automation range', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const layer = new TrackLayer();
    const clip = new AudioClip();
    clip.setStartTime(TimePosition.beats(2));
    clip.setSubjectiveDuration(TimeDuration.beats(2));
    layer.push(clip);
    const layerGroup = new TrackLayerGroup();
    layerGroup.push(layer);
    score.push(layerGroup);

    const channel = new Channel();
    channel.setName('Audio C');
    data.getMixer().getChannels().splice(0, 0, channel);
    const paramId = channel.getLevelParameter().getUniqueId();
    layer.getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(6, 1);

    const snap = createScoreDocumentSnapshot(data);
    const layerId = snap.layerGroups[0]!.layers[0]!.layerId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 4,
          layerIds: [layerId],
          parameterIdsByLayer: { [layerId]: [paramId] },
        },
        beatDelta: 2,
        includeAudioClips: true,
      },
    });

    // Anchored transform: boundary at 1, 3 (transition start), moved point 2→4,
    // discontinuity pair at 6 (trans end = 4+2).
    expect(
      channel
        .getLevelParameter()
        .getPoints()
        .map((p) => p.time),
    ).toEqual([0, 1, 3, 4, 6, 6]);
    expect(startBeats(clip, data)).toBeCloseTo(4, 5);
  });
});

describe('shift-gated object selection via explicit objectIds (B3)', () => {
  it('moves only explicitly selected objects, not all in-range objects', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    score.push(poly);

    const channel = new Channel();
    channel.setName('C');
    data.getMixer().getChannels().splice(0, 0, channel);
    const paramId = channel.getLevelParameter().getUniqueId();
    poly[0]!.getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0);
    channel.getLevelParameter().addPoint(4, 0.5);
    channel.getLevelParameter().addPoint(8, 1);

    const objA = new GenericScore();
    objA.setStartTime(TimePosition.beats(2));
    poly[0]!.push(objA);

    const objB = new GenericScore();
    objB.setStartTime(TimePosition.beats(3));
    poly[0]!.push(objB);

    const snap = createScoreDocumentSnapshot(data);
    const layerId = snap.layerGroups[0]!.layers[0]!.layerId;

    // Find the snapshot objectId for objA only (shift-selected).
    const items = snap.layerGroups[0]!.layers[0]!.items;
    const objAId = items.find((it) => it.startBeats === 2)!.objectId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 5,
          layerIds: [layerId],
          parameterIdsByLayer: { [layerId]: [paramId] },
        },
        beatDelta: 2,
        objectIds: [objAId],
      },
    });

    // objA moved; objB (not in explicit selection) stayed put.
    expect(startBeats(objA, data)).toBeCloseTo(4, 5);
    expect(startBeats(objB, data)).toBeCloseTo(3, 5);
  });

  it('clamps a left move against shift-selected objects that start before the range', async () => {
    const applyProjectDocumentPatchMock = vi.fn().mockResolvedValue(undefined);
    const flushPendingPatchesMock = vi.fn().mockResolvedValue(undefined);
    const originalProjectActions = {
      applyProjectDocumentPatch: useProjectStore.getState().applyProjectDocumentPatch,
      flushPendingPatches: useProjectStore.getState().flushPendingPatches,
    };
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    useProjectStore.setState({
      applyProjectDocumentPatch: applyProjectDocumentPatchMock,
      flushPendingPatches: flushPendingPatchesMock,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    globalThis.requestAnimationFrame = vi.fn(() => 1) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame;

    const layerGroups = [
      {
        groupId: 'g0',
        groupType: 'polyObject',
        name: 'g0',
        layerCount: 1,
        isOpenableContainer: false,
        layers: [
          {
            layerId: 'l0',
            name: 'l0',
            height: 44,
            muted: false,
            solo: false,
            items: [
              {
                objectId: 'obj-before-range',
                objectType: 'GenericScore',
                name: 'obj',
                startBeats: 0.5,
                durationBeats: 2,
              },
            ],
            automation: {
              layerId: 'l0',
              layerKind: 'soundObject' as const,
              parameterIds: ['p0'],
              selectedParameterId: 'p0',
              parameters: [
                {
                  parameterId: 'p0',
                  points: [
                    { time: 0, value: 0 },
                    { time: 2, value: 0.5 },
                  ],
                },
              ],
              targetGroups: [],
              missingParameterIds: [],
            },
          },
        ],
      },
    ] as unknown as ScoreLayerGroupSnapshot[];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      useScoreAutomationStore.getState().setRangeSelection({
        startBeat: 1,
        endBeat: 5,
        layerIds: ['l0'],
        parameterIdsByLayer: { l0: ['p0'] },
      });
      useScoreSelectionStore.getState().setSelection(['obj-before-range']);

      await act(async () => {
        root.render(
          <MultiLineOverlay
            layerGroups={layerGroups}
            pixelsPerBeat={10}
            snapEnabled={false}
            snapValue="BEAT"
            tempo={60}
            smpteFrameRate={30}
          />,
        );
      });

      const overlay = container.firstElementChild as HTMLElement;
      overlay.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 200,
        bottom: 44,
        width: 200,
        height: 44,
        toJSON: () => ({}),
      });

      act(() => {
        dispatchMouseEvent(overlay, 'mousedown', 20, 10);
      });
      act(() => {
        dispatchMouseEvent(overlay, 'mousemove', -20, 10);
      });
      await act(async () => {
        dispatchMouseEvent(overlay, 'mouseup', -20, 10);
        await Promise.resolve();
      });

      expect(applyProjectDocumentPatchMock).toHaveBeenCalledWith({
        score: expect.objectContaining({
          type: 'moveAutomationRange',
          beatDelta: -0.5,
          objectIds: ['obj-before-range'],
        }),
      });
    } finally {
      root.unmount();
      container.remove();
      useScoreAutomationStore.setState({
        selectedPoint: null,
        rangeSelection: null,
        multiLinePreview: null,
        multiLineObjectPreview: null,
      });
      useScoreSelectionStore.getState().clearSelection();
      useProjectStore.setState(
        originalProjectActions as Partial<ReturnType<typeof useProjectStore.getState>>,
      );
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});
