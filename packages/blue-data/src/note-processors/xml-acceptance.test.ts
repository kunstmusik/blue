import { describe, it, expect } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { XmlLoadError } from '../serialization/xml-load';
import { NoteProcessorChain } from './note-processor-chain';
import { NoteProcessorChainMap } from './note-processor-chain-map';
import {
  createNoteProcessorChainSnapshot,
  reifyChainFromSnapshot,
} from './note-processor-snapshot';
import { RandomAddProcessor } from './random-add-processor';
import { RandomMultiplyProcessor } from './random-multiply-processor';
import { JavaRandom } from '../sound-objects/jmask-support';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { TuningProcessor } from './tuning-processor';
const chain = (body: string) => Element.parse(`<noteProcessorChain>${body}</noteProcessorChain>`);
describe('processor XML acceptance', () => {
  it.each([
    '<noteProcessor type="__proto__"/>',
    '<noteProcessor type="foreign.AddProcessor"/>',
    '<noteProcessor type="Unknown"/>',
    '<noteProcessor type="AddProcessor"><pfield>4tail</pfield></noteProcessor>',
    '<noteProcessor type="AddProcessor"><value>Infinity</value></noteProcessor>',
    '<noteProcessor type="RetrogradeProcessor"><future/></noteProcessor>',
    '<noteProcessor type="RandomAddProcessor"><seedUsed>yes</seedUsed></noteProcessor>',
    '<noteProcessor type="RandomAddProcessor"><min>2</min><max>1</max></noteProcessor>',
    '<noteProcessor type="RandomMultiplyProcessor"><seed>9223372036854775808</seed></noteProcessor>',
    '<noteProcessor type="LineAddProcessor"><lineAddString>0 1tail</lineAddString></noteProcessor>',
    '<noteProcessor type="TimeWarpProcessor"><timeWarpString>0 0</timeWarpString></noteProcessor>',
    '<noteProcessor type="TuningProcessor"><pfield>3</pfield></noteProcessor>',
    '<noteProcessor type="Code"><code>x</code></noteProcessor>',
  ])('rejects invalid processor %s', (xml) =>
    expect(() => NoteProcessorChain.loadFromXML(chain(xml))).toThrow(XmlLoadError),
  );
  it('coalesces equal map and pfield aliases and rejects conflicting values', () => {
    const xml = Element.parse(
      '<noteProcessorChainMap><noteProcessorChain name="x"/><npc name="x"><noteProcessorChain/></npc></noteProcessorChainMap>',
    );
    expect(NoteProcessorChainMap.loadFromXML(xml).getChainNames()).toEqual(['x']);
    expect(
      NoteProcessorChain.loadFromXML(
        chain(
          '<noteProcessor type="AddProcessor"><pfield>4</pfield><pFieldIndex>4</pFieldIndex></noteProcessor>',
        ),
      ).getProcessors(),
    ).toHaveLength(1);
    expect(() =>
      NoteProcessorChain.loadFromXML(
        chain(
          '<noteProcessor type="AddProcessor"><pfield>4</pfield><pFieldIndex>5</pFieldIndex></noteProcessor>',
        ),
      ),
    ).toThrow(XmlLoadError);
  });
  it('preserves signed64 seed digits through load/save/copy and deterministic execution', () => {
    const original = RandomAddProcessor.loadFromXML(
      Element.parse(
        '<noteProcessor type="RandomAddProcessor"><seed>9223372036854775807</seed></noteProcessor>',
      ),
    );
    expect(original.getSeed()).toBe('9223372036854775807');
    expect(original.deepCopy().getSeed()).toBe(original.getSeed());
    original.setSeedUsed(true);
    expect(() => original.setSeed(9007199254740992)).toThrow();
    expect(original.saveAsXML().getTextString('seed')).toBe(original.getSeed());
    expect(new JavaRandom(BigInt(original.getSeed())).nextDouble()).toBe(
      new JavaRandom(281474976710655).nextDouble(),
    );
  });
  it.each([
    ['RandomAddProcessor', RandomAddProcessor, ' TRUE ', true],
    ['RandomAddProcessor', RandomAddProcessor, ' FaLsE ', false],
    ['RandomMultiplyProcessor', RandomMultiplyProcessor, ' TRUE ', true],
    ['RandomMultiplyProcessor', RandomMultiplyProcessor, ' FaLsE ', false],
  ] as const)('uses the checked %s seedUsed value %s', (type, Owner, token, expected) => {
    const source = `<noteProcessor type="${type}"><min>0</min><max>1</max><seedUsed>${token}</seedUsed><seed>17</seed></noteProcessor>`;
    const direct = Owner.loadFromXML(Element.parse(source));
    const embedded = NoteProcessorChain.loadFromXML(
      chain(source),
    ).getProcessors()[0] as typeof direct;
    expect(direct.isSeedUsed()).toBe(expected);
    expect(embedded.isSeedUsed()).toBe(expected);
    expect(direct.saveAsXML().getTextString('seedUsed')).toBe(String(expected));
    expect(Owner.loadFromXML(direct.saveAsXML()).isSeedUsed()).toBe(expected);

    if (expected) {
      const directNote = Note.createNoteFromText('i1 0 1 10 20')!;
      const embeddedNote = Note.createNoteFromText('i1 0 1 10 20')!;
      direct.process(new NoteList([directNote]));
      embedded.process(new NoteList([embeddedNote]));
      expect(directNote.getPField(4)).toBe(embeddedNote.getPField(4));
    }
  });
  it.each([
    '<npc name="x"><noteProcessorChain/></npc><npc name="x"><noteProcessorChain/></npc>',
    '<npc name="x"/>',
    '<npc name=""><noteProcessorChain/></npc>',
    '<noteProcessorChain name="legacy"><future/></noteProcessorChain>',
  ])('rejects ambiguous map %s', (xml) =>
    expect(() =>
      NoteProcessorChainMap.loadFromXML(
        Element.parse(`<noteProcessorChainMap>${xml}</noteProcessorChainMap>`),
      ),
    ).toThrow(XmlLoadError),
  );
  it('preserves complete Java Scale metadata', () => {
    const processor = TuningProcessor.loadFromXML(
      Element.parse(
        '<noteProcessor type="TuningProcessor"><scale><scaleName>seven</scaleName><baseFrequency>440</baseFrequency><octave>3</octave><ratios><ratio>1</ratio><ratio>1.5</ratio></ratios></scale></noteProcessor>',
      ),
    );
    expect(processor.saveAsXML().getElement('scale')?.getTextString('scaleName')).toBe('seven');
    expect(processor.saveAsXML().getElement('scale')?.getTextString('octave')).toBe('3');
    expect(processor.getRatios()).toEqual([1, 1.5]);
  });
  it('retains an unresolved scale dependency and blocks processing', () => {
    const processor = TuningProcessor.loadFromXML(
      Element.parse(
        '<noteProcessor type="TuningProcessor"><scale>custom.scl</scale><baseFrequency>440</baseFrequency></noteProcessor>',
      ),
    );
    expect(processor.saveAsXML().getTextString('scale')).toBe('custom.scl');
    expect(processor.deepCopy().saveAsXML().toXml()).toBe(processor.saveAsXML().toXml());
    const original = new NoteProcessorChain();
    original.addProcessor(processor);
    expect(
      reifyChainFromSnapshot(createNoteProcessorChainSnapshot(original)).saveAsXML().toXml(),
    ).toBe(original.saveAsXML().toXml());
    expect(() => processor.process([] as never)).toThrow(/unresolved/i);
  });
});
