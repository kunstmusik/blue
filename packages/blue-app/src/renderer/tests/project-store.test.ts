// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testAwaitPendingPatches,
  __testClearPendingPatches,
  __testFlushPendingPatches,
  acceptProjectDocumentRevision,
  applyBsbInterfacePatchToSnapshot,
  getProjectDocumentRevision,
  useProjectStore,
} from '../stores/project-store';
import { useMidiRoutingStore } from '../stores/midi-routing-store';
import ClojureProjectTab from '../components/workbench/panels/project-properties/ClojureProjectTab';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type { MixerChainClipboardPayload } from '../../shared/project-editor';
import type { MissingAudioAssetsSession } from '../../shared/missing-audio-assets';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createFocusSnapshot(sessionId: number) {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.loaded = true;
  snapshot.sessionId = sessionId;
  snapshot.orchestra.arrangement.rows = [
    {
      assignmentId: '1',
      enabled: true,
      instrumentName: 'Orchestra Name',
      instrumentType: 'generic',
      instrumentSummary: 'GenericInstrument',
      editable: true,
    },
  ];
  snapshot.score!.layerGroups = [
    {
      groupId: 'root-group',
      groupType: 'track',
      name: 'Tracks',
      defaultHeightIndex: 1,
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'track-1',
          layerKind: 'track',
          name: 'Track Name',
          height: 22,
          items: [],
          instrument: null,
        },
      ],
    },
  ];
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

  it('keeps load and canonical refresh semantics separate (T032)', () => {
    useProjectStore.getState().clearProject();
    const snapshot = createEmptyProjectEditorSnapshot();

    // Load semantics: dirty resets to a clean baseline.
    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      loaded: true,
      filePath: '/tmp/load.blue',
      sessionId: 2,
      documentId: 'doc-load',
      title: 'Loaded Title',
    });
    useProjectStore.getState().markDirty();
    expect(useProjectStore.getState().isDirty).toBe(true);

    // Canonical refresh: content and authoritative dirty projection apply,
    // the session and document identity remain untouched, and overlay stores
    // (layer selection) survive because no session change occurred.
    useProjectStore.getState().refreshFromCanonical(
      {
        ...snapshot,
        loaded: true,
        filePath: '/tmp/load.blue',
        sessionId: 2,
        documentId: 'doc-load',
        title: 'Remote Title',
      } as never,
      true,
    );

    expect(useProjectStore.getState().title).toBe('Remote Title');
    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(useProjectStore.getState().documentId).toBe('doc-load');
    expect(useProjectStore.getState().sessionId).toBe(2);

    // Authoritative clean projection after a save elsewhere.
    useProjectStore.getState().refreshFromCanonical(
      {
        ...snapshot,
        loaded: true,
        filePath: '/tmp/load.blue',
        sessionId: 2,
        documentId: 'doc-load',
        title: 'Saved Title',
      } as never,
      false,
    );
    expect(useProjectStore.getState().title).toBe('Saved Title');
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('refreshCanonicalSnapshot reapplies canonical content without resetting dirty state', async () => {
    const canonical = createEmptyProjectEditorSnapshot();
    canonical.loaded = true;
    canonical.sessionId = 1;
    canonical.documentId = 'doc-load';
    canonical.score!.layerGroups = [
      {
        groupId: 'canonical-group',
        groupType: 'track',
        name: 'Canonical Tracks',
        defaultHeightIndex: 1,
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          {
            layerId: 'canonical-layer',
            layerKind: 'track',
            name: 'Canonical Layer',
            height: 88,
            items: [],
            instrument: null,
          },
        ],
      },
    ];
    getProjectDocument.mockResolvedValue(canonical);
    useProjectStore.getState().markDirty();

    await useProjectStore.getState().refreshCanonicalSnapshot();

    expect(getProjectDocument).toHaveBeenCalledOnce();
    expect(useProjectStore.getState().score).toEqual(canonical.score);
    expect(useProjectStore.getState().isDirty).toBe(true);
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

  it('rejects a Track instrument create that the main process did not apply', async () => {
    commitProjectDocumentPatches.mockResolvedValue({
      revision: 0,
      sessionId: 1,
      changed: false,
    });

    const snapshot = createFocusSnapshot(1);
    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      filePath: '/tmp/track-instrument.blue',
    });

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'createTrackInstrument',
        track: {
          rootGroupId: 'root-group',
          trackId: 'track-1',
          projectSessionId: 1,
          projectRevision: 0,
        },
        instrumentType: 'blueX7',
      },
    });

    await expect(useProjectStore.getState().flushPendingPatches()).rejects.toThrow(
      'Track instrument change was not applied',
    );
  });

  it('drains edits queued while another commit is in flight', async () => {
    let resolveFirst!: (value: { revision: number; sessionId: number; changed: boolean }) => void;
    const firstCommit = new Promise<{ revision: number; sessionId: number; changed: boolean }>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
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

  it('submits the final Clojure entry removal durably and cannot mask canonical rejection (T126)', async () => {
    const canonicalWithEntry = createEmptyProjectEditorSnapshot();
    canonicalWithEntry.clojureProject = {
      libraryEntries: [
        { entryId: 'clj-1', dependencyCoordinates: 'org.clojure/clojure', version: '1.11.0' },
      ],
    };
    getProjectDocument.mockResolvedValue(canonicalWithEntry);

    useProjectStore.getState().setProjectInfo({
      ...canonicalWithEntry,
      loaded: true,
      filePath: '/tmp/clojure-removal.blue',
    });
    expect(useProjectStore.getState().clojureProject.libraryEntries).toHaveLength(1);

    // Drive the removal through the actual tab component so the exercised
    // intent is the one ClojureProjectTab dispatches.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(ClojureProjectTab, {
          disabled: false,
          clojureProject: useProjectStore.getState().clojureProject,
          updateClojureProject: (clojureProject) =>
            useProjectStore.getState().updateClojureProject(clojureProject),
        }),
      );
    });

    const removeButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Remove',
    );
    expect(removeButton).toBeDefined();
    await act(async () => {
      removeButton?.click();
    });
    await act(async () => {
      root.unmount();
    });
    container.remove();

    // The optimistic snapshot drops the entry while the durable submission is
    // still pending.
    expect(useProjectStore.getState().clojureProject.libraryEntries).toHaveLength(0);
    expect(useProjectStore.getState().isDirty).toBe(true);

    // Main reports the canonical document unchanged (rejected/no-op): the
    // clojure patch family must refresh from canonical instead of letting the
    // optimistic removal mask the rejection.
    commitProjectDocumentPatches.mockResolvedValue({
      revision: 0,
      sessionId: 1,
      changed: false,
    });

    await useProjectStore.getState().flushPendingPatches();

    expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(1);
    expect(commitProjectDocumentPatches.mock.calls[0]?.[0]).toEqual([
      { clojureProject: { libraryEntries: [] } },
    ]);
    expect(commitProjectDocumentPatches.mock.calls[0]?.[1]).toMatchObject({
      label: 'Update Clojure Project',
    });

    expect(getProjectDocument).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().clojureProject.libraryEntries).toEqual([
      { entryId: 'clj-1', dependencyCoordinates: 'org.clojure/clojure', version: '1.11.0' },
    ]);
  });

  it('rejects a stale in-flight receipt after a project reset', async () => {
    let resolveCommit!: (value: { revision: number; sessionId: number; changed: boolean }) => void;
    commitProjectDocumentPatches.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCommit = resolve;
      }),
    );

    await useProjectStore.getState().updateGlobalOrc('instr 1\nendin');
    const barrier = useProjectStore.getState().flushPendingPatches();
    await Promise.resolve();

    useProjectStore.getState().clearProject();
    useProjectStore.getState().setProjectInfo({
      ...createEmptyProjectEditorSnapshot(),
      loaded: true,
      sessionId: 2,
      filePath: '/tmp/replacement.blue',
    });
    resolveCommit({ revision: 99, sessionId: 1, changed: true });
    await barrier;

    expect(getProjectDocumentRevision()).toBe(0);
    expect(useProjectStore.getState()).toMatchObject({
      loaded: true,
      sessionId: 2,
      filePath: '/tmp/replacement.blue',
    });
  });
});

