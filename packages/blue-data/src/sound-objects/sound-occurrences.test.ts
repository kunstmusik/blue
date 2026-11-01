import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { BSBKnob } from '../instruments/blue-synth-builder/bsb-knob';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { getNotes } from '../utilities/score';
import { AudioFile } from './audio-file';
import { FrozenSoundObject } from './frozen-sound-object';
import { GenericScore } from './generic-score';
import { Instance } from './instance';
import { PolyObject } from './poly-object';
import { Sound } from './sound';
import { SoundLayer } from './sound-layer';
import { TimeBehavior } from './time-behavior';

function createSound(): Sound {
  const sound = new Sound();
  sound.setSubjectiveDuration(TimeDuration.beats(4));
  const instrument = sound.getBlueSynthBuilder();
  instrument.setName('Occurrence Sound');
  instrument.setInstrumentText('aout oscili <freq>, 440\noutc aout, aout');
  const knob = new BSBKnob();
  knob.objectName = 'freq';
  knob.automationAllowed = true;
  instrument.getGraphicInterface().getRootGroup().addChild(knob);
  const parameter = instrument.getParameters()[0]!;
  parameter.setAutomationEnabled(true);
  parameter.setPoints([
    { time: 0, value: 0 },
    { time: 0.5, value: 0.5 },
    { time: 1, value: 1 },
  ]);
  return sound;
}

function createProject(behavior: TimeBehavior, duration: number) {
  const source = new PolyObject();
  source.setTimeBehavior(TimeBehavior.NONE);
  source.setSubjectiveDuration(TimeDuration.beats(4));
  const layer = new SoundLayer();
  layer.push(createSound());
  source.push(layer);
  const instance = new Instance();
  instance.setSoundObject(source);
  instance.setTimeBehavior(behavior);
  instance.setStartTime(TimePosition.beats(10));
  instance.setSubjectiveDuration(TimeDuration.beats(duration));
  const root = new PolyObject(true);
  const rootLayer = new SoundLayer();
  rootLayer.push(instance);
  root.push(rootLayer);
  const data = new BlueData();
  data.getMixer().setEnabled(false);
  data.getScore().length = 0;
  data.getScore().push(root);
  return { data, layer };
}

function scoreNotes(csd: string) {
  return getNotes(csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1]);
}

function notesForInstrumentText(csd: string, text: string) {
  const instrumentIds = new Set(
    [...csd.matchAll(/\tinstr ([^\t\n]+)\t;[^\n]*\n([\s\S]*?)\tendin/g)]
      .filter((match) => match[2].includes(text))
      .map((match) => match[1]),
  );
  return scoreNotes(csd)
    .map((note) => note)
    .filter((note) => instrumentIds.has(note.getPField(1)!));
}

describe('Sound occurrence ranges in mixed source graphs', () => {
  it('retains an active Sound when a nested empty Instance prevents range-origin inference', async () => {
    const { data, layer } = createProject(TimeBehavior.NONE, 4);
    const empty = new GenericScore();
    empty.setScoreText('');
    const nested = new Instance();
    nested.setSoundObject(empty);
    nested.setTimeBehavior(TimeBehavior.NONE);
    layer.push(nested);
    data.setRenderStartTime(12);
    data.setRenderEndTime(14);

    const render = data.toRealtimePlaybackCSD();
    expect((await data.toRealtimePlaybackCSDAsync()).csdText).toBe(render.csdText);
    const notes = notesForInstrumentText(render.csdText, 'oscili');
    expect(notes.map((note) => [note.getStartTime(), note.getSubjectiveDuration()])).toEqual([
      [0, 2],
    ]);
    expect(
      render.parameters?.find((parameter) => parameter.getName() === 'freq')?.getPoints(),
    ).toEqual([
      { time: 12, value: 0.5 },
      { time: 14, value: 1 },
    ]);
  });

  it.each([
    { kind: 'audio', behavior: TimeBehavior.NONE, duration: 4, end: 14, expected: [[0, 2, 2]] },
    { kind: 'frozen', behavior: TimeBehavior.NONE, duration: 4, end: 14, expected: [[0, 2, 2]] },
    { kind: 'audio', behavior: TimeBehavior.SCALE, duration: 8, end: 16, expected: [[0, 4, 2]] },
    { kind: 'frozen', behavior: TimeBehavior.SCALE, duration: 8, end: 16, expected: [[0, 4, 2]] },
    {
      kind: 'audio',
      behavior: TimeBehavior.REPEAT,
      duration: 10,
      end: 19,
      expected: [
        [0, 2, 2],
        [2, 4, 0],
        [6, 1, 0],
      ],
    },
    {
      kind: 'frozen',
      behavior: TimeBehavior.REPEAT,
      duration: 10,
      end: 19,
      expected: [
        [0, 2, 2],
        [2, 4, 0],
        [6, 1, 0],
      ],
    },
  ])(
    'preserves $kind playback and seek during $behavior Sound range generation',
    async ({ kind, behavior, duration, end, expected }) => {
      const { data, layer } = createProject(behavior, duration);
      let file: AudioFile | FrozenSoundObject;
      if (kind === 'audio') {
        const audio = new AudioFile();
        audio.setSoundFileName('samples/review.wav');
        audio.setCsoundPostCode('outc aChannel1, aChannel2');
        file = audio;
      } else {
        const frozen = new FrozenSoundObject();
        frozen.setFrozenWaveFileName('samples/review.wav');
        frozen.setNumChannels(2);
        file = frozen;
      }
      file.setSubjectiveDuration(TimeDuration.beats(4));
      layer.push(file);
      const original = data.saveToString();
      data.setRenderStartTime(12);
      data.setRenderEndTime(end);

      const sync = data.toCSD();
      const asynchronous = await data.toCSDAsync();
      expect(asynchronous).toBe(sync);
      const disk = data.toDiskCSD();
      expect(await data.toDiskCSDAsync()).toBe(disk);
      for (const csd of [sync, disk]) {
        expect(
          notesForInstrumentText(csd, 'diskin2').map((note) => [
            note.getStartTime(),
            note.getSubjectiveDuration(),
            Number(note.getPField(kind === 'audio' ? 4 : 5)),
          ]),
        ).toEqual(expected);
      }
      data.setRenderStartTime(0);
      data.setRenderEndTime(-1);
      expect(data.saveToString()).toBe(original);
    },
  );
});
