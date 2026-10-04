import { describe, expect, it } from 'vitest';
import { readResourceXml } from './resource-xml-policy';
import { GenericInstrument } from './instruments/generic-instrument';
import { PythonInstrument } from './instruments/python-instrument';
import { Effect } from './mixer/effect';
import { GenericScore } from './sound-objects/generic-score';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { Preset } from './instruments/blue-synth-builder/preset';
import { PresetGroup } from './instruments/blue-synth-builder/preset-group';
import { ClojureObject } from './sound-objects/clojure-object';
import { FrozenSoundObject } from './sound-objects/frozen-sound-object';
import { XmlLoadContext, loadXml } from './serialization/xml-load';
import { Element } from './serialization/xml-reader';

const opcode = new OpcodeDefinition();
opcode.setOutTypes('0');

const source = { kind: 'instrument' as const, label: 'standalone instrument.xml' };
const directSoundObjectOwners: Array<
  [string, (root: Element, context: XmlLoadContext) => unknown]
> = [
  ['ClojureObject', (root, context) => ClojureObject.loadFromXML(root, undefined, context)],
  ['FrozenSoundObject', (root, context) => FrozenSoundObject.loadFromXML(root, undefined, context)],
];

describe('standalone resource report boundary', () => {
  it.each([
    ['instrument', new GenericInstrument()],
    ['instrument', new PythonInstrument()],
    ['effect', new Effect()],
    ['soundObject', new GenericScore()],
    ['udo', opcode],
    ['preset', new Preset()],
    ['preset', new PresetGroup()],
  ] as const)(
    'accepts and round-trips the current %s root without a project envelope',
    (kind, model) => {
      const xml = model.saveAsXML().toXml();
      const result = readResourceXml(kind, xml, { ...source, kind });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.saveAsXML().toXml()).toBe(xml);
    },
  );

  it('reports PianoRoll historical ruler metadata for standalone resources', () => {
    const rulerSource = { kind: 'soundObject' as const, label: 'piano-roll.xml' };
    const xml =
      '<soundObject type="blue.soundObject.PianoRoll"><timeUnit>6</timeUnit></soundObject>';
    const report = readResourceXml('soundObject', xml, rulerSource);

    expect(report.ok).toBe(true);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: 'SL-H06',
        severity: 'warning',
        source: rulerSource,
        path: '/soundObject/timeUnit[1]',
        value: '6',
        message: expect.stringContaining('current editor does not apply'),
        recovery: expect.stringContaining('retained and saved as timeUnit'),
      }),
    ]);
    if (!report.ok) throw new Error(JSON.stringify(report.diagnostics));
    expect(report.value.saveAsXML().getTextString('timeUnit')).toBe('6');
  });

  it.each(directSoundObjectOwners)(
    'matches direct %s root diagnostics at the resource report boundary',
    (_name, load) => {
      const reportSource = { kind: 'soundObject' as const, label: 'wrong-resource-root.xml' };
      const xml = '<wrong type="blue.soundObject.ClojureObject"/>';
      const resource = readResourceXml('soundObject', xml, reportSource);
      const direct = loadXml(xml, reportSource, (root, context) => load(root, context));
      expect(resource.ok).toBe(false);
      expect(direct.ok).toBe(false);
      if (resource.ok || direct.ok) throw new Error('Wrong resource root unexpectedly loaded.');
      expect(resource.diagnostics).toEqual(direct.diagnostics);
    },
  );

  it.each([
    ['instrument', '<effect/>'],
    ['effect', '<instrument type="blue.orchestra.GenericInstrument"/>'],
    ['soundObject', '<blueData/>'],
    ['udo', '<opcodeList/>'],
    ['preset', '<instrument/>'],
  ] as const)('rejects mismatched roots for %s without a partial candidate', (kind, xml) => {
    const result = readResourceXml(kind, xml, source);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0]).toMatchObject({ code: 'root', source });
  });

  it.each([
    '<instrument/>',
    '<instrument type="example.GenericInstrument"/>',
    '<instrument type="blue.orchestra.GenericInstrument" enabled="maybe"/>',
    '<instrument type="blue.orchestra.GenericInstrument"><instrumentText extra="yes">code</instrumentText></instrument>',
    '<instrument type="blue.orchestra.GenericInstrument"><future/></instrument>',
  ])('rejects unsupported instrument data %s', (xml) => {
    const result = readResourceXml('instrument', xml, source);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0].source).toEqual(source);
  });
});
