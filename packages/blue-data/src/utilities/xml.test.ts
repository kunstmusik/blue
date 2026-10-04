import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { checkShape, readEnum, readInt, readDouble, readBoolean, writeDouble } from './xml';
import { XmlLoadContext, XmlLoadError } from '../serialization/xml-load';

describe('xml utilities', () => {
  it('checks enum tokens, integer bounds, repeated fields, and container evidence', () => {
    expect(readEnum(Element.parse('<mode>BEATS</mode>'), ['BEATS', 'TIME'])).toBe('BEATS');
    expect(() => readEnum(Element.parse('<mode>future</mode>'), ['BEATS', 'TIME'])).toThrow(
      XmlLoadError,
    );
    expect(() => readInt(Element.parse('<n>4</n>'), undefined, 0, 3)).toThrow(XmlLoadError);
    const repeated = Element.parse('<root>\n <point/><point/>\n</root>');
    expect(() => checkShape(repeated, [], ['point'], undefined, ['point'])).not.toThrow();
    expect(() => checkShape(repeated, [], ['point'])).toThrow(XmlLoadError);
    const mixed = Element.parse('<root>before<point/>after</root>');
    expect(() => checkShape(mixed, [], ['point'])).toThrow(XmlLoadError);
    const root = Element.parse('<root><n unit="x">1</n></root>');
    const context = new XmlLoadContext(root, { kind: 'primitive', label: 'numbers.xml' });
    try {
      readDouble(root.getElement('n')!, context);
      expect.fail('unexpected acceptance');
    } catch (error) {
      expect(error).toBeInstanceOf(XmlLoadError);
      expect((error as XmlLoadError).diagnostics[0]).toMatchObject({
        source: { label: 'numbers.xml' },
        path: '/root/n[1]/@unit',
        member: '@unit',
        value: 'x',
      });
    }
  });
  it.each(['12junk', '', 'NaN', 'Infinity', '0x10', '1_000'])(
    'rejects invalid numeric token %j',
    (text) => {
      const elem = new Element('value');
      elem.setText(text);
      expect(() => readDouble(elem)).toThrow();
      expect(() => readInt(elem)).toThrow();
    },
  );

  it.each(['1.2', '1e2', '9007199254740992', '-9007199254740992'])(
    'rejects non-exact integral token %j',
    (text) => {
      const elem = new Element('value');
      elem.setText(text);
      expect(() => readInt(elem)).toThrow();
    },
  );

  it('reads complete finite numbers and safe integer endpoints', () => {
    expect(readDouble(Element.parse('<n> +1.25e2 </n>'))).toBe(125);
    expect(readInt(Element.parse('<n> -9007199254740991 </n>'))).toBe(-9007199254740991);
    expect(readInt(Element.parse('<n>9007199254740991</n>'))).toBe(9007199254740991);
  });

  it('accepts trimmed case-insensitive booleans and rejects invalid present values', () => {
    expect(readBoolean(Element.parse('<b> TRUE </b>'))).toBe(true);
    expect(readBoolean(Element.parse('<b>False</b>'))).toBe(false);
    for (const text of ['', '1', 'yes', 'falsejunk']) {
      const elem = new Element('value');
      elem.setText(text);
      expect(() => readBoolean(elem)).toThrow();
    }
  });

  it.each(['<n unit="beats">1</n>', '<n>1<extra/></n>'])('rejects scalar shape %s', (xml) => {
    expect(() => readDouble(Element.parse(xml))).toThrow();
  });

  describe('writeDouble', () => {
    it('adds a decimal point for integer values', () => {
      expect(writeDouble('x', 0).getTextString()).toBe('0.0');
      expect(writeDouble('x', -3).getTextString()).toBe('-3.0');
    });

    it('preserves scientific notation and non-finite values', () => {
      expect(writeDouble('x', 1e-7).getTextString()).toBe('1e-7');
      expect(writeDouble('x', Infinity).getTextString()).toBe('Infinity');
      expect(writeDouble('x', NaN).getTextString()).toBe('NaN');
    });
  });
});
