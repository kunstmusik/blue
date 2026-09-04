import { describe, expect, it } from 'vitest';
import { isLibraryEditorDocument, isLibraryEditorDocumentPatch } from './library-editor-document';

describe('Library editor document contracts', () => {
  it('accepts typed supported documents and rejects raw-XML supported documents', () => {
    expect(
      isLibraryEditorDocument({
        kind: 'udo',
        snapshot: {
          name: 'SoftClip',
          style: 'CLASSIC',
          outTypes: 'a',
          inTypes: 'a',
          inputArguments: '',
          code: 'xout ain',
          comments: '',
        },
      }),
    ).toBe(true);
    expect(isLibraryEditorDocument({ kind: 'instrument', rawXml: '<instrument />' })).toBe(false);
  });

  it('allows byte-preserved XML only for unsupported documents', () => {
    expect(
      isLibraryEditorDocument({
        kind: 'unsupported',
        libraryType: 'soundObject',
        objectType: 'FutureObject',
        message: 'Not editable',
        rawXml: '<soundObject type="FutureObject"><future/></soundObject>',
      }),
    ).toBe(true);
  });

  it('guards discriminated native patches', () => {
    expect(
      isLibraryEditorDocumentPatch({
        kind: 'effect',
        patch: { name: 'Reverb' },
      }),
    ).toBe(true);
    expect(isLibraryEditorDocumentPatch({ kind: 'effect', patch: null })).toBe(false);
  });
});
