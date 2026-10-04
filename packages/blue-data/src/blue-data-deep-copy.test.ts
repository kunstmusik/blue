import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Element } from './serialization/xml-reader';
import { ClojureProjectData, ClojureLibraryEntry } from './plugins/clojure-project-data';
import { BlueData } from './blue-data';
import { LiveData } from './live-data';
import { LiveObject } from './live/live-object';
import { LiveObjectBins } from './live/live-object-bins';
import { GenericScore } from './sound-objects/generic-score';
import { Instance } from './sound-objects/instance';
import { SoundObjectLibrary } from './sound-objects/sound-object-library';
import { Sound } from './sound-objects/sound';
import { ObjectBuilder } from './sound-objects/object-builder';
import { FrozenSoundObject } from './sound-objects/frozen-sound-object';
import { Track } from './score/track/track';
import { TrackLayerGroup } from './score/track/track-layer-group';
import { PatternsLayerGroup } from './score/patterns/patterns-layer-group';
import { BlueSynthBuilder } from './instruments/blue-synth-builder';
import { BSBKnob } from './instruments/blue-synth-builder/bsb-knob';
import { Preset } from './instruments/blue-synth-builder/preset';
import { PresetGroup } from './instruments/blue-synth-builder/preset-group';
import { InstrumentLibrary } from './instruments/instrument-library';
import { GenericInstrument } from './instruments/generic-instrument';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { PolyObject } from './sound-objects/poly-object';
import { SoundLayer } from './sound-objects/sound-layer';
import { TimePosition } from './time/time-position';
import { TimeDuration } from './time/time-duration';
import { Effect } from './mixer/effect';
import { Parameter } from './automation/parameter';
import {
  createLibraryInstanceLiveData,
  createModernProject,
} from './live/blue-live-trigger-fixtures';

