import { describe, it, expect } from 'vitest';
import { OpcodeDefinition } from '../../src/opcodes/opcode-definition';
import { UDOStyle } from '../../src/opcodes/udo-style';
import { parseUDOText } from '../../src/opcodes/udo-utilities';
import { Element } from '../../src/serialization/xml-reader';

describe('UDO import/export', () => {
  describe('Blue UDO export and import round-trip', () => {
    it('round-trips a classic UDO through XML save and load', () => {
      const udo = new OpcodeDefinition();
      udo.setName('saturate');
      udo.setStyle(UDOStyle.CLASSIC);
      udo.setOutTypes('a');
      udo.setInTypes('ak');
      udo.setCode('aSig, kDrive xin\naOut = tanh(aSig * kDrive)\nxout aOut');
      udo.setComments('a saturator');

      const xml = udo.saveAsXML();
      const xmlString = xml.toXml();

      const root = Element.parse(xmlString);
      const loaded = OpcodeDefinition.loadFromXML(root);

      expect(loaded.getName()).toBe('saturate');
      expect(loaded.getStyle()).toBe(UDOStyle.CLASSIC);
      expect(loaded.getOutTypes()).toBe('a');
      expect(loaded.getInTypes()).toBe('ak');
      expect(loaded.getCode()).toBe('aSig, kDrive xin\naOut = tanh(aSig * kDrive)\nxout aOut');
      expect(loaded.getComments()).toBe('a saturator');
    });

    it('round-trips a modern UDO through XML save and load', () => {
      const udo = new OpcodeDefinition();
      udo.setName('stereo_width');
      udo.setStyle(UDOStyle.MODERN);
      udo.setOutTypes('a, a');
      udo.setInputArguments('aSig, kWidth');
      udo.setCode('aLeft = aSig * (1 - kWidth)\naRight = aSig * (1 + kWidth)\nxout aLeft, aRight');

      const xmlString = udo.saveAsXML().toXml();
      const root = Element.parse(xmlString);
      const loaded = OpcodeDefinition.loadFromXML(root);

      expect(loaded.getName()).toBe('stereo_width');
      expect(loaded.getStyle()).toBe(UDOStyle.MODERN);
      expect(loaded.getInputArguments()).toBe('aSig, kWidth');
    });
  });

  describe('Csound UDO import via parseUDOText', () => {
    it('parses a classic UDO text block', () => {
      const text =
        'opcode saturate, a, ak\naSig, kDrive xin\naOut = tanh(aSig * kDrive)\nxout aOut\nendop';
      const result = parseUDOText(text);
      expect(result.size()).toBe(1);
      const udo = result.getOpcode(0)!;
      expect(udo.getName()).toBe('saturate');
      expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
      expect(udo.getOutTypes()).toBe('a');
      expect(udo.getInTypes()).toBe('ak');
    });

    it('parses a modern UDO text block', () => {
      const text =
        'opcode stereo_width(aSig, kWidth):(a, a)\naLeft = aSig * (1 - kWidth)\naRight = aSig * (1 + kWidth)\nxout aLeft, aRight\nendop';
      const result = parseUDOText(text);
      expect(result.size()).toBe(1);
      const udo = result.getOpcode(0)!;
      expect(udo.getName()).toBe('stereo_width');
      expect(udo.getStyle()).toBe(UDOStyle.MODERN);
      expect(udo.getInputArguments()).toContain('aSig');
    });

    it('parses multiple UDOs from one file', () => {
      const text = [
        'opcode foo, a, k',
        'aOut = foo(kIn)',
        'xout aOut',
        'endop',
        '',
        'opcode bar, k, k',
        'kOut = bar(kIn)',
        'xout kOut',
        'endop',
      ].join('\n');
      const result = parseUDOText(text);
      expect(result.size()).toBe(2);
      expect(result.getOpcode(0)!.getName()).toBe('foo');
      expect(result.getOpcode(1)!.getName()).toBe('bar');
    });

    it('parses a UDO with void output', () => {
      const text = 'opcode logMsg, 0, S\nprints SMsg\nendop';
      const result = parseUDOText(text);
      expect(result.size()).toBe(1);
      const udo = result.getOpcode(0)!;
      expect(udo.getName()).toBe('logMsg');
      expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    });
  });

  describe('OpcodeDefinition.generateCode for export', () => {
    it('generates proper classic opcode output', () => {
      const udo = new OpcodeDefinition();
      udo.setName('saturate');
      udo.setStyle(UDOStyle.CLASSIC);
      udo.setOutTypes('a');
      udo.setInTypes('ak');
      udo.setCode('aOut = tanh(aSig * kDrive)\nxout aOut');

      const code = udo.generateCode();
      expect(code).toContain('opcode saturate,a,ak');
      expect(code).toContain('aOut = tanh(aSig * kDrive)');
      expect(code).toContain('endop');
    });

    it('generates proper modern opcode output', () => {
      const udo = new OpcodeDefinition();
      udo.setName('stereo_width');
      udo.setStyle(UDOStyle.MODERN);
      udo.setOutTypes('a, a');
      udo.setInputArguments('aSig, kWidth');
      udo.setCode('aLeft = aSig * (1 - kWidth)\naRight = aSig * (1 + kWidth)\nxout aLeft, aRight');

      const code = udo.generateCode();
      expect(code).toContain('opcode stereo_width(aSig, kWidth):(a,a)');
      expect(code).toContain('xout aLeft, aRight');
      expect(code).toContain('endop');
    });
  });
});
