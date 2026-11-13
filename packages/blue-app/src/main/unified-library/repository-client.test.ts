import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient, type RepositoryWorkerPort } from './repository-client';

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

  it('rejects pending requests if the worker exits cleanly with code 0', async () => {
    class FakeWorker extends EventEmitter implements RepositoryWorkerPort {
      posted: unknown[] = [];
      postMessage(value: unknown): void {
        this.posted.push(value);
      }
      async terminate(): Promise<number> {
        return 0;
      }
    }

    const fakeWorker = new FakeWorker();
    const client = UnifiedLibraryRepositoryClient.openWorkerForTesting(fakeWorker);
    const pendingSnapshot = client.getSnapshot();
    const queuedSnapshot = client.getSnapshot();
    const pendingRejection = expect(pendingSnapshot).rejects.toThrow(/exited with 0/i);
    const queuedRejection = expect(queuedSnapshot).rejects.toThrow(/closed/i);
    await Promise.resolve();
    expect(fakeWorker.posted).toHaveLength(1);

    fakeWorker.emit('exit', 0);

    await Promise.all([pendingRejection, queuedRejection]);
    expect(fakeWorker.posted).toHaveLength(1);
    await expect(client.getSnapshot()).rejects.toThrow(/closed/i);
  });
});
