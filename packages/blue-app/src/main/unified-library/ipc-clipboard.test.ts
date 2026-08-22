import type { IpcMain } from 'electron';
import { describe, expect, it, vi } from 'vitest';

import { UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL } from '../../shared/unified-library';
import { registerUnifiedLibraryIpc } from './ipc';
import { UnifiedLibraryService } from './service';

describe('Unified Library clipboard IPC', () => {
  it('accepts validated BSB buffers, rejects malformed payloads, and unregisters', () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel);
      }),
    } as unknown as IpcMain;
    const service = new UnifiedLibraryService(':memory:');
    const unregister = registerUnifiedLibraryIpc({
      ipcMain,
      service,
      getWindows: () => [],
    });
    const handler = handlers.get(UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL)!;
    const clipboard = {
      originX: 10,
      originY: 20,
      widgets: [{
        id: 'slider-1', type: 'BSBHSlider', objectName: 'amp',
        x: 10, y: 20, width: 120, height: 24,
        value: 0.5, minimum: 0, maximum: 1, editable: true,
        properties: {},
      }],
    };

    expect(handler({}, clipboard)).toBe(true);
    expect(service.getSnapshot().bsbClipboard).toEqual(clipboard);
    expect(handler({}, { ...clipboard, originX: Number.NaN })).toBe(false);
    expect(service.getSnapshot().bsbClipboard).toEqual(clipboard);

    unregister();
    expect(handlers.has(UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL)).toBe(false);
  });
});
