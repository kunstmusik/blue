import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  Channel,
  GenericScore,
  TimePosition,
  TimeDuration,
} from '@blue/data';
import { applyProjectDocumentPatch, createScoreDocumentSnapshot } from './project-editor';
import type { ScoreAutomationLayerRef } from './project-editor';

function createProjectWithParameter(): {
  data: BlueData;
  paramId: string;
  layerRef: ScoreAutomationLayerRef;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const poly = new PolyObject(true);
  poly.newLayerAt(0);
  score.push(poly);

  const channel = new Channel();
  channel.setName('Test Channel');
  data.getMixer().getChannels().splice(0, 0, channel);

  const paramId = channel.getLevelParameter().getUniqueId();
  const snap = createScoreDocumentSnapshot(data);
  const groupId = snap.layerGroups[0]!.groupId;
  const layerId = snap.layerGroups[0]!.layers[0]!.layerId;

  const layerRef: ScoreAutomationLayerRef = {
    rootGroupIndex: 0,
    groupId,
    layerId,
    layerIndex: 0,
    layerKind: 'soundObject',
  };

  return { data, paramId, layerRef };
}

function createProjectWithTwoLayersAndParameter(): {
  data: BlueData;
  paramId: string;
  layerRef0: ScoreAutomationLayerRef;
  layerRef1: ScoreAutomationLayerRef;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const poly = new PolyObject(true);
  poly.newLayerAt(0);
  poly.newLayerAt(1);
  score.push(poly);

  const channel = new Channel();
  channel.setName('Test Channel');
  data.getMixer().getChannels().splice(0, 0, channel);

  const paramId = channel.getLevelParameter().getUniqueId();
  const snap = createScoreDocumentSnapshot(data);
  const groupId = snap.layerGroups[0]!.groupId;
  const layerId0 = snap.layerGroups[0]!.layers[0]!.layerId;
  const layerId1 = snap.layerGroups[0]!.layers[1]!.layerId;

  const layerRef0: ScoreAutomationLayerRef = {
    rootGroupIndex: 0,
    groupId,
    layerId: layerId0,
    layerIndex: 0,
    layerKind: 'soundObject',
  };
  const layerRef1: ScoreAutomationLayerRef = {
    rootGroupIndex: 0,
    groupId,
    layerId: layerId1,
    layerIndex: 1,
    layerKind: 'soundObject',
  };

  return { data, paramId, layerRef0, layerRef1 };
}

function createProjectWithTwoGroupsAndParameter(): {
  data: BlueData;
  paramId: string;
  targetGroupId: string;
  layerRef: ScoreAutomationLayerRef;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const first = new PolyObject(true);
  first.newLayerAt(0);
  score.push(first);

  const second = new PolyObject(true);
  second.newLayerAt(0);
  score.push(second);

  const channel = new Channel();
  channel.setName('Test Channel');
  data.getMixer().getChannels().splice(0, 0, channel);

  const paramId = channel.getLevelParameter().getUniqueId();
  const snap = createScoreDocumentSnapshot(data);
  const targetGroup = snap.layerGroups[1]!;
  const targetGroupId = targetGroup.groupId;

  const layerRef: ScoreAutomationLayerRef = {
    rootGroupIndex: 1,
    groupId: targetGroupId,
    layerId: targetGroup.layers[0]!.layerId,
    layerIndex: 0,
    layerKind: 'soundObject',
  };

  return { data, paramId, targetGroupId, layerRef };
}

function getSoundLayer(data: BlueData, layerIndex = 0) {
  const group = data.getScore()[0];
  if (!(group instanceof PolyObject)) {
    throw new Error('Expected root polyObject group');
  }
  return group[layerIndex]!;
}

