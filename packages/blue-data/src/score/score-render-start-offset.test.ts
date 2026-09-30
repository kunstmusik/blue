import { describe, expect, it } from 'vitest';
import { CompileData } from '../compile-data';
import { PianoRoll } from '../sound-objects/piano-roll';
import { PianoNote } from '../sound-objects/piano-roll/piano-note';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { AudioFile } from '../sound-objects/audio-file';
import { FrozenSoundObject } from '../sound-objects/frozen-sound-object';
import { GenericScore } from '../sound-objects/generic-score';
import { Instance } from '../sound-objects/instance';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { CurveType } from '../time/curve-type';
import { TempoPoint } from '../time/tempo-point';
import { TimeContext } from '../time/time-context';
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

function createNestedFileSoundObjects(
  wrapInInstances = false,
  sourceStart = wrapInInstances ? 0 : 2,
): {
  outer: PolyObject;
  context: TimeContext;
} {
  const context = new TimeContext();
  const tempoMap = context.getTempoMap();
  tempoMap.setEnabled(true);
  tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);
  tempoMap.addTempoPoint(new TempoPoint(9, 90, CurveType.CONSTANT));
  tempoMap.addTempoPoint(new TempoPoint(12, 120, CurveType.CONSTANT));

  const audioFile = new AudioFile();
  audioFile.setSoundFileName('nested-audio.wav');
  audioFile.setStartTime(TimePosition.beats(sourceStart));
  audioFile.setSubjectiveDuration(TimeDuration.beats(8));

  const frozen = new FrozenSoundObject();
  frozen.setStartTime(TimePosition.beats(sourceStart));
  frozen.setSubjectiveDuration(TimeDuration.beats(8));
  frozen.setNumChannels(1);
  frozen.setFrozenWaveFileName('nested-frozen.wav');

  const childLayer = new SoundLayer();
  if (wrapInInstances) {
    const instances = [audioFile, frozen].map((soundObject) => {
      const instance = new Instance();
      instance.setSoundObject(soundObject);
      instance.setStartTime(TimePosition.beats(2));
      instance.setSubjectiveDuration(TimeDuration.beats(8));
      instance.setTimeBehavior(TimeBehavior.NONE);
      return instance;
    });
    childLayer.push(...instances);
  } else {
    childLayer.push(audioFile, frozen);
  }

  const child = new PolyObject();
  child.setStartTime(TimePosition.beats(8));
  child.setSubjectiveDuration(TimeDuration.beats(12));
  child.setTimeBehavior(TimeBehavior.NONE);
  child.push(childLayer);

  const outerLayer = new SoundLayer();
  outerLayer.push(child);

  const outer = new PolyObject(true);
  outer.setStartTime(TimePosition.beats(0));
  outer.setTimeBehavior(TimeBehavior.NONE);
  outer.push(outerLayer);

  return { outer, context };
}

