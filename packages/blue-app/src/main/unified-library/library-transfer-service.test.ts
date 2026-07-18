import { BlueData, GenericInstrument } from '@blue/data';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

describe('Library drag transfer lifecycle', () => {
  it('finishes a valid Orchestra drop when source drag-end cancellation races the preview', async () => {
    const data = new BlueData();
    let projectRevision = 0;
    const projectAdapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 7,
      revision: projectRevision,
      commit: () => ++projectRevision,
    }));
    let client: UnifiedLibraryRepositoryClient;
    const service = new UnifiedLibraryService(
      ':memory:',
      (path) => {
        client = UnifiedLibraryRepositoryClient.openForTesting(path);
        return client;
      },
      projectAdapter,
    );
    await service.start();
    try {
      const instrument = new GenericInstrument();
      instrument.setName('Drop Me');
      const payloadXml = instrument.saveAsXML().toXml();
      const item = await client!.runForTesting((repository) => repository.createItem({
        libraryType: 'instrument',
        parentId: repository.getRoot('instrument').id,
        displayName: 'Drop Me',
        payload: {
          embeddedName: 'Drop Me',
          objectType: 'blue.orchestra.GenericInstrument',
          supportStatus: 'supported',
          supportReasonCode: null,
          supportMessage: null,
          payloadXml,
          rawHash: 'raw',
          canonicalContentHash: 'canonical',
          serializerRevision: null,
          preview: {},
          dependencies: { itemOwned: [], unresolvedExternal: [] },
          metadataRevision: 1,
        },
      }));
      const dragSessionId = 'orchestra-drop-race';
      await expect(service.beginLibraryDrag({
        dragSessionId,
        key: { scope: 'user', libraryType: 'instrument', nodeId: item.id },
        revision: item.revision,
      })).resolves.toMatchObject({ ok: true });

      const previewPromise = service.previewLibraryTransfer({
        source: { kind: 'drag', dragSessionId },
        target: {
          kind: 'orchestra',
          projectSessionId: 7,
          projectRevision: 0,
          insertIndex: 0,
        },
        mode: 'independent',
      });
      service.cancelLibraryDrag(dragSessionId);
      const preview = await previewPromise;
      expect(preview).toMatchObject({ ok: true, value: { canApply: true } });
      if (!preview.ok) throw new Error(preview.error.message);

      await expect(service.applyLibraryTransfer(preview.value.previewToken)).resolves.toMatchObject({
        ok: true,
        value: { libraryType: 'instrument', projectRevision: 1 },
      });
      expect(data.getArrangement().size()).toBe(1);
      expect(data.getArrangement().getArrangement()[0]?.instr?.getName()).toBe('Drop Me');
    } finally {
      await service.stop();
    }
  });
});
