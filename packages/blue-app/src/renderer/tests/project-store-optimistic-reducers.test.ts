// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { __testClearPendingPatches, useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type {
  InstrumentSnapshot,
  MixerChannelSnapshot,
  ProjectEditorSnapshot,
} from '../../shared/project-editor/contract';

function makeChannel(id: string, name: string, association = ''): MixerChannelSnapshot {
  return {
    id,
    name,
    channelKind: 'channel',
    outChannel: 'Master',
    muted: false,
    solo: false,
    level: 0,
    volume: 1,
    pan: 0.5,
    association,
    preChain: [],
    postChain: [],
  };
}

function makeInstrument(assignmentId: string, name: string): InstrumentSnapshot {
  return {
    assignmentId,
    name,
    type: 'GenericInstrument',
    enabled: true,
    comment: '',
    globalOrc: '',
    globalSco: '',
    opcodeList: [],
    instrumentText: 'out 0',
  };
}

function createCrossDomainFixture(sessionId = 10): ProjectEditorSnapshot {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.loaded = true;
  snapshot.filePath = '/tmp/reducers-oracle.blue';
  snapshot.sessionId = sessionId;
  snapshot.documentId = 'doc-reducers-oracle';

  snapshot.score.layerGroups = [
    {
      groupId: 'track-group-1',
      groupType: 'track',
      name: 'Tracks',
      defaultHeightIndex: 1,
      layerCount: 2,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'track-1',
          layerKind: 'track',
          name: 'Track One',
          height: 44,
          muted: false,
          solo: false,
          items: [],
          instrument: null,
        },
        {
          layerId: 'track-2',
          layerKind: 'track',
          name: 'Track Two',
          height: 44,
          muted: false,
          solo: false,
          items: [],
          instrument: null,
        },
      ],
    },
    {
      groupId: 'poly-group-1',
      groupType: 'polyObject',
      name: 'SoundObjects',
      defaultHeightIndex: 1,
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'sl-1',
          layerKind: 'soundObject',
          name: 'Layer 1',
          height: 44,
          muted: false,
          solo: false,
          items: [],
        },
      ],
    },
  ];

  const chanTrack1 = makeChannel('ch-t1', 'Track One', 'track-1');
  const chanTrack2 = makeChannel('ch-t2', 'Track Two', 'track-2');
  const chanInst1 = makeChannel('ch-i1', '1', '1');
  const chanInst2 = makeChannel('ch-i2', '2', '2');

  snapshot.mixer.channels = [chanInst1, chanInst2];
  snapshot.mixer.channelListGroups = [
    {
      listName: 'Tracks',
      association: 'track-group-1',
      channels: [chanTrack1, chanTrack2],
    },
  ];
  snapshot.mixer.subChannels = [{ ...makeChannel('sub-1', 'Sub 1'), channelKind: 'subChannel' }];

  snapshot.orchestra.arrangement.rows = [
    {
      assignmentId: '1',
      enabled: true,
      instrumentName: 'Inst One',
      instrumentType: 'GenericInstrument',
      instrumentSummary: 'GenericInstrument',
      editable: true,
    },
    {
      assignmentId: '2',
      enabled: true,
      instrumentName: 'Inst Two',
      instrumentType: 'GenericInstrument',
      instrumentSummary: 'GenericInstrument',
      editable: true,
    },
  ];
  snapshot.orchestra.instruments = [
    makeInstrument('1', 'Inst One'),
    makeInstrument('2', 'Inst Two'),
  ];

  return snapshot;
}

