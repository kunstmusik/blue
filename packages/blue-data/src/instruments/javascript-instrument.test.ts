import { describe, expect, it } from 'vitest';
import { OpcodeDefinition } from '../opcodes/opcode-definition';
import { OpcodeList } from '../opcodes/opcode-list';
import { UDOStyle } from '../opcodes/udo-style';
import { Element } from '../serialization/xml-reader';
import { JavaScriptInstrument } from './javascript-instrument';

describe('JavaScriptInstrument', () => {
  it('round-trips Java-style XML without losing script fields', () => {
    const xml = `<instrument type="blue.orchestra.JavaScriptInstrument">
      <name>JS Tone</name>
      <comment>script comment</comment>
      <globalOrc>gkJS init 1</globalOrc>
      <globalSco>i 1 0 1</globalSco>
      <instrumentText>instrument = "aout oscili 0.2, 440";</instrumentText>
      <opcodeList/>
    </instrument>`;

    const instr = JavaScriptInstrument.loadFromXML(Element.parse(xml));
    expect(instr.getName()).toBe('JS Tone');
    expect(instr.getComment()).toBe('script comment');
    expect(instr.getText()).toContain('instrument =');

    const saved = instr.saveAsXML();
    expect(saved.getAttribute('type')).toBe('blue.orchestra.JavaScriptInstrument');
    expect(saved.getTextString('globalOrc')).toBe('gkJS init 1');
    expect(saved.getTextString('instrumentText')).toContain('oscili');
  });

  it('appends its opcode list into the shared compile UDO list', () => {
    const instr = new JavaScriptInstrument();

    const opcode = new OpcodeDefinition();
    opcode.setName('jsFx');
    opcode.setStyle(UDOStyle.CLASSIC);
    opcode.setOutTypes('a');
    opcode.setInTypes('a');
    opcode.setCode('ain xin\nxout ain * 0.5');
    instr.getOpcodeList().addOpcode(opcode);

    const masterList = new OpcodeList();
    instr.generateUserDefinedOpcodes(masterList);

    expect(masterList.size()).toBe(1);
    expect(masterList.getOpcode(0)?.getName()).toBe('jsFx');
  });
});