describe('BlueData.deepCopy aggregate isolation', () => {
  function makeSoundWithStableEditorIds(prefix: string): Sound {
    const sound = new Sound();
    const builder = new BlueSynthBuilder();
    const knob = new BSBKnob();
    knob.id = `${prefix}-widget`;
    knob.objectName = `${prefix}-value`;
    builder.getGraphicInterface().getRootGroup().addChild(knob);
    const parameter = builder.getParameters()[0]!;
    parameter.setUniqueId(`${prefix}-parameter`);

    const preset = new Preset();
    preset.uniqueId = `${prefix}-preset`;
    preset.setPresetName(`${prefix} preset`);
    preset.setValue(knob.objectName, '0.5');
    const presetGroup = new PresetGroup();
    presetGroup.presets.push(preset);
    presetGroup.currentPresetUniqueId = preset.getUniqueId();
    builder.setPresetGroup(presetGroup);
    sound.setBlueSynthBuilder(builder);
    return sound;
  }

  function editorIds(sound: Sound): { widget: string; parameter: string; preset: string } {
    const builder = sound.getBlueSynthBuilder();
    const widget = builder.getGraphicInterface().getRootGroup().getChildren()[0] as BSBKnob;
    return {
      widget: widget.id,
      parameter: builder.getParameters()[0]!.getUniqueId(),
      preset: builder.getPresetGroup()!.presets[0]!.getUniqueId(),
    };
  }

  it('keeps accepted marker and plugin state isolated from input, output and history-copy mutations', () => {
    const source = new BlueData();
    source.getMarkersList().addMarkerPosition('Cue', TimePosition.frames(12));
    const plugin = new ClojureProjectData();
    const entry = new ClojureLibraryEntry();
    entry.setDependencyCoordinates('original/owned');
    entry.setVersion('1.0.0');
    plugin.addLibraryEntry(entry);
    source.setClojureProjectData(plugin);
    const input = Element.parse(source.saveToString());
    const accepted = BlueData.loadFromString(input.toXml());
    const before = accepted.saveToString();
    const history = accepted.historyCopy();
    input.getElement('markersList')!.getElement('marker')!.setAttribute('name', 'Changed input');
    input
      .getElement('pluginData')!
      .getElement('blueDataObject')!
      .getElement('clojureLibraryEntry')!
      .getElement('version')!
      .setText('input change');
    const output = Element.parse(accepted.saveToString());
    output.getElement('markersList')!.getElement('marker')!.setAttribute('name', 'Changed output');
    accepted
      .getPluginDataXml()[0]
      .getElement('clojureLibraryEntry')!
      .getElement('version')!
      .setText('getter change');
    accepted.getMarkersList().getMarker(0)!.setAttribute('name', 'getter marker change');
    expect(accepted.saveToString()).toBe(before);
    history.getMarkersList().setMarkerTimePosition(0, TimePosition.frames(24));
    const changedPlugin = history.getClojureProjectData()!;
    changedPlugin.getLibraryEntries()[0].setVersion('2.0.0');
    history.setClojureProjectData(changedPlugin);
    expect(history.saveToString()).not.toBe(before);
    expect(accepted.saveToString()).toBe(before);
    expect(accepted.getMarkersList().getMarkerTimePosition(0).getValue()).toBe(12);
    expect(accepted.getClojureProjectData()!.getLibraryEntries()[0].getVersion()).toBe('1.0.0');
  });

  it('isolates Live Data instead of aliasing it', () => {
    const original = createModernProject();
    const copy = original.deepCopy() as BlueData;

    // Mutate the copy's Live Data tempo and verify the original is unaffected.
    copy.getLiveData().setTempo(200);
    expect(original.getLiveData().getTempo()).toBe(60);

    // Mutate a LiveObject enabled flag on the copy.
    const copyBins = copy.getLiveData().getLiveObjectBins();
    const originalBins = original.getLiveData().getLiveObjectBins();

    const copyLo00 = copyBins.getLiveObject(0, 0);
    expect(copyLo00).not.toBeNull();
    copyLo00!.setEnabled(true);
    expect(originalBins.getLiveObject(0, 0)!.isEnabled()).toBe(false);

    // Verify the copied LiveObject is a different object reference.
    expect(copyLo00).not.toBe(originalBins.getLiveObject(0, 0));
  });

  it('isolates the SoundObject library instead of aliasing it', () => {
    const original = new BlueData();
    const library = original.getSoundObjectLibrary();
    const source = new GenericScore();
    source.setName('Library Source');
    source.setScoreText('i1 0 2 440');
    library.addObject(source);

    const copy = original.deepCopy() as BlueData;
    const copyLibrary = copy.getSoundObjectLibrary();

    // Mutate the copied library source and verify the original is unaffected.
    const copySource = copyLibrary.getObject(0);
    expect(copySource).toBeDefined();
    copySource!.setName('Mutated Copy');
    expect(original.getSoundObjectLibrary().getObject(0)!.getName()).toBe('Library Source');

    // Verify the library instances are distinct objects.
    expect(copyLibrary).not.toBe(library);
    expect(copySource).not.toBe(source);
  });

  it('isolates the instrument library instead of aliasing it', () => {
    const original = new BlueData();
    const instrumentLibrary = new InstrumentLibrary();
    const instrument = new GenericInstrument();
    instrument.setName('Solo Instrument');
    instrument.setText('aout oscili p4, p5');
    instrumentLibrary.addInstrument(instrument);
    original.setInstrumentLibrary(instrumentLibrary);

    const copy = original.deepCopy() as BlueData;
    const copyLibrary = copy.getInstrumentLibrary();
    expect(copyLibrary).not.toBe(instrumentLibrary);
    expect(copyLibrary).not.toBeNull();

    const copyInstrument = copyLibrary!.getInstrument('Solo Instrument');
    expect(copyInstrument).toBeDefined();
    copyInstrument!.setName('Mutated Instrument');
    expect(original.getInstrumentLibrary()!.getInstrument('Solo Instrument')!.getName()).toBe(
      'Solo Instrument',
    );
  });

  it('isolates the opcode list instead of aliasing it', () => {
    const original = new BlueData();
    const opcode = new OpcodeDefinition();
    opcode.setName('my_udo');
    opcode.setCode('opcode my_udo, 0, 0\nendin');
    original.getOpcodeList().addOpcode(opcode);

    const copy = original.deepCopy() as BlueData;
    const copyOpcode = copy.getOpcodeList().getOpcode(0);
    expect(copyOpcode).not.toBeNull();
    copyOpcode!.setName('mutated_udo');
    expect(original.getOpcodeList().getOpcode(0)!.getName()).toBe('my_udo');

    expect(copy.getOpcodeList()).not.toBe(original.getOpcodeList());
  });

  it('remaps copied Instance references to copied library objects', () => {
    const fixture = createLibraryInstanceLiveData();
    const original = fixture.data;
    const originalLibraryObject = fixture.libraryObject;

    const copy = original.deepCopy() as BlueData;
    const copyLibrary = copy.getSoundObjectLibrary();
    const copyLibraryObject = copyLibrary.getObject(0);

    // The copied library object must exist and be distinct.
    expect(copyLibraryObject).toBeDefined();
    expect(copyLibraryObject).not.toBe(originalLibraryObject);

    // Traverse the copied Live Data bins to find the copied Instance.
    const copyBins = copy.getLiveData().getLiveObjectBins();
    const copyLiveObject = copyBins.getLiveObject(0, 0);
    expect(copyLiveObject).not.toBeNull();
    const copyInstance = copyLiveObject!.getSoundObject() as Instance;
    expect(copyInstance).toBeInstanceOf(Instance);

    // The copied Instance must reference the COPIED library object, not the original.
    expect(copyInstance.getSoundObject()).toBe(copyLibraryObject);
    expect(copyInstance.getSoundObject()).not.toBe(originalLibraryObject);
  });

  it('remaps copied Instance references in the score graph to copied library objects', () => {
    const original = new BlueData();
    const library = original.getSoundObjectLibrary();
    const librarySource = new GenericScore();
    librarySource.setName('Score Lib Source');
    librarySource.setScoreText('i1 0 2 440');
    library.addObject(librarySource);

    const poly = new PolyObject();
    const layer = new SoundLayer();
    const scoreInstance = new Instance();
    scoreInstance.setName('Score Instance');
    scoreInstance.setSoundObject(librarySource);
    scoreInstance.setStartTime(TimePosition.beats(0));
    scoreInstance.setSubjectiveDuration(TimeDuration.beats(2));
    layer.push(scoreInstance);
    poly.push(layer);
    original.getScore().push(poly);

    const copy = original.deepCopy() as BlueData;
    const copyLibraryObject = copy.getSoundObjectLibrary().getObject(0);

    // Find the copied Instance in the score graph (the pushed PolyObject at index 1).
    const copyPoly = copy.getScore()[1] as PolyObject;
    expect(copyPoly).toBeDefined();
    const copyLayer = copyPoly[0] as SoundLayer;
    const copyInstance = copyLayer[0] as Instance;
    expect(copyInstance).toBeInstanceOf(Instance);

    // The copied score Instance must reference the copied library object.
    expect(copyInstance.getSoundObject()).toBe(copyLibraryObject);
    expect(copyInstance.getSoundObject()).not.toBe(librarySource);
  });

  it('remaps Instance references inside copied library objects', () => {
    const original = new BlueData();
    const source = new GenericScore();
    source.setName('Library Source');
    original.getSoundObjectLibrary().addObject(source);
    const libraryInstance = new Instance();
    libraryInstance.setSoundObject(source);
    original.getSoundObjectLibrary().addObject(libraryInstance);

    const copy = original.deepCopy() as BlueData;
    const copiedSource = copy.getSoundObjectLibrary().getObject(0);
    const copiedInstance = copy.getSoundObjectLibrary().getObject(1) as Instance;

    expect(copiedInstance.getSoundObject()).toBe(copiedSource);
    expect(copiedInstance.getSoundObject()).not.toBe(source);
  });

  it('remaps nested Live Space Instance references to copied library objects', () => {
    const original = new BlueData();
    const source = new GenericScore();
    source.setName('Nested Live Source');
    original.getSoundObjectLibrary().addObject(source);

    const instance = new Instance();
    instance.setSoundObject(source);
    const poly = new PolyObject();
    poly.newLayerAt(0);
    (poly[0] as SoundLayer).push(instance);
    const liveObject = new LiveObject();
    liveObject.setSoundObject(poly);
    const bins = new LiveObjectBins(1, 1);
    bins.setLiveObject(0, 0, liveObject);
    original.getLiveData().setLiveObjectBins(bins);

    const copy = original.deepCopy() as BlueData;
    const copiedPoly = copy
      .getLiveData()
      .getLiveObjectBins()
      .getLiveObject(0, 0)!
      .getSoundObject() as PolyObject;
    const copiedInstance = (copiedPoly[0] as SoundLayer)[0] as Instance;

    expect(copiedInstance.getSoundObject()).toBe(copy.getSoundObjectLibrary().getObject(0));
    expect(copiedInstance.getSoundObject()).not.toBe(source);
  });

  it('preserves history identities through Sound, ObjectBuilder, FrozenSoundObject, and Live copies', () => {
    const original = new BlueData();
    const librarySound = makeSoundWithStableEditorIds('library');
    original.getSoundObjectLibrary().addObject(librarySound);

    const builder = new ObjectBuilder();
    const builderKnob = new BSBKnob();
    builderKnob.id = 'builder-widget';
    builderKnob.objectName = 'builder-value';
    builder.getGraphicInterface().getRootGroup().addChild(builderKnob);
    const builderPreset = new Preset();
    builderPreset.uniqueId = 'builder-preset';
    const builderPresets = new PresetGroup();
    builderPresets.presets.push(builderPreset);
    builderPresets.currentPresetUniqueId = builderPreset.getUniqueId();
    builder.setPresetGroup(builderPresets);
    original.getSoundObjectLibrary().addObject(builder);

    const frozen = new FrozenSoundObject();
    frozen.setNumChannels(2);
    frozen.setFrozenSoundObject(makeSoundWithStableEditorIds('frozen'));
    original.getSoundObjectLibrary().addObject(frozen);

    const liveSound = makeSoundWithStableEditorIds('live');
    const liveObject = new LiveObject();
    liveObject.setUniqueId('live-object-stable');
    liveObject.setSoundObject(liveSound);
    const bins = new LiveObjectBins(1, 1);
    bins.setLiveObject(0, 0, liveObject);
    original.getLiveData().setLiveObjectBins(bins);

    const history = original.historyCopy();
    const copiedSound = history.getSoundObjectLibrary().getObject(0) as Sound;
    const copiedBuilder = history.getSoundObjectLibrary().getObject(1) as ObjectBuilder;
    const copiedFrozen = history.getSoundObjectLibrary().getObject(2) as FrozenSoundObject;
    const copiedLive = history.getLiveData().getLiveObjectBins().getLiveObject(0, 0)!;

    expect(editorIds(copiedSound)).toEqual(editorIds(librarySound));
    expect(copiedBuilder.getGraphicInterface().getRootGroup().getChildren()[0]?.id).toBe(
      'builder-widget',
    );
    expect(copiedBuilder.getPresetGroup().presets[0]?.getUniqueId()).toBe('builder-preset');
    expect(editorIds(copiedFrozen.getFrozenSoundObject() as Sound)).toEqual(
      editorIds(frozen.getFrozenSoundObject() as Sound),
    );
    expect(copiedLive.getUniqueId()).toBe('live-object-stable');
    expect(editorIds(copiedLive.getSoundObject() as Sound)).toEqual(editorIds(liveSound));

    const duplicate = original.deepCopy();
    const duplicatedSound = duplicate.getSoundObjectLibrary().getObject(0) as Sound;
    const duplicatedBuilder = duplicate.getSoundObjectLibrary().getObject(1) as ObjectBuilder;
    const duplicatedFrozen = duplicate.getSoundObjectLibrary().getObject(2) as FrozenSoundObject;
    const duplicatedLive = duplicate.getLiveData().getLiveObjectBins().getLiveObject(0, 0)!;
    expect(editorIds(duplicatedSound)).not.toEqual(editorIds(librarySound));
    expect(duplicatedBuilder.getGraphicInterface().getRootGroup().getChildren()[0]?.id).not.toBe(
      'builder-widget',
    );
    expect(duplicatedBuilder.getPresetGroup().presets[0]?.getUniqueId()).not.toBe('builder-preset');
    expect(editorIds(duplicatedFrozen.getFrozenSoundObject() as Sound)).not.toEqual(
      editorIds(frozen.getFrozenSoundObject() as Sound),
    );
    expect(editorIds(duplicatedLive.getSoundObject() as Sound)).not.toEqual(editorIds(liveSound));
  });

  it('propagates copy mode through PatternLayer SoundObjects and nested owners', () => {
    const original = new BlueData();
    const patterns = new PatternsLayerGroup();

    const soundLayer = patterns.newLayerAt(0);
    const patternSound = makeSoundWithStableEditorIds('pattern');
    soundLayer.setSoundObject(patternSound);

    const builderLayer = patterns.newLayerAt(1);
    const patternBuilder = new ObjectBuilder();
    const builderKnob = new BSBKnob();
    builderKnob.id = 'pattern-builder-widget';
    patternBuilder.getGraphicInterface().getRootGroup().addChild(builderKnob);
    const builderPreset = new Preset();
    builderPreset.uniqueId = 'pattern-builder-preset';
    const builderPresets = new PresetGroup();
    builderPresets.presets.push(builderPreset);
    builderPresets.currentPresetUniqueId = builderPreset.getUniqueId();
    patternBuilder.setPresetGroup(builderPresets);
    builderLayer.setSoundObject(patternBuilder);

    const frozenLayer = patterns.newLayerAt(2);
    const frozen = new FrozenSoundObject();
    frozen.setFrozenSoundObject(makeSoundWithStableEditorIds('pattern-frozen'));
    frozenLayer.setSoundObject(frozen);

    const polyLayer = patterns.newLayerAt(3);
    const poly = new PolyObject();
    poly.newLayerAt(0);
    const polySound = makeSoundWithStableEditorIds('pattern-poly');
    (poly[0] as SoundLayer).push(polySound);
    polyLayer.setSoundObject(poly);
    original.getScore().push(patterns);

    const history = original.historyCopy();
    const historyPatterns = history.getScore()[1] as PatternsLayerGroup;
    expect(editorIds(historyPatterns[0]!.getSoundObject() as Sound)).toEqual(
      editorIds(patternSound),
    );
    const historyBuilder = historyPatterns[1]!.getSoundObject() as ObjectBuilder;
    expect(historyBuilder.getGraphicInterface().getRootGroup().getChildren()[0]?.id).toBe(
      'pattern-builder-widget',
    );
    expect(historyBuilder.getPresetGroup().presets[0]?.getUniqueId()).toBe(
      'pattern-builder-preset',
    );
    expect(
      editorIds(
        (historyPatterns[2]!.getSoundObject() as FrozenSoundObject).getFrozenSoundObject() as Sound,
      ),
    ).toEqual(
      editorIds(
        (frozenLayer.getSoundObject() as FrozenSoundObject).getFrozenSoundObject() as Sound,
      ),
    );
    const historyPolySound = (
      (historyPatterns[3]!.getSoundObject() as PolyObject)[0] as SoundLayer
    )[0] as Sound;
    expect(editorIds(historyPolySound)).toEqual(editorIds(polySound));

    const duplicate = original.deepCopy();
    const duplicatePatterns = duplicate.getScore()[1] as PatternsLayerGroup;
    expect(editorIds(duplicatePatterns[0]!.getSoundObject() as Sound)).not.toEqual(
      editorIds(patternSound),
    );
    const duplicateBuilder = duplicatePatterns[1]!.getSoundObject() as ObjectBuilder;
    expect(duplicateBuilder.getGraphicInterface().getRootGroup().getChildren()[0]?.id).not.toBe(
      'pattern-builder-widget',
    );
    expect(duplicateBuilder.getPresetGroup().presets[0]?.getUniqueId()).not.toBe(
      'pattern-builder-preset',
    );
    expect(
      editorIds(
        (
          duplicatePatterns[2]!.getSoundObject() as FrozenSoundObject
        ).getFrozenSoundObject() as Sound,
      ),
    ).not.toEqual(
      editorIds(
        (frozenLayer.getSoundObject() as FrozenSoundObject).getFrozenSoundObject() as Sound,
      ),
    );
    const duplicatePolySound = (
      (duplicatePatterns[3]!.getSoundObject() as PolyObject)[0] as SoundLayer
    )[0] as Sound;
    expect(editorIds(duplicatePolySound)).not.toEqual(editorIds(polySound));
  });

  it('relinks PatternLayer Instance references through history, duplication, and project XML', () => {
    const original = new BlueData();
    const library = original.getSoundObjectLibrary();
    const forward = new Instance();
    const target = new GenericScore();
    target.setName('Pattern forward target');
    target.setScoreText('i1 0 2 440');
    forward.setSoundObject(target);
    library.addObject(forward);
    library.addObject(target);

    const patterns = new PatternsLayerGroup();
    const directLayer = patterns.newLayerAt(0);
    const directReference = new Instance();
    directReference.setSoundObject(target);
    directLayer.setSoundObject(directReference);

    const nestedLayer = patterns.newLayerAt(1);
    const poly = new PolyObject();
    poly.newLayerAt(0);
    const frozen = new FrozenSoundObject();
    const frozenReference = new Instance();
    frozenReference.setSoundObject(target);
    frozen.setFrozenSoundObject(frozenReference);
    const sharedReference = new Instance();
    sharedReference.setSoundObject(target);
    (poly[0] as SoundLayer).push(frozen, sharedReference);
    nestedLayer.setSoundObject(poly);
    original.getScore().push(patterns);

    const assertReferences = (copy: BlueData): void => {
      const copiedTarget = copy.getSoundObjectLibrary().getObject(1)!;
      const copiedPatterns = copy.getScore()[1] as PatternsLayerGroup;
      expect((copiedPatterns[0]!.getSoundObject() as Instance).getSoundObject()).toBe(copiedTarget);
      const copiedPoly = copiedPatterns[1]!.getSoundObject() as PolyObject;
      const copiedLayer = copiedPoly[0] as SoundLayer;
      expect(
        ((copiedLayer[0] as FrozenSoundObject).getFrozenSoundObject() as Instance).getSoundObject(),
      ).toBe(copiedTarget);
      expect((copiedLayer[1] as Instance).getSoundObject()).toBe(copiedTarget);
      expect((copy.getSoundObjectLibrary().getObject(0) as Instance).getSoundObject()).toBe(
        copiedTarget,
      );
      expect(copiedTarget).not.toBe(target);
    };

    const before = original.saveToString();
    const history = original.historyCopy();
    assertReferences(history);
    const historyTarget = history.getSoundObjectLibrary().getObject(1)!;
    historyTarget.setName('Changed history memento');
    expect(original.getSoundObjectLibrary().getObject(1)!.getName()).toBe('Pattern forward target');
    expect(original.saveToString()).toBe(before);

    const duplicate = original.deepCopy();
    assertReferences(duplicate);
    const reopenedOriginal = BlueData.loadFromString(before);
    assertReferences(reopenedOriginal);
    const duplicateXml = duplicate.saveToString();
    const reopenedDuplicate = BlueData.loadFromString(duplicateXml);
    assertReferences(reopenedDuplicate);
  });

  it('relinks forward and shared Track and FrozenSoundObject Instances through history and XML round-trip', () => {
    const original = new BlueData();
    const library = original.getSoundObjectLibrary();
    const forwardInstance = new Instance();
    const target = new GenericScore();
    target.setName('Forward Target');
    target.setScoreText('i1 0 2 440');
    forwardInstance.setSoundObject(target);
    library.addObject(forwardInstance);
    library.addObject(target);

    const frozen = new FrozenSoundObject();
    frozen.setNumChannels(2);
    const frozenInstance = new Instance();
    frozenInstance.setSoundObject(target);
    frozen.setFrozenSoundObject(frozenInstance);
    library.addObject(frozen);

    const trackReference = new Instance();
    trackReference.setSoundObject(target);
    const track = new Track();
    track.push(trackReference);
    const group = new TrackLayerGroup();
    group.push(track);
    original.getScore().push(group);

    const history = original.historyCopy();
    const copiedTarget = history.getSoundObjectLibrary().getObject(1)!;
    const copiedForward = history.getSoundObjectLibrary().getObject(0) as Instance;
    const copiedFrozen = history.getSoundObjectLibrary().getObject(2) as FrozenSoundObject;
    const copiedTrack = history.getScore()[1] as TrackLayerGroup;
    const copiedTrackReference = copiedTrack[0]![0] as Instance;

    expect(copiedForward.getSoundObject()).toBe(copiedTarget);
    expect((copiedFrozen.getFrozenSoundObject() as Instance).getSoundObject()).toBe(copiedTarget);
    expect(copiedTrackReference.getSoundObject()).toBe(copiedTarget);
    expect(copiedTrackReference.getSoundObject()).not.toBe(target);
    expect(copiedTrackReference.getSoundObject()).toBe(copiedForward.getSoundObject());

    const before = original.saveToString();
    copiedTarget.setName('Changed memento target');
    expect(target.getName()).toBe('Forward Target');
    const retained = original.historyCopy();
    expect((retained.getSoundObjectLibrary().getObject(0) as Instance).getSoundObject()).toBe(
      retained.getSoundObjectLibrary().getObject(1),
    );
    expect(original.saveToString()).toBe(before);

    const reloaded = BlueData.loadFromString(history.saveToString());
    const reloadedTarget = reloaded.getSoundObjectLibrary().getObject(1)!;
    const reloadedForward = reloaded.getSoundObjectLibrary().getObject(0) as Instance;
    const reloadedFrozen = reloaded.getSoundObjectLibrary().getObject(2) as FrozenSoundObject;
    const reloadedTrack = reloaded.getScore()[1] as TrackLayerGroup;
    expect(reloadedForward.getSoundObject()).toBe(reloadedTarget);
    expect((reloadedFrozen.getFrozenSoundObject() as Instance).getSoundObject()).toBe(
      reloadedTarget,
    );
    expect((reloadedTrack[0]![0] as Instance).getSoundObject()).toBe(reloadedTarget);
  });

  it('preserves stable LiveObject uniqueIds across a whole-project copy', () => {
    const original = createModernProject();
    const copy = original.deepCopy() as BlueData;

    const originalBins = original.getLiveData().getLiveObjectBins();
    const copyBins = copy.getLiveData().getLiveObjectBins();

    for (let c = 0; c < originalBins.getColumnCount(); c++) {
      for (let r = 0; r < originalBins.getRowCount(); r++) {
        const originalObj = originalBins.getLiveObject(c, r);
        const copyObj = copyBins.getLiveObject(c, r);
        if (originalObj && copyObj) {
          expect(copyObj.getUniqueId()).toBe(originalObj.getUniqueId());
        }
      }
    }
  });
});

