// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testClearPendingPatches,
  __testFlushPendingPatches,
  useProjectStore,
} from '../stores/project-store';
import { useMidiRoutingStore } from '../stores/midi-routing-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type { MissingAudioAssetsSession } from '../../shared/missing-audio-assets';

function createFocusSnapshot(sessionId: number) {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.loaded = true;
  snapshot.sessionId = sessionId;
  snapshot.orchestra.arrangement.rows = [{
    assignmentId: '1',
    enabled: true,
    instrumentName: 'Orchestra Name',
    instrumentType: 'generic',
    instrumentSummary: 'GenericInstrument',
    editable: true,
  }];
  snapshot.score!.layerGroups = [{
    groupId: 'root-group',
    groupType: 'track',
    name: 'Tracks',
    defaultHeightIndex: 1,
    layerCount: 1,
    isOpenableContainer: true,
    layers: [{
      layerId: 'track-1',
      layerKind: 'track',
      name: 'Track Name',
      height: 22,
      items: [],
      instrument: null,
    }],
  }];
  return snapshot;
}

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

describe('project-store — canonical acknowledgement barrier', () => {
  const commitProjectDocumentPatches = vi.fn();
  const getProjectDocument = vi.fn();

  beforeEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
    const snapshot = createEmptyProjectEditorSnapshot();
    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      loaded: true,
      filePath: '/tmp/parity.blue',
      sessionId: 1,
    });
    window.blueAPI = {
      ...window.blueAPI,
      commitProjectDocumentPatches,
      getProjectDocument,
    };
    commitProjectDocumentPatches.mockReset();
    getProjectDocument.mockReset();
    getProjectDocument.mockResolvedValue(null);
  });

  afterEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
  });

  it('restores the prior dirty state after a changed:false acknowledgement', async () => {
    commitProjectDocumentPatches.mockResolvedValue({
      revision: 0,
      sessionId: 1,
      changed: false,
    });

    await useProjectStore.getState().applyBlueLivePatch({
      type: 'updateTempoRepeat',
      patch: { tempo: 60 },
    });
    expect(useProjectStore.getState().isDirty).toBe(true);

    await useProjectStore.getState().flushPendingPatches();

    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('drains edits queued while another commit is in flight', async () => {
    let resolveFirst!: (value: { revision: number; sessionId: number; changed: boolean }) => void;
    const firstCommit = new Promise<{ revision: number; sessionId: number; changed: boolean }>((resolve) => {
      resolveFirst = resolve;
    });
    commitProjectDocumentPatches
      .mockReturnValueOnce(firstCommit)
      .mockResolvedValueOnce({ revision: 2, sessionId: 1, changed: true });

    await useProjectStore.getState().applyBlueLivePatch({
      type: 'updateTempoRepeat',
      patch: { tempo: 90 },
    });
    __testFlushPendingPatches();
    await Promise.resolve();

    await useProjectStore.getState().applyBlueLivePatch({
      type: 'updateTempoRepeat',
      patch: { repeat: 8 },
    });
    const barrier = useProjectStore.getState().flushPendingPatches();
    resolveFirst({ revision: 1, sessionId: 1, changed: true });
    await barrier;

    expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(2);
    expect(commitProjectDocumentPatches.mock.calls[1]?.[0]).toEqual([
      { blueLive: { type: 'updateTempoRepeat', patch: { repeat: 8 } } },
    ]);
  });

  it('propagates a background commit failure to an overlapping explicit barrier', async () => {
    let rejectFirst!: (error: Error) => void;
    const firstCommit = new Promise((_, reject) => {
      rejectFirst = reject;
    });
    commitProjectDocumentPatches.mockReturnValueOnce(firstCommit);

    await useProjectStore.getState().applyBlueLivePatch({
      type: 'updateTempoRepeat',
      patch: { tempo: 90 },
    });
    __testFlushPendingPatches();
    await Promise.resolve();

    const barrier = useProjectStore.getState().flushPendingPatches();
    rejectFirst(new Error('commit failed'));

    await expect(barrier).rejects.toThrow('commit failed');
  });

  it('refreshes canonical score state after ObjectBuilder conversion', async () => {
    commitProjectDocumentPatches.mockResolvedValue({
      revision: 1,
      sessionId: 1,
      changed: true,
    });
    getProjectDocument.mockResolvedValue(createEmptyProjectEditorSnapshot());

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'convertScoreObjectToObjectBuilder',
        target: {
          selectionId: 'external-0',
          selectedObjectType: 'External',
          editorObjectType: 'External',
          ownerKind: 'timeline',
          displayContext: 'timeline',
          location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
          supportsTimeBehavior: true,
          supportsRepeatPoint: true,
          supportsNoteProcessorChain: true,
        },
      },
    });
    await useProjectStore.getState().flushPendingPatches();

    expect(getProjectDocument).toHaveBeenCalledTimes(1);
  });
});

describe('project-store — MIDI focus reconciliation', () => {
  beforeEach(() => {
    useProjectStore.getState().clearProject();
    useMidiRoutingStore.setState({
      mode: 'focus',
      focusedTarget: null,
      focusRevision: 0,
    });
  });

  afterEach(() => {
    useProjectStore.getState().clearProject();
  });

  it('refreshes same-session names and clears removed focused identities', () => {
    const snapshot = createFocusSnapshot(7);
    useProjectStore.getState().setProjectInfo(snapshot);

    useMidiRoutingStore.getState().focusOrchestra({
      projectSessionId: 7,
      assignmentId: '1',
      displayName: 'Orchestra Name',
    });
    const renamed = {
      ...snapshot,
      orchestra: {
        ...snapshot.orchestra,
        arrangement: {
          rows: [{
            ...snapshot.orchestra.arrangement.rows[0]!,
            instrumentName: 'Renamed Orchestra',
          }],
        },
      },
    };
    useProjectStore.getState().setProjectInfo(renamed);
    expect(useMidiRoutingStore.getState().focusedTarget).toMatchObject({
      kind: 'orchestra',
      assignmentId: '1',
      displayName: 'Renamed Orchestra',
    });

    useMidiRoutingStore.getState().focusTrack({
      projectSessionId: 7,
      rootGroupId: 'root-group',
      trackId: 'track-1',
      displayName: 'Track Name',
    });
    useProjectStore.getState().setProjectInfo({
      ...renamed,
      score: { ...renamed.score!, layerGroups: [] },
    });
    expect(useMidiRoutingStore.getState().focusedTarget).toBeNull();
  });
});
