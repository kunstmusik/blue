import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TrackLayerGroup,
  AudioClip,
  BlueData,
  FadeType,
  GenericScore,
  PatternsLayerGroup,
  PolyObject,
  SoundLayer,
  TimeDuration,
  TimePosition,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createNestedPolyObjectSnapshot,
  createProjectEditorSnapshot,
} from '../../shared/project-editor';
import { useProjectStore, __testClearPendingPatches } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';

function createLayer(name: string, startBeats: number): SoundLayer {
  const layer = new SoundLayer();
  const score = new GenericScore();
  score.setName(name);
  score.setScoreText(`i1 ${startBeats} 2 440`);
  score.setStartTime(TimePosition.beats(startBeats));
  layer.push(score);
  return layer;
}

function createAudioClipForTest(name: string, filePath: string, durationSeconds: number): AudioClip {
  const clip = new AudioClip();
  clip.setName(name);
  clip.setAudioFile(filePath);
  clip.setNumChannels(2);
  clip.setAudioDuration(durationSeconds);
  clip.setStartTime(TimePosition.beats(0));
  clip.setSubjectiveDuration(TimeDuration.fromSeconds(durationSeconds));
  clip.setBackgroundColor(0x669966);
  return clip;
}

function createMultiGroupSnapshot() {
  const data = new BlueData();
  data.getScore().length = 0;

  const groupA = new PolyObject();
  groupA.setName('Group A');
  groupA.push(createLayer('A Layer 0', 0));
  groupA.push(createLayer('A Layer 1', 2));

  const groupB = new PolyObject();
  groupB.setName('Group B');
  groupB.push(createLayer('B Layer 0', 4));
  groupB.push(createLayer('B Layer 1', 6));

  data.getScore().push(groupA);
  data.getScore().push(groupB);

  return createProjectEditorSnapshot(data, null);
}

function getAllItems(snapshot: ReturnType<typeof createMultiGroupSnapshot>) {
  return snapshot.score.layerGroups.flatMap((group) =>
    group.layers.flatMap((layer) => layer.items));
}

beforeEach(() => {
  __testClearPendingPatches();
  useProjectStore.getState().clearProject();
  useScoreSelectionStore.getState().clearSelection();
});

afterEach(() => {
  __testClearPendingPatches();
  useProjectStore.getState().clearProject();
  useScoreSelectionStore.getState().clearSelection();
});

