import { describe, it, expect } from 'vitest';
import { Channel } from './channel';
import { Element } from '../serialization/xml-reader';

describe('Channel', () => {
  it('keeps a non-automated level parameter synchronized with the channel level', () => {
    const ch = new Channel();
    ch.setLevel(-18);
    expect(ch.getLevelParameter().getFixedValue()).toBe(-18);
  });

  it('keeps a non-automated pan parameter synchronized with the channel pan (T039, T044)', () => {
    const ch = new Channel();
    expect(ch.getPan()).toBe(0.5);
    expect(ch.getPanParameter().getFixedValue()).toBe(0.5);

    ch.setPan(0.25);
    expect(ch.getPan()).toBe(0.25);
    expect(ch.getPanParameter().getFixedValue()).toBe(0.25);
  });

  describe('saveAsXML and loadFromXML with Pan Parameter (T039, T044)', () => {
    it('does not write <volume> element', () => {
      const ch = new Channel();
      ch.setVolume(0.75);
      const xml = ch.saveAsXML().toXml();
      expect(xml).not.toContain('<volume>');
    });

    it('writes <pan> element and Pan Parameter', () => {
      const ch = new Channel();
      ch.setPan(0.25);
      const xml = ch.saveAsXML().toXml();
      expect(xml).toContain('<pan>0.25</pan>');
      expect(xml).toContain('<parameter');
      expect(xml).toContain('name="Pan"');
      expect(xml).toContain('name="Volume"');
    });

    it('writes level with decimal point', () => {
      const ch = new Channel();
      ch.setLevel(0);
      const xml = ch.saveAsXML().toXml();
      expect(xml).toContain('<level>0.0</level>');
    });

    it('writes muted and solo as child elements matching Java format', () => {
      const ch = new Channel();
      ch.setMuted(true);
      ch.setSolo(true);
      const xml = ch.saveAsXML().toXml();
      expect(xml).toContain('<muted>true</muted>');
      expect(xml).toContain('<solo>true</solo>');
    });

    it('loads legacy Java-format channel XML without pan or pan parameter', () => {
      const xml = `<channel>
        <name>Test</name>
        <outChannel>Master</outChannel>
        <level>-6.0</level>
        <muted>false</muted>
        <solo>false</solo>
        <effectsChain bin="pre"/>
        <effectsChain bin="post"/>
        <parameter name="Volume" label="dB" min="-96.0" max="12.0" value="-6.0">
          <line name="" version="2" max="12.0" min="-96.0" bdresolution="-1" color="-8355712" rightBound="false" endPointsLinked="false"/>
        </parameter>
      </channel>`;
      const ch = Channel.loadFromXML(Element.parse(xml));
      expect(ch.getName()).toBe('Test');
      expect(ch.getOutChannel()).toBe('Master');
      expect(ch.getLevel()).toBe(-6.0);
      expect(ch.getLevelParameter().getName()).toBe('Volume');
      expect(ch.getLevelParameter().getFixedValue()).toBe(-6.0);
      // Legacy file defaults pan to center 0.5 with a non-automated Pan parameter
      expect(ch.getPan()).toBe(0.5);
      expect(ch.getPanParameter().getName()).toBe('Pan');
      expect(ch.getPanParameter().getFixedValue()).toBe(0.5);
    });

    it('round-trips Channel XML with level, pan, and both parameters intact', () => {
      const ch = new Channel();
      ch.setName('Ch1');
      ch.setLevel(-3.0);
      ch.setPan(0.75);
      const savedXml = ch.saveAsXML();
      const loaded = Channel.loadFromXML(savedXml);

      expect(loaded.getName()).toBe('Ch1');
      expect(loaded.getLevel()).toBe(-3.0);
      expect(loaded.getPan()).toBe(0.75);
      expect(loaded.getLevelParameter().getFixedValue()).toBe(-3.0);
      expect(loaded.getPanParameter().getFixedValue()).toBe(0.75);
    });

    it('falls back to center 0.5 for invalid XML pan values', () => {
      for (const invalid of ['abc', '-1', '2.5', 'NaN', 'Infinity']) {
        const xml = `<channel><name>Test</name><pan>${invalid}</pan></channel>`;
        const ch = Channel.loadFromXML(Element.parse(xml));
        expect(ch.getPan()).toBe(0.5);
      }
    });

    it('preserves pan and panParameter in deepCopy', () => {
      const ch = new Channel();
      ch.setPan(0.3);
      ch.getPanParameter().setResolution(0.01);

      const copy = ch.deepCopy() as Channel;
      expect(copy.getPan()).toBe(0.3);
      expect(copy.getPanParameter().getFixedValue()).toBe(0.3);
      expect(copy.getPanParameter().getResolution()).toBe(0.01);
      // Ensure it is a distinct deep copy
      copy.setPan(0.8);
      expect(ch.getPan()).toBe(0.3);
      expect(copy.getPan()).toBe(0.8);
    });
  });
});
