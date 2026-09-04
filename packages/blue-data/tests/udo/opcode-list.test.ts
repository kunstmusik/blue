import { describe, it, expect } from 'vitest';
import { OpcodeList } from '../../src/opcodes/opcode-list';
import { OpcodeDefinition } from '../../src/opcodes/opcode-definition';
import { UDOStyle } from '../../src/opcodes/udo-style';
import { Element } from '../../src/serialization/xml-reader';

describe('OpcodeList', () => {
  it('getNameOfEquivalentCopy finds classic equivalent', () => {
    const list = new OpcodeList();

    const udo1 = new OpcodeDefinition();
    udo1.setName('test1');
    udo1.setStyle(UDOStyle.CLASSIC);
    udo1.setOutTypes('i');
    udo1.setInTypes('i');
    udo1.setCode('code');
    list.addOpcode(udo1);

    // Same code/types, different name
    const udo2 = new OpcodeDefinition();
    udo2.setName('test2');
    udo2.setStyle(UDOStyle.CLASSIC);
    udo2.setOutTypes('i');
    udo2.setInTypes('i');
    udo2.setCode('code');

    expect(list.getNameOfEquivalentCopy(udo2)).toBe('test1');
    expect(list.getNameOfEquivalentCopy(null as unknown as OpcodeDefinition)).toBeNull();

    // Different code
    udo2.setCode('code2');
    expect(list.getNameOfEquivalentCopy(udo2)).toBeNull();

    // Different inTypes
    udo2.setCode('code');
    udo2.setInTypes('k');
    expect(list.getNameOfEquivalentCopy(udo2)).toBeNull();

    // Different outTypes
    udo2.setInTypes('i');
    udo2.setOutTypes('k');
    expect(list.getNameOfEquivalentCopy(udo2)).toBeNull();
  });

  it('getNameOfEquivalentCopy finds modern equivalent', () => {
    const list = new OpcodeList();

    const udo1 = new OpcodeDefinition();
    udo1.setName('testModern1');
    udo1.setStyle(UDOStyle.MODERN);
    udo1.setInputArguments('aSig, kDrive');
    udo1.setOutTypes('a');
    udo1.setCode('aOut = tanh(aSig * kDrive)\nxout aOut');
    list.addOpcode(udo1);

    // Same inputArguments/code/outTypes, different name
    const udo2 = new OpcodeDefinition();
    udo2.setName('testModern2');
    udo2.setStyle(UDOStyle.MODERN);
    udo2.setInputArguments('aSig, kDrive');
    udo2.setOutTypes('a');
    udo2.setCode('aOut = tanh(aSig * kDrive)\nxout aOut');

    expect(list.getNameOfEquivalentCopy(udo2)).toBe('testModern1');

    // Different inputArguments
    udo2.setInputArguments('aSig, kOther');
    expect(list.getNameOfEquivalentCopy(udo2)).toBeNull();
  });

  it('legacy XML defaults to classic style', () => {
    const root = new Element('opcodeList');
    const udoElem = root.addElement('udo');
    udoElem.addElement('opcodeName').setText('legacyOpcode');
    udoElem.addElement('outTypes').setText('a');
    udoElem.addElement('inTypes').setText('ak');
    udoElem.addElement('codeBody').setText('xout 1');
    udoElem.addElement('comments').setText('');

    const list = OpcodeList.loadFromXML(root);
    expect(list.size()).toBe(1);
    const udo = list.getOpcode(0)!;
    expect(udo.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo.getName()).toBe('legacyOpcode');
    expect(udo.getInTypes()).toBe('ak');
    expect(udo.getOutTypes()).toBe('a');
  });
});
