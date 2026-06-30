// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { BlueData, PolyObject, Channel, AudioLayer, AudioLayerGroup } from '@blue/data';
import { applyProjectDocumentPatch, createScoreDocumentSnapshot } from '../../shared/project-editor';
import type { ScoreAutomationLayerRef } from '../../shared/project-editor';

function soundLayerProject() {
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
  const snap = createScoreDocumentSnapshot(data);
  const layerRef: ScoreAutomationLayerRef = {
    rootGroupIndex: 0,
    groupId: snap.layerGroups[0]!.groupId,
    layerId: snap.layerGroups[0]!.layers[0]!.layerId,
    layerIndex: 0,
    layerKind: 'soundObject',
  };
  return { data, paramId, layerRef };
}

function audioLayerProject() {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const layer = new AudioLayer();
  layer.setName('Audio Layer');
  const layerGroup = new AudioLayerGroup();
  layerGroup.push(layer);
  score.push(layerGroup);

  const channel = new Channel();
  channel.setName('Audio C');
  channel.setAssociation(layer.getUniqueId());
  data.getMixer().getChannels().splice(0, 0, channel);

  const paramId = channel.getLevelParameter().getUniqueId();
  const snap = createScoreDocumentSnapshot(data);
  const layerRef: ScoreAutomationLayerRef = {
    rootGroupIndex: 0,
    groupId: snap.layerGroups[0]!.groupId,
    layerId: snap.layerGroups[0]!.layers[0]!.layerId,
    layerIndex: 0,
    layerKind: 'audio',
  };
  return { data, paramId, layerRef };
}

describe('automation assignment survives snapshot refresh', () => {
  it('keeps a soundObject layer assignment, selected parameter, and resolved points after refresh', () => {
    const { data, paramId, layerRef } = soundLayerProject();

    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramId, enableAutomation: true },
    });

    const first = createScoreDocumentSnapshot(data);
    const automation = first.layerGroups[0]!.layers[0]!.automation!;
    expect(automation.parameterIds).toContain(paramId);
    expect(automation.selectedParameterId).toBe(paramId);
    expect(automation.parameters.map((p) => p.parameterId)).toContain(paramId);

    // A second snapshot (what the renderer builds on every refresh) preserves it.
    const refreshed = createScoreDocumentSnapshot(data);
    const again = refreshed.layerGroups[0]!.layers[0]!.automation!;
    expect(again.parameterIds).toContain(paramId);
    expect(again.selectedParameterId).toBe(paramId);
  });

  it('keeps an audio layer assignment after refresh', () => {
    const { data, paramId, layerRef } = audioLayerProject();

    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramId, enableAutomation: true },
    });

    const first = createScoreDocumentSnapshot(data);
    expect(first.layerGroups[0]!.layers[0]!.automation!.parameterIds).toContain(paramId);
    const refreshed = createScoreDocumentSnapshot(data);
    expect(refreshed.layerGroups[0]!.layers[0]!.automation!.parameterIds).toContain(paramId);
  });

  it('persists an edited line color across refresh', () => {
    const { data, paramId, layerRef } = soundLayerProject();
    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramId, enableAutomation: true },
    });
    applyProjectDocumentPatch(data, {
      score: { type: 'setAutomationLineColor', parameterId: paramId, lineColor: 0xff0000 },
    });

    const snap = createScoreDocumentSnapshot(data);
    const param = snap.layerGroups[0]!.layers[0]!.automation!.parameters.find((p) => p.parameterId === paramId)!;
    expect(param.lineColor).toBe(0xff0000);
  });

  it('reports stale assignments as missing and clears them without crashing the snapshot', () => {
    const { data, paramId, layerRef } = soundLayerProject();
    applyProjectDocumentPatch(data, {
      score: { type: 'assignAutomationToLayer', layer: layerRef, parameterId: paramId, enableAutomation: true },
    });

    // Simulate a stale id left behind by a removed target.
    const group = data.getScore()[0] as PolyObject;
    group[0]!.getAutomationParameters().addParameterId('does-not-exist');

    const stale = createScoreDocumentSnapshot(data);
    const automation = stale.layerGroups[0]!.layers[0]!.automation!;
    expect(automation.missingParameterIds).toContain('does-not-exist');
    // Resolved parameters exclude the stale id (no phantom line).
    expect(automation.parameters.map((p) => p.parameterId)).not.toContain('does-not-exist');

    applyProjectDocumentPatch(data, {
      score: { type: 'cleanupLayerAutomation', layer: layerRef },
    });

    const cleaned = createScoreDocumentSnapshot(data);
    expect(cleaned.layerGroups[0]!.layers[0]!.automation!.missingParameterIds).not.toContain('does-not-exist');
    expect(cleaned.layerGroups[0]!.layers[0]!.automation!.parameterIds).toContain(paramId);
  });
});
