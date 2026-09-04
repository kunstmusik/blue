import { describe, it, expect } from 'vitest';
import { MidiInputProcessor } from './midi-input-processor';
import { Element } from '../serialization/xml-reader';
import { Scale } from '../sound-objects/piano-roll/scale';

describe('MidiInputProcessor', () => {
  describe('default state', () => {
    it('has default key mapping', () => {
      const mip = new MidiInputProcessor();
      expect(mip.getKeyMapping()).toBe('PCH');
    });

    it('has default velocity mapping', () => {
      const mip = new MidiInputProcessor();
      expect(mip.getVelocityMapping()).toBe('MIDI');
    });

    it('has empty pitch constant', () => {
      const mip = new MidiInputProcessor();
      expect(mip.getPitchConstant()).toBe('');
    });

    it('has empty amp constant', () => {
      const mip = new MidiInputProcessor();
      expect(mip.getAmpConstant()).toBe('');
    });

    it('has a default scale', () => {
      const mip = new MidiInputProcessor();
      expect(mip.getScale()).not.toBeNull();
      expect(mip.getScale()!.getNumScaleDegrees()).toBe(12);
    });
  });

  describe('loadFromXML', () => {
    it('loads keyMapping', () => {
      const xml = '<midiInputProcessor><keyMapping>MIDI</keyMapping></midiInputProcessor>';
      const elem = Element.parse(xml);
      const mip = MidiInputProcessor.loadFromXML(elem);
      expect(mip.getKeyMapping()).toBe('MIDI');
    });

    it('loads velMapping', () => {
      const xml = '<midiInputProcessor><velMapping>RAW</velMapping></midiInputProcessor>';
      const elem = Element.parse(xml);
      const mip = MidiInputProcessor.loadFromXML(elem);
      expect(mip.getVelocityMapping()).toBe('RAW');
    });

    it('loads pitchConstant', () => {
      const xml =
        '<midiInputProcessor><pitchConstant>gk_pitch</pitchConstant></midiInputProcessor>';
      const elem = Element.parse(xml);
      const mip = MidiInputProcessor.loadFromXML(elem);
      expect(mip.getPitchConstant()).toBe('gk_pitch');
    });

    it('loads ampConstant', () => {
      const xml = '<midiInputProcessor><ampConstant>gk_amp</ampConstant></midiInputProcessor>';
      const elem = Element.parse(xml);
      const mip = MidiInputProcessor.loadFromXML(elem);
      expect(mip.getAmpConstant()).toBe('gk_amp');
    });

    it('loads scale', () => {
      const xml = `
        <midiInputProcessor>
          <scale>
            <scaleName>Test</scaleName>
            <baseFrequency>440</baseFrequency>
            <octave>2</octave>
            <ratios>
              <ratio>1</ratio>
              <ratio>1.5</ratio>
            </ratios>
          </scale>
        </midiInputProcessor>`;
      const elem = Element.parse(xml);
      const mip = MidiInputProcessor.loadFromXML(elem);
      expect(mip.getScale()).not.toBeNull();
      expect(mip.getScale()!.scaleName).toBe('Test');
      expect(mip.getScale()!.baseFrequency).toBe(440);
      expect(mip.getScale()!.octave).toBe(2);
      expect(mip.getScale()!.ratios).toEqual([1, 1.5]);
    });
  });

  describe('saveAsXML', () => {
    it('saves all fields', () => {
      const mip = new MidiInputProcessor();
      mip.setKeyMapping('MIDI');
      mip.setVelocityMapping('RAW');
      mip.setPitchConstant('gk_pitch');
      mip.setAmpConstant('gk_amp');

      const xml = mip.saveAsXML();
      expect(xml.getName()).toBe('midiInputProcessor');
      expect(xml.getElement('keyMapping')?.getTextString()).toBe('MIDI');
      expect(xml.getElement('velMapping')?.getTextString()).toBe('RAW');
      expect(xml.getElement('pitchConstant')?.getTextString()).toBe('gk_pitch');
      expect(xml.getElement('ampConstant')?.getTextString()).toBe('gk_amp');
      expect(xml.getElement('scale')).not.toBeNull();
    });

    it('saves a typed scale', () => {
      const mip = new MidiInputProcessor();
      const scale = new Scale();
      scale.scaleName = 'Pentatonic';
      scale.baseFrequency = 220;
      scale.octave = 3;
      scale.ratios = [1, 1.125, 1.25];
      mip.setScale(scale);

      const xml = mip.saveAsXML();
      const scaleElem = xml.getElement('scale');
      expect(scaleElem?.getElement('scaleName')?.getTextString()).toBe('Pentatonic');
      expect(scaleElem?.getElement('baseFrequency')?.getTextString()).toBe('220');
      expect(scaleElem?.getElement('octave')?.getTextString()).toBe('3');
    });
  });

  describe('round-trip', () => {
    it('preserves data through save/load', () => {
      const original = new MidiInputProcessor();
      original.setKeyMapping('MIDI');
      original.setVelocityMapping('RAW');
      original.setPitchConstant('gk_pitch');
      original.setAmpConstant('gk_amp');

      const xml = original.saveAsXML();
      const loaded = MidiInputProcessor.loadFromXML(xml);

      expect(loaded.getKeyMapping()).toBe('MIDI');
      expect(loaded.getVelocityMapping()).toBe('RAW');
      expect(loaded.getPitchConstant()).toBe('gk_pitch');
      expect(loaded.getAmpConstant()).toBe('gk_amp');
    });

    it('preserves typed scale through save/load', () => {
      const original = new MidiInputProcessor();
      const scale = new Scale();
      scale.scaleName = 'Test Scale';
      scale.baseFrequency = 330;
      scale.octave = 2.5;
      scale.ratios = [1, 1.2, 1.333333];
      original.setScale(scale);

      const xml = original.saveAsXML();
      const loaded = MidiInputProcessor.loadFromXML(xml);

      expect(loaded.getScale()).not.toBeNull();
      expect(loaded.getScale()!.scaleName).toBe('Test Scale');
      expect(loaded.getScale()!.baseFrequency).toBe(330);
      expect(loaded.getScale()!.octave).toBe(2.5);
      expect(loaded.getScale()!.ratios).toEqual([1, 1.2, 1.333333]);
    });
  });

  describe('deepCopy', () => {
    it('copies all fields', () => {
      const original = new MidiInputProcessor();
      original.setKeyMapping('MIDI');
      original.setVelocityMapping('RAW');
      original.setPitchConstant('gk_pitch');
      const scale = new Scale();
      scale.scaleName = 'Copy Test';
      original.setScale(scale);

      const copy = original.deepCopy() as MidiInputProcessor;
      expect(copy.getKeyMapping()).toBe('MIDI');
      expect(copy.getVelocityMapping()).toBe('RAW');
      expect(copy.getPitchConstant()).toBe('gk_pitch');
      expect(copy.getScale()).not.toBeNull();
      expect(copy.getScale()!.scaleName).toBe('Copy Test');
    });
  });
});
