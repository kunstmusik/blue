import { describe, expect, it, vi } from 'vitest';
import { LibraryDragSessionService } from './drag-session-service';

const key = { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'item-1' };

describe('opaque Library drag sessions', () => {
  it('returns only an opaque descriptor and validates the source revision', () => {
    const service = new LibraryDragSessionService(() => 1_000);
    const descriptor = service.begin(key, 4);
    expect(descriptor).toEqual({ dragSessionId: expect.any(String), libraryType: 'instrument' });
    expect(JSON.stringify(descriptor)).not.toContain('xml');
    expect(service.resolve(descriptor.dragSessionId, 4)).toMatchObject({ key, revision: 4 });
    expect(() => service.resolve(descriptor.dragSessionId, 5)).toThrow(/changed/i);
  });

  it('expires, cancels, and consumes a drag once', () => {
    let now = 0;
    const service = new LibraryDragSessionService(() => now, 100);
    const cancelled = service.begin(key, 1);
    service.cancel(cancelled.dragSessionId);
    expect(() => service.resolve(cancelled.dragSessionId, 1)).toThrow(/expired/i);

    const consumed = service.begin(key, 1);
    expect(service.consume(consumed.dragSessionId, 1)).toMatchObject({ key });
    expect(() => service.consume(consumed.dragSessionId, 1)).toThrow(/expired/i);

    const expired = service.begin(key, 1);
    now = 101;
    expect(() => service.resolve(expired.dragSessionId, 1)).toThrow(/expired/i);
  });

  it('supports explicit cancellation callbacks without retaining renderer payloads', () => {
    const service = new LibraryDragSessionService();
    const onCancel = vi.fn();
    const descriptor = service.begin(key, 2, onCancel);
    service.cancel(descriptor.dragSessionId);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
