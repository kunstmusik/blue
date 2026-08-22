import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  TrackLayerGroup,
  Channel,
  Effect,
  Parameter,
} from '@blue/data';
import {
  createScoreDocumentSnapshot,
} from './project-editor';
import type {
  ScoreLayerAutomationSnapshot,
  AutomationParameterSnapshot,
  AutomationTargetGroupSnapshot,
  AutomationTargetSnapshot,
  ScoreLayerSnapshot,
} from './project-editor';

function createProjectWithMixerParameter(): {
  data: BlueData;
  paramId: string;
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
  poly[0]!.getAutomationParameters().addParameterId(paramId);

  return { data, paramId };
}

function createProjectWithAssociatedTrack(): {
  data: BlueData;
  paramId: string;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const audioGroup = new TrackLayerGroup();
  const layer = audioGroup.newLayerAt(0);
  score.push(audioGroup);

  const channel = new Channel();
  channel.setName('');
  channel.setAssociation(layer.getUniqueId());
  channel.getPreEffects().push(createAutomatableEffect('Pre Filter', 'Cutoff'));
  channel.getPostEffects().push(createAutomatableEffect('Post Reverb', 'Room Size'));
  data.getMixer().getChannels().splice(0, 0, channel);

  return { data, paramId: channel.getLevelParameter().getUniqueId() };
}

function createAutomatableEffect(name: string, parameterLabel: string): Effect {
  const effect = new Effect();
  effect.setName(name);

  const parameter = new Parameter();
  parameter.setName(parameterLabel.toLowerCase().replaceAll(' ', '-'));
  parameter.setLabel(parameterLabel);

  const effectXml = effect.saveAsXML();
  effectXml.getElement('parameterList')!.addElement(parameter.saveAsXML());
  return Effect.loadFromXML(effectXml);
}

describe('ScoreLayerAutomationSnapshot shape', () => {
  it('includes layerId, layerKind, parameterIds, and collections', () => {
    const { data } = createProjectWithMixerParameter();
    const snap = createScoreDocumentSnapshot(data);
    const layer = snap.layerGroups[0]!.layers[0]!;
    const automation: ScoreLayerAutomationSnapshot | undefined = layer.automation;

    expect(automation).toBeDefined();
    expect(typeof automation!.layerId).toBe('string');
    expect(automation!.layerKind).toBe('soundObject');
    expect(Array.isArray(automation!.parameterIds)).toBe(true);
    expect(automation!.parameterIds.length).toBeGreaterThan(0);
    expect(Array.isArray(automation!.parameters)).toBe(true);
    expect(Array.isArray(automation!.targetGroups)).toBe(true);
    expect(Array.isArray(automation!.missingParameterIds)).toBe(true);
  });
});

describe('AutomationParameterSnapshot shape', () => {
  it('includes lineColor, points, and metadata fields', () => {
    const { data } = createProjectWithMixerParameter();
    data.getMixer().getChannels()[0]!.getLevelParameter().setResolutionText('0.10');
    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation!;

    const param: AutomationParameterSnapshot = automation.parameters[0]!;
    expect(param).toBeDefined();
    expect(typeof param.parameterId).toBe('string');
    expect(typeof param.name).toBe('string');
    expect(typeof param.label).toBe('string');
    expect(typeof param.displayName).toBe('string');
    expect(typeof param.minimum).toBe('number');
    expect(typeof param.maximum).toBe('number');
    expect(param.resolutionDecimal).toBe('0.10');
    expect(typeof param.resolution).toBe('number');
    expect(typeof param.curve).toBe('string');
    expect(typeof param.fixedValue).toBe('number');
    expect(typeof param.automationEnabled).toBe('boolean');
    expect(typeof param.lineColor).toBe('number');
    expect(typeof param.sourceKind).toBe('string');
    expect(Array.isArray(param.targetPath)).toBe(true);
    expect(Array.isArray(param.points)).toBe(true);
  });
});

