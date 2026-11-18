import { describe, expect, it } from 'vite-plus/test';
import { Element } from '../serialization/xml-reader';
import { PythonInstrument } from './python-instrument';

describe('PythonInstrument', () => {
  it('preserves Java-style Python instrument XML for the deferred editor', () => {
    const xml = `<instrument type="blue.orchestra.PythonInstrument">
      <name>Py Tone</name>
      <comment>python comment</comment>
      <globalOrc>gkPy init 1</globalOrc>
      <globalSco>i 2 0 1</globalSco>
      <instrumentText>instrument = "aout oscili 0.2, 330"</instrumentText>
      <opcodeList/>
    </instrument>`;

    const instr = PythonInstrument.loadFromXML(Element.parse(xml));
    expect(instr.getName()).toBe('Py Tone');
    expect(instr.getComment()).toBe('python comment');
    expect(instr.getText()).toContain('instrument =');

    const saved = instr.saveAsXML();
    expect(saved.getAttribute('type')).toBe('blue.orchestra.PythonInstrument');
    expect(saved.getTextString('comment')).toBe('python comment');
    expect(saved.getTextString('instrumentText')).toContain('330');
  });
});
