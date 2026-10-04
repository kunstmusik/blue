import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { OpcodeList } from './opcode-list';
import { OpcodeDefinition } from './opcode-definition';
import { readResourceXml } from '../resource-xml-policy';

describe('UDO exact local contracts', () => {
  it.each([
    '<udo><style>future</style></udo>',
    '<udo><style>MODERN</style><inTypes>a</inTypes></udo>',
    '<udo><style>CLASSIC</style><inputArguments>aIn:a</inputArguments></udo>',
    '<udo future="yes"/>',
    '<udo><codeBody future="yes">code</codeBody></udo>',
    '<udo><opcodeName>A</opcodeName><opcodeName>B</opcodeName></udo>',
    '<udo><future/></udo>',
  ])('rejects malformed or conflicting UDO fields %s', (xml) => {
    const result = readResourceXml('udo', xml, { kind: 'udo', label: 'opcode.xml' });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0].source.label).toBe('opcode.xml');
  });
  it('rejects arbitrary opcode-list children', () => {
    expect(() =>
      OpcodeList.loadFromXML(Element.parse('<opcodeList><future/></opcodeList>')),
    ).toThrow();
  });
  it('reports and omits only empty opposing inputs without changing significant code', () => {
    const xml =
      '<udo><style>MODERN</style><inTypes></inTypes><inputArguments>aInput:a</inputArguments><codeBody>  \nxout aInput\n </codeBody></udo>';
    const result = readResourceXml('udo', xml, { kind: 'udo', label: 'opcode.xml' });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toMatchObject([
      { code: 'R-UDO-REDUNDANT-INPUT', severity: 'warning' },
    ]);
    if (!result.ok) throw new Error('UDO unexpectedly rejected');
    expect(result.value.saveAsXML().hasElement('inTypes')).toBe(false);
    expect(result.value.saveAsXML().getElement('codeBody')!.getTextString()).toBe(
      '  \nxout aInput\n ',
    );
    expect(() => OpcodeDefinition.loadFromXML(Element.parse(xml))).toThrow('report handler');
  });
});
