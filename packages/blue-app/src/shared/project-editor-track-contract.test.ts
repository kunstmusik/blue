import { describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericInstrument,
  GenericScore,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  type ProjectDocumentPatchContext,
  type TrackRef,
} from './project-editor';

function createTrackProject(): { data: BlueData; ref: TrackRef } {
  const data = new BlueData();
  const group = new TrackLayerGroup();
  group.setUniqueId('contract-group');
  const track = group.newLayerAt(0);
  track.setUniqueId('contract-track');
  track.setName('Contract Track');
  const score = new GenericScore();
  score.setName('Existing');
  score.setScoreText('i1 0 1 60');
  score.setStartTime(TimePosition.beats(0));
  score.setSubjectiveDuration(TimeDuration.beats(1));
  track.push(score);
  data.getScore().length = 0;
  data.getScore().push(group);
  return {
    data,
    ref: {
      rootGroupId: 'contract-group',
      trackId: 'contract-track',
      projectSessionId: 2,
      projectRevision: 0,
    },
  };
}

describe('Track project editor contract', () => {
  it('projects stable Track identity, mixed rows, and instrument summary', () => {
    const { data, ref } = createTrackProject();
    const instrument = new GenericInstrument();
    instrument.setName('Owned');
    const track = data.getScore()[0]![0]!;
    track.setInstrument(instrument);

    const snapshot = createProjectEditorSnapshot(data, null, 4);
    const group = snapshot.score?.layerGroups[0];
    expect(group?.groupType).toBe('track');
    if (!group || group.groupType !== 'track') throw new Error('missing Track snapshot');
    expect(group.groupId).toBe(ref.rootGroupId);
    expect(group.layers[0]?.layerKind).toBe('track');
    expect(group.layers[0]?.layerId).toBe(ref.trackId);
    expect(group.layers[0]?.instrument).toMatchObject({ trackId: ref.trackId, name: 'Owned' });
    expect(group.layers[0]?.items[0]?.editorTarget.location).toMatchObject({
      rootGroupId: ref.rootGroupId,
      trackId: ref.trackId,
    });
  });

  it('validates stable targets before mutation and rejects incompatible payloads', () => {
    const { data, ref } = createTrackProject();
    const context: ProjectDocumentPatchContext = { projectSessionId: 7, projectRevision: 3 };
    const validRef: TrackRef = { ...ref, projectSessionId: 7, projectRevision: 3 };
    const track = data.getScore()[0]![0]!;
    const originalLength = track.length;

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'addTrackItem',
        track: validRef,
        item: { objectType: 'AudioFile', name: 'wrong type' },
        startBeats: 0,
      },
    }, context)).toBe(false);
    expect(track).toHaveLength(originalLength);

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'addTrackItem',
        track: { ...validRef, rootGroupId: 'wrong-group' },
        item: { objectType: 'GenericScore', name: 'not added' },
        startBeats: 0,
      },
    }, context)).toBe(false);
    expect(track).toHaveLength(originalLength);

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'addTrackItem',
        track: { ...validRef, projectSessionId: 8 },
        item: { objectType: 'GenericScore', name: 'stale' },
        startBeats: 0,
      },
    }, context)).toBe(false);
    expect(track).toHaveLength(originalLength);

    const missingFence = {
      rootGroupId: ref.rootGroupId,
      trackId: ref.trackId,
    } as TrackRef;
    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'addTrackItem',
        track: missingFence,
        item: { objectType: 'GenericScore', name: 'unfenced' },
        startBeats: 0,
      },
    }, context)).toBe(false);
    expect(track).toHaveLength(originalLength);
  });

  it('adds and replaces Track-owned content atomically through stable identity', () => {
    const { data, ref } = createTrackProject();
    const context: ProjectDocumentPatchContext = { projectSessionId: 2, projectRevision: 0 };
    const track = data.getScore()[0]![0]!;

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'addTrackItem',
        track: { ...ref, projectSessionId: 2, projectRevision: 0 },
        item: { objectType: 'GenericScore', name: 'Added', durationBeats: 2 },
        startBeats: 2,
      },
    }, context)).toBe(true);
    expect(track).toHaveLength(2);
    expect(track[1]?.getName()).toBe('Added');

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'createTrackInstrument',
        track: ref,
        instrumentType: 'generic',
      },
    }, context)).toBe(true);
    expect(track.getInstrument()).not.toBeNull();

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'clearTrackInstrument',
        track: ref,
      },
    }, context)).toBe(true);
    expect(track.getInstrument()).toBeNull();
  });
});