describe('assignAutomationToLayer patch', () => {
  it('assigns a parameter to a sound layer', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();

    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramId },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation;
    expect(automation).toBeDefined();
    expect(automation!.parameterIds).toContain(paramId);
    expect(automation!.selectedParameterId).toBe(paramId);
    expect(automation!.parameters).toHaveLength(1);
    expect(automation!.parameters[0]!.parameterId).toBe(paramId);
  });

  it('moves parameter from another layer when assigning', () => {
    const { data, paramId, layerRef0, layerRef1 } = createProjectWithTwoLayersAndParameter();

    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);

    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef1, parameterId: paramId },
    });

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.layerGroups[0]!.layers[0]!.automation!.parameterIds).toEqual([]);
    expect(snap.layerGroups[0]!.layers[1]!.automation!.parameterIds).toContain(paramId);
  });

  it('enables automation on parameter when enableAutomation is true', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: paramId,
        enableAutomation: true,
      },
    });

    const channel = data.getMixer().getChannels()[0]!;
    expect(channel.getLevelParameter().isAutomationEnabled()).toBe(true);
  });

  it('seeds a drawable default line point for a newly assigned parameter', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    expect(channel.getLevelParameter().getPoints()).toEqual([]);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: paramId,
        enableAutomation: true,
      },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation!;
    expect(automation.parameters[0]!.points).toEqual([{ time: 0, value: 0 }]);
  });

  it('selects the newly assigned parameter when another parameter is already assigned', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    const layer = getSoundLayer(data);
    layer.getAutomationParameters().addParameterId(paramId);
    layer.getAutomationParameters().setSelectedParameter(paramId);

    const secondChannel = new Channel();
    secondChannel.setName('Second Channel');
    data.getMixer().getChannels().splice(0, 0, secondChannel);
    const secondParamId = secondChannel.getLevelParameter().getUniqueId();

    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: secondParamId },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation!;
    expect(automation.parameterIds).toContain(secondParamId);
    expect(automation.selectedParameterId).toBe(secondParamId);
  });

  it('assigns distinct sequential LineColors to multiple parameters on a layer regardless of alphabetical sort order', () => {
    const { data, layerRef } = createProjectWithParameter();

    // Create 3 parameters on mixer channels with names that sort out-of-order alphabetically
    const mixer = data.getMixer();
    const chZ = new Channel();
    chZ.setName('Zebra');
    const chA = new Channel();
    chA.setName('Alpha');
    const chM = new Channel();
    chM.setName('Middle');
    mixer.getChannels().push(chZ, chA, chM);

    const paramZId = chZ.getLevelParameter().getUniqueId();
    const paramAId = chA.getLevelParameter().getUniqueId();
    const paramMId = chM.getLevelParameter().getUniqueId();

    // Assign Zebra first (first param on layer -> color index 0: 0x20dd00 green)
    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramZId },
    });

    // Assign Alpha second (sorts before Zebra, but is 2nd on layer -> color index 1: 0x0000ff blue)
    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramAId },
    });

    // Assign Middle third (3rd on layer -> color index 2: 0xffa500 orange)
    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramMId },
    });

    const paramZ = chZ.getLevelParameter();
    const paramA = chA.getLevelParameter();
    const paramM = chM.getLevelParameter();

    expect(paramZ.getLineColor()).toBe(0x20dd00); // 1st color in LineColors
    expect(paramA.getLineColor()).toBe(0x0000ff); // 2nd color in LineColors
    expect(paramM.getLineColor()).toBe(0xffa500); // 3rd color in LineColors
  });

  it('resolves the target layer by group id when the root group index has changed', () => {
    const { data, paramId, targetGroupId, layerRef } = createProjectWithTwoGroupsAndParameter();
    const score = data.getScore();
    const moved = score.splice(1, 1)[0]!;
    score.splice(0, 0, moved);

    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramId },
    });

    const snap = createScoreDocumentSnapshot(data);
    const targetGroup = snap.layerGroups.find((group) => group.groupId === targetGroupId)!;
    const otherGroup = snap.layerGroups.find((group) => group.groupId !== targetGroupId)!;
    expect(targetGroup.layers[0]!.automation!.parameterIds).toContain(paramId);
    expect(otherGroup.layers[0]!.automation?.parameterIds ?? []).not.toContain(paramId);
  });
});

describe('removeAutomationFromLayer patch', () => {
  it('removes an assigned parameter from a layer', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);

    applyProjectDocumentPatch(data, {
      score: { type: 'removeAutomationFromLayer', layer: layerRef, parameterId: paramId },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation;
    expect(automation?.parameterIds ?? []).not.toContain(paramId);
  });
});

describe('moveAutomationToLayer patch', () => {
  it('moves a parameter from one layer to another', () => {
    const { data, paramId, layerRef0, layerRef1 } = createProjectWithTwoLayersAndParameter();
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveAutomationToLayer',
        fromLayer: layerRef0,
        toLayer: layerRef1,
        parameterId: paramId,
      },
    });

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.layerGroups[0]!.layers[0]!.automation?.parameterIds ?? []).not.toContain(paramId);
    expect(snap.layerGroups[0]!.layers[1]!.automation!.parameterIds).toContain(paramId);
  });
});

describe('clearLayerAutomations patch', () => {
  it('clears all assigned parameters from a layer', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);

    applyProjectDocumentPatch(data, {
      score: { type: 'clearLayerAutomations', layer: layerRef },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation;
    expect(automation?.parameterIds ?? []).toHaveLength(0);
  });
});

