// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type { MissingAudioAssetsSession } from '../../shared/missing-audio-assets';

describe('project-store — missing-audio resolve refresh', () => {
  beforeEach(() => {
    useProjectStore.getState().clearProject();
  });

  afterEach(() => {
    useProjectStore.getState().clearProject();
  });

  it('marks the project dirty and applies the refreshed snapshot after a changed resolve', () => {
    expect(useProjectStore.getState().isDirty).toBe(false);

    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.globalOrc = 'instr 1\nendin';

    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(useProjectStore.getState().globalOrc).toBe('instr 1\nendin');
  });

  it('setMissingAudioSession stores and clears the active session', () => {
    const session: MissingAudioAssetsSession = {
      sessionId: 's1',
      projectSessionId: 1,
      projectFilePath: '/p/x.blue',
      missingFiles: [{ originalPath: 'a.wav', replacementPath: '' }],
    };

    useProjectStore.getState().setMissingAudioSession(session);
    expect(useProjectStore.getState().missingAudioSession).toEqual(session);

    useProjectStore.getState().setMissingAudioSession(null);
    expect(useProjectStore.getState().missingAudioSession).toBeNull();
  });

  it('clearProject resets the missing-audio session', () => {
    useProjectStore.getState().setMissingAudioSession({
      sessionId: 's1',
      projectSessionId: 1,
      projectFilePath: null,
      missingFiles: [],
    });
    useProjectStore.getState().clearProject();
    expect(useProjectStore.getState().missingAudioSession).toBeNull();
  });
});
