// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openUnifiedLibraries } from '../stores/library-routing';
import { useLibraryStore } from '../stores/library-store';
import { useWorkbenchStore } from '../stores/workbench-store';

describe('unified library contextual entry points', () => {
  beforeEach(() => {
    useLibraryStore.getState().reset();
    useWorkbenchStore.setState({ openPanel: vi.fn() as never });
    window.blueAPI = {
      ...window.blueAPI,
      setLibraryContext: vi.fn(async (request) => ({
        ok: true as const,
        value: {
          selectedType: request.type === 'instrumentTarget' ? 'instrument' as const : 'effect' as const,
          target: {
            libraryType: request.type === 'instrumentTarget' ? 'instrument' as const : 'effect' as const,
            projectSessionId: request.projectSessionId,
            label: request.type === 'instrumentTarget' ? 'Project Orchestra' : '1 / pre',
            valid: true,
            targetRevision: '0',
          },
        },
      })),
    };
  });

  it('routes Orchestra browse through the fixed Instrument target', async () => {
    await openUnifiedLibraries({ type: 'instrumentTarget', projectSessionId: 12 });
    expect(window.blueAPI.setLibraryContext).toHaveBeenCalledWith({
      type: 'instrumentTarget', projectSessionId: 12,
    });
    expect(useWorkbenchStore.getState().openPanel).toHaveBeenCalledWith('LibrariesTopComponent');
    expect(useLibraryStore.getState().typeFilter).toBe('instrument');
  });

  it('routes Mixer browse with an exact chain boundary', async () => {
    await openUnifiedLibraries({
      type: 'effectTarget',
      projectSessionId: 12,
      channelId: '1',
      chain: 'pre',
      insertIndex: 2,
      targetRevision: 'current',
    });
    expect(window.blueAPI.setLibraryContext).toHaveBeenCalledWith(expect.objectContaining({
      type: 'effectTarget', channelId: '1', chain: 'pre', insertIndex: 2,
    }));
    expect(useLibraryStore.getState().typeFilter).toBe('effect');
  });
});
