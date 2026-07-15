import { describe, expect, it } from 'vitest';
import { UnifiedLibraryService } from './service';

describe('library failure isolation', () => {
  it('keeps project-change coordination callable when the library store cannot open', async () => {
    const service = new UnifiedLibraryService('/unused', () => { throw new Error('database disk image is malformed'); });
    expect((await service.start()).phase).toBe('readOnlyFailure');
    expect(() => service.publishProjectChanged()).not.toThrow();
    expect(service.getSnapshot()).toMatchObject({ phase: 'readOnlyFailure', writable: false });
  });
});
