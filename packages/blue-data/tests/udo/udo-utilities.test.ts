import { describe, it, expect } from 'vitest';
import {
  parseUDOText,
  parseUDODeclaration,
  convertToModern,
  convertToClassic,
} from '../../src/opcodes/udo-utilities';
import {
  getModernOutputSignature,
  getModernOutTypesDisplay,
  getInTypesFromInputArguments,
  normalizeModernOutTypes,
  normalizeClassicOutTypes,
} from '../../src/opcodes/udo-type-utils';
import { OpcodeDefinition } from '../../src/opcodes/opcode-definition';
import { OpcodeList } from '../../src/opcodes/opcode-list';
import { UDOStyle } from '../../src/opcodes/udo-style';
import { Element } from '../../src/serialization/xml-reader';

describe('UDOUtilities', () => {
  // ─── Parsing Modern UDO Text ───

  it('parses modern UDO text', () => {
    const text = `opcode saturate(aSig, kDrive):a
    aOut = tanh(aSig * kDrive)
    xout aOut
endop`;
    const list = parseUDOText(text);
    expect(list.size()).toBe(1);
    const udo = list.getOpcode(0)!;
    expect(udo.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo.getName()).toBe('saturate');
    expect(udo.getInputArguments()).toBe('aSig, kDrive');
    expect(udo.getOutTypes()).toBe('a');
    expect(getInTypesFromInputArguments(udo.getInputArguments())).toBe('ak');
  });

  it('parses modern UDO with annotated args and spaced colon', () => {
    const text = `opcode annotated(kIn1:o, kIn2:j) : a
    xout kIn1 + kIn2
endop`;
    const list = parseUDOText(text);
    expect(list.size()).toBe(1);
    const udo = list.getOpcode(0)!;
    expect(udo.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo.getInputArguments()).toBe('kIn1:o, kIn2:j');
    expect(udo.getOutTypes()).toBe('a');
    expect(getInTypesFromInputArguments(udo.getInputArguments())).toBe('oj');
  });

  it('parses modern UDO when colon starts next line', () => {
    const text = `opcode nextLineColon(aSig, kDrive)
: (a, a)
    aL = aSig
    aR = aSig * kDrive
    xout aL, aR
endop`;
    const list = parseUDOText(text);
    expect(list.size()).toBe(1);
    const udo = list.getOpcode(0)!;
    expect(udo.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo.getInputArguments()).toBe('aSig, kDrive');
    expect(udo.getOutTypes()).toBe('a, a');
  });

  it('recovers when broken modern header is followed by another opcode', () => {
    const text = `opcode broken(
this is not a valid header
opcode next, a, a
    xout 1
endop`;
    const list = parseUDOText(text);
    expect(list.size()).toBe(1);
    const udo = list.getOpcode(0)!;
    expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo.getName()).toBe('next');
    expect(udo.getOutTypes()).toBe('a');
    expect(udo.getInTypes()).toBe('a');
  });

  // ─── Parsing Classic UDO Text ───

  it('parses classic UDO text', () => {
    const text = `opcode saturate, a, ak
    aSig, kDrive    xin
    aOut = tanh(aSig * kDrive)
    xout aOut
    endop`;
    const list = parseUDOText(text);
    expect(list.size()).toBe(1);
    const udo = list.getOpcode(0)!;
    expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo.getName()).toBe('saturate');
    expect(udo.getOutTypes()).toBe('a');
    expect(udo.getInTypes()).toBe('ak');
  });

  // ─── Classic → Modern Conversion ───

  it('converts classic to modern using xin arguments', () => {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setName('test');
    udo.setOutTypes('a');
    udo.setInTypes('ak');
    udo.setCode('aSig, kDrive\txin\naOut = tanh(aSig * kDrive)\nxout aOut');

    convertToModern(udo);

    expect(udo.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo.getInputArguments()).toBe('aSig, kDrive');
    expect(udo.getInTypes()).toBe('');
    // xin line should be removed from code body
    expect(udo.getCode()).not.toContain('xin');
    expect(udo.getCode()).toContain('aOut = tanh(aSig * kDrive)');
  });

  it('converts classic to modern preserving legacy input kinds', () => {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setName('test');
    udo.setOutTypes('a');
    udo.setInTypes('oj');
    udo.setCode('kIn1, kIn2\txin\nxout kIn1 + kIn2');

    convertToModern(udo);

    expect(udo.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo.getInputArguments()).toBe('kIn1:o, kIn2:j');
  });

  it('converts classic to modern with multiple outputs', () => {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setOutTypes('aa');
    udo.setInTypes('a');
    udo.setCode('xout 1, 2');

    convertToModern(udo);

    expect(udo.getOutTypes()).toBe('a, a');
  });

  it('converts classic zero output to modern void', () => {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setOutTypes('0');
    udo.setInTypes('S');
    udo.setCode('prints Smsg');

    convertToModern(udo);

    expect(udo.getOutTypes()).toBe('');
    const code = udo.generateCode();
    expect(code).toContain(':void');
  });

  // ─── Modern → Classic Conversion ───

  it('converts modern to classic', () => {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.MODERN);
    udo.setName('test');
    udo.setInputArguments('aSig, kDrive');
    udo.setOutTypes('a');
    udo.setCode('aOut = tanh(aSig * kDrive)\nxout aOut');

    convertToClassic(udo);

    expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo.getInTypes()).toBe('ak');
    expect(udo.getInputArguments()).toBe('');
    expect(udo.getCode()).toContain('aSig, kDrive\txin');
    expect(udo.getOutTypes()).toBe('a');
  });

  it('converts annotated modern to classic without keeping annotations in xin', () => {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.MODERN);
    udo.setName('test');
    udo.setInputArguments('kIn1:o, kIn2:j');
    udo.setOutTypes('a');
    udo.setCode('xout kIn1 + kIn2');

    convertToClassic(udo);

    expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo.getInTypes()).toBe('oj');
    // xin line should have bare names (no :o or :j)
    expect(udo.getCode()).toContain('kIn1, kIn2\txin');
    expect(udo.getCode()).not.toContain('kIn1:o');
  });

  it('converts modern void to classic zero', () => {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('SMsg');
    udo.setOutTypes('');
    udo.setCode('prints SMsg');

    convertToClassic(udo);

    expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo.getOutTypes()).toBe('0');
    expect(udo.getInTypes()).toBe('S');
  });

  // ─── XML Round-Trip ───

  it('saves loads and generates modern UDO', () => {
    const udo = new OpcodeDefinition();
    udo.setName('stereo_width');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('aSig, kWidth');
    udo.setOutTypes('a, a');
    udo.setCode('aL = aSig\naR = aSig * kWidth\nxout aL, aR');

    const xml = udo.saveAsXML();
    const loaded = OpcodeDefinition.loadFromXML(xml);

    expect(loaded.getStyle()).toBe(UDOStyle.MODERN);
    expect(loaded.getInputArguments()).toBe('aSig, kWidth');
    expect(loaded.getOutTypes()).toBe('a, a');

    const code = loaded.generateCode();
    expect(code).toContain('opcode stereo_width(aSig, kWidth):(a,a)');
  });

  it('parsed modern UDO remains equivalent after XML round-trip', () => {
    const text = `opcode fx(aSig, kDrive):a
    aOut = tanh(aSig * kDrive)
    xout aOut
endop`;
    const list = parseUDOText(text);
    const original = list.getOpcode(0)!;

    const xml = original.saveAsXML();
    const loaded = OpcodeDefinition.loadFromXML(xml);

    expect(original.isEquivalent(loaded)).toBe(true);
  });

  // ─── Equivalence with Spacing ───

  it('modern equivalent comparison ignores outType spacing', () => {
    const list = new OpcodeList();
    const a = new OpcodeDefinition();
    a.setName('fx');
    a.setStyle(UDOStyle.MODERN);
    a.setInputArguments('aSig, kDrive');
    a.setOutTypes('a, a');
    a.setCode('xout 1');
    list.addOpcode(a);

    const b = new OpcodeDefinition();
    b.setName('fx2');
    b.setStyle(UDOStyle.MODERN);
    b.setInputArguments('aSig, kDrive');
    b.setOutTypes('a,a');
    b.setCode('xout 1');

    expect(list.getNameOfEquivalentCopy(b)).toBe('fx');
  });

  // ─── Void and Empty Output ───

  it('parses modern UDO with void output', () => {
    const text = `opcode logMsg(SMsg):void
    prints SMsg
endop`;
    const list = parseUDOText(text);
    const udo = list.getOpcode(0)!;
    expect(udo.getOutTypes()).toBe('');
    const code = udo.generateCode();
    expect(code).toContain('opcode logMsg(SMsg):void');
  });

  it('parses modern UDO with empty output list', () => {
    const text = `opcode logMsg(SMsg):()
    prints SMsg
endop`;
    const list = parseUDOText(text);
    const udo = list.getOpcode(0)!;
    expect(udo.getOutTypes()).toBe('');
    const code = udo.generateCode();
    expect(code).toContain('opcode logMsg(SMsg):void');
  });

  it('parses modern UDO with multiple output types', () => {
    const text = `opcode stereoSplit(aSig, kPan):(a, a)
    aL = aSig * (1 - kPan)
    aR = aSig * kPan
    xout aL, aR
endop`;
    const list = parseUDOText(text);
    const udo = list.getOpcode(0)!;
    expect(udo.getOutTypes()).toBe('a, a');
    const code = udo.generateCode();
    expect(code).toContain('opcode stereoSplit(aSig, kPan):(a,a)');
  });

  // ─── Output Signature ───

  it('modern output signature handles all cases', () => {
    expect(getModernOutputSignature('void')).toBe('void');
    expect(getModernOutputSignature('0')).toBe('void');
    expect(getModernOutputSignature('')).toBe('void');
    expect(getModernOutputSignature('()')).toBe('void');
    expect(getModernOutputSignature('a')).toBe('a');
    expect(getModernOutputSignature('a, k')).toBe('(a,k)');
  });

  // ─── Display String ───

  it('modern outTypes display uses void for zero output', () => {
    expect(getModernOutTypesDisplay('void')).toBe('void');
    expect(getModernOutTypesDisplay('0')).toBe('void');
    expect(getModernOutTypesDisplay('')).toBe('void');
    expect(getModernOutTypesDisplay('()')).toBe('void');
    expect(getModernOutTypesDisplay('a, a')).toBe('a, a');
  });

  // ─── Code Generation Formatting ───

  it('modern generate code uses flush header and indented body', () => {
    const udo = new OpcodeDefinition();
    udo.setName('logMsg');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('SMsg');
    udo.setOutTypes('');
    udo.setCode('prints SMsg');

    const code = udo.generateCode();
    expect(code).toContain('opcode logMsg(SMsg):void\n');
    expect(code).toContain('    prints SMsg');
    expect(code).toContain('\nendop');
    // No tab indentation
    expect(code).not.toContain('\t');
  });

  // ─── XML Void Serialization ───

  it('saves modern void outTypes as void text in XML', () => {
    const udo = new OpcodeDefinition();
    udo.setName('logMsg');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('SMsg');
    udo.setOutTypes('');
    udo.setCode('prints SMsg');

    const xml = udo.saveAsXML();
    // Check that XML contains <outTypes>void</outTypes>
    const outTypesElem = xml.getElement('outTypes');
    expect(outTypesElem?.getTextString()).toBe('void');

    // Reload and verify
    const loaded = OpcodeDefinition.loadFromXML(xml);
    expect(loaded.getOutTypes()).toBe('');
    expect(loaded.generateCode()).toContain(':void');
  });

  // ─── parseUDODeclaration ───

  it('parseUDODeclaration returns null for non-opcode lines', () => {
    expect(parseUDODeclaration('instr 1')).toBeNull();
    expect(parseUDODeclaration('xout 1')).toBeNull();
  });

  it('parseUDODeclaration parses classic header', () => {
    const udo = parseUDODeclaration('opcode test, a, ak');
    expect(udo).not.toBeNull();
    expect(udo!.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo!.getName()).toBe('test');
    expect(udo!.getOutTypes()).toBe('a');
    expect(udo!.getInTypes()).toBe('ak');
  });

  it('parseUDODeclaration parses modern header', () => {
    const udo = parseUDODeclaration('opcode saturate(aSig, kDrive):a');
    expect(udo).not.toBeNull();
    expect(udo!.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo!.getName()).toBe('saturate');
    expect(udo!.getInputArguments()).toBe('aSig, kDrive');
    expect(udo!.getOutTypes()).toBe('a');
  });
});
