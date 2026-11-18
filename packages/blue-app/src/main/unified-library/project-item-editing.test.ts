import { forkProjectGraph } from '../project-history-graph';
import {
  BlueData,
  GenericInstrument,
  GenericScore,
  Instance,
  LiveObject,
  PolyObject,
} from '@blue/data';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vite-plus/test';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { ProjectHistory } from '../project-history';
import { ProjectSession } from '../project-session';
import { MockHistoryContext } from '../project-history-test-support';
import {
  assignExplicitScoreObjectId,
  getScoreObjectId,
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
  const linkedInstance = (id = libraryId) => {
    const instance = new Instance();
    instance.setSoundObject(definition);
    instance.setLibraryId(id);
    return instance;
  };
  const libraryGroup = new PolyObject();
  libraryGroup.newLayerAt(0).push(linkedInstance('0'));
  const nestedLibraryId = data.getSoundObjectLibrary().addObject(libraryGroup);
  const liveGroup = new PolyObject();
  liveGroup.newLayerAt(0).push(linkedInstance());
  const bins = data.getLiveData().getLiveObjectBins();
  const direct = new LiveObject();
  direct.setSoundObject(linkedInstance());
  bins.setLiveObject(0, 0, direct);
  const nested = new LiveObject();
  nested.setSoundObject(liveGroup);
  bins.setLiveObject(0, 1, nested);
  let revision = 0;
  return {
    data,
    libraryId,
    nestedLibraryId,
    definition,
    adapter: new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 4,
      revision,
      commit: () => ++revision,
    })),
  };
}

function startLibraryHistory(data: BlueData) {
  const session = new ProjectSession();
  session.replace(data, join(tmpdir(), 'library-history.blue'));
  const history = new ProjectHistory({ session });
  const context = new MockHistoryContext('ctx-library-history');
  const documentId = session.read().documentId!;
  const live = () => session.read().data!;
  const adapter = new UnifiedLibraryProjectAdapter((options) => {
    const current = session.read();
    if (!options) return { data: live(), sessionId: current.sessionId, revision: current.revision };
    const candidate = forkProjectGraph(live(), new Set(options.rootFields));
    return {
      data: candidate,
      sessionId: current.sessionId,
      revision: current.revision,
      commit: async (label?: string) => {
        const receipt = await history.commitPreparedStructuralMutation({
          label: label ?? 'Library Transfer',
          candidate,
          rootFields: options.rootFields,
          expectedDocumentId: documentId,
          expectedSessionId: current.sessionId,
          expectedRevision: current.revision,
        });
        const error = receipt.oversizeProposal?.explanation ?? receipt.error;
        if (error) throw new Error(error);
        return receipt.revision;
      },
    };
  });
  return { session, history, context, documentId, live, adapter };
}