describe('selectLayerAutomation patch', () => {
  it('sets the selected parameter on a layer', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);

    applyProjectDocumentPatch(data, {
      score: { type: 'selectLayerAutomation', layer: layerRef, parameterId: paramId },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation;
    expect(automation!.selectedParameterId).toBe(paramId);
  });
});

describe('setAutomationLineColor patch', () => {
  it('sets the line color on a parameter', () => {
    const { data, paramId } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    expect(channel.getLevelParameter().getLineColor()).toBe(-8355712);

    applyProjectDocumentPatch(data, {
      score: { type: 'setAutomationLineColor', parameterId: paramId, lineColor: 0xff0000 },
    });

    expect(channel.getLevelParameter().getLineColor()).toBe(0xff0000);
  });
});

describe('setAutomationResolution patch', () => {
  it('mutates the exact resolution and snaps existing points', () => {
    const { data, paramId } = createProjectWithParameter();
    const parameter = data.getMixer().getChannels()[0]!.getLevelParameter();
    parameter.addPoint(0, 0.37);

    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'setAutomationResolution',
        parameterId: paramId,
        resolutionDecimal: '0.10',
      },
    });

    expect(changed).toBe(true);
    expect(parameter.getResolutionText()).toBe('0.10');
    expect(parameter.getPoints()[0]?.value).toBeCloseTo(0.3, 12);
  });

  it('rejects malformed exact text without changing the project', () => {
    const { data, paramId } = createProjectWithParameter();
    const parameter = data.getMixer().getChannels()[0]!.getLevelParameter();
    parameter.setResolutionText('0.10');
    const beforePoints = parameter.getPoints();

    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'setAutomationResolution',
        parameterId: paramId,
        resolutionDecimal: 'not-a-decimal',
      },
    });

    expect(changed).toBe(false);
    expect(parameter.getResolutionText()).toBe('0.10');
    expect(parameter.getPoints()).toEqual(beforePoints);
  });
});

describe('setAutomationPoints patch', () => {
  it('replaces all points on a parameter', () => {
    const { data, paramId } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'setAutomationPoints',
        parameterId: paramId,
        points: [
          { time: 0, value: 0.5 },
          { time: 4, value: 1.0 },
        ],
      },
    });

    const pts = channel.getLevelParameter().getPoints();
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ time: 0, value: 0.5 });
    expect(pts[1]).toEqual({ time: 4, value: 1.0 });
  });

  it('clamps values and sorts points by time', () => {
    const { data, paramId } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'setAutomationPoints',
        parameterId: paramId,
        points: [
          { time: 4, value: 200 },
          { time: -1, value: -200 },
        ],
      },
    });

    expect(channel.getLevelParameter().getPoints()).toEqual([
      { time: 0, value: -96 },
      { time: 4, value: 12 },
    ]);
  });
});

describe('insertAutomationPoint patch', () => {
  it('adds a new point to a parameter', () => {
    const { data, paramId } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    channel.getLevelParameter().addPoint(0, 0.0);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'insertAutomationPoint',
        parameterId: paramId,
        point: { time: 2, value: 0.75 },
      },
    });

    const pts = channel.getLevelParameter().getPoints();
    expect(pts).toHaveLength(2);
    expect(pts[1]).toEqual({ time: 2, value: 0.75 });
  });
});

describe('deleteAutomationPoint patch', () => {
  it('removes a point by index', () => {
    const { data, paramId } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    channel.getLevelParameter().addPoint(0, 0.0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(4, 1.0);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'deleteAutomationPoint',
        parameterId: paramId,
        pointIndex: 1,
      },
    });

    const pts = channel.getLevelParameter().getPoints();
    expect(pts).toHaveLength(2);
    expect(pts.map((p) => p.time)).toEqual([0, 4]);
  });

  it('does not delete the first line point', () => {
    const { data, paramId } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    channel.getLevelParameter().addPoint(0, 0.0);
    channel.getLevelParameter().addPoint(4, 1.0);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'deleteAutomationPoint',
        parameterId: paramId,
        pointIndex: 0,
      },
    });

    expect(channel.getLevelParameter().getPoints()).toHaveLength(2);
  });
});

