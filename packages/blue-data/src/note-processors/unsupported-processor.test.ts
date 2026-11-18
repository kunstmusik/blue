import { describe, expect, it } from 'vite-plus/test';
import { Element } from '../serialization/xml-reader';
import { UnsupportedProcessor } from './unsupported-processor';

describe('UnsupportedProcessor', () => {
  it('preserves nested XML structure losslessly', () => {
    const xml = Element.parse(`
      <noteProcessor type="blue.noteProcessor.CustomProcessor" priority="7">
        <outer attr="a">
          <inner flag="true">value</inner>
        </outer>
      </noteProcessor>
    `);

    const proc = UnsupportedProcessor.loadFromXML(xml, 'blue.noteProcessor.CustomProcessor');
    const saved = proc.saveAsXML();

    expect(saved.toXml()).toBe(xml.toXml());
    expect(proc.getOriginalType()).toBe('blue.noteProcessor.CustomProcessor');
  });

  it('deep copies the preserved XML tree', () => {
    const xml = Element.parse(`
      <noteProcessor type="blue.noteProcessor.CustomProcessor">
        <outer><inner>value</inner></outer>
      </noteProcessor>
    `);

    const proc = UnsupportedProcessor.loadFromXML(xml, 'blue.noteProcessor.CustomProcessor');
    const copy = proc.deepCopy();

    expect(copy.saveAsXML().toXml()).toBe(xml.toXml());
    expect(copy).not.toBe(proc);
  });
});
