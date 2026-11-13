import { describe, expect, it } from 'vitest';
import { UNSAFE_EXTERNAL_ENTITY_FIXTURE } from './fixtures/legacy-library-corpus';
import { parseLegacyLibraryDocument } from './legacy-library-codec';
import { findRawXmlElements, parseRawXmlDocument } from './raw-xml-document';

describe('raw XML document', () => {
  it('extracts exact leaf slices with BMP and non-BMP Unicode before and inside the leaf', () => {
    const rawLeaf =
      '<soundObject type="example.Future"><name>🎹 Ω</name><!-- exact --></soundObject>';
    const xml = `<soundObjectLibrary><!-- préface 🎼 --><category categoryName="根">${rawLeaf}</category></soundObjectLibrary>`;
    const document = parseRawXmlDocument(xml);

    const leaves = findRawXmlElements(document, 'soundObject');
    expect(leaves).toHaveLength(1);
    expect(leaves[0]?.rawXml).toBe(rawLeaf);
    expect(xml.slice(leaves[0]?.startCodeUnit, leaves[0]?.endCodeUnit)).toBe(rawLeaf);
  });

  it('retains comments, CDATA, entity spelling, and unknown nested content', () => {
    const rawLeaf =
      '<effect><name>A &amp; B</name><!--c--><plugin><![CDATA[x < y]]></plugin></effect>';
    const xml = `<effectsLibrary><effectCategory categoryName="root" isRoot="true">${rawLeaf}</effectCategory></effectsLibrary>`;
    const document = parseRawXmlDocument(xml);

    expect(findRawXmlElements(document, 'effect')[0]?.rawXml).toBe(rawLeaf);
  });

  it('rejects document types and never resolves external entities', () => {
    expect(() => parseLegacyLibraryDocument(UNSAFE_EXTERNAL_ENTITY_FIXTURE)).toThrow(
      /document type/i,
    );
  });

  it('preserves __proto__ XML attributes on a null-prototype record', () => {
    const document = parseRawXmlDocument('<soundObject __proto__="extra"/>');
    expect(Object.getPrototypeOf(document.root.attributes)).toBeNull();
    expect(document.root.attributes['__proto__']).toBe('extra');
    expect(Object.entries(document.root.attributes)).toEqual([['__proto__', 'extra']]);
  });
});
