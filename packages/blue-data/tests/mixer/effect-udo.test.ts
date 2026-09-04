import { describe, it, expect } from 'vitest';
import { Effect } from '../../src/mixer/effect';
import { UDOStyle } from '../../src/opcodes/udo-style';
import { Element } from '../../src/serialization/xml-reader';

describe('Effect UDO Generation', () => {
  it('classic generateUDO includes xin line', () => {
    const effect = new Effect();
    effect.setStyle(UDOStyle.CLASSIC);
    effect.setNumIns(2);
    effect.setNumOuts(2);
    effect.setCode('aout1 = ain1\naout2 = ain2');

    const udo = effect.generateUDO(0);
    expect(udo).toContain('xin');
    expect(udo).toContain('xout');
    expect(udo).toContain('xout\taout1,aout2');
    expect(udo).toContain('opcode blueEffect0,aa,aa');
    expect(udo).toContain('\tendop');
  });

  it('modern generateUDO skips xin line', () => {
    const effect = new Effect();
    effect.setStyle(UDOStyle.MODERN);
    effect.setNumIns(2);
    effect.setNumOuts(2);
    effect.setCode('aout1 = ain1\naout2 = ain2');

    const udo = effect.generateUDO(0);
    expect(udo).not.toContain('xin');
    expect(udo).toContain('xout');
    expect(udo).toContain('    xout\taout1,aout2');
    expect(udo).toContain('opcode blueEffect0(ain1, ain2):(a,a)');
    expect(udo).toContain('endop');
  });

  it('modern generateCode uses modern header', () => {
    const effect = new Effect();
    effect.setName('testEffect');
    effect.setStyle(UDOStyle.MODERN);
    effect.setNumIns(1);
    effect.setNumOuts(1);
    effect.setCode('aout1 = ain1 * 0.5');

    const udo = effect.generateUDO(0);
    // Should start with modern header
    expect(udo).toContain('opcode blueEffect0(ain1):a');
    // Should have 4-space indented body
    expect(udo).toContain('    aout1 = ain1 * 0.5');
    // Should NOT have tab-indented opcode/endop
    expect(udo).not.toContain('\topcode');
    expect(udo).not.toContain('\tendop');
  });

  it('modern generateCode with multiple outputs', () => {
    const effect = new Effect();
    effect.setName('testStereo');
    effect.setStyle(UDOStyle.MODERN);
    effect.setNumIns(1);
    effect.setNumOuts(2);
    effect.setCode('aout1 = ain1\naout2 = ain1');

    const udo = effect.generateUDO(0);
    expect(udo).toContain('opcode blueEffect0(ain1):(a,a)');
  });

  it('legacy XML defaults to classic style', () => {
    const root = new Element('effect');
    root.addElement('name').setText('legacyEffect');
    root.addElement('enabled').setText('true');
    root.addElement('numIns').setText('2');
    root.addElement('numOuts').setText('2');
    root.addElement('code').setText('aout1 = ain1');

    const effect = Effect.loadFromXML(root);
    expect(effect.getStyle()).toBe(UDOStyle.CLASSIC);
  });

  it('XML round-trip preserves style', () => {
    const effect = new Effect();
    effect.setStyle(UDOStyle.MODERN);
    effect.setName('roundTrip');
    effect.setNumIns(3);
    effect.setNumOuts(2);

    const xml = effect.saveAsXML();
    const loaded = Effect.loadFromXML(xml);

    expect(loaded.getStyle()).toBe(UDOStyle.MODERN);
    expect(loaded.getName()).toBe('roundTrip');
    expect(loaded.getNumIns()).toBe(3);
    expect(loaded.getNumOuts()).toBe(2);
  });
});
