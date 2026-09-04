import { describe, expect, it } from 'vitest';
import {
  AudioClip,
  AudioFile,
  BlueData,
  GenericScore,
  PianoRoll,
  PolyObject,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  type TrackRef,
} from './project-editor';

function createMixedProject(): { data: BlueData; first: TrackRef; second: TrackRef } {
  const data = new BlueData();
  data.getScore().length = 0;
  const group = new TrackLayerGroup();
  group.setUniqueId('items-group');

  const first = group.newLayerAt(0);
  first.setUniqueId('items-first');
  const score = new GenericScore();
  score.setName('Source Score');
  score.setStartTime(TimePosition.beats(0));
  score.setSubjectiveDuration(TimeDuration.beats(1));
  first.push(score);

  const clip = new AudioClip();
  clip.setName('Source Clip');
  clip.setAudioFile('/fixtures/source.wav');
  clip.setStartTime(TimePosition.beats(2));
  clip.setSubjectiveDuration(TimeDuration.beats(1));
  first.push(clip);

  const second = group.newLayerAt(1);
  second.setUniqueId('items-second');
  data.getScore().push(group);
  return {
    data,
    first: {
      rootGroupId: group.getUniqueId(),
      trackId: first.getUniqueId(),
      projectSessionId: 0,
      projectRevision: 0,
    },
    second: {
      rootGroupId: group.getUniqueId(),
      trackId: second.getUniqueId(),
      projectSessionId: 0,
      projectRevision: 0,
    },
  };
}

describe('Track item project patches', () => {
  it('adds, pastes, moves, resizes, and removes mixed items by stable location', () => {
    const { data, first, second } = createMixedProject();
    const context = { projectSessionId: 5, projectRevision: 8 };
    const firstRef = { ...first, ...context };
    const secondRef = { ...second, ...context };
    const track = data.getScore()[0]![0]!;
    const secondTrack = data.getScore()[0]![1]!;

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'addTrackItem',
            track: firstRef,
            item: { objectType: 'GenericScore', name: 'Added Score', durationBeats: 2 },
            startBeats: 4,
          },
        },
        context,
      ),
    ).toBe(true);
    expect(track).toHaveLength(3);

    const snapshot = createProjectEditorSnapshot(data, null, 5, 8);
    const sourceItem =
      snapshot.score?.layerGroups[0]?.groupType === 'track'
        ? snapshot.score.layerGroups[0].layers[0]?.items[0]
        : undefined;
    expect(sourceItem?.serializedXml).toBeDefined();

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'addTrackItem',
            track: secondRef,
            item: {
              serializedXml: sourceItem!.serializedXml,
              name: 'Pasted Score',
              durationBeats: 3,
            },
            startBeats: 6,
          },
        },
        context,
      ),
    ).toBe(true);
    expect(secondTrack).toHaveLength(1);

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'moveTrackItems',
            moves: [
              {
                source: { track: firstRef, objectIndex: 1 },
                destination: secondRef,
                targetStartBeats: 8,
              },
            ],
          },
        },
        context,
      ),
    ).toBe(true);
    expect(track).toHaveLength(2);
    expect(secondTrack).toHaveLength(2);
    expect(secondTrack[1]!.getStartTime().toBeats(data.getScore().getTimeContext())).toBe(8);

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'resizeTrackItems',
            resizes: [
              {
                target: { track: secondRef, objectIndex: 1 },
                targetStartBeats: 9,
                targetDurationBeats: 4,
              },
            ],
          },
        },
        context,
      ),
    ).toBe(true);
    expect(secondTrack[1]!.getSubjectiveDuration().toBeats(data.getScore().getTimeContext())).toBe(
      4,
    );

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'removeTrackItems',
            targets: [{ track: secondRef, objectIndex: 0 }],
          },
        },
        context,
      ),
    ).toBe(true);
    expect(secondTrack).toHaveLength(1);
  });

  it('rejects AudioFile destinations without changing the Track', () => {
    const { data, first } = createMixedProject();
    const context = { projectSessionId: 1, projectRevision: 0 };
    const track = data.getScore()[0]![0]!;
    const before = track.length;
    expect(track.accepts(new AudioFile())).toBe(false);

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'addTrackItem',
            track: { ...first, ...context },
            item: { objectType: 'AudioFile', name: 'Rejected' },
            startBeats: 0,
          },
        },
        context,
      ),
    ).toBe(false);
    expect(track).toHaveLength(before);
  });

  it('rejects PolyObject creation, paste, and move without mutating either Track', () => {
    const { data, first, second } = createMixedProject();
    const context = { projectSessionId: 4, projectRevision: 6 };
    const firstRef = { ...first, ...context };
    const secondRef = { ...second, ...context };
    const firstTrack = data.getScore()[0]![0]!;
    const secondTrack = data.getScore()[0]![1]!;
    const polyObject = new PolyObject();
    polyObject.newLayerAt(0);

    expect(firstTrack.accepts(polyObject)).toBe(false);
    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'addTrackItem',
            track: secondRef,
            item: { objectType: 'PolyObject', name: 'Rejected creation' },
            startBeats: 0,
          },
        },
        context,
      ),
    ).toBe(false);
    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'addTrackItem',
            track: secondRef,
            item: { serializedXml: polyObject.saveAsXML().toXml(), name: 'Rejected paste' },
            startBeats: 0,
          },
        },
        context,
      ),
    ).toBe(false);

    firstTrack.push(polyObject);
    const sourceIndex = firstTrack.indexOf(polyObject);
    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'moveTrackItems',
            moves: [
              {
                source: { track: firstRef, objectIndex: sourceIndex },
                destination: secondRef,
                targetStartBeats: 2,
              },
            ],
          },
        },
        context,
      ),
    ).toBe(false);
    expect(firstTrack[sourceIndex]).toBe(polyObject);
    expect(secondTrack).toHaveLength(0);
  });

  it('keeps the constructor default name when a new Track item has no explicit name', () => {
    const { data, second } = createMixedProject();
    const context = { projectSessionId: 3, projectRevision: 2 };
    const secondTrack = data.getScore()[0]![1]!;

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'addTrackItem',
            track: { ...second, ...context },
            item: { objectType: 'PianoRoll' },
            startBeats: 1,
          },
        },
        context,
      ),
    ).toBe(true);

    expect(secondTrack[0]).toBeInstanceOf(PianoRoll);
    expect(secondTrack[0]!.getName()).toBe('PianoRoll');
  });

  it('sets subjective duration from the selected object objective duration', () => {
    const { data } = createMixedProject();
    const scoreObject = data.getScore()[0]![0]![0] as GenericScore;
    scoreObject.setScoreText('i1 0 1 440\ni1 3 2 660');
    scoreObject.setSubjectiveDuration(TimeDuration.beats(1));
    const snapshot = createProjectEditorSnapshot(data, null);
    const group = snapshot.score?.layerGroups[0];
    if (!group || group.groupType !== 'track') throw new Error('missing Track snapshot');
    const target = group.layers[0]!.items[0]!.editorTarget;

    expect(
      applyProjectDocumentPatch(data, {
        score: { type: 'setSubjectiveDurationToObjective', targets: [target] },
      }),
    ).toBe(true);
    expect(scoreObject.getSubjectiveDuration().toBeats(data.getScore().getTimeContext())).toBe(5);
  });
});
