import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryItemKey, LibraryItemPreview, LibraryResult } from '../shared/unified-library';

const invoke = vi.hoisted(() => vi.fn());
const expose = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({
  clipboard: { writeText: vi.fn(), readText: vi.fn() },
  contextBridge: { exposeInMainWorld: expose },
  ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn() },
  webUtils: { getPathForFile: vi.fn(() => '') },
}));

describe('library XML diagnostic IPC', () => {
  beforeEach(() => {
    invoke.mockReset();
    expose.mockClear();
    vi.resetModules();
  });
  it.each(['warning', 'error'] as const)(
    'preserves serializable %s source paths and recovery information',
    async (severity) => {
      await import('./preload');
      const bridge = expose.mock.calls.find(([name]) => name === 'blueAPI')![1] as {
        getLibraryItemPreview(key: LibraryItemKey): Promise<LibraryResult<LibraryItemPreview>>;
      };
      const diagnostic = {
        severity,
        code: 'contract',
        source: {
          kind: 'library',
          label: 'Imported Pad',
          nativePath: 'C:\\Users\\artist\\library.xml',
          libraryItemId: 'item-1',
        },
        path: '/instrument/graphicInterface[1]',
        member: '@type',
        value: 'future.Widget',
        message: 'Unsupported widget.',
        recovery: 'Preserve the original archive.',
      };
      const response =
        severity === 'error'
          ? {
              ok: false,
              error: {
                code: 'validation-failed',
                message: diagnostic.message,
                retryable: false,
                diagnostics: [diagnostic],
              },
            }
          : { ok: true, value: { diagnostics: [diagnostic] } };
      invoke.mockResolvedValueOnce(structuredClone(response));
      expect(
        await bridge.getLibraryItemPreview({
          scope: 'user',
          libraryType: 'instrument',
          nodeId: 'item-1',
        }),
      ).toEqual(response);
    },
  );
});