describe('moveAutomationPoint patch', () => {
  it('moves a point to a new time and value', () => {
    const { data, paramId } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    channel.getLevelParameter().addPoint(0, 0.0);
    channel.getLevelParameter().addPoint(4, 1.0);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveAutomationPoint',
        parameterId: paramId,
        pointIndex: 0,
        point: { time: 1, value: 0.3 },
      },
    });

    const pts = channel.getLevelParameter().getPoints();
    expect(pts[0]).toEqual({ time: 1, value: 0.3 });
    expect(pts[1]).toEqual({ time: 4, value: 1.0 });
  });
});

describe('moveAutomationRange patch', () => {
  it('moves selected automation points only for assigned parameters in included layers', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0.0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(6, 1.0);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 4,
          layerIds: [layerRef.layerId],
          parameterIdsByLayer: { [layerRef.layerId]: [paramId] },
        },
        beatDelta: 2,
      },
    });

    // Anchored transform inserts boundary points at 1 (selection start), 3
    // (translated start), and a discontinuity pair at 6 (translated end = 4+2).
    // Moved point at 2→4 is also present.
    expect(
      channel
        .getLevelParameter()
        .getPoints()
        .map((point) => point.time),
    ).toEqual([0, 1, 3, 4, 6, 6]);
  });
});

describe('scaleAutomationRange patch', () => {
  it('scales selected automation points around the anchor beat', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0.0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(6, 1.0);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'scaleAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 4,
          layerIds: [layerRef.layerId],
          parameterIdsByLayer: { [layerRef.layerId]: [paramId] },
        },
        anchorBeat: 1,
        scaleFactor: 2,
      },
    });

    // Anchored transform inserts boundary points at 1 (domain start), 3 (scaled
    // point: 2→3), and a discontinuity pair at 7 (scaled end: 4→7).
    expect(
      channel
        .getLevelParameter()
        .getPoints()
        .map((point) => point.time),
    ).toEqual([0, 1, 3, 7, 7]);
  });

  it('aborts before line edits when a selected object partially overlaps the scale range', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    const channel = data.getMixer().getChannels()[0]!;
    const layer = getSoundLayer(data);
    layer.getAutomationParameters().addParameterId(paramId);
    channel.getLevelParameter().addPoint(0, 0.0);
    channel.getLevelParameter().addPoint(2, 0.5);
    channel.getLevelParameter().addPoint(6, 1.0);

    const object = new GenericScore();
    object.setStartTime(TimePosition.beats(0));
    object.setSubjectiveDuration(TimeDuration.beats(2));
    layer.push(object);

    const snap = createScoreDocumentSnapshot(data);
    const objectId = snap.layerGroups[0]!.layers[0]!.items[0]!.objectId;
    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'scaleAutomationRange',
        range: {
          startBeat: 1,
          endBeat: 4,
          layerIds: [layerRef.layerId],
          parameterIdsByLayer: { [layerRef.layerId]: [paramId] },
        },
        anchorBeat: 1,
        scaleFactor: 2,
        objectIds: [objectId],
      },
    });

    expect(changed).toBe(false);
    expect(
      channel
        .getLevelParameter()
        .getPoints()
        .map((point) => point.time),
    ).toEqual([0, 2, 6]);
    expect(object.getStartTime().toBeats(data.getScore().getTimeContext())).toBe(0);
    expect(object.getSubjectiveDuration().toBeats(data.getScore().getTimeContext())).toBe(2);
  });
});

describe('cleanupLayerAutomation patch', () => {
  it('removes stale parameter IDs that no longer resolve', () => {
    const { data, layerRef } = createProjectWithParameter();
    const staleId = 'nonexistent-param-id';
    getSoundLayer(data).getAutomationParameters().addParameterId(staleId);

    applyProjectDocumentPatch(data, {
      score: { type: 'cleanupLayerAutomation', layer: layerRef },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation;
    expect(automation?.parameterIds ?? []).not.toContain(staleId);
  });

  it('keeps valid parameter IDs', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);

    applyProjectDocumentPatch(data, {
      score: { type: 'cleanupLayerAutomation', layer: layerRef },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation;
    expect(automation!.parameterIds).toContain(paramId);
  });

  it('removes only specified parameterIds when provided', () => {
    const { data, paramId, layerRef } = createProjectWithParameter();
    const staleId = 'stale-id';
    getSoundLayer(data).getAutomationParameters().addParameterId(paramId);
    getSoundLayer(data).getAutomationParameters().addParameterId(staleId);

    applyProjectDocumentPatch(data, {
      score: { type: 'cleanupLayerAutomation', layer: layerRef, parameterIds: [staleId] },
    });

    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation!;
    expect(automation.parameterIds).toContain(paramId);
    expect(automation.parameterIds).not.toContain(staleId);
  });
});
