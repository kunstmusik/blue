import { describe, expect, it } from 'vitest';
import { BlueData } from '../../src/blue-data';
import { PolyObject } from '../../src/sound-objects/poly-object';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { PianoRoll } from '../../src/sound-objects/piano-roll';
import { PianoNote } from '../../src/sound-objects/piano-roll/piano-note';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { Channel } from '../../src/mixer/channel';
import { Effect } from '../../src/mixer/effect';
import { BlueSynthBuilder } from '../../src/instruments/blue-synth-builder';
import { BSBKnob } from '../../src/instruments/blue-synth-builder/bsb-knob';
import { Preset } from '../../src/instruments/blue-synth-builder/preset';
import { PresetGroup } from '../../src/instruments/blue-synth-builder/preset-group';
import { BlueX7 } from '../../src/instruments/blue-x7';
import { Parameter } from '../../src/automation/parameter';
import {
  createHistoryFixtureProject,
  createRepresentativeUnknownDataProject,
} from '../../src/test-support/java-parity-fixtures';

function beats(value: number): TimePosition {
  return TimePosition.beats(value);
}

function durationBeats(value: number): TimeDuration {
  return TimeDuration.beats(value);
}

function buildUs1Project(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'US1 Roundtrip Project';
  data.getGlobalOrcSco().setGlobalOrc('sr = 44100\nnchnls = 2\n0dbfs = 1\n');

  const score = data.getScore();
  score.length = 0;

  const root = new PolyObject();
  root.setName('Root Group');
  score.push(root);

  const layerA = root.newLayerAt(0);
  layerA.setName('Layer A');
  const layerB = root.newLayerAt(1);
  layerB.setName('Layer B');

  const outer = new GenericScore();
  outer.setName('Outer Object');
  outer.setStartTime(beats(0));
  outer.setSubjectiveDuration(durationBeats(8));
  layerA.push(outer);

  const nested = new PolyObject();
  nested.setName('Nested Group');
  layerA.push(nested);
  const nestedLayer = nested.newLayerAt(0);
  nestedLayer.setName('Nested Layer');
  const nestedObj = new GenericScore();
  nestedObj.setName('Nested Object');
  nestedObj.setScoreText('i1 0 1 440 0.5');
  nestedObj.setStartTime(beats(1));
  nestedObj.setSubjectiveDuration(durationBeats(1));
  nestedLayer.push(nestedObj);

  const roll = new PianoRoll();
  roll.setName('Lead Roll');
  roll.setStartTime(beats(2));
  roll.setSubjectiveDuration(durationBeats(4));
  const note = new PianoNote();
  note.setOctave(8);
  note.setScaleDegree(0);
  note.setStart(0);
  note.setDuration(1);
  roll.addNote(note);
  layerB.push(roll);

  const mixer = data.getMixer();
  const ch = new Channel();
  ch.setName('Synth Channel');
  ch.setLevel(0.75);
  const preEffect = new Effect();
  preEffect.setName('Reverb');
  preEffect.setCode('aout reverb ain, 0.3\n');
  ch.getPreEffects().push(preEffect);
  mixer.getChannels().push(ch);
  mixer.getMaster().setLevel(0.9);

  const bsb = new BlueSynthBuilder();
  bsb.setName('BSB Instrument');
  bsb.setInstrumentText('aout oscili <gain>, 440\nblueMixerOut aout, aout');
  const knob = new BSBKnob();
  knob.objectName = 'gain';
  knob.setValue(0.6);
  knob.minimum = 0;
  knob.maximum = 1;
  bsb.getGraphicInterface().getRootGroup().addChild(knob);
  const preset = new Preset();
  preset.setPresetName('Init');
  preset.setValue(knob.objectName, String(knob.value));
  const group = new PresetGroup();
  group.setPresetGroupName('Factory');
  group.presets.push(preset);
  bsb.setPresetGroup(group);
  data.getArrangement().addInstrument(bsb);

  const x7 = new BlueX7();
  x7.setName('BlueX7 Instrument');
  data.getArrangement().addInstrument(x7);

  const automation = new Parameter();
  automation.setName('auto');
  automation.setLabel('Automation');
  automation.setMinimum(0);
  automation.setMaximum(1);
  automation.setResolution(0.01);
  data.getMixer().getChannels()[0]!.getPreEffects()[0]!.getParameters().push(automation);
  return data;
}

/**
 * Full data-layer history cycle: capture a detached before-memento, mutate the
 * live project, prove the memento retained the exact original state (XML and
 * generated CSD), then restore and verify the restored canonical graph is
 * equivalent and isolated from the retained memento.
 */
