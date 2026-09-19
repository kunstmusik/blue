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

    describe('stereo pan mode persistence, validation, and copy (T019)', () => {
      it('has exact defaults: Balance, Width 1, Dual Left 0, Dual Right 1', () => {
        const ch = new Channel();
        expect(ch.getStereoPanMode()).toBe('balance');
        expect(ch.getPanWidth()).toBe(1.0);
        expect(ch.getDualPanLeft()).toBe(0.0);
        expect(ch.getDualPanRight()).toBe(1.0);

        const widthParam = ch.getPanWidthParameter();
        expect(widthParam.getName()).toBe('Width');
        expect(widthParam.getFixedValue()).toBe(1.0);
        expect(widthParam.getMinimum()).toBe(0.0);
        expect(widthParam.getMaximum()).toBe(1.0);

        const dualLeftParam = ch.getDualPanLeftParameter();
        expect(dualLeftParam.getName()).toBe('Dual Left');
        expect(dualLeftParam.getFixedValue()).toBe(0.0);
        expect(dualLeftParam.getMinimum()).toBe(0.0);
        expect(dualLeftParam.getMaximum()).toBe(1.0);

        const dualRightParam = ch.getDualPanRightParameter();
        expect(dualRightParam.getName()).toBe('Dual Right');
        expect(dualRightParam.getFixedValue()).toBe(1.0);
        expect(dualRightParam.getMinimum()).toBe(0.0);
        expect(dualRightParam.getMaximum()).toBe(1.0);
      });

      it('enforces finite [0, 1] validation on Width, Dual Left, and Dual Right setters', () => {
        const ch = new Channel();

        // Valid setters
        ch.setPanWidth(0.3);
        expect(ch.getPanWidth()).toBe(0.3);
        ch.setDualPanLeft(0.1);
        expect(ch.getDualPanLeft()).toBe(0.1);
        ch.setDualPanRight(0.9);
        expect(ch.getDualPanRight()).toBe(0.9);

        // Out of range or non-finite values are rejected (value unchanged)
        ch.setPanWidth(-0.2);
        expect(ch.getPanWidth()).toBe(0.3);
        ch.setPanWidth(1.5);
        expect(ch.getPanWidth()).toBe(0.3);
        ch.setPanWidth(NaN);
        expect(ch.getPanWidth()).toBe(0.3);

        ch.setDualPanLeft(-0.5);
        expect(ch.getDualPanLeft()).toBe(0.1);
        ch.setDualPanLeft(1.2);
        expect(ch.getDualPanLeft()).toBe(0.1);
        ch.setDualPanLeft(NaN);
        expect(ch.getDualPanLeft()).toBe(0.1);

        ch.setDualPanRight(-0.1);
        expect(ch.getDualPanRight()).toBe(0.9);
        ch.setDualPanRight(1.4);
        expect(ch.getDualPanRight()).toBe(0.9);
        ch.setDualPanRight(NaN);
        expect(ch.getDualPanRight()).toBe(0.9);

        // Mode fallback
        ch.setStereoPanMode('invalid' as any);
        expect(ch.getStereoPanMode()).toBe('balance');
      });

      it('preserves all stored stereo values across mode switches', () => {
        const ch = new Channel();
        ch.setPan(0.35);
        ch.setPanWidth(0.7);
        ch.setDualPanLeft(0.2);
        ch.setDualPanRight(0.8);

        ch.setStereoPanMode('stereoPan');
        expect(ch.getPan()).toBe(0.35);
        expect(ch.getPanWidth()).toBe(0.7);
        expect(ch.getDualPanLeft()).toBe(0.2);
        expect(ch.getDualPanRight()).toBe(0.8);

        ch.setStereoPanMode('dualPan');
        expect(ch.getPan()).toBe(0.35);
        expect(ch.getPanWidth()).toBe(0.7);
        expect(ch.getDualPanLeft()).toBe(0.2);
        expect(ch.getDualPanRight()).toBe(0.8);

        ch.setStereoPanMode('balance');
        expect(ch.getPan()).toBe(0.35);
        expect(ch.getPanWidth()).toBe(0.7);
        expect(ch.getDualPanLeft()).toBe(0.2);
        expect(ch.getDualPanRight()).toBe(0.8);
      });

      it('maintains stable parameter identities across accesses', () => {
        const ch = new Channel();
        expect(ch.getPanWidthParameter()).toBe(ch.getPanWidthParameter());
        expect(ch.getDualPanLeftParameter()).toBe(ch.getDualPanLeftParameter());
        expect(ch.getDualPanRightParameter()).toBe(ch.getDualPanRightParameter());

        const ids = new Set([
          ch.getLevelParameter().getUniqueId(),
          ch.getPanParameter().getUniqueId(),
          ch.getPanWidthParameter().getUniqueId(),
          ch.getDualPanLeftParameter().getUniqueId(),
          ch.getDualPanRightParameter().getUniqueId(),
        ]);
        expect(ids.size).toBe(5);
      });

      it('falls back safely for missing or invalid XML stereo pan fields', () => {
        const xml = `<channel>
          <name>Test</name>
          <stereoPanMode>bogus</stereoPanMode>
          <panWidth>2.5</panWidth>
          <dualPanLeft>-1.0</dualPanLeft>
          <dualPanRight>xyz</dualPanRight>
        </channel>`;
        const ch = Channel.loadFromXML(Element.parse(xml));
        expect(ch.getStereoPanMode()).toBe('balance');
        expect(ch.getPanWidth()).toBe(1.0);
        expect(ch.getDualPanLeft()).toBe(0.0);
        expect(ch.getDualPanRight()).toBe(1.0);
      });

      it('rejects trailing garbage in numeric fields with safe default fallback', () => {
        const xml = `<channel>
          <name>Test</name>
          <pan>0.5trailing</pan>
          <panWidth>0.8xyz</panWidth>
          <dualPanLeft>0.2abc</dualPanLeft>
          <dualPanRight>0.9garbage</dualPanRight>
        </channel>`;
        const ch = Channel.loadFromXML(Element.parse(xml));
        expect(ch.getPan()).toBe(0.5);
        expect(ch.getPanWidth()).toBe(1.0);
        expect(ch.getDualPanLeft()).toBe(0.0);
        expect(ch.getDualPanRight()).toBe(1.0);
      });

      it('round-trips stereo modes and dispatches known parameter tags explicitly', () => {
        const ch = new Channel();
        ch.setName('StereoCh');
        ch.setStereoPanMode('stereoPan');
        ch.setPan(0.4);
        ch.setPanWidth(0.65);
        ch.setDualPanLeft(0.15);
        ch.setDualPanRight(0.85);

        const xml = ch.saveAsXML();
        const loaded = Channel.loadFromXML(xml);

        expect(loaded.getStereoPanMode()).toBe('stereoPan');
        expect(loaded.getPan()).toBe(0.4);
        expect(loaded.getPanWidth()).toBe(0.65);
        expect(loaded.getDualPanLeft()).toBe(0.15);
        expect(loaded.getDualPanRight()).toBe(0.85);

        expect(loaded.getPanParameter().getFixedValue()).toBe(0.4);
        expect(loaded.getPanWidthParameter().getFixedValue()).toBe(0.65);
        expect(loaded.getDualPanLeftParameter().getFixedValue()).toBe(0.15);
        expect(loaded.getDualPanRightParameter().getFixedValue()).toBe(0.85);
      });

      it('preserves stereo values and isolates parameters in deepCopy', () => {
        const ch = new Channel();
        ch.setStereoPanMode('dualPan');
        ch.setPanWidth(0.42);
        ch.setDualPanLeft(0.18);
        ch.setDualPanRight(0.82);

        const copy = ch.deepCopy() as Channel;
        expect(copy.getStereoPanMode()).toBe('dualPan');
        expect(copy.getPanWidth()).toBe(0.42);
        expect(copy.getDualPanLeft()).toBe(0.18);
        expect(copy.getDualPanRight()).toBe(0.82);

        expect(copy.getPanWidthParameter()).not.toBe(ch.getPanWidthParameter());
        expect(copy.getDualPanLeftParameter()).not.toBe(ch.getDualPanLeftParameter());
        expect(copy.getDualPanRightParameter()).not.toBe(ch.getDualPanRightParameter());

        copy.setPanWidth(0.99);
        expect(ch.getPanWidth()).toBe(0.42);
        expect(copy.getPanWidth()).toBe(0.99);
      });
    });
  });
});