describe('score multigroup object identity', () => {
  it('keeps selection scoped to one object when multiple groups share layer and item indexes', () => {
    const snapshot = createMultiGroupSnapshot();
    const groupBItem = snapshot.score.layerGroups[1]!.layers[0]!.items[0]!;

    useScoreSelectionStore.getState().setSelection([
      { objectId: groupBItem.objectId, editorTarget: groupBItem.editorTarget },
    ]);

    const selectedItems = getAllItems(snapshot).filter((item) =>
      useScoreSelectionStore.getState().selectedObjectIds.has(item.objectId));

    expect(selectedItems).toHaveLength(1);
    expect(selectedItems[0]!.name).toBe('B Layer 0');
  });

  it('moves only the targeted object during optimistic score updates', () => {
    const snapshot = createMultiGroupSnapshot();
    useProjectStore.getState().setProjectInfo(snapshot);

    const initialGroups = useProjectStore.getState().score.layerGroups;
    const stationary = initialGroups[0]!.layers[0]!.items[0]!;
    const moving = initialGroups[1]!.layers[0]!.items[0]!;
    const targetGroupId = initialGroups[1]!.groupId;

    useProjectStore.getState().moveScoreObjects([
      {
        objectId: moving.objectId,
        targetStartBeats: 9,
        targetLayerIndex: 0,
        targetGroupId,
      },
    ]);

    const updatedGroups = useProjectStore.getState().score.layerGroups;

    expect(updatedGroups[0]!.layers[0]!.items).toHaveLength(1);
    expect(updatedGroups[0]!.layers[0]!.items[0]!.objectId).toBe(stationary.objectId);
    expect(updatedGroups[0]!.layers[0]!.items[0]!.startBeats).toBe(stationary.startBeats);

    expect(updatedGroups[1]!.layers[0]!.items).toHaveLength(1);
    expect(updatedGroups[1]!.layers[0]!.items[0]!.objectId).toBe(moving.objectId);
    expect(updatedGroups[1]!.layers[0]!.items[0]!.startBeats).toBe(9);
  });

  it('removes only the targeted object during optimistic score updates', () => {
    const snapshot = createMultiGroupSnapshot();
    useProjectStore.getState().setProjectInfo(snapshot);

    const initialGroups = useProjectStore.getState().score.layerGroups;
    const stationary = initialGroups[0]!.layers[1]!.items[0]!;
    const removed = initialGroups[1]!.layers[1]!.items[0]!;

    useProjectStore.getState().removeScoreObjects(new Set([removed.objectId]));

    const updatedGroups = useProjectStore.getState().score.layerGroups;

    expect(updatedGroups[0]!.layers[1]!.items).toHaveLength(1);
    expect(updatedGroups[0]!.layers[1]!.items[0]!.objectId).toBe(stationary.objectId);

    expect(updatedGroups[1]!.layers[1]!.items).toHaveLength(0);
  });

  it('persists layer renames through canonical score patches', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const group = new PolyObject(true);
    const layer = new SoundLayer();
    layer.setName('Original Layer');
    group.push(layer);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null);
    const groupId = snapshot.score.layerGroups[0]!.groupId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'renameLayer',
        groupId,
        layerIndex: 0,
        name: 'Renamed Layer',
      },
    });

    expect((data.getScore()[0] as PolyObject)[0]!.getName()).toBe('Renamed Layer');
    expect(createProjectEditorSnapshot(data, null).score.layerGroups[0]!.layers[0]!.name)
      .toBe('Renamed Layer');
  });

  it('includes mute/solo state in root and nested PolyObject snapshots', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const root = new PolyObject(true);
    const rootLayer = new SoundLayer();
    rootLayer.setName('Root Layer');
    rootLayer.setMuted(true);

    const nested = new PolyObject(false);
    const nestedLayer = new SoundLayer();
    nestedLayer.setName('Nested Layer');
    nestedLayer.setSolo(true);
    nested.push(nestedLayer);

    rootLayer.push(nested);
    root.push(rootLayer);
    data.getScore().push(root);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.score.layerGroups[0]!.layers[0]!.muted).toBe(true);
    expect(snapshot.score.layerGroups[0]!.layers[0]!.solo).toBe(false);

    const nestedSnapshot = createNestedPolyObjectSnapshot(data, {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    });

    expect(nestedSnapshot?.layers[0]!.muted).toBe(false);
    expect(nestedSnapshot?.layers[0]!.solo).toBe(true);
  });

  it('persists layer mute and solo through canonical score patches', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const group = new PolyObject(true);
    const layer = new SoundLayer();
    group.push(layer);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null);
    const groupId = snapshot.score.layerGroups[0]!.groupId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateLayerState',
        groupId,
        layerIndex: 0,
        patch: {
          muted: true,
          solo: true,
        },
      },
    });

    const updatedLayer = (data.getScore()[0] as PolyObject)[0]!;
    expect(updatedLayer.isMuted()).toBe(true);
    expect(updatedLayer.isSolo()).toBe(true);

    const updatedSnapshot = createProjectEditorSnapshot(data, null);
    expect(updatedSnapshot.score.layerGroups[0]!.layers[0]!.muted).toBe(true);
    expect(updatedSnapshot.score.layerGroups[0]!.layers[0]!.solo).toBe(true);
  });

  it('preserves saved layer heights in root and nested snapshots', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const root = new PolyObject(true);
    const rootLayer = new SoundLayer();
    rootLayer.setHeightIndex(2);

    const nested = new PolyObject(false);
    const nestedLayer = new SoundLayer();
    nestedLayer.setHeightIndex(4);
    nested.push(nestedLayer);

    rootLayer.push(nested);
    root.push(rootLayer);

    const audio = new TrackLayerGroup();
    const audioLayer = audio.newLayerAt(0);
    audioLayer.setHeightIndex(3);

    data.getScore().push(root);
    data.getScore().push(audio);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.score.layerGroups[0]!.layers[0]!.height).toBe(66);
    expect(snapshot.score.layerGroups[1]!.layers[0]!.height).toBe(88);

    const nestedSnapshot = createNestedPolyObjectSnapshot(data, {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    });

    expect(nestedSnapshot?.layers[0]!.height).toBe(110);
  });

  it('persists audio layer height through canonical score patches', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audio = new TrackLayerGroup();
    audio.newLayerAt(0);
    data.getScore().push(audio);

    const snapshot = createProjectEditorSnapshot(data, null);
    const groupId = snapshot.score.layerGroups[0]!.groupId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateLayerState',
        groupId,
        layerIndex: 0,
        patch: {
          heightIndex: 4,
        },
      },
    });

    expect((data.getScore()[0] as TrackLayerGroup)[0]!.getHeightIndex()).toBe(4);

    const updatedSnapshot = createProjectEditorSnapshot(data, null);
    expect(updatedSnapshot.score.layerGroups[0]!.layers[0]!.height).toBe(110);
  });

  it('moves the targeted root layer group when non-PolyObject groups are present', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audio = new TrackLayerGroup();
    audio.setName('Track');
    const poly = new PolyObject(true);
    poly.setName('Poly');
    const patterns = new PatternsLayerGroup();
    patterns.setName('Patterns');

    data.getScore().push(audio);
    data.getScore().push(poly);
    data.getScore().push(patterns);

    const snapshot = createProjectEditorSnapshot(data, null);
    const polyGroupId = snapshot.score.layerGroups[1]!.groupId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveLayerGroup',
        groupId: polyGroupId,
        targetIndex: 0,
      },
    });

    const updated = createProjectEditorSnapshot(data, null);
    expect(updated.score.layerGroups.map((group) => group.name)).toEqual([
      'Poly',
      'Track',
      'Patterns',
    ]);
  });

  it('adds audio and patterns layer groups through canonical score patches', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'addLayerGroup',
        groupType: 'track',
      },
    });

    applyProjectDocumentPatch(data, {
      score: {
        type: 'addLayerGroup',
        groupType: 'patterns',
      },
    });

    expect(data.getScore()[0]).toBeInstanceOf(TrackLayerGroup);
    expect((data.getScore()[0] as TrackLayerGroup).length).toBe(1);
    expect(data.getScore()[1]).toBeInstanceOf(PatternsLayerGroup);
    expect((data.getScore()[1] as PatternsLayerGroup).length).toBe(1);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.score.layerGroups.map((group) => group.groupType)).toEqual([
      'track',
      'patterns',
    ]);
    expect(snapshot.score.layerGroups.map((group) => group.name)).toEqual([
      'Track Layer Group',
      'Patterns Layer Group',
    ]);
  });

  it('adds audio clips through canonical and optimistic score patches', async () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audio = new TrackLayerGroup();
    audio.newLayerAt(0);
    data.getScore().push(audio);

    const initialSnapshot = createProjectEditorSnapshot(data, null);
    const groupId = initialSnapshot.score.layerGroups[0]!.groupId;
    const serializedClip = createAudioClipForTest('Dropped Clip', '/tmp/dropped.wav', 2.5);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'addScoreObjects',
        groupId,
        objects: [
          {
            layerIndex: 0,
            objectType: 'AudioClip',
            name: 'Dropped Clip',
            startBeats: 4,
            durationBeats: 5,
            durationTimeBase: 'TIME',
            backgroundColor: 0x669966,
            serializedXml: serializedClip.saveAsXML().toXml(),
          },
        ],
      },
    });

    const updatedSnapshot = createProjectEditorSnapshot(data, null);
    const canonicalItem = updatedSnapshot.score.layerGroups[0]!.layers[0]!.items[0]!;

    expect((data.getScore()[0] as TrackLayerGroup)[0]![0]).toBeInstanceOf(AudioClip);
    expect(canonicalItem.objectType).toBe('AudioClip');
    expect(canonicalItem.startBeats).toBe(4);
    expect(canonicalItem.durationTimeBase).toBe('TIME');
    expect(canonicalItem.serializedXml).toContain('/tmp/dropped.wav');
    expect(canonicalItem.barRenderer.kind).toBe('audioClip');

    useProjectStore.getState().setProjectInfo(initialSnapshot);
    const applyPatchSpy = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ applyProjectDocumentPatch: applyPatchSpy } as Partial<ReturnType<typeof useProjectStore.getState>>);

    useProjectStore.getState().addScoreObjects([
      {
        layerIndex: 0,
        groupId,
        name: 'Optimistic Clip',
        startBeats: 2,
        durationBeats: 4,
        durationTimeBase: 'TIME',
        backgroundColor: 0x669966,
        objectType: 'AudioClip',
        isContainer: false,
        serializedXml: createAudioClipForTest('Optimistic Clip', '/tmp/optimistic.wav', 2).saveAsXML().toXml(),
        barRenderer: {
          kind: 'audioClip',
          labelLines: ['Optimistic Clip'],
          audioFilePath: '/tmp/optimistic.wav',
          waveformKey: 'aclp:/tmp/optimistic.wav',
          fileStartTimeBeats: 0,
          audioDurationBeats: 2,
          looping: true,
          fadeInBeats: 0,
          fadeInType: 'LINEAR',
          fadeOutBeats: 0,
          fadeOutType: 'LINEAR',
        },
      },
    ]);

    await Promise.resolve();

    const optimisticItem = useProjectStore.getState().score.layerGroups[0]!.layers[0]!.items[0]!;
    expect(optimisticItem.objectType).toBe('AudioClip');
    expect(optimisticItem.barRenderer.kind).toBe('audioClip');
    expect(optimisticItem.editorTarget?.supportsTimeBehavior).toBe(false);
    expect(optimisticItem.editorTarget?.supportsRepeatPoint).toBe(false);
    expect(applyPatchSpy).toHaveBeenCalledWith({
      score: {
        type: 'addScoreObjects',
        groupId,
        objects: [
          expect.objectContaining({
            selectionId: optimisticItem.objectId,
            layerIndex: 0,
            objectType: 'AudioClip',
            serializedXml: expect.stringContaining('/tmp/optimistic.wav'),
          }),
        ],
      },
    });
  });

  it('preserves explicit selection ids when canonically adding audio clips', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audio = new TrackLayerGroup();
    audio.newLayerAt(0);
    data.getScore().push(audio);

    const snapshot = createProjectEditorSnapshot(data, null);
    const groupId = snapshot.score.layerGroups[0]!.groupId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'addScoreObjects',
        groupId,
        objects: [
          {
            selectionId: 'local-aclp-42',
            layerIndex: 0,
            objectType: 'AudioClip',
            name: 'Canonical Clip',
            startBeats: 1,
            durationBeats: 2,
            durationTimeBase: 'TIME',
            backgroundColor: 0x669966,
            serializedXml: createAudioClipForTest('Canonical Clip', '/tmp/canonical.wav', 1).saveAsXML().toXml(),
          },
        ],
      },
    });

    const after = createProjectEditorSnapshot(data, null);
    expect(after.score.layerGroups[0]!.layers[0]!.items[0]!.objectId).toBe('local-aclp-42');
    expect(after.score.layerGroups[0]!.layers[0]!.items[0]!.editorTarget?.selectionId).toBe('local-aclp-42');
  });

  it('moves audio clips canonically within audio groups and snapshots beat-based waveform timings', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setTempo(120);

    const audio = new TrackLayerGroup();
    audio.newLayerAt(0);
    audio.newLayerAt(1);

    const clip = createAudioClipForTest('Moved Clip', '/tmp/moved.wav', 2);
    clip.setFileStartTime(0.5);
    clip.setFadeIn(0.25);
    clip.setFadeOut(0.75);
    audio[0]!.push(clip);
    data.getScore().push(audio);

    const before = createProjectEditorSnapshot(data, null);
    const clipTarget = before.score.layerGroups[0]!.layers[0]!.items[0]!.editorTarget;
    const groupId = before.score.layerGroups[0]!.groupId;

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveScoreObjects',
        moves: [
          {
            target: clipTarget!,
            targetGroupId: groupId,
            targetLayerIndex: 1,
            targetStartBeats: 6,
          },
        ],
      },
    });

    const after = createProjectEditorSnapshot(data, null);
    expect(after.score.layerGroups[0]!.layers[0]!.items).toHaveLength(0);
    const moved = after.score.layerGroups[0]!.layers[1]!.items[0]!;
    expect(moved.objectType).toBe('AudioClip');
    expect(moved.startBeats).toBe(6);
    expect(moved.barRenderer.kind).toBe('audioClip');
    if (moved.barRenderer.kind === 'audioClip') {
      expect(moved.barRenderer.audioDurationBeats).toBeCloseTo(4);
      expect(moved.barRenderer.fileStartTimeBeats).toBeCloseTo(1);
      expect(moved.barRenderer.fadeInBeats).toBeCloseTo(0.5);
      expect(moved.barRenderer.fadeOutBeats).toBeCloseTo(1.5);
    }
  });

  it('snapshots actual audio clip color and normalized fade types', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audio = new TrackLayerGroup();
    audio.newLayerAt(0);

    const clip = createAudioClipForTest('Colored Clip', '/tmp/colored.wav', 2);
    clip.setBackgroundColor(0x404040);
    clip.setFadeIn(0.25);
    clip.setFadeInType(FadeType.CONSTANT_POWER);
    clip.setFadeOut(0.5);
    clip.setFadeOutType(FadeType.SLOW);
    audio[0]!.push(clip);
    data.getScore().push(audio);

    const snapshot = createProjectEditorSnapshot(data, null);
    const item = snapshot.score.layerGroups[0]!.layers[0]!.items[0]!;

    expect(item.backgroundColor).toBe(0x404040);
    expect(item.barRenderer.kind).toBe('audioClip');
    if (item.barRenderer.kind === 'audioClip') {
      expect(item.barRenderer.fadeInType).toBe('CONSTANT_POWER');
      expect(item.barRenderer.fadeOutType).toBe('SLOW');
    }
  });
});
