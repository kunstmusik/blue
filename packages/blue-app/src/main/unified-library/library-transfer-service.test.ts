import { BlueData, GenericInstrument, GenericScore, PolyObject } from '@blue/data';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

describe('Library drag transfer lifecycle', () => {
  it('captures one timeline SoundObject into the shared typed buffer for user-library Paste', async () => {
    const data = new BlueData();
    const rootGroup = data.getScore()[0];
    if (!(rootGroup instanceof PolyObject)) throw new Error('Expected the default PolyObject root');
    const soundObject = new GenericScore();
    soundObject.setName('Copied From Timeline');
    rootGroup[0]!.push(soundObject);
    const adapter = new UnifiedLibraryProjectAdapter(() => ({ data, sessionId: 9, revision: 2 }));
    let client: UnifiedLibraryRepositoryClient;
    const service = new UnifiedLibraryService(
      ':memory:',
      (path) => {
        client = UnifiedLibraryRepositoryClient.openForTesting(path);
        return client;
      },
      adapter,
    );
    await service.start();
    try {
      const captured = await service.captureScoreSoundObjectClipboard({
        projectSessionId: 9,
        projectRevision: 2,
        location: {
          rootGroupIndex: 0,
          containerPath: [],
          layerIndex: 0,
          objectIndex: 0,
        },
      });
      expect(captured).toMatchObject({
        ok: true,
        value: {
          operation: 'copy',
          source: { kind: 'buffer', libraryType: 'soundObject' },
        },
      });
      if (!captured.ok) throw new Error(captured.error.message);

      const userRoot = await client!.getRoot('soundObject');
      await expect(
        service.copyLibraryTransferToUser(
          { kind: 'clipboard', source: captured.value.source },
          userRoot.id,
        ),
      ).resolves.toMatchObject({
        ok: true,
        value: { affectedNodes: [{ displayName: 'Copied From Timeline' }] },
      });
    } finally {
      await service.stop();
    }
  });

  it('cuts a user folder immediately and pastes reusable deep copies from a detached buffer', async () => {
    let client: UnifiedLibraryRepositoryClient;
    const service = new UnifiedLibraryService(':memory:', (path) => {
      client = UnifiedLibraryRepositoryClient.openForTesting(path);
      return client;
    });
    await service.start();
    try {
      const root = await client!.getRoot('instrument');
      const folder = await client!.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Cut Folder',
      });
      const nested = await client!.createFolder({
        libraryType: 'instrument',
        parentId: folder.id,
        displayName: 'Nested',
      });
      const instrument = new GenericInstrument();
      instrument.setName('Nested Lead');
      await client!.createItem({
        libraryType: 'instrument',
        parentId: nested.id,
        displayName: 'Nested Lead',
        payload: {
          embeddedName: 'Nested Lead',
          objectType: 'blue.orchestra.GenericInstrument',
          supportStatus: 'supported',
          supportReasonCode: null,
          supportMessage: null,
          payloadXml: instrument.saveAsXML().toXml(),
          rawHash: 'nested-raw',
          canonicalContentHash: 'nested-canonical',
          serializerRevision: null,
          preview: {},
          dependencies: { itemOwned: [], unresolvedExternal: [] },
          metadataRevision: 1,
        },
      });

      const prepared = await service.prepareLibraryMutation({
        type: 'deleteNode',
        nodeId: folder.id,
        expectedRevision: folder.revision,
      });
      expect(prepared).toMatchObject({ ok: true, value: { affectedCount: 3 } });
      if (!prepared.ok) throw new Error(prepared.error.message);
      const cut = await service.cutLibraryToClipboard({
        source: {
          kind: 'userNode',
          libraryType: 'instrument',
          nodeId: folder.id,
          revision: folder.revision,
        },
        confirmationToken: prepared.value.confirmationToken,
      });
      expect(cut).toMatchObject({
        ok: true,
        value: {
          clipboard: {
            operation: 'cut',
            source: { kind: 'buffer', libraryType: 'instrument' },
          },
        },
      });
      if (!cut.ok) throw new Error(cut.error.message);
      await expect(client!.getNode(folder.id)).rejects.toThrow(/not found/i);

      const reference = { kind: 'clipboard' as const, source: cut.value.clipboard.source };
      await expect(service.copyLibraryTransferToUser(reference, root.id)).resolves.toMatchObject({
        ok: true,
      });
      await expect(service.copyLibraryTransferToUser(reference, root.id)).resolves.toMatchObject({
        ok: true,
      });
      const pastedFolders = (await client!.listChildren(root.id)).filter(
        (node) => node.displayName === 'Cut Folder',
      );
      expect(pastedFolders).toHaveLength(2);
      for (const pastedFolder of pastedFolders) {
        const nestedCopy = (await client!.listChildren(pastedFolder.id))[0]!;
        const itemCopy = (await client!.listChildren(nestedCopy.id))[0]!;
        expect({
          nestedName: nestedCopy.displayName,
          itemName: itemCopy.displayName,
          payload: (await client!.getItemPayload(itemCopy.id)).payloadXml,
        }).toMatchObject({
          nestedName: 'Nested',
          itemName: 'Nested Lead',
          payload: expect.stringContaining('Nested Lead'),
        });
      }
    } finally {
      await service.stop();
    }
  });

  it('cuts a project item immediately and pastes it from the same detached typed buffer', async () => {
    const data = new BlueData();
    const instrument = new GenericInstrument();
    instrument.setName('Project Cut');
    data.getArrangement().addInstrument(instrument, '1');
    let projectRevision = 0;
    const projectAdapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 15,
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
      const source = projectAdapter.list('instrument')[0]!;
      const opened = await service.openLibraryItemEditor(source.key, false);
      expect(opened).toMatchObject({ ok: true });
      if (!opened.ok) throw new Error(opened.error.message);
      service.patchLibraryEditorSession({
        sessionId: opened.value.sessionId,
        documentPatch: {
          kind: 'instrument',
          patch: {
            type: 'updateInstrument',
            assignmentId: 'library-item',
            patch: { name: 'Protected Project Draft' },
          },
        },
      });
      const preview = service.previewProjectLibraryDelete(source.key);
      expect(preview).toMatchObject({ ok: true });
      if (!preview.ok) throw new Error(preview.error.message);
      await expect(
        service.cutLibraryToClipboard({
          source: { kind: 'library', key: source.key, revision: source.revision },
          confirmationToken: preview.value.confirmationToken,
        }),
      ).resolves.toMatchObject({ ok: false, error: { code: 'validation-failed' } });
      expect(data.getArrangement().size()).toBe(1);
      await service.revertLibraryEditorSession(opened.value.sessionId);
      const confirmedPreview = service.previewProjectLibraryDelete(source.key);
      if (!confirmedPreview.ok) throw new Error(confirmedPreview.error.message);
      const cut = await service.cutLibraryToClipboard({
        source: { kind: 'library', key: source.key, revision: source.revision },
        confirmationToken: confirmedPreview.value.confirmationToken,
      });
      expect(cut).toMatchObject({
        ok: true,
        value: {
          clipboard: { source: { kind: 'buffer', libraryType: 'instrument' } },
          closedEditorSessionIds: [opened.value.sessionId],
        },
      });
      if (!cut.ok) throw new Error(cut.error.message);
      expect(data.getArrangement().size()).toBe(0);

      const root = await client!.getRoot('instrument');
      await expect(
        service.copyLibraryTransferToUser(
          { kind: 'clipboard', source: cut.value.clipboard.source },
          root.id,
        ),
      ).resolves.toMatchObject({
        ok: true,
        value: { affectedNodes: [{ displayName: 'Project Cut' }] },
      });
      expect(data.getArrangement().size()).toBe(0);
    } finally {
      await service.stop();
    }
  });

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
      const item = await client!.runForTesting((repository) =>
        repository.createItem({
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
        }),
      );
      const dragSessionId = 'orchestra-drop-race';
      await expect(
        service.beginLibraryDrag({
          dragSessionId,
          key: { scope: 'user', libraryType: 'instrument', nodeId: item.id },
          revision: item.revision,
        }),
      ).resolves.toMatchObject({ ok: true });

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

      await expect(service.applyLibraryTransfer(preview.value.previewToken)).resolves.toMatchObject(
        {
          ok: true,
          value: { libraryType: 'instrument', projectRevision: 1 },
        },
      );
      expect(data.getArrangement().size()).toBe(1);
      expect(data.getArrangement().getArrangement()[0]?.instr?.getName()).toBe('Drop Me');
    } finally {
      await service.stop();
    }
  });

  it('copies an opaque project drag into the matching user library', async () => {
    const data = new BlueData();
    const instrument = new GenericInstrument();
    instrument.setName('Project Lead');
    data.getArrangement().addInstrument(instrument, '1');
    const projectAdapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 9,
      revision: 3,
      commit: () => 4,
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
      const source = projectAdapter.list('instrument')[0]!;
      const dragSessionId = 'project-to-user-drag';
      await expect(
        service.beginLibraryDrag({
          dragSessionId,
          key: source.key,
          revision: source.revision,
        }),
      ).resolves.toMatchObject({
        ok: true,
        value: { libraryType: 'instrument', sourceScope: 'projectOwned' },
      });

      const root = await client!.getRoot('instrument');
      const result = await service.copyLibraryTransferToUser(
        { kind: 'drag', dragSessionId },
        root.id,
      );

      expect(result).toMatchObject({
        ok: true,
        value: { affectedNodes: [{ displayName: 'Project Lead', scope: 'user' }] },
      });
      expect(service.cancelLibraryDrag(dragSessionId)).toBeUndefined();
    } finally {
      await service.stop();
    }
  });

  it('routes an exact UDO transfer into the addressed Instrument UDO list', async () => {
    const data = new BlueData();
    const instrument = new GenericInstrument();
    instrument.setName('UDO Host');
    data.getArrangement().addInstrument(instrument, '7');
    let projectRevision = 0;
    const projectAdapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 12,
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
      const payloadXml =
        '<udo><style>CLASSIC</style><opcodeName>embeddedTone</opcodeName><outTypes>a</outTypes><inTypes>a</inTypes><codeBody>aout = ain</codeBody><comments/></udo>';
      const item = await client!.runForTesting((repository) =>
        repository.createItem({
          libraryType: 'udo',
          parentId: repository.getRoot('udo').id,
          displayName: 'embeddedTone',
          payload: {
            embeddedName: 'embeddedTone',
            objectType: 'blue.udo.UserDefinedOpcode',
            supportStatus: 'supported',
            supportReasonCode: null,
            supportMessage: null,
            payloadXml,
            rawHash: 'raw-udo',
            canonicalContentHash: 'canonical-udo',
            serializerRevision: null,
            preview: {},
            dependencies: { itemOwned: [], unresolvedExternal: [] },
            metadataRevision: 1,
          },
        }),
      );

      const preview = await service.previewLibraryTransfer({
        source: {
          kind: 'clipboard',
          source: {
            kind: 'userNode',
            libraryType: 'udo',
            nodeId: item.id,
            revision: item.revision,
          },
        },
        target: {
          kind: 'projectUdo',
          projectSessionId: 12,
          projectRevision: 0,
          instrumentAssignmentId: '7',
          insertIndex: 0,
        },
      });
      expect(preview).toMatchObject({ ok: true, value: { canApply: true } });
      if (!preview.ok) throw new Error(preview.error.message);
      await expect(service.applyLibraryTransfer(preview.value.previewToken)).resolves.toMatchObject(
        {
          ok: true,
          value: { libraryType: 'udo', projectRevision: 1 },
        },
      );

      expect(data.getOpcodeList().size()).toBe(0);
      expect(instrument.getOpcodeList().getOpcode(0)?.getName()).toBe('embeddedTone');
    } finally {
      await service.stop();
    }
  });
});