describe('project-store optimistic reducers oracle', () => {
  const commitProjectDocumentPatches = vi.fn();
  const getProjectDocument = vi.fn();

  beforeEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
    useProjectStore.getState().setProjectInfo(createCrossDomainFixture());
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
    vi.restoreAllMocks();
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
  });

  it('preserves object references on untouched sibling mixer channels, score groups/layers, and instruments', async () => {
    const before = useProjectStore.getState();
    const untouchedGroupChannel = before.mixer.channelListGroups[0]!.channels[1]!;
    const untouchedRootChannel = before.mixer.channels[1]!;
    const untouchedSubChannel = before.mixer.subChannels[0]!;
    const untouchedPolyGroup = before.score.layerGroups[1]!;
    const untouchedTrackLayer = before.score.layerGroups[0]!.layers[1]!;
    const untouchedInstrument = before.orchestra.instruments[1]!;
    const untouchedRow = before.orchestra.arrangement.rows[1]!;

    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'ch-i1', patch: { level: -6 } },
    });
    const afterMixer = useProjectStore.getState();
    expect(afterMixer.mixer.channels[0]!.level).toBe(-6);
    expect(afterMixer.mixer.channels[1]).toBe(untouchedRootChannel);
    expect(afterMixer.mixer.channelListGroups[0]!.channels[1]).toBe(untouchedGroupChannel);
    expect(afterMixer.mixer.subChannels[0]).toBe(untouchedSubChannel);

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateLayerState',
        groupId: 'track-group-1',
        layerIndex: 0,
        patch: { muted: true },
      },
    });
    const afterScore = useProjectStore.getState();
    expect(afterScore.score.layerGroups[1]).toBe(untouchedPolyGroup);
    expect(afterScore.score.layerGroups[0]!.layers[1]).toBe(untouchedTrackLayer);

    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: { name: 'Inst One Renamed' },
      },
    });
    const afterOrch = useProjectStore.getState();
    expect(afterOrch.orchestra.instruments[0]!.name).toBe('Inst One Renamed');
    expect(afterOrch.orchestra.instruments[1]).toBe(untouchedInstrument);
    expect(afterOrch.orchestra.arrangement.rows[1]).toBe(untouchedRow);
  });

  it('uses deterministic fallback IDs and clock timestamps for sub-channel, layer, and score-object additions', async () => {
    const uuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('00000000-0000-4000-8000-000000000123');
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000456);

    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: { type: 'addSubChannel', name: 'Bus A' },
    });
    expect(uuidSpy).toHaveBeenCalled();
    expect(useProjectStore.getState().mixer.subChannels.at(-1)?.id).toBe(
      '00000000-0000-4000-8000-000000000123',
    );

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: { type: 'addLayer', groupId: 'track-group-1', layerIndex: 1 },
    });
    expect(nowSpy).toHaveBeenCalled();
    expect(useProjectStore.getState().score.layerGroups[0]!.layers[2]!.layerId).toBe(
      'layer-1700000000456',
    );

    useProjectStore.getState().addScoreObjects([
      {
        groupId: 'poly-group-1',
        layerIndex: 0,
        objectType: 'GenericScore',
        name: 'Clip A',
        startBeats: 0,
        durationBeats: 4,
        backgroundColor: 0x336699,
      },
    ]);
    const addedObject = useProjectStore.getState().score.layerGroups[1]!.layers[0]!.items[0]!;
    expect(addedObject.objectId).toMatch(/^local-sobj-\d+$/);
  });

  it('coordinates cross-domain renames and assignment updates across score, mixer, and orchestra', async () => {
    // 1. score.type === 'renameLayer' -> updates mixer track channel name
    await useProjectStore.getState().applyProjectDocumentPatch({
      score: { type: 'renameLayer', groupId: 'track-group-1', layerIndex: 0, name: 'Drums' },
    });
    expect(useProjectStore.getState().score.layerGroups[0]!.layers[0]!.name).toBe('Drums');
    expect(useProjectStore.getState().mixer.channelListGroups[0]!.channels[0]!.name).toBe('Drums');

    // 2. mixer.type === 'updateChannel' -> renames associated track layer
    await useProjectStore.getState().applyProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'ch-t2', patch: { name: 'Bass' } },
    });
    expect(useProjectStore.getState().mixer.channelListGroups[0]!.channels[1]!.name).toBe('Bass');
    expect(useProjectStore.getState().score.layerGroups[0]!.layers[1]!.name).toBe('Bass');

    // 3. orchestra.type === 'updateAssignment' -> updates mixer channel association and name
    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateAssignment',
        assignmentId: '1',
        nextAssignmentId: '10',
      },
    });
    const updatedChannel = useProjectStore
      .getState()
      .mixer.channels.find((channel) => channel.id === 'ch-i1');
    expect(updatedChannel?.association).toBe('10');
    expect(updatedChannel?.name).toBe('10');
  });
});
