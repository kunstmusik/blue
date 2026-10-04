import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { NoteProcessorChain } from './note-processor-chain';
import { XmlLoadError } from '../serialization/xml-load';

describe('NoteProcessorChain', () => {
  it('rejects ValueTimeMapper XML as an unregistered chain processor', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.ValueTimeMapper">
          <timeMap>
            <point beat="0" value="0" />
          </timeMap>
        </noteProcessor>
      </noteProcessorChain>
    `);

    expect(() => NoteProcessorChain.loadFromXML(xml)).toThrow(XmlLoadError);
  });
});
