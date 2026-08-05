import { describe, it, expect } from 'vitest';
import { Channel } from './channel';
import { Element } from '../serialization/xml-reader';

describe('Channel', () => {
  it('keeps a non-automated level parameter synchronized with the channel level', () => {
    const ch = new Channel();

    ch.setLevel(-18);

    expect(ch.getLevelParameter().getFixedValue()).toBe(-18);
  });

  describe('saveAsXML Java parity', () => {
    it('does not write <volume> element', () => {
      const ch = new Channel();
      ch.setVolume(0.75);
      const xml = ch.saveAsXML().toXml();
      expect(xml).not.toContain('<volume>');
    });

    it('does not write <pan> element', () => {
      const ch = new Channel();
      ch.setPan(0.25);
      const xml = ch.saveAsXML().toXml();
      expect(xml).not.toContain('<pan>');
    });

    it('writes level with decimal point (e.g. "0.0" not "0")', () => {
      const ch = new Channel();
      ch.setLevel(0);
      const xml = ch.saveAsXML().toXml();
      expect(xml).toContain('<level>0.0</level>');
    });

    it('writes muted as child element matching Java format', () => {
      const ch = new Channel();
      ch.setMuted(true);
      const xml = ch.saveAsXML().toXml();
      expect(xml).toContain('<muted>true</muted>');
    });

    it('writes solo as child element matching Java format', () => {
      const ch = new Channel();
      ch.setSolo(true);
      const xml = ch.saveAsXML().toXml();
      expect(xml).toContain('<solo>true</solo>');
    });
  });

  describe('loadFromXML Java parity', () => {
    it('loads Java-format channel XML (no volume/pan)', () => {
      const xml = `<channel>
        <name>Test</name>
        <outChannel>Master</outChannel>
        <level>-6.0</level>
        <muted>false</muted>
        <solo>false</solo>
        <effectsChain bin="pre"/>
        <effectsChain bin="post"/>
      </channel>`;
      const ch = Channel.loadFromXML(Element.parse(xml));
      expect(ch.getName()).toBe('Test');
      expect(ch.getOutChannel()).toBe('Master');
      expect(ch.getLevel()).toBe(-6.0);
    });

    it('round-trips Java-format channel XML without adding spurious elements', () => {
      const javaXml = `<channel><name>Ch1</name><outChannel>Master</outChannel><level>-3.0</level><muted>false</muted><solo>false</solo><effectsChain bin="pre"/><effectsChain bin="post"/></channel>`;
      const ch = Channel.loadFromXML(Element.parse(javaXml));
      const saved = ch.saveAsXML().toXml();
      expect(saved).not.toContain('<volume>');
      expect(saved).not.toContain('<pan>');
      expect(saved).toContain('<level>-3.0</level>');
    });
  });
});
