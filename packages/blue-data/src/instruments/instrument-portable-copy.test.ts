import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { BlueSynthBuilder } from './blue-synth-builder';
import { BlueX7 } from './blue-x7';
import { GenericInstrument } from './generic-instrument';
import type { Instrument } from './instrument';
import { loadInstrumentFromXML } from './instrument-registry';
import { JavaScriptInstrument } from './javascript-instrument';
import { PythonInstrument } from './python-instrument';

const INSTRUMENT_FACTORIES: ReadonlyArray<readonly [string, () => Instrument]> = [
  ['GenericInstrument', () => new GenericInstrument()],
  ['JavaScriptInstrument', () => new JavaScriptInstrument()],
  ['PythonInstrument', () => new PythonInstrument()],
  ['BlueX7', () => new BlueX7()],
  ['BlueSynthBuilder', () => new BlueSynthBuilder()],
];

function normalizeEmptyElements(xml: string): string {
  return xml.replace(/<([A-Za-z][\w:.-]*)([^>]*)><\/\1>/g, '<$1$2/>');
}

describe.each(INSTRUMENT_FACTORIES)('%s portable copy', (_name, createInstrument) => {
  it('round-trips every common instrument field through library XML', () => {
    const source = createInstrument();
    source.setName('Portable instrument');
    source.setComment('Preserve this comment');
    source.setEnabled(false);

    const payloadXml = source.saveAsXML().toXml();
    const copy = loadInstrumentFromXML(Element.parse(payloadXml));

    expect(copy).not.toBeNull();
    expect(copy).not.toBe(source);
    expect(copy?.constructor).toBe(source.constructor);
    expect(copy?.getName()).toBe(source.getName());
    expect(copy?.getComment()).toBe(source.getComment());
    expect(copy?.isEnabled()).toBe(false);
    expect(normalizeEmptyElements(copy?.saveAsXML().toXml() ?? '')).toBe(
      normalizeEmptyElements(payloadXml),
    );
  });
});