describe('project library item editing', () => {
  it('accepts a save matching the live instrument without a new history entry', async () => {
    const data = new BlueData();
    const instrument = new GenericInstrument();
    instrument.setName('Edited elsewhere');
    data.getArrangement().addInstrument(instrument, '1');
    const { session, history, adapter } = startLibraryHistory(data);
    history.checkpointSave();
    const key = adapter
      .list('instrument')
      .find((item) => item.displayName === 'Edited elsewhere')!.key;
    const source = adapter.getEditorSource(key)!;

    const draftXml = `\n${source.payloadXml}`;
    const saved = await adapter.saveEditorSource(key, source.revision, draftXml);

    expect(saved).toEqual(source);
    expect(session.read().revision).toBe(0);
    expect(history.getEntries()).toHaveLength(0);
    expect(history.isDirty()).toBe(false);
    expect(data.getArrangement().getInstrumentById('1')).toBe(instrument);
  });

  it('reports shared usage and guarded deletion removes definitions and linked instances', () => {
    const { data, adapter, libraryId, nestedLibraryId } = projectWithSharedUsage();
    const key = adapter.list('soundObject').find((item) => item.displayName === 'Shared')!.key;
    expect(adapter.getUsage(key)).toMatchObject({
      linkedInstanceCount: 5,
      locations: expect.arrayContaining([
        'blueLive/column-0/row-0',
        'blueLive/column-0/row-1/layer-0/object-0',
        `library/${nestedLibraryId}/layer-0/object-0`,
      ]),
    });
    const preview = adapter.previewDelete(key);
    expect(preview).toMatchObject({ linkedInstanceCount: 5, requiresConfirmation: true });
    expect(adapter.deleteProjectItem(key, preview.confirmationToken)).toMatchObject({
      libraryType: 'soundObject',
    });
    expect(data.getSoundObjectLibrary().getObjectById(libraryId)).toBeUndefined();
    expect((data.getScore()[0] as PolyObject)[0]).toHaveLength(0);
    expect(
      (data.getSoundObjectLibrary().getObjectById(nestedLibraryId) as PolyObject)[0],
    ).toHaveLength(0);
    const bins = data.getLiveData().getLiveObjectBins();
    expect(bins.getLiveObject(0, 0)).toBeNull();
    expect(
      (bins.getLiveObject(0, 1)?.getSoundObject() as PolyObject | undefined)?.[0],
    ).toHaveLength(0);
  });

  it('restores a deleted project definition and linked instances through history', async () => {
    const { data, libraryId, nestedLibraryId } = projectWithSharedUsage();
    const { session, history, context, documentId, live, adapter } = startLibraryHistory(data);
    const key = adapter.list('soundObject').find((item) => item.displayName === 'Shared')!.key;
    const instanceIds = () =>
      Array.from((live().getScore()[0] as PolyObject)[0]!, getScoreObjectId);
    const definition = () => live().getSoundObjectLibrary().getObjectById(libraryId);
    const linkedDefinitions = () => {
      const score = (live().getScore()[0] as PolyObject)[0]!;
      const bins = live().getLiveData().getLiveObjectBins();
      const nested = live().getSoundObjectLibrary().getObjectById(nestedLibraryId) as PolyObject;
      return [
        ...score,
        nested[0]![0],
        bins.getLiveObject(0, 0)?.getSoundObject(),
        (bins.getLiveObject(0, 1)?.getSoundObject() as PolyObject | undefined)?.[0]![0],
      ].map((instance) => (instance as Instance).getSoundObject());
    };
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
    expect(linkedDefinitions().every((object) => object === definition())).toBe(true);
    expect(history.isDirty()).toBe(false);

    const redo = await history.redo(context.nextRedoRequest(documentId, session.read().revision));
    expect(redo.status).toBe('committed');
    expect(live().getSoundObjectLibrary().getObjectById(libraryId)).toBeUndefined();
    expect(instanceIds()).toEqual([]);
    expect(live().getLiveData().getLiveObjectBins().getLiveObject(0, 0)).toBeNull();
    expect(history.isDirty()).toBe(true);
  });

  it('rebinds every placement when replacing a definition through history', async () => {
    const { data, libraryId, nestedLibraryId } = projectWithSharedUsage();
    const { session, history, context, documentId, adapter } = startLibraryHistory(data);
    const key = adapter.list('soundObject').find((item) => item.displayName === 'Shared')!.key;
    const source = adapter.getEditorSource(key)!;
    const updated = new GenericScore();
    updated.setName('Updated shared definition');
    const result = await adapter.saveEditorSource(
      key,
      source.revision,
      updated.saveAsXML().toXml(),
    );
    expect(result?.displayName).toBe('Updated shared definition');

    const checkLinks = (name: string) => {
      const definition = data.getSoundObjectLibrary().getObjectById(libraryId)!;
      expect(definition.getName()).toBe(name);
      const bins = data.getLiveData().getLiveObjectBins();
      const nested = data.getSoundObjectLibrary().getObjectById(nestedLibraryId) as PolyObject;
      const liveGroup = bins.getLiveObject(0, 1)?.getSoundObject() as PolyObject;
      const score = (data.getScore()[0] as PolyObject)[0]!;
      for (const instance of [
        ...score,
        nested[0]![0],
        bins.getLiveObject(0, 0)?.getSoundObject(),
        liveGroup[0]![0],
      ]) {
        expect((instance as Instance).getSoundObject()).toBe(definition);
      }
    };

    checkLinks('Updated shared definition');
    const undo = await history.undo(context.nextUndoRequest(documentId, session.read().revision));
    expect(undo.status).toBe('committed');
    checkLinks('Shared');
    const redo = await history.redo(context.nextRedoRequest(documentId, session.read().revision));
    expect(redo.status).toBe('committed');
    checkLinks('Updated shared definition');
  });

  it('copies a project item into the user repository with a new stable UUID', async () => {
    const { adapter } = projectWithSharedUsage();
    const key = adapter.list('soundObject').find((item) => item.displayName === 'Shared')!.key;
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
