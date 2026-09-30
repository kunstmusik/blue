import { BlueData, GenericScore, Instance, PolyObject } from '@blue/data';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { ProjectHistory } from '../project-history';
import { ProjectSession } from '../project-session';
import { MockHistoryContext } from '../project-history-test-support';
import {
  assignExplicitScoreObjectId,
  getScoreObjectId,
  transferProjectEditorIdentities,
} from '../../shared/project-editor/identity';

function projectWithSharedUsage() {
  const data = new BlueData();
  const definition = new GenericScore();
  definition.setName('Shared');
  const libraryId = data.getSoundObjectLibrary().addObject(definition);
  const group = new PolyObject(true);
  group.newLayerAt(0);
  for (let i = 0; i < 2; i += 1) {
    const instance = new Instance();
    instance.setSoundObject(definition);
    instance.setLibraryId(libraryId);
    assignExplicitScoreObjectId(instance, `shared-instance-${i}`);
    group[0]!.push(instance);
  }
  data.getScore().push(group);
  let revision = 0;
  return {
    data,
    adapter: new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 4,
      revision,
      commit: () => ++revision,
    })),
  };
}

describe('project library item editing', () => {
  it('reports shared usage and guarded deletion removes definitions and linked instances', () => {
    const { data, adapter } = projectWithSharedUsage();
    const key = adapter.list('soundObject')[0]!.key;
    expect(adapter.getUsage(key)).toMatchObject({ linkedInstanceCount: 2 });
    const preview = adapter.previewDelete(key);
    expect(preview).toMatchObject({ linkedInstanceCount: 2, requiresConfirmation: true });
    expect(adapter.deleteProjectItem(key, preview.confirmationToken)).toMatchObject({
      libraryType: 'soundObject',
    });
    expect(data.getSoundObjectLibrary().size()).toBe(0);
    expect((data.getScore()[0] as PolyObject)[0]).toHaveLength(0);
  });

  it('restores a deleted project definition and linked instances through history', async () => {
    const { data } = projectWithSharedUsage();
    const session = new ProjectSession();
    session.replace(data, join(tmpdir(), 'library-delete.blue'));
    const history = new ProjectHistory({ session });
    const context = new MockHistoryContext('ctx-library-delete');
    const documentId = session.read().documentId!;
    const live = () => session.read().data!;
    const adapter = new UnifiedLibraryProjectAdapter(() => {
      const current = session.read();
      const candidate = live().historyCopy();
      transferProjectEditorIdentities(live(), candidate);
      return {
        data: candidate,
        sessionId: current.sessionId,
        revision: current.revision,
        commit: async (label?: string) => {
          const receipt = await history.commitPreparedStructuralMutation({
            label: label ?? 'Library Transfer',
            candidate,
            expectedDocumentId: documentId,
            expectedSessionId: current.sessionId,
            expectedRevision: current.revision,
          });
          if (!receipt.changed) throw new Error(receipt.error ?? 'Deletion was not committed');
          return receipt.revision;
        },
      };
    });
    const key = adapter.list('soundObject')[0]!.key;
    const libraryId =
      key.scope === 'projectShared' && key.locator.kind === 'soundObject'
        ? key.locator.libraryId
        : '';
    const instanceIds = () =>
      Array.from((live().getScore()[0] as PolyObject)[0]!, getScoreObjectId);
    history.markClean();
    const baselineXml = live().saveToString();
    const baselineIds = instanceIds();

    const preview = adapter.previewDelete(key);
    await adapter.deleteProjectItem(key, preview.confirmationToken);
    expect(live().getSoundObjectLibrary().getObjectById(libraryId)).toBeUndefined();
    expect(instanceIds()).toEqual([]);
    expect(history.isDirty()).toBe(true);
    expect(history.read().undoLabel).toBe('Delete Project Library Item');

    const undo = await history.undo(context.nextUndoRequest(documentId, session.read().revision));
    expect(undo.status).toBe('committed');
    expect(live().saveToString()).toBe(baselineXml);
    expect(instanceIds()).toEqual(baselineIds);
    expect(history.isDirty()).toBe(false);

    const redo = await history.redo(context.nextRedoRequest(documentId, session.read().revision));
    expect(redo.status).toBe('committed');
    expect(live().getSoundObjectLibrary().getObjectById(libraryId)).toBeUndefined();
    expect(instanceIds()).toEqual([]);
    expect(history.isDirty()).toBe(true);
  });

  it('copies a project item into the user repository with a new stable UUID', async () => {
    const { adapter } = projectWithSharedUsage();
    const key = adapter.list('soundObject')[0]!.key;
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const root = await client.getRoot('soundObject');
      const copy = await adapter.copyProjectItemToUser(key, client, root.id);
      expect(copy.id).not.toBe(
        key.scope === 'user'
          ? key.nodeId
          : key.locator.kind === 'soundObject'
            ? key.locator.libraryId
            : '',
      );
      expect((await client.getItemPayload(copy.id)).payloadXml).toContain('Shared');
    } finally {
      await client.close();
    }
  });
});
