import { describe, expect, it } from 'vitest';
import {
  createHistoryFixtureProject,
  createRepresentativeScoreProject,
  createRepresentativeMixerProject,
  createRepresentativeInstrumentProject,
  createRepresentativeBsbProject,
  createRepresentativeBlueX7Project,
  createRepresentativePianoRollProject,
  createRepresentativeFreezeProject,
  createRepresentativeUnknownDataProject,
  resolveRepoRoot,
  loadHistoryFixtureFile,
  type HistoryFixtureKind,
} from './test-support/java-parity-fixtures';
import { BlueData } from './blue-data';
import { PolyObject } from './sound-objects/poly-object';
import { FrozenSoundObject } from './sound-objects/frozen-sound-object';
import { PianoRoll } from './sound-objects/piano-roll';
import { BlueSynthBuilder } from './instruments/blue-synth-builder';
import { BSBKnob } from './instruments/blue-synth-builder/bsb-knob';
import { BSBDropdown } from './instruments/blue-synth-builder/bsb-dropdown';
import { BlueX7 } from './instruments/blue-x7';
import { Parameter } from './automation/parameter';
import { Channel } from './mixer/channel';
import { Track } from './score/track/track';
import { TrackLayerGroup } from './score/track/track-layer-group';

describe('java-parity-fixtures history fixture entry points', () => {
  const allKinds: HistoryFixtureKind[] = [
    'score',
    'mixer',
    'instrument',
    'bsb',
    'blueX7',
    'pianoRoll',
    'freeze',
    'unknownData',
  ];

  it('resolves repo root and can load smoke-test.blue fixture', () => {
    const root = resolveRepoRoot();
    expect(root).toBeDefined();
    const smoke = loadHistoryFixtureFile('fixtures/smoke-test.blue');
    expect(smoke).toBeInstanceOf(BlueData);
    expect(smoke.getScore().length).toBeGreaterThan(0);
  });

  for (const kind of allKinds) {
    it(`creates and round-trips representative ${kind} fixture project via XML`, () => {
      const project = createHistoryFixtureProject(kind);
      expect(project).toBeInstanceOf(BlueData);

      const xml = project.saveToString();
      expect(typeof xml).toBe('string');
      expect(xml.length).toBeGreaterThan(0);

      const reloaded = BlueData.loadFromString(xml);
      expect(reloaded).toBeInstanceOf(BlueData);
      expect(reloaded.getProjectProperties().title).toBe(project.getProjectProperties().title);
    });
  }

  it('validates representative score fixture structure', () => {
    const data = createRepresentativeScoreProject();
    const score = data.getScore();
    expect(score.length).toBe(1);
    const root = score[0] as PolyObject;
    expect(root.getName()).toBe('Root');
    const layer = root[0];
    expect(layer?.getName()).toBe('Sound Layer 1');
    expect(layer?.length).toBe(2);
  });

  it('validates representative mixer fixture structure', () => {
    const data = createRepresentativeMixerProject();
    const mixer = data.getMixer();
    expect(mixer.isEnabled()).toBe(true);
    expect(mixer.getChannels().length).toBe(2);
    expect(mixer.getMaster().getLevel()).toBe(0.9);
  });

  it('validates representative instrument fixture structure', () => {
    const data = createRepresentativeInstrumentProject();
    const instr = data.getArrangement().getInstrument(0);
    expect(instr?.getName()).toBe('SineSynth');
  });

  it('validates representative BSB fixture structure', () => {
    const data = createRepresentativeBsbProject();
    const bsb = data.getArrangement().getInstrument(0);
    expect(bsb?.getName()).toBe('BSB Instrument');
  });

  it('validates representative BlueX7 fixture structure', () => {
    const data = createRepresentativeBlueX7Project();
    expect(data.getScore().length).toBeGreaterThan(0);
  });

  it('validates representative PianoRoll fixture structure', () => {
    const data = createRepresentativePianoRollProject();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const roll = layer?.[0] as PianoRoll;
    expect(roll).toBeInstanceOf(PianoRoll);
    expect(roll.getNotes().length).toBe(2);
  });

  it('validates representative freeze fixture structure', () => {
    const data = createRepresentativeFreezeProject();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const fso = layer?.[0] as FrozenSoundObject;
    expect(fso).toBeInstanceOf(FrozenSoundObject);
    expect(fso.getFrozenWaveFileName()).toBe('freeze_01.wav');
    expect(fso.getFrozenSoundObject()).not.toBeNull();
  });

  it('validates representative unknown data fixture preservation', () => {
    const data = createRepresentativeUnknownDataProject();
    expect(data.getPluginDataXml().length).toBe(1);
    expect(data.getPluginDataXml()[0].getName()).toBe('legacyPlugin');

    const xml = data.saveToString();
    expect(xml).toContain('<legacyPlugin id="custom-plugin-123">');
    expect(xml).toContain('customAuthoredAttr="testValue"');
    expect(xml).toContain('<customElement>unknownText</customElement>');

    const reloaded = BlueData.loadFromString(xml);
    expect(reloaded.getPluginDataXml().length).toBe(1);
    const root = reloaded.getScore()[0] as PolyObject;
    const layer = root[0];
    expect(layer?.getUnknownAttributes().get('customAuthoredAttr')).toBe('testValue');
    expect(layer?.getUnknownChildren().length).toBe(1);
  });

  describe('historyCopy mode vs duplication deepCopy', () => {
    it('preserves Parameter unique IDs in historyCopy, regenerates in duplication deepCopy', () => {
      const param = new Parameter();
      param.setName('cutoff');
      const origId = param.getUniqueId();

      const historyClone = param.deepCopy('history') as Parameter;
      expect(historyClone.getUniqueId()).toBe(origId);

      const dupClone = param.deepCopy('duplication') as Parameter;
      expect(dupClone.getUniqueId()).not.toBe(origId);

      const defaultClone = param.deepCopy() as Parameter;
      expect(defaultClone.getUniqueId()).not.toBe(origId);
    });

    it('preserves BSB widget IDs and dropdown item unique IDs in historyCopy, regenerates in duplication', () => {
      const bsb = new BlueSynthBuilder();
      const knob = new BSBKnob();
      knob.objectName = 'cutoff';
      knob.id = 'w-cutoff-1';

      const dropdown = new BSBDropdown();
      dropdown.objectName = 'wave';
      dropdown.id = 'w-wave-1';
      dropdown.dropdownItems = [
        { name: 'Saw', value: '1', uniqueId: 'dropdown-item-saw' },
        { name: 'Square', value: '2', uniqueId: 'dropdown-item-square' },
      ];

      bsb.getGraphicInterface().getRootGroup().addChild(knob);
      bsb.getGraphicInterface().getRootGroup().addChild(dropdown);

      const historyBsb = bsb.deepCopy('history');
      const histKnob = historyBsb.getGraphicInterface().findWidgetById('w-cutoff-1');
      const histDropdown = historyBsb
        .getGraphicInterface()
        .findWidgetById('w-wave-1') as BSBDropdown;
      expect(histKnob).not.toBeNull();
      expect(histKnob?.id).toBe('w-cutoff-1');
      expect(histDropdown).not.toBeNull();
      expect(histDropdown.id).toBe('w-wave-1');
      expect(histDropdown.dropdownItems?.[0].uniqueId).toBe('dropdown-item-saw');
      expect(histDropdown.dropdownItems?.[1].uniqueId).toBe('dropdown-item-square');

      const dupBsb = bsb.deepCopy('duplication');
      const dupKnob = dupBsb.getGraphicInterface().getRootGroup().getChildren()[0];
      const dupDropdown = dupBsb
        .getGraphicInterface()
        .getRootGroup()
        .getChildren()[1] as BSBDropdown;
      expect(dupKnob.id).not.toBe('w-cutoff-1');
      expect(dupDropdown.id).not.toBe('w-wave-1');
      expect(dupDropdown.dropdownItems?.[0].uniqueId).not.toBe('dropdown-item-saw');
      expect(dupDropdown.dropdownItems?.[1].uniqueId).not.toBe('dropdown-item-square');
    });

    it('preserves Track unique IDs and parameter IDs in historyCopy', () => {
      const track = new Track();
      track.setName('Audio 1');
      const origTrackId = track.getUniqueId();

      const bsb = new BlueSynthBuilder();
      const knob = new BSBKnob();
      knob.objectName = 'vol';
      bsb.getGraphicInterface().getRootGroup().addChild(knob);
      track.setInstrument(bsb);

      const histTrack = track.deepCopy('history');
      expect(histTrack.getUniqueId()).toBe(origTrackId);
      const histInstr = histTrack.getInstrument() as BlueSynthBuilder;
      const origInstr = track.getInstrument() as BlueSynthBuilder;
      expect(histInstr?.getParameters()[0]?.getUniqueId()).toBe(
        origInstr?.getParameters()[0]?.getUniqueId(),
      );

      const dupTrack = track.deepCopy('duplication');
      const dupInstr = dupTrack.getInstrument() as BlueSynthBuilder;
      expect(dupInstr?.getParameters()[0]?.getUniqueId()).not.toBe(
        origInstr?.getParameters()[0]?.getUniqueId(),
      );
    });

    it('preserves BlueX7 parameter unique IDs in historyCopy, regenerates in duplication', () => {
      const x7 = new BlueX7();
      const origParamId = x7.getParameters()[0]?.getUniqueId();
      expect(origParamId).toBeDefined();

      const histX7 = x7.deepCopy('history');
      expect(histX7.getParameters()[0]?.getUniqueId()).toBe(origParamId);

      const dupX7 = x7.deepCopy('duplication');
      expect(dupX7.getParameters()[0]?.getUniqueId()).not.toBe(origParamId);
    });

    it('provides complete memory isolation on BlueData.historyCopy()', () => {
      const project = createRepresentativeBsbProject();
      const copy = project.historyCopy();

      // Verify they are separate object instances
      expect(copy).not.toBe(project);
      expect(copy.getArrangement()).not.toBe(project.getArrangement());
      expect(copy.getScore()).not.toBe(project.getScore());
      expect(copy.getMixer()).not.toBe(project.getMixer());
      expect(copy.getProjectProperties()).not.toBe(project.getProjectProperties());

      // Mutate property on copy
      copy.getProjectProperties().title = 'Mutated Title';
      expect(project.getProjectProperties().title).not.toBe('Mutated Title');

      // Mutate mixer channel on copy
      copy.getMixer().getMaster().setLevel(0.123);
      expect(project.getMixer().getMaster().getLevel()).not.toBe(0.123);

      // Verify XML representation before mutation is identical
      const origXml = project.saveToString();
      const freshCopyXml = project.historyCopy().saveToString();
      expect(freshCopyXml).toBe(origXml);
    });

    it('proves source, candidate, retained before-state, and retained after-state never share mutable aliases', () => {
      // 1. Establish initial source project with rich hierarchical state
      const source = createRepresentativeBsbProject();
      source.getProjectProperties().title = 'Initial Title';
      source.getProjectProperties().author = 'Author 1';
      const bsb = source.getArrangement().getInstrument(0) as BlueSynthBuilder;
      const knob = bsb.getGraphicInterface().getRootGroup().getChildren()[0] as BSBKnob;
      knob.value = 440;
      source.getMixer().getMaster().setLevel(0.8);

      const initialXml = source.saveToString();
      const initialCsd = source.toCSD();

      // 2. Capture retained before-state memento
      const retainedBefore = source.historyCopy();

      // 3. Create candidate working copy for staging an edit
      const candidate = source.historyCopy();

      // Ensure all 3 are distinct instances
      expect(new Set([source, retainedBefore, candidate]).size).toBe(3);
      expect(retainedBefore.saveToString()).toBe(initialXml);
      expect(candidate.saveToString()).toBe(initialXml);

      // 4. Perform mutations on candidate
      candidate.getProjectProperties().title = 'Candidate Modified Title';
      const candidateBsb = candidate.getArrangement().getInstrument(0) as BlueSynthBuilder;
      const candidateKnob = candidateBsb
        .getGraphicInterface()
        .getRootGroup()
        .getChildren()[0] as BSBKnob;
      candidateKnob.value = 880;
      candidate.getMixer().getMaster().setLevel(0.5);

      // Add a second sound object to the candidate score
      const candidateScore = candidate.getScore();
      const candidateTrackGroup = candidateScore[0] as TrackLayerGroup;
      const newTrack = candidateTrackGroup.newLayerAt(candidateTrackGroup.length);
      newTrack.setName('Candidate Extra Track');

      // Add an object to candidate sound object library
      const candidateLibObj = new PolyObject();
      candidateLibObj.setName('Candidate Lib Sound');
      candidate.getSoundObjectLibrary().addObject(candidateLibObj);

      // Verify that source and retainedBefore are completely untouched by candidate mutations
      expect(source.getProjectProperties().title).toBe('Initial Title');
      expect(retainedBefore.getProjectProperties().title).toBe('Initial Title');
      expect(knob.value).toBe(440);
      expect(
        (
          (retainedBefore.getArrangement().getInstrument(0) as BlueSynthBuilder)
            .getGraphicInterface()
            .getRootGroup()
            .getChildren()[0] as BSBKnob
        ).value,
      ).toBe(440);
      expect(source.getMixer().getMaster().getLevel()).toBe(0.8);
      expect(retainedBefore.getMixer().getMaster().getLevel()).toBe(0.8);
      expect((source.getScore()[0] as TrackLayerGroup).length).toBe(1);
      expect((retainedBefore.getScore()[0] as TrackLayerGroup).length).toBe(1);
      expect(source.getSoundObjectLibrary().getAllObjects().length).toBe(0);
      expect(retainedBefore.getSoundObjectLibrary().getAllObjects().length).toBe(0);

      // Verify XML and CSD of source and retainedBefore remain strictly identical to initial
      expect(source.saveToString()).toBe(initialXml);
      expect(retainedBefore.saveToString()).toBe(initialXml);
      expect(source.toCSD()).toBe(initialCsd);
      expect(retainedBefore.toCSD()).toBe(initialCsd);

      // 5. Capture retained after-state memento from candidate
      const retainedAfter = candidate.historyCopy();

      // Ensure all 4 states are distinct object instances
      expect(new Set([source, retainedBefore, candidate, retainedAfter]).size).toBe(4);
      expect(retainedAfter.getProjectProperties().title).toBe('Candidate Modified Title');
      expect(
        (
          (retainedAfter.getArrangement().getInstrument(0) as BlueSynthBuilder)
            .getGraphicInterface()
            .getRootGroup()
            .getChildren()[0] as BSBKnob
        ).value,
      ).toBe(880);
      expect(retainedAfter.getMixer().getMaster().getLevel()).toBe(0.5);
      expect((retainedAfter.getScore()[0] as TrackLayerGroup).length).toBe(2);
      expect(retainedAfter.getSoundObjectLibrary().getAllObjects().length).toBe(1);

      // 6. Perform subsequent mutations on candidate (simulating further ongoing typing or gestures)
      candidate.getProjectProperties().title = 'Subsequent Candidate Edit';
      candidateKnob.value = 1760;
      candidate.getMixer().getMaster().setLevel(0.2);

      // Verify retainedAfter was NOT affected by subsequent candidate edits
      expect(retainedAfter.getProjectProperties().title).toBe('Candidate Modified Title');
      expect(
        (
          (retainedAfter.getArrangement().getInstrument(0) as BlueSynthBuilder)
            .getGraphicInterface()
            .getRootGroup()
            .getChildren()[0] as BSBKnob
        ).value,
      ).toBe(880);
      expect(retainedAfter.getMixer().getMaster().getLevel()).toBe(0.5);

      // Verify source and retainedBefore are STILL completely untouched
      expect(source.getProjectProperties().title).toBe('Initial Title');
      expect(retainedBefore.getProjectProperties().title).toBe('Initial Title');
      expect(knob.value).toBe(440);
      expect(source.getMixer().getMaster().getLevel()).toBe(0.8);
      expect(retainedBefore.getMixer().getMaster().getLevel()).toBe(0.8);

      // 7. Verify XML integrity and round-trip fidelity
      const afterXml = retainedAfter.saveToString();
      expect(afterXml).not.toBe(initialXml);
      expect(afterXml).toContain('Candidate Modified Title');
      expect(afterXml).not.toContain('Subsequent Candidate Edit');

      const reloadedAfter = BlueData.loadFromString(afterXml);
      expect(reloadedAfter.getProjectProperties().title).toBe('Candidate Modified Title');
      expect(reloadedAfter.getMixer().getMaster().getLevel()).toBe(0.5);
      expect((reloadedAfter.getScore()[0] as TrackLayerGroup).length).toBe(2);

      // 8. Verify CSD generation is valid and distinct
      const afterCsd = retainedAfter.toCSD();
      expect(afterCsd).toBeDefined();
      expect(afterCsd.length).toBeGreaterThan(0);
      expect(retainedBefore.toCSD()).toBe(initialCsd);
    });
  });

  describe('global history restore oracle (T020, US1)', () => {
    it('restores instrument references and mixer entry identities across a capture/mutate/restore cycle', () => {
      const project = createRepresentativeInstrumentProject();
      const channel = new Channel();
      channel.setName('Referencing Channel');
      channel.setLevel(0.5);
      project.getMixer().getChannels().push(channel);

      const initialXml = project.saveToString();
      const assignmentId = project.getArrangement().getArrangement()[0]!.arrangementId;

      // Capture, then mutate live state past the capture point.
      const beforeMemento = project.historyCopy();
      project.getArrangement().removeInstrumentById(assignmentId);
      project.getMixer().getChannels().length = 0;
      expect(project.saveToString()).not.toBe(initialXml);

      // Restore from the retained memento: identities and references return.
      const restored = beforeMemento.historyCopy();
      expect(restored.saveToString()).toBe(initialXml);
      expect(restored.getArrangement().getArrangement()[0]!.arrangementId).toBe(assignmentId);
      expect(restored.getMixer().getChannels()[0]!.getName()).toBe('Referencing Channel');
      expect(beforeMemento.saveToString()).toBe(initialXml);
    });

    it('keeps BSB preset and dropdown-link identities stable across repeated history cycles', () => {
      const project = createRepresentativeBsbProject();
      const dropdownXml = project.saveToString();

      let current = project;
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const memento = current.historyCopy();
        // Simulate a later, unrelated mutation on the live graph.
        current.getProjectProperties().title = `Cycle ${cycle}`;
        current = memento.historyCopy();
        expect(current.saveToString()).toBe(dropdownXml);
      }
    });

    it('preserves score pan laws and channel stereo settings with stable parameter identities across historyCopy (Spec 113 T040)', () => {
      const project = createRepresentativeMixerProject();
      project.getScore().panLawDb = -6;
      project.getScore().panOffCenterBoost = true;

      const ch = project.getMixer().getChannels()[0]!;
      ch.setStereoPanMode('stereoPan');
      ch.setPanWidth(0.65);
      ch.setDualPanLeft(0.15);
      ch.setDualPanRight(0.85);

      const widthParamId = ch.getPanWidthParameter().getUniqueId();
      const dualLeftParamId = ch.getDualPanLeftParameter().getUniqueId();
      const dualRightParamId = ch.getDualPanRightParameter().getUniqueId();

      const memento = project.historyCopy();

      // Mutation on original project
      project.getScore().panLawDb = 0;
      project.getScore().panOffCenterBoost = false;
      ch.setStereoPanMode('balance');
      ch.setPanWidth(1.0);

      // Verify memento is unaffected
      expect(memento.getScore().panLawDb).toBe(-6);
      expect(memento.getScore().panOffCenterBoost).toBe(true);
      const mementoCh = memento.getMixer().getChannels()[0]!;
      expect(mementoCh.getStereoPanMode()).toBe('stereoPan');
      expect(mementoCh.getPanWidth()).toBe(0.65);
      expect(mementoCh.getDualPanLeft()).toBe(0.15);
      expect(mementoCh.getDualPanRight()).toBe(0.85);

      // Parameter unique IDs remain stable across historyCopy
      expect(mementoCh.getPanWidthParameter().getUniqueId()).toBe(widthParamId);
      expect(mementoCh.getDualPanLeftParameter().getUniqueId()).toBe(dualLeftParamId);
      expect(mementoCh.getDualPanRightParameter().getUniqueId()).toBe(dualRightParamId);
    });
  });
});
