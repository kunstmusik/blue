import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';

describe('UnifiedLibraryRepositoryClient', () => {
  it('serializes in-process requests and closes deterministically', async () => {
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    const order: number[] = [];

    const first = client.runForTesting(async (repository) => {
      await Promise.resolve();
      order.push(1);
      return repository.getContentRevision();
    });
    const second = client.runForTesting((repository) => {
      order.push(2);
      return repository.getContentRevision();
    });

    await expect(Promise.all([first, second])).resolves.toEqual([0, 0]);
    expect(order).toEqual([1, 2]);
    await client.close();
    await expect(client.getSnapshot()).rejects.toThrow(/closed/i);
  });

  it('transfers bounded repository errors without breaking the queue', async () => {
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      await expect(client.getNode('missing')).rejects.toThrow(/not found/i);
      await expect(client.getSnapshot()).resolves.toMatchObject({ contentRevision: 0 });
    } finally {
      await client.close();
    }
  });
});
