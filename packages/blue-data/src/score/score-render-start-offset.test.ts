import { describe, expect, it } from 'vitest';
import { CompileData } from '../compile-data';
import { PianoRoll } from '../sound-objects/piano-roll';
import { PianoNote } from '../sound-objects/piano-roll/piano-note';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { AudioClip } from './audio/audio-clip';
import { Score } from './score';
import { TrackLayerGroup } from './track/track-layer-group';

const RENDER_START = 16;
const RENDER_END = 20;

function createPianoRoll(
  scoreStart = RENDER_START,
  noteStarts: readonly number[] = [0, 0.75, 1.5],
): PianoRoll {
  const pianoRoll = new PianoRoll();
  pianoRoll.setStartTime(TimePosition.beats(scoreStart));
  pianoRoll.setSubjectiveDuration(TimeDuration.beats(4));
  pianoRoll.setTimeBehavior(TimeBehavior.NONE);

  for (const start of noteStarts) {
    const note = new PianoNote();
    note.initFields(pianoRoll.getFieldDefinitions());
    note.setStart(start);
    note.setDuration(0.25);
    pianoRoll.addNote(note);
  }

  return pianoRoll;
}

function createScore(layerPath: 'sound-object' | 'track', pianoRoll = createPianoRoll()): Score {
  const score = new Score();
  score.length = 0;

  if (layerPath === 'sound-object') {
    const group = new PolyObject(true);
    const layer = new SoundLayer();
    layer.push(pianoRoll);
    group.push(layer);
    score.push(group);
  } else {
    const group = new TrackLayerGroup();
    group.newLayerAt(0).push(pianoRoll);
    score.push(group);
  }

  return score;
}

function startTimes(notes: Iterable<{ getStartTime(): number }>): number[] {
  return [...notes].map((note) => note.getStartTime());
}

describe.each([
  ['SoundObject layer', 'sound-object'],
  ['Track layer', 'track'],
] as const)('%s render-start translation', (_label, layerPath) => {
  it('rebases synchronous PianoRoll notes to the start of the performance', () => {
    const notes = createScore(layerPath).generateForCSD(
      new CompileData(),
      RENDER_START,
      RENDER_END,
    );

    expect(startTimes(notes)).toEqual([0, 0.75, 1.5]);
  });

  it('rebases asynchronous PianoRoll notes to the start of the performance', async () => {
    const notes = await createScore(layerPath).generateForCSDAsync(
      new CompileData(),
      RENDER_START,
      RENDER_END,
    );

    expect(startTimes(notes)).toEqual([0, 0.75, 1.5]);
  });

  it('excludes PianoRoll notes before the render start after rebasing', () => {
    const pianoRoll = createPianoRoll(15, [0.5, 1, 1.75]);
    const notes = createScore(layerPath, pianoRoll).generateForCSD(
      new CompileData(),
      RENDER_START,
      RENDER_END,
    );

    expect(startTimes(notes)).toEqual([0, 0.75]);
  });
});

it('does not rebase already-relative Track AudioClip notes twice', () => {
  const score = new Score();
  score.length = 0;
  const group = new TrackLayerGroup();
  const track = group.newLayerAt(0);
  const clip = new AudioClip();
  clip.setAudioFile('/fixtures/render-start.wav');
  clip.setStartTime(TimePosition.beats(RENDER_START));
  clip.setSubjectiveDuration(TimeDuration.beats(1));
  track.push(clip);
  score.push(group);

  const notes = score.generateForCSD(new CompileData(), RENDER_START, RENDER_END);

  expect(startTimes(notes)).toEqual([0]);
});