describe('AutomationTargetGroupSnapshot shape', () => {
  it('groups targets by source kind with groupId and label', () => {
    const { data } = createProjectWithMixerParameter();
    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation!;

    expect(automation.targetGroups.length).toBeGreaterThan(0);

    const group: AutomationTargetGroupSnapshot = automation.targetGroups[0]!;
    expect(typeof group.groupId).toBe('string');
    expect(typeof group.label).toBe('string');
    expect(Array.isArray(group.targets)).toBe(true);
    expect(Array.isArray(group.subGroups)).toBe(true);
  });

  it('includes targets with assignmentState and sourceKind', () => {
    const { data } = createProjectWithMixerParameter();
    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation!;

    function collectAllTargets(groups: AutomationTargetGroupSnapshot[]): AutomationTargetSnapshot[] {
      const result: AutomationTargetSnapshot[] = [];
      function walk(g: AutomationTargetGroupSnapshot) {
        result.push(...g.targets);
        for (const sub of g.subGroups) walk(sub);
      }
      for (const g of groups) walk(g);
      return result;
    }

    const allTargets = collectAllTargets(automation.targetGroups);
    expect(allTargets.length).toBeGreaterThan(0);

    const target = allTargets[0]!;
    expect(typeof target.parameterId).toBe('string');
    expect(typeof target.label).toBe('string');
    expect(typeof target.sourceKind).toBe('string');
    expect(typeof target.automationEnabled).toBe('boolean');
    expect(
      ['available', 'assignedCurrentLayer', 'assignedOtherLayer', 'missing'].includes(target.assignmentState),
    ).toBe(true);
  });
});

describe('automation field on ScoreLayerSnapshot', () => {
  it('appears on polyObject sound layers with assigned parameters', () => {
    const { data } = createProjectWithMixerParameter();
    const snap = createScoreDocumentSnapshot(data);
    const layer: ScoreLayerSnapshot = snap.layerGroups[0]!.layers[0]!;

    expect(layer.automation).toBeDefined();
    expect(layer.automation!.parameters).toHaveLength(1);
  });

  it('returns empty automation snapshot when no parameters assigned on soundObject layer', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    score.push(poly);

    const snap = createScoreDocumentSnapshot(data);
    const layer = snap.layerGroups[0]!.layers[0]!;

    expect(layer.automation).toBeDefined();
    expect(layer.automation!.parameterIds).toEqual([]);
    expect(layer.automation!.parameters).toEqual([]);
    expect(layer.automation!.missingParameterIds).toEqual([]);
  });

  it('always appears on Track rows even with no assigned parameters', () => {
    const { data } = createProjectWithAssociatedTrack();
    const snap = createScoreDocumentSnapshot(data);

    const audioGroup = snap.layerGroups.find(g => g.groupType === 'track');
    expect(audioGroup).toBeDefined();
    expect(audioGroup!.layers[0]!.automation).toBeDefined();
    expect(audioGroup!.layers[0]!.automation!.parameterIds).toEqual([]);
  });

  it('limits Track targets to its associated mixer channel', () => {
    const { data, paramId } = createProjectWithAssociatedTrack();
    const unrelated = new Channel();
    unrelated.setName('Unrelated Channel');
    data.getMixer().getChannels().splice(0, 0, unrelated);

    const snap = createScoreDocumentSnapshot(data);
    const audioGroup = snap.layerGroups.find(g => g.groupType === 'track')!;
    const automation = audioGroup.layers[0]!.automation!;
    const serializedTargets = JSON.stringify(automation.targetGroups);
    const trackChannelGroup = automation.targetGroups[0]!;

    expect(serializedTargets).toContain(paramId);
    expect(serializedTargets).not.toContain(unrelated.getLevelParameter().getUniqueId());
    expect(serializedTargets).not.toContain('Instrument');
    expect(trackChannelGroup.label).toBe('Track Channel');
    expect(trackChannelGroup.targets.map((target) => target.label)).toEqual(['dB']);
    expect(trackChannelGroup.subGroups.map((group) => group.label)).toEqual([
      'Pre-Effects',
      'Post-Effects',
    ]);
    expect(trackChannelGroup.subGroups.some((group) => group.label === '')).toBe(false);
  });
});
