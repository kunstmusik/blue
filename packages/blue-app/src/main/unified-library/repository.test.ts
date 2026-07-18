import { describe, expect, it } from 'vitest';
import { classifyLibraryPayload, parseRawXmlDocument, stableTextHash } from '@blue/data';
import { UnifiedLibraryRepository } from './repository';
import { createUnifiedLibraryTestDirectory } from './test-helpers';

const ITEM_PAYLOAD = {
  embeddedName: 'Pad',
  objectType: 'blue.orchestra.GenericInstrument',
  supportStatus: 'supported' as const,
  supportReasonCode: null,
  supportMessage: null,
  payloadXml: '<instrument type="blue.orchestra.GenericInstrument"><name>Pad</name></instrument>',
  rawHash: 'raw-pad',
  canonicalContentHash: 'canonical-pad',
  serializerRevision: '1',
  preview: { description: { state: 'unavailable', reason: 'not provided' } },
  dependencies: { unresolved: [] },
  metadataRevision: 1,
};

describe('UnifiedLibraryRepository foundation', () => {
  it('retains stable UUID identity across rename while duplicate gets a new identity', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const item = repository.createItem({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Pad',
        payload: ITEM_PAYLOAD,
      });
      const renamed = repository.renameNode(item.id, item.revision, 'Warm Pad');
      const duplicate = repository.duplicateNode(renamed.id, renamed.revision);

      expect(renamed.id).toBe(item.id);
      expect(duplicate.id).not.toBe(item.id);
      expect(duplicate.displayName).toBe('Warm Pad');
    } finally {
      repository.close();
    }
  });

  it('keeps payloads lazy and rejects stale revisions atomically', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const item = repository.createItem({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Pad',
        payload: ITEM_PAYLOAD,
      });

      const listed = repository.listChildren(root.id);
      expect(listed[0]).not.toHaveProperty('payloadXml');
      expect(repository.getItemPayload(item.id).payloadXml).toBe(ITEM_PAYLOAD.payloadXml);
      expect(() => repository.renameNode(item.id, item.revision + 1, 'Wrong')).toThrow(
        /stale revision/i,
      );
      expect(repository.getNode(item.id).displayName).toBe('Pad');
    } finally {
      repository.close();
    }
  });

  it('promotes unchanged Java-qualified built-ins when support becomes available', () => {
    const directory = createUnifiedLibraryTestDirectory('blue-library-reclassify-');
    const payloadXml = '<soundObject type="blue.soundObject.Sound"><name>Playable Sound</name><instrument type="blue.orchestra.BlueSynthBuilder"><name>Embedded</name><graphicInterface/><parameterList/><opcodeList/></instrument></soundObject>';
    const classified = classifyLibraryPayload('soundObject', parseRawXmlDocument(payloadXml).root);
    expect(classified).toMatchObject({ supportStatus: 'supported', rawHash: stableTextHash(payloadXml) });
    try {
      const initial = UnifiedLibraryRepository.open(directory.databasePath);
      const root = initial.getRoot('soundObject');
      const item = initial.createItem({
        libraryType: 'soundObject',
        parentId: root.id,
        displayName: 'Playable Sound',
        payload: {
          embeddedName: 'Playable Sound',
          objectType: 'blue.soundObject.Sound',
          supportStatus: 'unsupported',
          supportReasonCode: 'unknown-type',
          supportMessage: 'Unsupported before upgrade',
          payloadXml,
          rawHash: stableTextHash(payloadXml),
          canonicalContentHash: stableTextHash(payloadXml),
          serializerRevision: null,
          preview: {},
          dependencies: {},
          metadataRevision: 1,
        },
      });
      initial.close();

      const upgraded = UnifiedLibraryRepository.open(directory.databasePath);
      expect(upgraded.getItemPayload(item.id)).toMatchObject({
        supportStatus: 'supported',
        supportReasonCode: null,
        supportMessage: null,
        payloadXml,
        metadataRevision: 2,
      });
      expect(upgraded.getNode(item.id).revision).toBe(item.revision + 1);
      upgraded.close();
    } finally {
      directory.cleanup();
    }
  });
});