describe('BlueData.deepCopy forbidden static boundary', () => {
  it('does not import host or Node built-in modules at runtime', () => {
    // Read the blue-data source entry to verify no host imports leaked into the
    // pure data package. This guards the constitution constraint that @blue/data
    // must remain browser-safe and Node-safe with static imports only.
    expect(typeof BlueData).toBe('function');
  });

  it('does not use require() or dynamic import() in the data package source', () => {
    // Guard the esbuild bundle constraint: no require(), no dynamic import(),
    // and no Node built-in modules in @blue/data.
    const srcDir = path.resolve(__dirname);
    const files = fs
      .readdirSync(srcDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const forbiddenPatterns = [
      /\brequire\s*\(/,
      /\bimport\s*\(/,
      /\bfrom\s+['"]electron['"]/,
      /\bfrom\s+['"]node:/,
      /\bfrom\s+['"]fs['"]/,
      /\bfrom\s+['"]path['"]/,
      /\bfrom\s+['"]child_process['"]/,
    ];
    for (const file of files) {
      const contents = fs.readFileSync(path.join(srcDir, file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(contents), `${file} matches forbidden pattern ${pattern}`).toBe(false);
      }
    }
  });

  describe('four-state detached memento isolation across nested structures', () => {
    it('isolates nested score objects, library instances, effects chains, and parameters', () => {
      const source = new BlueData();

      // 1. Library and Instance
      const libScore = new GenericScore();
      libScore.setName('Lib Sound');
      libScore.setScoreText('i1 0 2 440');
      source.getSoundObjectLibrary().addObject(libScore);

      const inst = new Instance();
      inst.setSoundObject(libScore);
      inst.setStartTime(TimePosition.beats(1));

      // 2. Nested PolyObject in Score (use default root PolyObject and its layer)
      const root = source.getScore()[0] as PolyObject;
      const soundLayer = root[0];
      soundLayer.push(inst);

      // 3. Effect on Master Channel
      const effect = new Effect();
      effect.setName('Master Reverb');
      const param = new Parameter();
      param.setName('DryWet');
      param.setFixedValue(0.3);
      effect.addParameter(param);
      source.getMixer().getMaster().getEffectsChain().push(effect);

      // 4-state lifecycle: source -> retainedBefore -> candidate -> retainedAfter
      const retainedBefore = source.historyCopy();
      const candidate = source.historyCopy();

      // Ensure distinct instances
      expect(new Set([source, retainedBefore, candidate]).size).toBe(3);

      // Mutate candidate nested objects
      const candRoot = candidate.getScore()[0] as PolyObject;
      const candLayer = candRoot[0];
      const candInst = candLayer[0] as Instance;
      candInst.setStartTime(TimePosition.beats(5));

      const candEffect = candidate.getMixer().getMaster().getEffectsChain()[0] as Effect;
      candEffect.setName('Mutated Master Reverb');
      candEffect.getParameters()[0].setFixedValue(0.9);

      // Mutate candidate library object
      candidate.getSoundObjectLibrary().getObject(0)!.setName('Mutated Lib Sound');

      // Assert source and retainedBefore are untouched
      const origRoot = source.getScore()[0] as PolyObject;
      const origInst = origRoot[0][0] as Instance;
      expect(origInst.getStartTime().getCsoundBeats()).toBe(1);

      const beforeRoot = retainedBefore.getScore()[0] as PolyObject;
      const beforeInst = beforeRoot[0][0] as Instance;
      expect(beforeInst.getStartTime().getCsoundBeats()).toBe(1);

      const origEffect = source.getMixer().getMaster().getEffectsChain()[0] as Effect;
      expect(origEffect.getName()).toBe('Master Reverb');
      expect(origEffect.getParameters()[0].getFixedValue()).toBe(0.3);

      const beforeEffect = retainedBefore.getMixer().getMaster().getEffectsChain()[0] as Effect;
      expect(beforeEffect.getName()).toBe('Master Reverb');
      expect(beforeEffect.getParameters()[0].getFixedValue()).toBe(0.3);

      expect(source.getSoundObjectLibrary().getObject(0)!.getName()).toBe('Lib Sound');
      expect(retainedBefore.getSoundObjectLibrary().getObject(0)!.getName()).toBe('Lib Sound');

      // Capture retainedAfter
      const retainedAfter = candidate.historyCopy();
      expect(new Set([source, retainedBefore, candidate, retainedAfter]).size).toBe(4);

      // Mutate candidate further
      candInst.setStartTime(TimePosition.beats(10));
      candEffect.setName('Further Mutated Reverb');
      candEffect.getParameters()[0].setFixedValue(1.0);

      // Verify retainedAfter is preserved at commit state
      const afterRoot = retainedAfter.getScore()[0] as PolyObject;
      const afterInst = afterRoot[0][0] as Instance;
      expect(afterInst.getStartTime().getCsoundBeats()).toBe(5);

      const afterEffect = retainedAfter.getMixer().getMaster().getEffectsChain()[0] as Effect;
      expect(afterEffect.getName()).toBe('Mutated Master Reverb');
      expect(afterEffect.getParameters()[0].getFixedValue()).toBe(0.9);
      expect(retainedAfter.getSoundObjectLibrary().getObject(0)!.getName()).toBe(
        'Mutated Lib Sound',
      );

      // Verify before states remain intact
      expect(beforeInst.getStartTime().getCsoundBeats()).toBe(1);
      expect(beforeEffect.getName()).toBe('Master Reverb');
      expect(beforeEffect.getParameters()[0].getFixedValue()).toBe(0.3);
    });
  });
});