describe('global history roundtrip oracle (T020, US1)', () => {
  it('retains and restores identity, XML, and generated CSD across a mixed-edit cycle', () => {
    const project = buildUs1Project();

    const beforeXml = project.saveToString();
    const beforeCsd = project.toDiskCSD();

    // 1. Capture the detached before-memento exactly as the history layer does.
    const beforeMemento = project.historyCopy();

    // 2. Mutate the live project with a mixed edit sequence.
    const score = project.getScore();
    const root = score[0] as PolyObject;
    root[0].length = 0; // delete Layer A objects (nested group included)
    root[1].length = 0; // delete PianoRoll
    project.getMixer().getMaster().setLevel(0.1);
    project
      .getArrangement()
      .removeInstrumentById(project.getArrangement().getArrangement()[0]?.arrangementId ?? '');

    expect(project.saveToString()).not.toBe(beforeXml);
    expect(project.toDiskCSD()).not.toBe(beforeCsd);

    // 3. The retained memento still reproduces the original exactly.
    expect(beforeMemento.saveToString()).toBe(beforeXml);
    expect(beforeMemento.toDiskCSD()).toBe(beforeCsd);

    // 4. Restore: the canonical graph becomes a fresh history copy of the memento.
    const restored = beforeMemento.historyCopy();

    // Identity and equivalence
    expect(restored.saveToString()).toBe(beforeXml);
    expect(restored.toDiskCSD()).toBe(beforeCsd);

    const restoredRoot = restored.getScore()[0] as PolyObject;
    expect(restoredRoot[0].length).toBe(2); // outer + nested group
    expect(restoredRoot[1].length).toBe(1); // PianoRoll

    const restoredNested = restoredRoot[0][1] as PolyObject;
    expect(restoredNested.getName()).toBe('Nested Group');
    expect(restoredNested[0][0].getName()).toBe('Nested Object');

    const restoredRoll = restoredRoot[1][0] as PianoRoll;
    expect(restoredRoll.getName()).toBe('Lead Roll');
    expect(restoredRoll.getNotes()).toHaveLength(1);

    expect(restored.getMixer().getMaster().getLevel()).toBe(0.9);
    expect(restored.getArrangement().size()).toBe(2); // BSB + BlueX7

    const restoredBsb = restored.getArrangement().getArrangement()[0]?.instr as BlueSynthBuilder;
    expect(restoredBsb.getPresetGroup()?.getPresetGroupName()).toBe('Factory');
    expect(restoredBsb.getPresetGroup()?.getPresets()[0]?.getPresetName()).toBe('Init');

    // 5. The restored graph never aliases the retained memento.
    restored.getMixer().getMaster().setLevel(0.42);
    expect(beforeMemento.getMixer().getMaster().getLevel()).toBe(0.9);
    (restoredRoot[1][0] as PianoRoll).setName('Renamed After Restore');
    expect(((beforeMemento.getScore()[0] as PolyObject)[1][0] as PianoRoll).getName()).toBe(
      'Lead Roll',
    );
  });

  it('preserves layer ordering and channel entry order across history restore', () => {
    const project = buildUs1Project();
    const memento = project.historyCopy();

    // Reorder live state after capture.
    const root = project.getScore()[0] as PolyObject;
    root[1].length = 0;
    root[0].setName('Layer A Renamed');
    const channels = project.getMixer().getChannels();
    const first = channels[0]!;
    channels.splice(0, 1);
    channels.push(first);

    // Restore must bring back the captured ordering exactly.
    const restored = memento.historyCopy();
    const restoredRoot = restored.getScore()[0] as PolyObject;
    expect(restoredRoot[0].getName()).toBe('Layer A');
    expect(restoredRoot[1].getName()).toBe('Layer B');
    expect(restored.getMixer().getChannels()[0]!.getName()).toBe('Synth Channel');
    expect(restored.getMixer().getChannels()[0]!.getPreEffects()[0]!.getName()).toBe('Reverb');
  });

  it('round-trips every representative fixture project through history cycles', () => {
    const kinds = [
      'score',
      'mixer',
      'instrument',
      'bsb',
      'blueX7',
      'pianoRoll',
      'freeze',
      'unknownData',
    ] as const;
    for (const kind of kinds) {
      const project = createHistoryFixtureProject(kind);
      const originalXml = project.saveToString();
      const memento = project.historyCopy();

      // Simulate mutation then restore.
      project.getProjectProperties().title = `Mutated ${kind}`;
      const restored = memento.historyCopy();

      expect(restored.saveToString(), `fixture "${kind}" XML diverged after restore`).toBe(
        originalXml,
      );
      expect(memento.saveToString(), `fixture "${kind}" memento diverged`).toBe(originalXml);
    }
  });

  it('keeps generated CSD identical through history restore for a CSD-stable fixture', () => {
    const project = createHistoryFixtureProject('score');
    const csdBefore = project.toDiskCSD();

    const memento = project.historyCopy();
    project.getGlobalOrcSco().setGlobalOrc('; mutated\n');
    expect(project.toDiskCSD()).not.toBe(csdBefore);

    const restored = memento.historyCopy();
    expect(restored.toDiskCSD()).toBe(csdBefore);
  });

  it('preserves unknown project data verbatim across history cycles', () => {
    const project = createRepresentativeUnknownDataProject();
    const originalXml = project.saveToString();

    const memento = project.historyCopy();
    const restored = memento.historyCopy();

    expect(restored.saveToString()).toBe(originalXml);

    // XML reload of the restored project keeps the unknown data too.
    const reloaded = BlueData.loadFromString(restored.saveToString());
    expect(reloaded.saveToString()).toBe(originalXml);
  });
});
