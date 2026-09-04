import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  TrackLayerGroup,
  Channel,
  Effect,
  Parameter,
  BlueSynthBuilder,
  BlueX7,
  Element,
} from '@blue/data';
import { createScoreDocumentSnapshot } from './project-editor';
import type {
  ScoreLayerAutomationSnapshot,
  AutomationParameterSnapshot,
  AutomationTargetGroupSnapshot,
  AutomationTargetSnapshot,
  ScoreLayerSnapshot,
} from './project-editor';

function createProjectWithInstrumentParameter(): {
  data: BlueData;
  paramId: string;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const poly = new PolyObject(true);
  poly.newLayerAt(0);
  score.push(poly);

  const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
    <name>Synth</name>
    <instrumentText>aout oscili &lt;chorus_mode&gt;, 440</instrumentText>
    <graphicInterface>
      <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="chorus-knob">
        <objectName>chorus_mode</objectName>
        <x>0</x><y>0</y>
        <automationAllowed>true</automationAllowed>
        <value>0.5</value>
        <minimum>0</minimum>
        <maximum>1</maximum>
      </bsbObject>
    </graphicInterface>
    <parameterList>
      <parameter uniqueId="chorus-param" name="chorus_mode" min="0.0" max="1.0" automationEnabled="true">
        <line>
          <linePoint x="0.0" y="0.5"/>
          <linePoint x="1.0" y="0.5"/>
        </line>
      </parameter>
    </parameterList>
    <opcodeList/>
  </instrument>`;

  const instr = BlueSynthBuilder.loadFromXML(Element.parse(xml));
  const arrangement = data.getArrangement();
  arrangement.addInstrument(instr, '1');

  const param = instr.getParameters()[0]!;
  const paramId = param.getUniqueId();
  poly[0]!.getAutomationParameters().addParameterId(paramId);

  return { data, paramId };
}

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

  it('resolves targetPath for arrangement instrument parameters', () => {
    const { data } = createProjectWithInstrumentParameter();
    const snap = createScoreDocumentSnapshot(data);
    const automation = snap.layerGroups[0]!.layers[0]!.automation!;
    const param = automation.parameters[0]!;

    expect(param.name).toBe('chorus_mode');
    expect(param.targetPath).toEqual(['instr 1', 'chorus_mode']);
    expect(param.targetPath.join(' > ')).toBe('instr 1 > chorus_mode');
  });

  it('preserves the instr prefix for named arrangement ids that start with instr', () => {
    const { data } = createProjectWithInstrumentParameter();
    expect(
      data.getArrangement().updateAssignment('1', {
        nextArrangementId: 'instrumental',
      }),
    ).toBe(true);

    const snap = createScoreDocumentSnapshot(data);
    const param = snap.layerGroups[0]!.layers[0]!.automation!.parameters[0]!;

    expect(param.targetPath).toEqual(['instr instrumental', 'chorus_mode']);
  });

  it('resolves targetPath for mixer channel volume and effect parameters', () => {
    const { data } = createProjectWithAssociatedTrack();
    // Assign the track channel's level parameter and pre-effect parameter to the track layer
    const preEffect = data.getMixer().getChannels()[0]!.getPreEffects()[0]!;
    const preEffectParam = preEffect.getParameters()[0]!;
    const levelParam = data.getMixer().getChannels()[0]!.getLevelParameter();

    data.getScore()[0]![0]!.getAutomationParameters().addParameterId(levelParam.getUniqueId());
    data.getScore()[0]![0]!.getAutomationParameters().addParameterId(preEffectParam.getUniqueId());

    const updatedSnap = createScoreDocumentSnapshot(data);
    const updatedAutomation = updatedSnap.layerGroups.find((g) => g.groupType === 'track')!
      .layers[0]!.automation!;
    const volumeSnap = updatedAutomation.parameters.find(
      (p) => p.parameterId === levelParam.getUniqueId(),
    )!;
    const effectSnap = updatedAutomation.parameters.find(
      (p) => p.parameterId === preEffectParam.getUniqueId(),
    )!;

    expect(volumeSnap.targetPath).toEqual(['Mixer', 'Channel', 'Volume']);
    expect(effectSnap.targetPath).toEqual([
      'Mixer',
      'Channel',
      'Pre-Effects',
      'Pre Filter',
      'cutoff',
    ]);
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

    function collectAllTargets(
      groups: AutomationTargetGroupSnapshot[],
    ): AutomationTargetSnapshot[] {
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
      ['available', 'assignedCurrentLayer', 'assignedOtherLayer', 'missing'].includes(
        target.assignmentState,
      ),
    ).toBe(true);
  });
});

describe('BlueX7 owner-aware automation targets (Spec 092 US3)', () => {
  function flatten(groups: AutomationTargetGroupSnapshot[]): AutomationTargetSnapshot[] {
    return groups.flatMap((group) => [...group.targets, ...flatten(group.subGroups)]);
  }

  it('exposes 151 nested targets for arrangement and owning Track locations', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    data.getScore().push(poly);

    const arrangementX7 = new BlueX7();
    arrangementX7.setName('Duplicate X7');
    data.getArrangement().addInstrument(arrangementX7, '7');

    const trackGroup = new TrackLayerGroup();
    trackGroup.setName('Audio Group');
    trackGroup.setUniqueId('x7-group');
    const track = trackGroup.newLayerAt(0);
    track.setName('Duplicate X7');
    track.setUniqueId('x7-track');
    const trackX7 = new BlueX7();
    trackX7.setName('Duplicate X7');
    track.setInstrument(trackX7);
    data.getScore().push(trackGroup);

    const snapshot = createScoreDocumentSnapshot(data);
    const arrangementAutomation = snapshot.layerGroups[0]!.layers[0]!.automation!;
    const trackAutomation = snapshot.layerGroups[1]!.layers[0]!.automation!;
    const arrangementTargets = flatten(arrangementAutomation.targetGroups).filter(
      (target) => target.ownerIdentity === 'arrangement:7',
    );
    const trackTargets = flatten(trackAutomation.targetGroups).filter(
      (target) => target.ownerIdentity === 'track:x7-group:x7-track',
    );

    expect(arrangementTargets).toHaveLength(151);
    expect(trackTargets).toHaveLength(151);
    expect(new Set(arrangementTargets.map((target) => target.parameterId)).size).toBe(151);
    expect(new Set(trackTargets.map((target) => target.parameterId)).size).toBe(151);
    expect(arrangementTargets[0]!.locationLabel).toContain('7) Duplicate X7');
    expect(trackTargets[0]!.locationLabel).toBe('Audio Group / Duplicate X7');
    expect(snapshot.layerGroups[1]!.layers[0]!.instrument?.snapshot).toMatchObject({
      ownerIdentity: 'track:x7-group:x7-track',
    });
    expect(new Set(arrangementTargets.map((target) => target.updateClass))).toEqual(
      new Set(['active-note', 'next-note']),
    );

    const arrangementOwnerGroup = arrangementAutomation.targetGroups
      .find((group) => group.groupId === 'instrument')!
      .subGroups.find((group) => group.groupId === 'instr-7')!;
    expect(arrangementOwnerGroup.subGroups.map((group) => group.label)).toEqual([
      'Common',
      'LFO',
      'Pitch Envelope',
      'Operator 1',
      'Operator 2',
      'Operator 3',
      'Operator 4',
      'Operator 5',
      'Operator 6',
    ]);
  });

  it('disambiguates at least four same-named BlueX7 instances with unique location labels (SC-009)', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject(true);
    poly.newLayerAt(0);
    data.getScore().push(poly);

    // Four arrangement BlueX7 instruments sharing one display name.
    for (const id of ['7', '8', '9', '10']) {
      const arrangementX7 = new BlueX7();
      arrangementX7.setName('Duplicate X7');
      data.getArrangement().addInstrument(arrangementX7, id);
    }

    // Two Track-owned BlueX7 instruments also sharing that display name; the
    // owning Tracks keep distinct names, so each Track's location label
    // identifies its own same-named instrument.
    const trackGroup = new TrackLayerGroup();
    trackGroup.setName('Audio Group');
    trackGroup.setUniqueId('x7-group');
    const trackNames = { 'x7-track-a': 'Lead Track', 'x7-track-b': 'Bass Track' } as const;
    for (const trackId of ['x7-track-a', 'x7-track-b'] as const) {
      const track = trackGroup.newLayerAt(trackGroup.length);
      track.setName(trackNames[trackId]);
      track.setUniqueId(trackId);
      const trackX7 = new BlueX7();
      trackX7.setName('Duplicate X7');
      track.setInstrument(trackX7);
    }
    data.getScore().push(trackGroup);

    const snapshot = createScoreDocumentSnapshot(data);

    // The arrangement chooser exposes all four same-named owners, each with
    // the complete 151-target catalog and a pairwise-distinct location label.
    const arrangementAutomation = snapshot.layerGroups[0]!.layers[0]!.automation!;
    const arrangementOwnerIds = [
      'arrangement:7',
      'arrangement:8',
      'arrangement:9',
      'arrangement:10',
    ];
    const arrangementTargetsById = new Map(
      arrangementOwnerIds.map((ownerIdentity) => [
        ownerIdentity,
        flatten(arrangementAutomation.targetGroups).filter(
          (target) => target.ownerIdentity === ownerIdentity,
        ),
      ]),
    );
    for (const ownerIdentity of arrangementOwnerIds) {
      expect(arrangementTargetsById.get(ownerIdentity), ownerIdentity).toHaveLength(151);
      expect(
        new Set(arrangementTargetsById.get(ownerIdentity)!.map((target) => target.parameterId))
          .size,
      ).toBe(151);
    }
    const arrangementLabels = arrangementOwnerIds.map(
      (ownerIdentity) => arrangementTargetsById.get(ownerIdentity)![0]!.locationLabel,
    );
    expect(new Set(arrangementLabels).size).toBe(4);
    expect(arrangementLabels[0]).toContain('7) Duplicate X7');
    expect(arrangementLabels[3]).toContain('10) Duplicate X7');

    // Each Track's own automation exposes its own BlueX7 only — never another
    // Track's targets — and the two Track labels also stay distinct.
    const trackLayerA = snapshot.layerGroups[1]!.layers[0]!.automation!;
    const trackLayerB = snapshot.layerGroups[1]!.layers[1]!.automation!;
    const trackATargets = flatten(trackLayerA.targetGroups).filter(
      (target) => target.ownerIdentity === 'track:x7-group:x7-track-a',
    );
    const trackBTargets = flatten(trackLayerB.targetGroups).filter(
      (target) => target.ownerIdentity === 'track:x7-group:x7-track-b',
    );
    expect(trackATargets).toHaveLength(151);
    expect(trackBTargets).toHaveLength(151);
    expect(
      flatten(trackLayerA.targetGroups).some(
        (target) => target.ownerIdentity === 'track:x7-group:x7-track-b',
      ),
    ).toBe(false);
    expect(
      flatten(trackLayerB.targetGroups).some(
        (target) => target.ownerIdentity === 'track:x7-group:x7-track-a',
      ),
    ).toBe(false);
    expect(trackATargets[0]!.locationLabel).not.toBe(trackBTargets[0]!.locationLabel);
    // Across all six same-named BlueX7 instances the disambiguators never collide.
    const allLabels = [
      ...arrangementLabels,
      trackATargets[0]!.locationLabel,
      trackBTargets[0]!.locationLabel,
    ];
    expect(new Set(allLabels).size).toBe(6);
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

    const audioGroup = snap.layerGroups.find((g) => g.groupType === 'track');
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
    const audioGroup = snap.layerGroups.find((g) => g.groupType === 'track')!;
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
