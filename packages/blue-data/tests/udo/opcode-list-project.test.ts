import { describe, it, expect } from 'vite-plus/test';
import { OpcodeList } from '../../src/opcodes/opcode-list';
import { OpcodeDefinition } from '../../src/opcodes/opcode-definition';
import { UDOStyle } from '../../src/opcodes/udo-style';
import { convertToModern, convertToClassic } from '../../src/opcodes/udo-utilities';

function makeUdo(name: string, style: UDOStyle = UDOStyle.CLASSIC): OpcodeDefinition {
  const udo = new OpcodeDefinition();
  udo.setName(name);
  udo.setStyle(style);
  udo.setOutTypes('a');
  udo.setInTypes('ak');
  udo.setCode('xout 1');
  return udo;
}

describe('OpcodeList mutations for project UDO editing', () => {
  it('addOpcodeAt inserts at correct position', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('a'));
    list.addOpcode(makeUdo('c'));
    list.addOpcodeAt(1, makeUdo('b'));
    expect(list.getOpcode(1)!.getName()).toBe('b');
    expect(list.size()).toBe(3);
  });

  it('removeOpcodeAt returns false for out-of-bounds', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('a'));
    expect(list.removeOpcodeAt(5)).toBe(false);
    expect(list.removeOpcodeAt(-1)).toBe(false);
    expect(list.size()).toBe(1);
  });

  it('replaceOpcodeAt replaces in place', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('a'));
    list.addOpcode(makeUdo('b'));
    const replacement = makeUdo('c');
    expect(list.replaceOpcodeAt(1, replacement)).toBe(true);
    expect(list.getOpcode(1)!.getName()).toBe('c');
  });

  it('moveOpcode reorders items', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('a'));
    list.addOpcode(makeUdo('b'));
    list.addOpcode(makeUdo('c'));
    expect(list.moveOpcode(0, 2)).toBe(true);
    expect(list.getOpcode(0)!.getName()).toBe('b');
    expect(list.getOpcode(1)!.getName()).toBe('c');
    expect(list.getOpcode(2)!.getName()).toBe('a');
  });

  it('moveOpcode returns false for invalid indices', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('a'));
    expect(list.moveOpcode(-1, 0)).toBe(false);
    expect(list.moveOpcode(0, 5)).toBe(false);
  });

  it('moveOpcode is no-op for same index', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('a'));
    expect(list.moveOpcode(0, 0)).toBe(true);
    expect(list.getOpcode(0)!.getName()).toBe('a');
  });

  it('addAll deep-copies from another list', () => {
    const list1 = new OpcodeList();
    list1.addOpcode(makeUdo('a'));
    list1.addOpcode(makeUdo('b'));

    const list2 = new OpcodeList();
    list2.addAll(list1);

    expect(list2.size()).toBe(2);
    expect(list2.getOpcode(0)!.getName()).toBe('a');
    expect(list2.getOpcode(1)!.getName()).toBe('b');

    list2.getOpcode(0)!.setName('modified');
    expect(list1.getOpcode(0)!.getName()).toBe('a');
  });

  it('getOpcodes returns shallow copy', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('a'));
    const opcodes = list.getOpcodes();
    opcodes.length = 0;
    expect(list.size()).toBe(1);
  });

  it('XML round-trip preserves order', () => {
    const list = new OpcodeList();
    list.addOpcode(makeUdo('first'));
    list.addOpcode(makeUdo('second'));
    list.addOpcode(makeUdo('third'));

    const xml = list.saveAsXML();
    const loaded = OpcodeList.loadFromXML(xml);

    expect(loaded.size()).toBe(3);
    expect(loaded.getOpcode(0)!.getName()).toBe('first');
    expect(loaded.getOpcode(1)!.getName()).toBe('second');
    expect(loaded.getOpcode(2)!.getName()).toBe('third');
  });
});

describe('OpcodeDefinition style conversion for project UDO', () => {
  it('converts classic to modern and back', () => {
    const udo = new OpcodeDefinition();
    udo.setName('saturate');
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setOutTypes('a');
    udo.setInTypes('ak');
    udo.setCode('aSig, kDrive xin\naOut = tanh(aSig * kDrive)\nxout aOut');

    convertToModern(udo);
    expect(udo.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo.getInputArguments()).toContain('aSig');
    expect(udo.getInputArguments()).toContain('kDrive');
    expect(udo.getCode()).not.toContain('xin');

    convertToClassic(udo);
    expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo.getInTypes()).toBe('ak');
    expect(udo.getCode()).toContain('xin');
  });

  it('deepCopy produces independent clone', () => {
    const udo = makeUdo('original');
    const copy = udo.deepCopy();
    copy.setName('modified');
    expect(udo.getName()).toBe('original');
  });
});
