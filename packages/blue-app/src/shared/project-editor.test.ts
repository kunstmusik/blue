import { describe, expect, it } from 'vitest';
import {
  BlueData,
  AudioClip,
  GenericScore,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  isEmptyProjectDocumentPatch,
  resolveTimelineScoreObjects,
} from './project-editor';

describe('resolveTimelineScoreObjects', () => {
  it('resolves snapshot IDs to the original timeline objects', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const score = new GenericScore();
    score.setStartTime(TimePosition.beats(1));
    score.setSubjectiveDuration(TimeDuration.beats(2));
    const clip = new AudioClip();
    clip.setAudioFile('/fixtures/audition.wav');
    track.push(score, clip);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null);
    const objectId = snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!.objectId;
    const clipId = snapshot.score!.layerGroups[0]!.layers[0]!.items[1]!.objectId;

    expect(resolveTimelineScoreObjects(data, [objectId, clipId])).toEqual([score, clip]);
  });

  it('rejects duplicate and stale IDs without returning partial selections', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const score = new GenericScore();
    track.push(score);
    data.getScore().push(group);
    const snapshot = createProjectEditorSnapshot(data, null);
    const objectId = snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!.objectId;

    expect(resolveTimelineScoreObjects(data, [objectId, objectId])).toBeNull();
    expect(resolveTimelineScoreObjects(data, [objectId, 'missing'])).toBeNull();
    expect(resolveTimelineScoreObjects(data, ['  '])).toBeNull();
  });
});

describe('Scratch Pad project bridge', () => {
  it('includes scratch pad data in snapshots and applies partial patches', () => {
    const data = new BlueData();
    data.getScratchPadData().setScratchText('Initial notes');
    data.getScratchPadData().setWordWrapEnabled(false);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.scratchPad).toEqual({
      text: 'Initial notes',
      wordWrapEnabled: false,
    });

    expect(applyProjectDocumentPatch(data, {
      scratchPad: { text: 'Updated notes' },
    })).toBe(true);
    expect(data.getScratchPadData().getScratchText()).toBe('Updated notes');
    expect(data.getScratchPadData().isWordWrapEnabled()).toBe(false);

    expect(applyProjectDocumentPatch(data, {
      scratchPad: { wordWrapEnabled: true },
    })).toBe(true);
    expect(data.getScratchPadData().isWordWrapEnabled()).toBe(true);
    expect(applyProjectDocumentPatch(data, {
      scratchPad: {},
    })).toBe(false);
    expect(isEmptyProjectDocumentPatch({ scratchPad: {} })).toBe(true);
  });
});
