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

describe('project-store — pattern layer optimistic projection', () => {
  beforeEach(() => {
    (window as unknown as { blueAPI?: unknown }).blueAPI = {
      commitProjectDocumentPatches: async () => ({ changed: true }),
      getProjectDocument: async () => null,
    };
  });

  afterEach(() => {
    useProjectStore.getState().clearProject();
    delete (window as unknown as { blueAPI?: unknown }).blueAPI;
  });

  it('inserts a full PatternLayerSnapshot when a layer is added to a patterns group', async () => {
    const patternsGroup = {
      groupId: 'grp',
      groupType: 'patterns' as const,
      name: 'Patterns',
      layerCount: 1,
      isOpenableContainer: false as const,
      patternBeatsLength: 4,
      effectivePatternBeatsLength: 4,
      layers: [{
        layerId: 'pl-1',
        name: 'Row A',
        height: 44,
        muted: false,
        solo: false,
        items: [],
        sourceObject: {
          objectId: 'src-1',
          objectType: 'GenericScore',
          name: 'Source',
          backgroundColor: 0x404040,
          editorTarget: {
            selectionId: 'src-1',
            selectedObjectType: 'GenericScore',
            editorObjectType: 'GenericScore',
            ownerKind: 'timeline' as const,
            displayContext: 'timeline' as const,
            patternSource: { groupId: 'grp', layerId: 'pl-1', sourceObjectId: 'src-1' },
            supportsTimeBehavior: true,
            supportsRepeatPoint: true,
            supportsNoteProcessorChain: true,
          },
          barRenderer: { kind: 'generic' as const, labelLines: ['Source'], timeBehavior: 'NONE', repeatPointBeats: null },
        },
        activeCellIndices: [0],
      }],
    };
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.score!.layerGroups = [patternsGroup];
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    (window as unknown as { blueAPI?: unknown }).blueAPI = {
      commitProjectDocumentPatches: async () => ({ changed: true }),
      getProjectDocument: async () => null,
    };

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: { type: 'addLayer', groupId: 'grp', layerIndex: 0 },
    });

    const group = useProjectStore.getState().score.layerGroups[0]!;
    if (group.groupType !== 'patterns') throw new Error('expected patterns group');
    expect(group.layers).toHaveLength(2);
    const added = group.layers[1]!;
    // The optimistic row must be a full PatternLayerSnapshot: the pattern grid
    // reads activeCellIndices/sourceObject synchronously during render.
    expect(Array.isArray(added.activeCellIndices)).toBe(true);
    expect(added.sourceObject).toBeDefined();
    expect(added.sourceObject.editorTarget.patternSource?.groupId).toBe('grp');

    await useProjectStore.getState().flushPendingPatches();
  });

  it('optimistically projects moveLayerRange and removeLayerRanges', async () => {
    const group = {
      groupId: 'sound-grp',
      groupType: 'polyObject' as const,
      name: 'Sound Group',
      layerCount: 4,
      isOpenableContainer: true as const,
      layers: [
        { layerId: 'l-0', name: 'L0', height: 44, muted: false, solo: false, items: [] },
        { layerId: 'l-1', name: 'L1', height: 44, muted: false, solo: false, items: [] },
        { layerId: 'l-2', name: 'L2', height: 44, muted: false, solo: false, items: [] },
        { layerId: 'l-3', name: 'L3', height: 44, muted: false, solo: false, items: [] },
      ],
    };
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.score!.layerGroups = [group];
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    (window as unknown as { blueAPI?: unknown }).blueAPI = {
      commitProjectDocumentPatches: async () => ({ changed: true }),
      getProjectDocument: async () => null,
    };

    // Optimistically move [1, 2] to 0 -> order should be L1, L2, L0, L3
    await useProjectStore.getState().applyProjectDocumentPatch({
      score: { type: 'moveLayerRange', groupId: 'sound-grp', startIndex: 1, endIndex: 2, targetIndex: 0 },
    });

    let currentGroup = useProjectStore.getState().score.layerGroups[0]!;
    expect(currentGroup.layers.map((l) => l.name)).toEqual(['L1', 'L2', 'L0', 'L3']);

    // Optimistically remove [0, 1] (L1, L2) -> order should be L0, L3
    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'removeLayerRanges',
        ranges: [{ groupId: 'sound-grp', startIndex: 0, endIndex: 1 }],
        deleteEmptyLayerGroups: false,
      },
    });

    currentGroup = useProjectStore.getState().score.layerGroups[0]!;
    expect(currentGroup.layers.map((l) => l.name)).toEqual(['L0', 'L3']);
    expect(currentGroup.layerCount).toBe(2);

    await useProjectStore.getState().flushPendingPatches();
  });

  it('rejects invalid optimistic removal ranges without deleting unrelated empty groups', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.score.layerGroups = [
      {
        groupId: 'selected-group',
        groupType: 'polyObject',
        name: 'Selected',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [{ layerId: 'selected-layer', name: 'Selected Layer', height: 44, muted: false, solo: false, items: [] }],
      },
      {
        groupId: 'unrelated-empty-group',
        groupType: 'polyObject',
        name: 'Keep Empty',
        layerCount: 0,
        isOpenableContainer: true,
        layers: [],
      },
    ];
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'removeLayerRanges',
        ranges: [{ groupId: 'selected-group', startIndex: 0, endIndex: 3 }],
        deleteEmptyLayerGroups: true,
      },
    });

    expect(useProjectStore.getState().score.layerGroups.map((group) => group.groupId)).toEqual([
      'selected-group',
      'unrelated-empty-group',
    ]);
    await useProjectStore.getState().flushPendingPatches();
  });

  it('rejects an invalid optimistic move target without changing layer order', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.score!.layerGroups = [{
      groupId: 'move-group',
      groupType: 'polyObject',
      name: 'Move Group',
      layerCount: 2,
      isOpenableContainer: true,
      layers: [
        { layerId: 'move-0', name: 'L0', height: 44, muted: false, solo: false, items: [] },
        { layerId: 'move-1', name: 'L1', height: 44, muted: false, solo: false, items: [] },
      ],
    }];
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'moveLayerRange',
        groupId: 'move-group',
        startIndex: 0,
        endIndex: 0,
        targetIndex: 2,
      },
    });

    expect(useProjectStore.getState().score.layerGroups[0]!.layers.map((layer) => layer.name))
      .toEqual(['L0', 'L1']);
    await useProjectStore.getState().flushPendingPatches();
  });
});
