import { describe, expect, it } from 'vitest';
import {
  EMPTY_LEGACY_LIBRARY_FIXTURES,
  NESTED_LEGACY_LIBRARY_FIXTURES,
  JAVA_COMPATIBILITY_LIBRARY_FIXTURES,
} from './fixtures/legacy-library-corpus';
import { exportLegacyLibraryDocument, parseLegacyLibraryDocument } from './legacy-library-codec';

describe('legacy library envelope codec', () => {
  it('recognizes the four Java Blue roots and stable type descriptors', () => {
    const plans = EMPTY_LEGACY_LIBRARY_FIXTURES.map((fixture) =>
      parseLegacyLibraryDocument(fixture.xml),
    );

    expect(plans.map((plan) => plan.libraryType)).toEqual([
      'instrument',
      'udo',
      'effect',
      'soundObject',
    ]);
    expect(plans.map((plan) => plan.root.children)).toEqual([[], [], [], []]);
    expect(plans.map(exportLegacyLibraryDocument)).toEqual([
      '<instrumentLibrary><instrumentCategory categoryName="Instrument Library" isRoot="true"></instrumentCategory></instrumentLibrary>',
      '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"></udoCategory></udoLibrary>',
      '<effectsLibrary><effectCategory categoryName="Effects Library" isRoot="true"></effectCategory></effectsLibrary>',
      '<soundObjectLibrary><category categoryName="SoundObject Library"></category></soundObjectLibrary>',
    ]);
  });

  it('preserves recursive category and leaf order for the three category-first formats', () => {
    for (const fixture of NESTED_LEGACY_LIBRARY_FIXTURES.slice(0, 3)) {
      const plan = parseLegacyLibraryDocument(fixture.xml);
      expect(plan.root.children).toHaveLength(1);
      expect(plan.root.children[0]?.kind).toBe('folder');
      if (plan.root.children[0]?.kind === 'folder') {
        expect(plan.root.children[0].children[0]?.kind).toBe('item');
      }

      const reparsed = parseLegacyLibraryDocument(exportLegacyLibraryDocument(plan));
      expect(reparsed.folderCount).toBe(plan.folderCount);
      expect(reparsed.itemCount).toBe(plan.itemCount);
    }
  });

  it('preserves mixed SoundObject folder/item ordering and raw unsupported payloads', () => {
    const fixture = NESTED_LEGACY_LIBRARY_FIXTURES[3];
    const plan = parseLegacyLibraryDocument(fixture.xml);

    expect(plan.root.children.map((child) => child.kind)).toEqual(['item', 'folder', 'item']);
    expect(plan.unsupportedCount).toBe(1);

    const unsupported = plan.root.children[2];
    expect(unsupported?.kind).toBe('item');
    if (unsupported?.kind === 'item') {
      expect(unsupported.payload.supportStatus).toBe('unsupported');
      expect(unsupported.payload.rawXml).toContain('<!--preserve-->');
      expect(unsupported.payload.rawXml).toContain('<![CDATA[do-not-run()]]>');
    }

    const exported = exportLegacyLibraryDocument(plan);
    expect(exported).toContain(unsupported?.kind === 'item' ? unsupported.payload.rawXml : '');
  });

  it('marks a known outer type with unknown nested content unsupported as a whole', () => {
    const rawLeaf =
      '<instrument type="blue.orchestra.GenericInstrument"><name>Future</name><futureField keep="exact"/></instrument>';
    const plan = parseLegacyLibraryDocument(
      `<instrumentLibrary><instrumentCategory categoryName="Root" isRoot="true">${rawLeaf}</instrumentCategory></instrumentLibrary>`,
    );
    const item = plan.root.children[0];
    expect(item?.kind).toBe('item');
    if (item?.kind === 'item') {
      expect(item.payload.supportStatus).toBe('unsupported');
      expect(item.payload.supportReasonCode).toBe('unknown-nested-content');
      expect(item.payload.rawXml).toBe(rawLeaf);
    }
  });

  it('recognizes Java-qualified built-in Sound objects as supported', () => {
    const plan = parseLegacyLibraryDocument(
      '<soundObjectLibrary><category categoryName="SoundObjects"><soundObject type="blue.soundObject.Sound"><name>Playable Sound</name><instrument type="blue.orchestra.BlueSynthBuilder"><name>Embedded</name><graphicInterface/><parameterList/><opcodeList/></instrument></soundObject></category></soundObjectLibrary>',
    );
    const item = plan.root.children[0];
    expect(item?.kind).toBe('item');
    if (item?.kind === 'item') {
      expect(item.payload.objectType).toBe('blue.soundObject.Sound');
      expect(item.payload.supportStatus).toBe('supported');
    }
  });

  it('reparses representative Java-generated compatibility fixtures without losing hierarchy or raw unsupported leaves', () => {
    for (const fixture of JAVA_COMPATIBILITY_LIBRARY_FIXTURES) {
      const original = parseLegacyLibraryDocument(fixture.xml);
      const exported = exportLegacyLibraryDocument(original);
      const reparsed = parseLegacyLibraryDocument(exported);
      expect(reparsed).toMatchObject({
        libraryType: original.libraryType,
        folderCount: original.folderCount,
        itemCount: original.itemCount,
        unsupportedCount: original.unsupportedCount,
      });
      const rawLeaves = (plan: typeof original): string[] => {
        const values: string[] = [];
        const visit = (folder: typeof plan.root): void => {
          for (const child of folder.children) {
            if (child.kind === 'folder') visit(child);
            else if (child.payload.supportStatus === 'unsupported')
              values.push(child.payload.rawXml);
          }
        };
        visit(plan.root);
        return values;
      };
      expect(rawLeaves(reparsed)).toEqual(rawLeaves(original));
    }
  });
});