describe('project-store — stable façade contract', () => {
  const commitProjectDocumentPatches = vi.fn();
  const getProjectDocument = vi.fn();

  beforeEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
    const snapshot = createFocusSnapshot(11);
    snapshot.mixer.enabled = false;
    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      filePath: '/tmp/facade.blue',
    });
    window.blueAPI = {
      ...window.blueAPI,
      commitProjectDocumentPatches,
      getProjectDocument,
      sendBsbRealtimeControlUpdate: vi.fn(async () => undefined),
    };
    commitProjectDocumentPatches.mockReset();
    commitProjectDocumentPatches.mockResolvedValue({ revision: 1, sessionId: 11, changed: true });
    getProjectDocument.mockReset();
    getProjectDocument.mockResolvedValue(null);
  });

  afterEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
  });

  it('keeps revision, BSB reducer, flush, await, and clear helpers callable through the façade', async () => {
    expect(applyBsbInterfacePatchToSnapshot).toBeTypeOf('function');
    expect(getProjectDocumentRevision()).toBe(0);

    acceptProjectDocumentRevision(11, 4);
    acceptProjectDocumentRevision(11, 2);
    expect(getProjectDocumentRevision()).toBe(4);

    await useProjectStore.getState().updateGlobalSco('f0 3600');
    __testFlushPendingPatches();
    await __testAwaitPendingPatches();
    expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(1);

    __testClearPendingPatches();
  });

  it('applies representative document, mixer, orchestra, MIDI, and score patches immediately', async () => {
    await useProjectStore.getState().applyProjectDocumentPatch({ globalOrc: 'instr 2\nendin' });
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: { type: 'setMixerEnabled', value: true },
    });
    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: { type: 'updateAssignment', assignmentId: '1', enabled: false },
    });
    await useProjectStore.getState().applyProjectDocumentPatch({
      midiInput: { type: 'updateKeyMapping', value: 'pch' },
    });

    expect(useProjectStore.getState().globalOrc).toBe('instr 2\nendin');
    expect(useProjectStore.getState().mixer.enabled).toBe(true);
    expect(useProjectStore.getState().orchestra.arrangement.rows[0]?.enabled).toBe(false);
    expect(useProjectStore.getState().midiInput?.keyMapping).toBe('pch');
    expect(useProjectStore.getState().isDirty).toBe(true);

    await useProjectStore.getState().flushPendingPatches();
    expect(getProjectDocument).not.toHaveBeenCalled();

    commitProjectDocumentPatches.mockResolvedValueOnce({
      revision: 2,
      sessionId: 11,
      changed: true,
    });
    getProjectDocument.mockResolvedValueOnce({
      ...createFocusSnapshot(11),
      filePath: '/tmp/facade.blue',
    });
    await useProjectStore.getState().applyProjectDocumentPatch({
      score: { type: 'renameLayer', groupId: 'root-group', layerIndex: 0, name: 'Renamed Track' },
    });
    expect(useProjectStore.getState().score.layerGroups[0]?.layers[0]?.name).toBe('Renamed Track');
    await useProjectStore.getState().flushPendingPatches();
    expect(getProjectDocument).toHaveBeenCalledTimes(1);
  });

  it('normalizes fresh mixer duplicate and paste identities before optimistic and durable apply', async () => {
    const channelId = useProjectStore.getState().mixer.master.id;
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: {
        type: 'addSend',
        channelId,
        chain: 'pre',
        sendChannel: 'Master',
        level: 0.5,
        entryId: 'source-send',
      },
    });
    await useProjectStore.getState().flushPendingPatches();
    commitProjectDocumentPatches.mockClear();

    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: {
        type: 'duplicateChainEntry',
        channelId,
        chain: 'pre',
        entryId: 'source-send',
      },
    });
    const afterDuplicate = useProjectStore.getState().mixer.master.preChain;
    const duplicate = afterDuplicate[1];
    expect(duplicate?.entryId).not.toBe('source-send');
    await useProjectStore.getState().flushPendingPatches();

    expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
      [
        {
          mixer: expect.objectContaining({
            type: 'duplicateChainEntry',
            newEntryId: duplicate?.entryId,
          }),
        },
      ],
      expect.anything(),
    );

    const payload: MixerChainClipboardPayload = {
      sourceKind: 'project',
      entries: [
        {
          entryId: 'clipboard-send',
          kind: 'send',
          sendChannel: 'Master',
          level: 0.25,
          enabled: true,
        },
      ],
    };
    commitProjectDocumentPatches.mockClear();
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: {
        type: 'pasteChainEntries',
        channelId,
        chain: 'pre',
        index: 1,
        payload,
      },
    });
    const afterPaste = useProjectStore.getState().mixer.master.preChain;
    const pasted = afterPaste[1];
    expect(pasted?.entryId).not.toBe('clipboard-send');
    await useProjectStore.getState().flushPendingPatches();

    expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
      [
        {
          mixer: expect.objectContaining({
            type: 'pasteChainEntries',
            newEntryIds: [pasted?.entryId],
          }),
        },
      ],
      expect.anything(),
    );

    const firstPastedId = pasted?.entryId;
    commitProjectDocumentPatches.mockClear();
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: {
        type: 'pasteChainEntries',
        channelId,
        chain: 'pre',
        payload,
      },
    });
    const secondPastedId = useProjectStore.getState().mixer.master.preChain.at(-1)?.entryId;
    expect(secondPastedId).not.toBe(firstPastedId);
    expect(secondPastedId).not.toBe('clipboard-send');
    await useProjectStore.getState().flushPendingPatches();

    expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
      [
        {
          mixer: expect.objectContaining({
            type: 'pasteChainEntries',
            newEntryIds: [secondPastedId],
          }),
        },
      ],
      expect.anything(),
    );
  });

  it('keeps renderer-issued insertion identities usable for removal before acknowledgement (T119)', async () => {
    const channelId = useProjectStore.getState().mixer.master.id;
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: {
        type: 'addEffectFromLibrary',
        channelId,
        chain: 'pre',
        libraryEffectId: 'library-effect-1',
        effectXml: '<effect/>',
        entryId: 'source-effect',
      },
    });
    await useProjectStore.getState().flushPendingPatches();
    commitProjectDocumentPatches.mockClear();

    // Duplicate without flushing: the optimistic snapshot already contains
    // the insertion while the canonical document does not yet.
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: { type: 'duplicateChainEntry', channelId, chain: 'pre', entryId: 'source-effect' },
    });
    const duplicateId = useProjectStore.getState().mixer.master.preChain.at(-1)?.entryId;
    expect(duplicateId).toBeTruthy();

    // Remove it by the optimistic id BEFORE the duplicate is acknowledged.
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: { type: 'removeChainEntry', channelId, chain: 'pre', entryId: duplicateId! },
    });
    expect(
      useProjectStore
        .getState()
        .mixer.master.preChain.some((entry) => entry.entryId === duplicateId),
    ).toBe(false);

    // One flush settles both patches; the durable duplicate must carry the
    // very id the renderer removed, so main converges on the same state.
    await useProjectStore.getState().flushPendingPatches();
    expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(1);
    const [patches] = commitProjectDocumentPatches.mock.calls[0]!;
    expect(patches).toEqual([
      {
        mixer: expect.objectContaining({
          type: 'duplicateChainEntry',
          newEntryId: duplicateId,
        }),
      },
      {
        mixer: expect.objectContaining({
          type: 'removeChainEntry',
          entryId: duplicateId,
        }),
      },
    ]);
    expect(
      useProjectStore
        .getState()
        .mixer.master.preChain.some((entry) => entry.entryId === duplicateId),
    ).toBe(false);
  });

  it('labels unlabeled mixer submissions at the queue choke point and preserves caller labels (T123)', async () => {
    const channelId = useProjectStore.getState().mixer.master.id;
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: {
        type: 'addSend',
        channelId,
        chain: 'pre',
        sendChannel: 'Master',
        level: 0.5,
        entryId: 'send-1',
      },
    });
    await useProjectStore.getState().flushPendingPatches();
    expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ label: 'Add Send' }),
    );

    commitProjectDocumentPatches.mockClear();
    await useProjectStore
      .getState()
      .applyProjectDocumentPatch(
        { mixer: { type: 'setMixerEnabled', value: false } },
        { label: 'Custom Caller Label' },
      );
    await useProjectStore.getState().flushPendingPatches();
    expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ label: 'Custom Caller Label' }),
    );
  });

  it('labels transport navigation commands with semantic actions (T123)', async () => {
    useProjectStore.setState({
      transport: { ...useProjectStore.getState().transport, renderStartTime: 0 },
      score: {
        ...useProjectStore.getState().score,
        markers: [{ id: 'm1', name: 'A', time: 8 } as never],
      },
    });

    useProjectStore.getState().rewindToStart();
    await useProjectStore.getState().flushPendingPatches();
    expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ label: 'Rewind to Start' }),
    );

    commitProjectDocumentPatches.mockClear();
    useProjectStore.getState().navigateToNextMarker();
    await useProjectStore.getState().flushPendingPatches();
    expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ label: 'Move Render Start to Next Marker' }),
    );
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
          rows: [
            {
              ...snapshot.orchestra.arrangement.rows[0]!,
              instrumentName: 'Renamed Orchestra',
            },
          ],
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
      layers: [
        {
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
            barRenderer: {
              kind: 'generic' as const,
              labelLines: ['Source'],
              timeBehavior: 'NONE',
              repeatPointBeats: null,
            },
          },
          activeCellIndices: [0],
        },
      ],
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
      score: {
        type: 'moveLayerRange',
        groupId: 'sound-grp',
        startIndex: 1,
        endIndex: 2,
        targetIndex: 0,
      },
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
        layers: [
          {
            layerId: 'selected-layer',
            name: 'Selected Layer',
            height: 44,
            muted: false,
            solo: false,
            items: [],
          },
        ],
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
    snapshot.score!.layerGroups = [
      {
        groupId: 'move-group',
        groupType: 'polyObject',
        name: 'Move Group',
        layerCount: 2,
        isOpenableContainer: true,
        layers: [
          { layerId: 'move-0', name: 'L0', height: 44, muted: false, solo: false, items: [] },
          { layerId: 'move-1', name: 'L1', height: 44, muted: false, solo: false, items: [] },
        ],
      },
    ];
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

    expect(
      useProjectStore.getState().score.layerGroups[0]!.layers.map((layer) => layer.name),
    ).toEqual(['L0', 'L1']);
    await useProjectStore.getState().flushPendingPatches();
  });

  it('clones replacement instrument snapshots with deep equality and nested mutation independence', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.score!.layerGroups = [
      {
        groupId: 'track-grp',
        groupType: 'track',
        name: 'Tracks',
        defaultHeightIndex: 1,
        layerCount: 1,
        isOpenableContainer: false,
        layers: [
          {
            layerId: 'layer-1',
            layerKind: 'track',
            name: 'Track 1',
            height: 44,
            items: [],
            instrument: null,
          },
        ],
      },
    ];
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    const replacementInstrument = {
      type: 'generic' as const,
      instrumentType: 'generic',
      name: 'Custom Synth',
      comment: 'A test comment',
      enabled: true,
      instrumentText: 'aout oscili 0.5, 440',
      nestedRecord: { key: 'val', deep: [1, 2, 3] },
      optionalVal: undefined,
    };

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'replaceTrackInstrument',
        track: {
          rootGroupId: 'track-grp',
          trackId: 'layer-1',
        },
        instrument: replacementInstrument as any,
      },
    });

    const storedLayer = useProjectStore.getState().score.layerGroups[0]!.layers[0]!;
    expect(storedLayer.instrument).not.toBeNull();
    const storedSnapshot = (storedLayer.instrument as any).snapshot;

    // Structural equality
    expect(storedSnapshot).toEqual(replacementInstrument);
    // Not same reference
    expect(storedSnapshot).not.toBe(replacementInstrument);
    expect(storedSnapshot.nestedRecord).not.toBe(replacementInstrument.nestedRecord);
    expect(storedSnapshot.nestedRecord.deep).not.toBe(replacementInstrument.nestedRecord.deep);

    // Independent nested mutation: mutate the input object
    replacementInstrument.nestedRecord.key = 'mutated';
    replacementInstrument.nestedRecord.deep.push(999);

    expect(storedSnapshot.nestedRecord.key).toBe('val');
    expect(storedSnapshot.nestedRecord.deep).toEqual([1, 2, 3]);

    await useProjectStore.getState().flushPendingPatches();
  });

  it('canonical text refresh updates store text without queuing outgoing patches or echoing edits', async () => {
    const commitSpy = vi.fn().mockResolvedValue({ changed: true });
    (window as unknown as { blueAPI?: unknown }).blueAPI = {
      commitProjectDocumentPatches: commitSpy,
      getProjectDocument: async () => null,
    };

    const info = {
      ...createEmptyProjectEditorSnapshot(),
      loaded: true,
      sessionId: 1,
      documentId: 'doc-canonical',
      globalOrc: 'instr 99\nendin',
      globalSco: '; canonical score',
    };

    // Refresh from canonical publication
    useProjectStore.getState().refreshFromCanonical(info, false);

    expect(useProjectStore.getState().globalOrc).toBe('instr 99\nendin');
    expect(useProjectStore.getState().globalSco).toBe('; canonical score');
    expect(useProjectStore.getState().isDirty).toBe(false);

    // Verify no patches were queued for commit
    await useProjectStore.getState().flushPendingPatches();
    expect(commitSpy).not.toHaveBeenCalled();
  });
});
