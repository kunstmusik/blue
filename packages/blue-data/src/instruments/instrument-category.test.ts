import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { InstrumentCategory } from './instrument-category';
import { JavaScriptInstrument } from './javascript-instrument';

describe('InstrumentCategory legacy loading', () => {
  it('dispatches known leaves through the instrument registry', () => {
    const category = InstrumentCategory.loadFromXML(
      Element.parse(`
        <instrumentCategory categoryName="Root" isRoot="true">
          <instrument type="blue.orchestra.JavaScriptInstrument">
            <name>Scripted</name>
            <instrumentText>instrument = "aout = 0";</instrumentText>
          </instrument>
        </instrumentCategory>
      `),
    );

    expect(category.getInstruments()).toHaveLength(1);
    expect(category.getInstruments()[0]).toBeInstanceOf(JavaScriptInstrument);
    expect(category.getInstruments()[0]?.getName()).toBe('Scripted');
  });

  it('does not coerce an unknown instrument type to GenericInstrument', () => {
    const category = InstrumentCategory.loadFromXML(
      Element.parse(`
        <instrumentCategory categoryName="Root" isRoot="true">
          <instrument type="example.UnknownInstrument"><name>Unknown</name></instrument>
        </instrumentCategory>
      `),
    );

    expect(category.getInstruments()).toEqual([]);
  });
});
