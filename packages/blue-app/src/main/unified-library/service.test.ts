import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

describe('UnifiedLibraryService foundation', () => {
  it('moves from initializing to ready and publishes snapshots', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    const phases: string[] = [];
    const unsubscribe = service.onSnapshot((snapshot) => phases.push(snapshot.phase));

    await expect(service.start()).resolves.toMatchObject({
      phase: 'ready',
      writable: true,
      contentRevision: 0,
    });
    expect(phases).toEqual(['initializing', 'ready']);

    unsubscribe();
    await service.stop();
    expect(service.getSnapshot().phase).toBe('stopped');
  });

  it('serializes long-running operation leases and releases idempotently', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();
    const release = service.acquireOperation('manualImport', 'previewing');

    expect(service.getSnapshot().operation?.kind).toBe('manualImport');
    expect(() => service.acquireOperation('export', 'preflight')).toThrow(/already in progress/i);
    release();
    release();
    expect(service.getSnapshot().operation).toBeUndefined();

    await service.stop();
  });
});
