import { describe, expect, it } from 'vitest';

import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { GenericScore } from './generic-score';
import { FrozenSoundObject } from './frozen-sound-object';
import './register-sound-object-types';

describe('FrozenSoundObject', () => {
  function createPopulatedFrozen(): FrozenSoundObject {
    const fso = new FrozenSoundObject();
    fso.setName('F: My Source');
    fso.setStartTime(TimePosition.beats(8));
    fso.setSubjectiveDuration(TimeDuration.beats(4));
    fso.setNumChannels(2);
    fso.setFrozenWaveFileName('freeze0.wav');

    const source = new GenericScore();
    source.setName('My Source');
    source.setStartTime(TimePosition.beats(8));
    source.setSubjectiveDuration(TimeDuration.beats(4));
    fso.setFrozenSoundObject(source);

    return fso;
  }

  describe('XML round-trip', () => {
    it('serializes numChannels, frozenWaveFileName, and nested soundObject in Java order', () => {
      const fso = createPopulatedFrozen();
      const xml = fso.saveAsXML();
      const text = xml.toXml();

      const numChannelsIdx = text.indexOf('<numChannels>');
      const fileNameIdx = text.indexOf('<frozenWaveFileName>');
      const nestedIdx = text.indexOf('<soundObject type="blue.soundObject.GenericScore"');

      expect(numChannelsIdx).toBeGreaterThan(-1);
      expect(fileNameIdx).toBeGreaterThan(numChannelsIdx);
      expect(nestedIdx).toBeGreaterThan(fileNameIdx);

      expect(text).toContain('<numChannels>2</numChannels>');
      expect(text).toContain('<frozenWaveFileName>freeze0.wav</frozenWaveFileName>');
    });

    it('round-trips nested source object through save/load', () => {
      const fso = createPopulatedFrozen();
      const xml = fso.saveAsXML();
      const roundTripped = FrozenSoundObject.loadFromXML(xml);

      expect(roundTripped.getName()).toBe('F: My Source');
      expect(roundTripped.getNumChannels()).toBe(2);
      expect(roundTripped.getFrozenWaveFileName()).toBe('freeze0.wav');
      expect(roundTripped.getStartTime().getValue()).toBe(8);
      expect(roundTripped.getSubjectiveDuration().getValue()).toBe(4);

      const nested = roundTripped.getFrozenSoundObject();
      expect(nested).not.toBeNull();
      expect(nested!.getName()).toBe('My Source');
      expect(nested instanceof GenericScore).toBe(true);
    });

    it('preserves relative filename (not absolute path)', () => {
      const fso = new FrozenSoundObject();
      fso.setFrozenWaveFileName('freeze3.aif');
      fso.setNumChannels(1);

      const xml = fso.saveAsXML();
      const loaded = FrozenSoundObject.loadFromXML(xml);

      expect(loaded.getFrozenWaveFileName()).toBe('freeze3.aif');
      expect(loaded.getFrozenWaveFileName()).not.toContain('/');
    });

    it('handles missing nested soundObject gracefully', () => {
      const xml = new Element('soundObject');
      xml.setAttribute('type', 'blue.soundObject.FrozenSoundObject');
      xml.addElement('name').setText('Frozen No Source');
      const startElem = TimePosition.beats(0).saveAsXML();
      startElem.setName('startTime');
      xml.addElement(startElem);
      const durElem = TimeDuration.beats(2).saveAsXML();
      durElem.setName('subjectiveDuration');
      xml.addElement(durElem);
      xml.addElement('numChannels').setText('1');
      xml.addElement('frozenWaveFileName').setText('freeze0.wav');

      const loaded = FrozenSoundObject.loadFromXML(xml);
      expect(loaded.getNumChannels()).toBe(1);
      expect(loaded.getFrozenWaveFileName()).toBe('freeze0.wav');
      expect(loaded.getFrozenSoundObject()).toBeNull();
    });
  });

  describe('deep copy', () => {
    it('deep-copies nested source independently', () => {
      const fso = createPopulatedFrozen();
      const copy = fso.deepCopy() as FrozenSoundObject;

      expect(copy).not.toBe(fso);
      expect(copy.getNumChannels()).toBe(2);
      expect(copy.getFrozenWaveFileName()).toBe('freeze0.wav');

      const origNested = fso.getFrozenSoundObject()!;
      const copyNested = copy.getFrozenSoundObject()!;
      expect(copyNested).not.toBe(origNested);
      copyNested.setName('Changed');
      expect(origNested.getName()).toBe('My Source');
    });
  });

  describe('CSD generation', () => {
    it('returns empty note list when no frozen wave filename is set', () => {
      const fso = new FrozenSoundObject();
      fso.setNumChannels(2);
      const context = new TimeContext();
      const compileData = CompileData.createEmptyCompileData();

      const notes = fso.generateForCSD(context, compileData, 0, -1);
      expect(notes.size).toBe(0);
    });

    it('registers a diskin2 instrument and generates a playback note', () => {
      const fso = createPopulatedFrozen();
      fso.setStartTime(TimePosition.beats(2));
      fso.setSubjectiveDuration(TimeDuration.beats(4));

      const context = new TimeContext();
      const compileData = CompileData.createEmptyCompileData();

      const notes = fso.generateForCSD(context, compileData, 0, -1);
      expect(notes.size).toBe(1);

      const note = notes.getNote(0);
      expect(note.getPField(4)).toBe('"freeze0.wav"');
      expect(note.getPField(5)).toBe('0');
      expect(note.getStartTime()).toBe(2);
      expect(note.getSubjectiveDuration()).toBe(4);
    });

    it('generates correct diskin2 instrument text for mono', () => {
      const fso = new FrozenSoundObject();
      fso.setName('F: Mono');
      fso.setStartTime(TimePosition.beats(0));
      fso.setSubjectiveDuration(TimeDuration.beats(2));
      fso.setNumChannels(1);
      fso.setFrozenWaveFileName('freeze0.wav');

      const context = new TimeContext();
      const compileData = CompileData.createEmptyCompileData();

      fso.generateForCSD(context, compileData, 0, -1);

      const assignments = compileData.getArrangement().getArrangement();
      expect(assignments).toHaveLength(1);
      const instr = assignments[0].instr;
      expect(instr.getName()).toBe('Frozen SoundObject Player Instrument');
      expect(instr.generateInstrument()).toContain('aChannel1\tdiskin2\tp4, 1, p5');
      expect(instr.generateInstrument()).toContain('\tout\taChannel1');
      expect(instr.generateInstrument()).not.toContain('outc');
    });

    it('generates outc for multichannel', () => {
      const fso = new FrozenSoundObject();
      fso.setStartTime(TimePosition.beats(0));
      fso.setSubjectiveDuration(TimeDuration.beats(2));
      fso.setNumChannels(4);
      fso.setFrozenWaveFileName('freeze1.wav');

      const context = new TimeContext();
      const compileData = CompileData.createEmptyCompileData();

      fso.generateForCSD(context, compileData, 0, -1);

      const assignments = compileData.getArrangement().getArrangement();
      const instr = assignments[0].instr;
      const text = instr.generateInstrument();
      expect(text).toContain('aChannel1, aChannel2, aChannel3, aChannel4\tdiskin2\tp4, 1, p5');
      expect(text).toContain('\toutc\taChannel1, aChannel2, aChannel3, aChannel4');
    });

    it('registers the instrument only once across multiple frozen objects', () => {
      const fso1 = new FrozenSoundObject();
      fso1.setStartTime(TimePosition.beats(0));
      fso1.setSubjectiveDuration(TimeDuration.beats(2));
      fso1.setNumChannels(2);
      fso1.setFrozenWaveFileName('freeze0.wav');

      const fso2 = new FrozenSoundObject();
      fso2.setStartTime(TimePosition.beats(4));
      fso2.setSubjectiveDuration(TimeDuration.beats(2));
      fso2.setNumChannels(2);
      fso2.setFrozenWaveFileName('freeze1.wav');

      const context = new TimeContext();
      const compileData = CompileData.createEmptyCompileData();

      fso1.generateForCSD(context, compileData, 0, -1);
      fso2.generateForCSD(context, compileData, 0, -1);

      const assignments = compileData.getArrangement().getArrangement();
      expect(assignments).toHaveLength(1);

      const notes2 = fso2.generateForCSD(context, compileData, 0, -1);
      expect(notes2.size).toBe(1);
      expect(notes2.getNote(0).getPField(4)).toBe('"freeze1.wav"');
    });

    it('clips note duration to the render window', () => {
      const fso = createPopulatedFrozen();
      fso.setStartTime(TimePosition.beats(0));
      fso.setSubjectiveDuration(TimeDuration.beats(10));

      const context = new TimeContext();
      const compileData = CompileData.createEmptyCompileData();

      const notes = fso.generateForCSD(context, compileData, 2, 6);
      expect(notes.size).toBe(1);
      const note = notes.getNote(0);
      expect(note.getStartTime()).toBe(2);
      expect(note.getSubjectiveDuration()).toBe(4);
      expect(note.getPField(5)).toBe('2');
    });
  });

  describe('time behavior', () => {
    it('returns NOT_SUPPORTED', () => {
      const fso = new FrozenSoundObject();
      expect(fso.getTimeBehavior()).toBe('NOT_SUPPORTED');
    });
  });
});
