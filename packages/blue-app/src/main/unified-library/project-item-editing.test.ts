import { BlueData, GenericScore, Instance, PolyObject } from '@blue/data';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { UnifiedLibraryRepositoryClient } from './repository-client';

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