function expectNestedFileOffsets(
  notes: Iterable<{ getPField(index: number): string | undefined }>,
  expectedSeconds: number,
): void {
  const generated = [...notes];
  expect(generated).toHaveLength(2);
  const audioFileNote = generated.find((note) => note.getPField(4) !== '"nested-frozen.wav"');
  const frozenNote = generated.find((note) => note.getPField(4) === '"nested-frozen.wav"');

  expect(audioFileNote).toBeDefined();
  expect(frozenNote).toBeDefined();
  expect(Number(audioFileNote?.getPField(4))).toBeCloseTo(expectedSeconds, 6);
  expect(Number(frozenNote?.getPField(5))).toBeCloseTo(expectedSeconds, 6);
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

describe('nested file-backed SoundObject render offsets', () => {
  it('rebases nested PolyObject notes once for a bounded selected range', async () => {
    const score = new Score();
    const nested = new PolyObject();
    nested.newLayerAt(-1);
    nested.setStartTime(TimePosition.beats(8));
    nested.setTimeBehavior(TimeBehavior.NONE);
    const phrase = new GenericScore();
    phrase.setScoreText('i1 1 0.5\ni2 1.5 0.5');
    phrase.setTimeBehavior(TimeBehavior.NONE);
    nested[0]!.push(phrase);
    (score[0] as PolyObject)[0]!.push(nested);

    expect(startTimes(score.generateForCSD(new CompileData(), 9, 10))).toEqual([0, 0.5]);
    expect(startTimes(await score.generateForCSDAsync(new CompileData(), 9, 10))).toEqual([0, 0.5]);
  });

  it('uses project tempo for a bounded selected range at the nested SoundLayer boundary', () => {
    const { outer, context } = createNestedFileSoundObjects();
    const child = outer[0]![0]! as PolyObject;
    const childLayer = child[0]!;
    const notes = childLayer.generateForCSD(context, new CompileData(), 3, 5, { beatOrigin: 8 });
    const generated = [...notes];

    expectNestedFileOffsets(generated, context.beatsToSeconds(11) - context.beatsToSeconds(10));
    expect(startTimes(generated)).toEqual([3, 3]);
    expect(generated.map((note) => note.getSubjectiveDuration())).toEqual([2, 2]);
  });

  it('accumulates the child PolyObject start in synchronous generation', () => {
    const { outer, context } = createNestedFileSoundObjects();
    const child = outer[0]![0]! as PolyObject;
    const notes = child.generateForCSD(context, new CompileData(), 3, -1);
    const generated = [...notes];

    expectNestedFileOffsets(generated, context.beatsToSeconds(11) - context.beatsToSeconds(10));
    expect(startTimes(generated)).toEqual([8, 8]);
    expect(generated.map((note) => note.getSubjectiveDuration())).toEqual([7, 7]);
  });

  it('accumulates the child PolyObject start in asynchronous generation', async () => {
    const { outer, context } = createNestedFileSoundObjects();
    const child = outer[0]![0]! as PolyObject;
    const notes = await child.generateForCSDAsync(context, new CompileData(), 3, -1);
    const generated = [...notes];

    expectNestedFileOffsets(generated, context.beatsToSeconds(11) - context.beatsToSeconds(10));
    expect(startTimes(generated)).toEqual([8, 8]);
    expect(generated.map((note) => note.getSubjectiveDuration())).toEqual([7, 7]);
  });

  it('composes nested PolyObject and Instance starts for synchronous generation', () => {
    const { outer, context } = createNestedFileSoundObjects(true);
    const child = outer[0]![0]! as PolyObject;
    const notes = child.generateForCSD(context, new CompileData(), 3, -1);
    const generated = [...notes];

    expectNestedFileOffsets(generated, context.beatsToSeconds(11) - context.beatsToSeconds(10));
    expect(startTimes(generated)).toEqual([7, 7]);
    expect(generated.map((note) => note.getSubjectiveDuration())).toEqual([7, 7]);
  });

  it('composes nested PolyObject and Instance starts for asynchronous generation', async () => {
    const { outer, context } = createNestedFileSoundObjects(true);
    const child = outer[0]![0]! as PolyObject;
    const notes = await child.generateForCSDAsync(context, new CompileData(), 3, -1);
    const generated = [...notes];

    expectNestedFileOffsets(generated, context.beatsToSeconds(11) - context.beatsToSeconds(10));
    expect(startTimes(generated)).toEqual([7, 7]);
    expect(generated.map((note) => note.getSubjectiveDuration())).toEqual([7, 7]);
  });

  it('excludes normalized linked-source starts from the sync seek origin', () => {
    const { outer, context } = createNestedFileSoundObjects(true, 2);
    const child = outer[0]![0]! as PolyObject;
    const notes = child.generateForCSD(context, new CompileData(), 3, -1);

    expectNestedFileOffsets(notes, context.beatsToSeconds(11) - context.beatsToSeconds(10));
  });

  it('excludes normalized linked-source starts from the async seek origin', async () => {
    const { outer, context } = createNestedFileSoundObjects(true, 2);
    const child = outer[0]![0]! as PolyObject;
    const notes = await child.generateForCSDAsync(context, new CompileData(), 3, -1);

    expectNestedFileOffsets(notes, context.beatsToSeconds(11) - context.beatsToSeconds(10));
  });
});
