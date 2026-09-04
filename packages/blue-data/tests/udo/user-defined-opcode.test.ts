import { describe, it, expect } from 'vitest';
import { OpcodeDefinition } from '../../src/opcodes/opcode-definition';
import { UDOStyle } from '../../src/opcodes/udo-style';
import { Element } from '../../src/serialization/xml-reader';

describe('OpcodeDefinition (UserDefinedOpcode)', () => {
  // ─── Classic Code Generation ───

  it('generates classic-style code with tab-indented header and endop', () => {
    const udo = new OpcodeDefinition();
    udo.setName('saturate');
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setOutTypes('a');
    udo.setInTypes('ak');
    udo.setCode('aOut = tanh(aSig * kDrive)\nxout aOut');

    const code = udo.generateCode();
    expect(code).toContain('\topcode saturate,a,ak');
    expect(code).toContain('aOut = tanh(aSig * kDrive)');
    expect(code).toContain('\tendop');
    // Classic does NOT use 4-space indentation for body
    expect(code).not.toContain('    aOut');
  });

  it('appends commentText to classic header', () => {
    const udo = new OpcodeDefinition();
    udo.setName('test');
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setOutTypes('a');
    udo.setInTypes('k');
    udo.setCode('xout 1');
    udo.setCommentText('my comment');

    const code = udo.generateCode();
    expect(code).toContain('\topcode test,a,k ; my comment');
  });

  // ─── Modern Code Generation ───

  it('generates modern-style code with named args and colon output', () => {
    const udo = new OpcodeDefinition();
    udo.setName('saturate');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('aSig, kDrive');
    udo.setOutTypes('a');
    udo.setCode('aOut = tanh(aSig * kDrive)\nxout aOut');

    const code = udo.generateCode();
    expect(code).toContain('opcode saturate(aSig, kDrive):a');
    expect(code).toContain('    aOut = tanh(aSig * kDrive)');
    expect(code).toContain('endop');
    // Modern does NOT use tab indentation
    expect(code).not.toContain('\topcode');
    expect(code).not.toContain('\tendop');
  });

  it('modern style with void output uses :void', () => {
    const udo = new OpcodeDefinition();
    udo.setName('logMsg');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('SMsg');
    udo.setOutTypes('');
    udo.setCode('prints SMsg');

    const code = udo.generateCode();
    expect(code).toContain('opcode logMsg(SMsg):void');
  });

  it('modern style with multiple outputs uses parenthesized form', () => {
    const udo = new OpcodeDefinition();
    udo.setName('stereoSplit');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('aSig, kPan');
    udo.setOutTypes('a, a');
    udo.setCode('xout aL, aR');

    const code = udo.generateCode();
    expect(code).toContain('opcode stereoSplit(aSig, kPan):(a,a)');
  });

  it('modern style indents body with 4 spaces and leaves blank lines empty', () => {
    const udo = new OpcodeDefinition();
    udo.setName('test');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('aIn');
    udo.setOutTypes('a');
    udo.setCode('line1\n\nline3');

    const code = udo.generateCode();
    expect(code).toContain('    line1');
    expect(code).toContain('    line3');
    // Blank line between should not have spaces
    const lines = code.split('\n');
    const blankLine = lines.find((l) => l.length === 0);
    expect(blankLine).toBeDefined();
  });

  it('appends commentText to modern header', () => {
    const udo = new OpcodeDefinition();
    udo.setName('test');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('aIn');
    udo.setOutTypes('a');
    udo.setCode('xout aIn');
    udo.setCommentText('modern comment');

    const code = udo.generateCode();
    expect(code).toContain('opcode test(aIn):a ; modern comment');
  });

  // ─── XML Serialization ───

  it('round-trips classic UDO through XML', () => {
    const udo = new OpcodeDefinition();
    udo.setName('classicUDO');
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setOutTypes('a');
    udo.setInTypes('ak');
    udo.setCode('xout 1');
    udo.setComments('my comment');

    const xml = udo.saveAsXML();
    const loaded = OpcodeDefinition.loadFromXML(xml);

    expect(loaded.getName()).toBe('classicUDO');
    expect(loaded.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(loaded.getOutTypes()).toBe('a');
    expect(loaded.getInTypes()).toBe('ak');
    expect(loaded.getCode()).toBe('xout 1');
    expect(loaded.getComments()).toBe('my comment');
  });

  it('round-trips modern UDO through XML', () => {
    const udo = new OpcodeDefinition();
    udo.setName('stereo_width');
    udo.setStyle(UDOStyle.MODERN);
    udo.setInputArguments('aSig, kWidth');
    udo.setOutTypes('a, a');
    udo.setCode('aL = aSig\naR = aSig * kWidth');
    udo.setComments('');

    const xml = udo.saveAsXML();
    const loaded = OpcodeDefinition.loadFromXML(xml);

    expect(loaded.getName()).toBe('stereo_width');
    expect(loaded.getStyle()).toBe(UDOStyle.MODERN);
    expect(loaded.getInputArguments()).toBe('aSig, kWidth');
    expect(loaded.getOutTypes()).toBe('a, a');
    expect(loaded.getInTypes()).toBe('');
  });

  it('legacy XML without style defaults to CLASSIC', () => {
    const root = new Element('udo');
    root.addElement('opcodeName').setText('legacyOpcode');
    root.addElement('outTypes').setText('a');
    root.addElement('inTypes').setText('ak');
    root.addElement('codeBody').setText('xout 1');
    root.addElement('comments').setText('');

    const loaded = OpcodeDefinition.loadFromXML(root);
    expect(loaded.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(loaded.getName()).toBe('legacyOpcode');
    expect(loaded.getInTypes()).toBe('ak');
    expect(loaded.getOutTypes()).toBe('a');
  });

  // ─── Equivalence ───

  it('classic UDOs with same types and code are equivalent', () => {
    const a = new OpcodeDefinition();
    a.setStyle(UDOStyle.CLASSIC);
    a.setOutTypes('a');
    a.setInTypes('ak');
    a.setCode('xout 1');

    const b = new OpcodeDefinition();
    b.setStyle(UDOStyle.CLASSIC);
    b.setOutTypes('a');
    b.setInTypes('ak');
    b.setCode('xout 1');

    expect(a.isEquivalent(b)).toBe(true);
  });

  it('UDOs with different names but same types/code are equivalent', () => {
    const a = new OpcodeDefinition();
    a.setName('copy1');
    a.setStyle(UDOStyle.CLASSIC);
    a.setOutTypes('a');
    a.setInTypes('ak');
    a.setCode('xout 1');

    const b = new OpcodeDefinition();
    b.setName('copy2');
    b.setStyle(UDOStyle.CLASSIC);
    b.setOutTypes('a');
    b.setInTypes('ak');
    b.setCode('xout 1');

    expect(a.isEquivalent(b)).toBe(true);
  });

  it('UDOs with different code are not equivalent', () => {
    const a = new OpcodeDefinition();
    a.setStyle(UDOStyle.CLASSIC);
    a.setOutTypes('a');
    a.setInTypes('ak');
    a.setCode('xout 1');

    const b = new OpcodeDefinition();
    b.setStyle(UDOStyle.CLASSIC);
    b.setOutTypes('a');
    b.setInTypes('ak');
    b.setCode('xout 2');

    expect(a.isEquivalent(b)).toBe(false);
  });

  it('modern UDOs compare inputArguments', () => {
    const a = new OpcodeDefinition();
    a.setStyle(UDOStyle.MODERN);
    a.setInputArguments('aSig, kDrive');
    a.setOutTypes('a');
    a.setCode('xout 1');

    const b = new OpcodeDefinition();
    b.setStyle(UDOStyle.MODERN);
    b.setInputArguments('aSig, kDrive');
    b.setOutTypes('a');
    b.setCode('xout 1');

    expect(a.isEquivalent(b)).toBe(true);

    b.setInputArguments('aSig, kOther');
    expect(a.isEquivalent(b)).toBe(false);
  });

  it('isEquivalent returns false for null', () => {
    const udo = new OpcodeDefinition();
    expect(udo.isEquivalent(null)).toBe(false);
  });

  // ─── deepCopy ───

  it('deepCopy preserves all fields', () => {
    const udo = new OpcodeDefinition();
    udo.setName('copyTest');
    udo.setStyle(UDOStyle.MODERN);
    udo.setOutTypes('a, a');
    udo.setInputArguments('aL, aR');
    udo.setCode('xout aL, aR');
    udo.setComments('test comment');

    const copy = udo.deepCopy() as OpcodeDefinition;
    expect(copy.getName()).toBe('copyTest');
    expect(copy.getStyle()).toBe(UDOStyle.MODERN);
    expect(copy.getOutTypes()).toBe('a, a');
    expect(copy.getInputArguments()).toBe('aL, aR');
    expect(copy.getCode()).toBe('xout aL, aR');
    expect(copy.getComments()).toBe('test comment');
  });
});
