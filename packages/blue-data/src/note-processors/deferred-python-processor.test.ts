import { describe, expect, it } from 'vite-plus/test';
import { Element } from '../serialization/xml-reader';
import { NoteProcessorChain } from './note-processor-chain';

describe('PythonProcessor preservation', () => {
  it('preserves PythonProcessor XML through load/save cycle', () => {
    const originalXml = `<noteProcessorChain>
<noteProcessor type="blue.noteProcessor.PythonProcessor"><code>print("hello")</code></noteProcessor>
</noteProcessorChain>`;
    const xml = Element.parse(originalXml);
    const chain = NoteProcessorChain.loadFromXML(xml);
    const savedXml = chain.saveAsXML().toXml();
    expect(savedXml).toContain('PythonProcessor');
    expect(savedXml).toContain('print');
  });

  it('preserves PythonProcessor in a mixed chain', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.AddProcessor">
          <pfield>4</pfield>
          <value>10</value>
        </noteProcessor>
        <noteProcessor type="blue.noteProcessor.PythonProcessor">
          <code>x = 42</code>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    expect(chain.getProcessors()).toHaveLength(2);
    const saved = chain.saveAsXML();
    expect(saved.toXml()).toContain('PythonProcessor');
    expect(saved.toXml()).toContain('x = 42');
  });

  it('deep copies PythonProcessor data', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.PythonProcessor">
          <code>original code</code>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    const copy = chain.deepCopy();
    expect(copy.saveAsXML().toXml()).toBe(chain.saveAsXML().toXml());
  });
});
