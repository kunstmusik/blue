import { beforeAll, describe, it, expect, vi } from 'vitest';
import { Instance } from './instance';
import { GenericScore } from './generic-score';
import { AudioFile } from './audio-file';
import { FrozenSoundObject } from './frozen-sound-object';
import { PolyObject } from './poly-object';
import { SoundLayer } from './sound-layer';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { JavaScriptObject } from './javascript-object';
import { CompileData } from '../compile-data';
import { TimeContext } from '../time/time-context';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { TimeBehavior } from './time-behavior';
import { initializeJavaScriptRuntime } from '../javascript-runtime';
import { CurveType } from '../time/curve-type';
import { TempoPoint } from '../time/tempo-point';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { TimeWarpProcessor } from '../note-processors/time-warp-processor';

function createTempoContext(): TimeContext {
  const context = new TimeContext();
  const tempoMap = context.getTempoMap();
  tempoMap.setEnabled(true);
  tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);
  tempoMap.addTempoPoint(new TempoPoint(12, 60, CurveType.CONSTANT));
  return context;
}

function getFileSeekOffsets(
  notes: Iterable<{ getPField(index: number): string | undefined }>,
): [number, number] {
  const generated = [...notes];
  const audioNote = generated.find(
    (note) => note.getPField(4) !== '"compound-frozen.wav"' && Number(note.getPField(4)) !== 440,
  );
  const frozenNote = generated.find((note) => note.getPField(4) === '"compound-frozen.wav"');
  return [Number(audioNote?.getPField(4)), Number(frozenNote?.getPField(5))];
}

function getP3Values(notes: Iterable<{ toScoreText(): string }>): number[] {
  return [...notes].map((note) => Number(note.toScoreText().trim().split(/\s+/)[2]));
}

describe('Instance', () => {
  beforeAll(initializeJavaScriptRuntime);
  it('does not infer a linked range origin from file leaves after a dynamic source is pruned', async () => {
    const context = createTempoContext();
    const source = new PolyObject();
    source.setTimeBehavior(TimeBehavior.NONE);
    source.setSubjectiveDuration(TimeDuration.beats(12));

    const layer = new SoundLayer();
    const lead = new JavaScriptObject();
    lead.setJavaScriptCode('score = "i1 2 1 440";');
    lead.setTimeBehavior(TimeBehavior.NONE);
    lead.setSubjectiveDuration(TimeDuration.beats(2));
    layer.push(lead);

    const audioFile = new AudioFile();
    audioFile.setSoundFileName('compound-audio.wav');
    audioFile.setStartTime(TimePosition.beats(4));
    audioFile.setSubjectiveDuration(TimeDuration.beats(8));
    layer.push(audioFile);

    const frozen = new FrozenSoundObject();
    frozen.setFrozenWaveFileName('compound-frozen.wav');
    frozen.setNumChannels(1);
    frozen.setStartTime(TimePosition.beats(4));
    frozen.setSubjectiveDuration(TimeDuration.beats(8));
    layer.push(frozen);
    source.push(layer);

    const instance = new Instance();
    instance.setSoundObject(source);
    instance.setTimeBehavior(TimeBehavior.NONE);
    instance.setSubjectiveDuration(TimeDuration.beats(12));
    instance.setStartTime(TimePosition.beats(8));

    const syncNotes = instance.generateForCSD(context, new CompileData(), 3, 5);
    const asyncNotes = await instance.generateForCSDAsync(context, new CompileData(), 3, 5);

    expect(getFileSeekOffsets(syncNotes)).toEqual([0, 0]);
    expect(getFileSeekOffsets(asyncNotes)).toEqual([0, 0]);
    expect(getP3Values(syncNotes)).toEqual([1, 1]);
    expect(getP3Values(asyncNotes)).toEqual([1, 1]);
  });

  it.each([
    { fileStart: 4, expectedSeekBeats: 1, expectedDuration: 2, expectedNoteStart: 8 },
    { fileStart: 6, expectedSeekBeats: 0, expectedDuration: 1, expectedNoteStart: 9 },
  ])(
    'translates linked static-origin ranges before pruning a file leaf at beat $fileStart',
    async ({ fileStart, expectedSeekBeats, expectedDuration, expectedNoteStart }) => {
      const context = createTempoContext();
      const source = new PolyObject();
      source.setTimeBehavior(TimeBehavior.NONE);
      source.setSubjectiveDuration(TimeDuration.beats(12));

      const layer = new SoundLayer();
      const origin = new GenericScore();
      origin.setScoreText('i1 2 1 440');
      origin.setTimeBehavior(TimeBehavior.NONE);
      origin.setSubjectiveDuration(TimeDuration.beats(8));
      layer.push(origin);

      const audioFile = new AudioFile();
      audioFile.setSoundFileName('compound-audio.wav');
      audioFile.setStartTime(TimePosition.beats(fileStart));
      audioFile.setSubjectiveDuration(TimeDuration.beats(8));
      layer.push(audioFile);

      const frozen = new FrozenSoundObject();
      frozen.setFrozenWaveFileName('compound-frozen.wav');
      frozen.setNumChannels(1);
      frozen.setStartTime(TimePosition.beats(fileStart));
      frozen.setSubjectiveDuration(TimeDuration.beats(8));
      layer.push(frozen);
      source.push(layer);

      const instance = new Instance();
      instance.setSoundObject(source);
      instance.setTimeBehavior(TimeBehavior.NONE);
      instance.setSubjectiveDuration(TimeDuration.beats(12));
      instance.setStartTime(TimePosition.beats(8));

      const expectedAdjustedStart = fileStart === 4 ? 1 : 0;
      const expectedAdjustedEnd = fileStart === 4 ? 3 : 1;
      const audioGeneration = vi.spyOn(audioFile, 'generateForCSD');
      const frozenGeneration = vi.spyOn(frozen, 'generateForCSD');
      const syncNotes = instance.generateForCSD(context, new CompileData(), 3, 5);
      const asyncNotes = await instance.generateForCSDAsync(context, new CompileData(), 3, 5);

      const expectedOffsetSeconds =
        context.beatsToSeconds(8 + fileStart + expectedSeekBeats) -
        context.beatsToSeconds(8 + fileStart);
      const expectedOffsets = [expectedOffsetSeconds, expectedOffsetSeconds];
      expect(getFileSeekOffsets(syncNotes)).toEqual(expectedOffsets);
      expect(getFileSeekOffsets(asyncNotes)).toEqual(expectedOffsets);
      expect(getP3Values(syncNotes)).toEqual([expectedDuration, expectedDuration]);
      expect(getP3Values(asyncNotes)).toEqual([expectedDuration, expectedDuration]);
      expect([...syncNotes].map((note) => note.getStartTime())).toEqual([
        expectedNoteStart,
        expectedNoteStart,
      ]);
      expect([...asyncNotes].map((note) => note.getStartTime())).toEqual([
        expectedNoteStart,
        expectedNoteStart,
      ]);
      expect(audioGeneration.mock.calls.map((call) => call.slice(2, 4))).toEqual([
        [expectedAdjustedStart, expectedAdjustedEnd],
        [expectedAdjustedStart, expectedAdjustedEnd],
      ]);
      expect(frozenGeneration.mock.calls.map((call) => call.slice(2, 4))).toEqual([
        [expectedAdjustedStart, expectedAdjustedEnd],
        [expectedAdjustedStart, expectedAdjustedEnd],
      ]);
    },
  );

  it('keeps out-of-span GenericScore origins on the legacy range path', async () => {
    const context = createTempoContext();
    const source = new PolyObject();
    source.setTimeBehavior(TimeBehavior.NONE);
    source.setSubjectiveDuration(TimeDuration.beats(12));

    const layer = new SoundLayer();
    const origin = new GenericScore();
    origin.setScoreText('i1 2 1 440');
    origin.setTimeBehavior(TimeBehavior.NONE);
    origin.setSubjectiveDuration(TimeDuration.beats(2));
    layer.push(origin);

    const audioFile = new AudioFile();
    audioFile.setSoundFileName('compound-audio.wav');
    audioFile.setStartTime(TimePosition.beats(4));
    audioFile.setSubjectiveDuration(TimeDuration.beats(8));
    layer.push(audioFile);

    const frozen = new FrozenSoundObject();
    frozen.setFrozenWaveFileName('compound-frozen.wav');
    frozen.setNumChannels(1);
    frozen.setStartTime(TimePosition.beats(4));
    frozen.setSubjectiveDuration(TimeDuration.beats(8));
    layer.push(frozen);
    source.push(layer);

    const instance = new Instance();
    instance.setSoundObject(source);
    instance.setTimeBehavior(TimeBehavior.NONE);
    instance.setSubjectiveDuration(TimeDuration.beats(12));
    instance.setStartTime(TimePosition.beats(8));

    const audioGeneration = vi.spyOn(audioFile, 'generateForCSD');
    const frozenGeneration = vi.spyOn(frozen, 'generateForCSD');
    const syncNotes = instance.generateForCSD(context, new CompileData(), 3, 5);
    const asyncNotes = await instance.generateForCSDAsync(context, new CompileData(), 3, 5);

    expect(getFileSeekOffsets(syncNotes)).toEqual([0, 0]);
    expect(getFileSeekOffsets(asyncNotes)).toEqual([0, 0]);
    expect(getP3Values(syncNotes)).toEqual([1, 1]);
    expect(getP3Values(asyncNotes)).toEqual([1, 1]);
    expect([...syncNotes].map((note) => note.getStartTime())).toEqual([8, 8]);
    expect([...asyncNotes].map((note) => note.getStartTime())).toEqual([8, 8]);
    expect(audioGeneration.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      [0, 1],
      [0, 1],
    ]);
    expect(frozenGeneration.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('leaves scaled source file seeks and durations unchanged by M16 finalization', async () => {
    const context = createTempoContext();
    const source = new PolyObject();
    source.setTimeBehavior(TimeBehavior.SCALE);
    source.setSubjectiveDuration(TimeDuration.beats(5));

    const layer = new SoundLayer();
    const lead = new GenericScore();
    lead.setScoreText('i1 2 1 440');
    lead.setTimeBehavior(TimeBehavior.NONE);
    lead.setSubjectiveDuration(TimeDuration.beats(5));
    layer.push(lead);

    const audioFile = new AudioFile();
    audioFile.setSoundFileName('compound-audio.wav');
    audioFile.setStartTime(TimePosition.beats(4));
    audioFile.setSubjectiveDuration(TimeDuration.beats(8));
    layer.push(audioFile);

    const frozen = new FrozenSoundObject();
    frozen.setFrozenWaveFileName('compound-frozen.wav');
    frozen.setNumChannels(1);
    frozen.setStartTime(TimePosition.beats(4));
    frozen.setSubjectiveDuration(TimeDuration.beats(8));
    layer.push(frozen);
    source.push(layer);

    const instance = new Instance();
    instance.setSoundObject(source);
    instance.setTimeBehavior(TimeBehavior.NONE);
    instance.setSubjectiveDuration(TimeDuration.beats(12));
    instance.setStartTime(TimePosition.beats(8));

    const syncNotes = instance.generateForCSD(context, new CompileData(), 3, 5);
    const asyncNotes = await instance.generateForCSDAsync(context, new CompileData(), 3, 5);

    expect([getFileSeekOffsets(syncNotes), getFileSeekOffsets(asyncNotes)]).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(getP3Values(syncNotes)).toEqual([1, 1]);
    expect(getP3Values(asyncNotes)).toEqual([1, 1]);
  });

  it('does not finalize file provenance across a nested scaled PolyObject', async () => {
    const context = createTempoContext();
    const source = new PolyObject();
    source.setTimeBehavior(TimeBehavior.NONE);
    source.setSubjectiveDuration(TimeDuration.beats(12));

    const outerLayer = new SoundLayer();
    const lead = new GenericScore();
    lead.setScoreText('i1 0 1 440');
    lead.setStartTime(TimePosition.beats(1));
    lead.setSubjectiveDuration(TimeDuration.beats(8));
    lead.setTimeBehavior(TimeBehavior.NONE);
    outerLayer.push(lead);

    const inner = new PolyObject();
    inner.setTimeBehavior(TimeBehavior.SCALE);
    inner.setSubjectiveDuration(TimeDuration.beats(2));
    inner.setStartTime(TimePosition.beats(2.75));

    const innerLayer = new SoundLayer();
    const audioFile = new AudioFile();
    audioFile.setSoundFileName('nested-scaled-audio.wav');
    audioFile.setStartTime(TimePosition.beats(2));
    audioFile.setSubjectiveDuration(TimeDuration.beats(8));
    innerLayer.push(audioFile);
    inner.push(innerLayer);
    outerLayer.push(inner);
    source.push(outerLayer);

    const instance = new Instance();
    instance.setSoundObject(source);
    instance.setTimeBehavior(TimeBehavior.NONE);
    instance.setSubjectiveDuration(TimeDuration.beats(12));

    const syncNotes = instance.generateForCSD(context, new CompileData(), 0, 5);
    const asyncNotes = await instance.generateForCSDAsync(context, new CompileData(), 0, 5);

    const syncFileNote = [...syncNotes].find((note) => Number(note.getPField(4)) !== 440);
    const asyncFileNote = [...asyncNotes].find((note) => Number(note.getPField(4)) !== 440);
    expect(syncFileNote).toBeDefined();
    expect(asyncFileNote).toBeDefined();
    expect(Number(syncFileNote?.getPField(4))).toBe(0);
    expect(Number(asyncFileNote?.getPField(4))).toBe(0);
    expect(Number(syncFileNote?.toScoreText().trim().split(/\s+/)[2])).toBeCloseTo(1.6);
    expect(Number(asyncFileNote?.toScoreText().trim().split(/\s+/)[2])).toBeCloseTo(1.6);
  });

  it('does not finalize file provenance after a source SoundLayer time processor', async () => {
    const context = createTempoContext();
    const source = new PolyObject();
    source.setTimeBehavior(TimeBehavior.NONE);
    source.setSubjectiveDuration(TimeDuration.beats(12));

    const leadLayer = new SoundLayer();
    const lead = new GenericScore();
    lead.setScoreText('i1 0 8 440');
    lead.setStartTime(TimePosition.beats(2));
    lead.setSubjectiveDuration(TimeDuration.beats(8));
    lead.setTimeBehavior(TimeBehavior.NONE);
    leadLayer.push(lead);
    source.push(leadLayer);

    const fileLayer = new SoundLayer();
    const audioFile = new AudioFile();
    audioFile.setSoundFileName('time-warped-audio.wav');
    audioFile.setStartTime(TimePosition.beats(4));
    audioFile.setSubjectiveDuration(TimeDuration.beats(8));
    fileLayer.push(audioFile);

    const timeWarp = new TimeWarpProcessor();
    timeWarp.setTimeWarpString('0 30');
    const layerProcessors = new NoteProcessorChain();
    layerProcessors.addProcessor(timeWarp);
    fileLayer.setNoteProcessorChain(layerProcessors);
    source.push(fileLayer);

    const instance = new Instance();
    instance.setSoundObject(source);
    instance.setTimeBehavior(TimeBehavior.NONE);
    instance.setSubjectiveDuration(TimeDuration.beats(12));

    const syncNotes = instance.generateForCSD(context, new CompileData(), 3, -1);
    const asyncNotes = await instance.generateForCSDAsync(context, new CompileData(), 3, -1);
    const syncFileNote = [...syncNotes].find((note) => note.getPField(4) !== '440');
    const asyncFileNote = [...asyncNotes].find((note) => note.getPField(4) !== '440');

    expect(syncFileNote).toBeDefined();
    expect(asyncFileNote).toBeDefined();
    expect(Number(syncFileNote?.getPField(4))).toBe(0);
    expect(Number(asyncFileNote?.getPField(4))).toBe(0);
    expect(Number(syncFileNote?.toScoreText().trim().split(/\s+/)[2])).toBeCloseTo(16);
    expect(Number(asyncFileNote?.toScoreText().trim().split(/\s+/)[2])).toBeCloseTo(16);
  });

  it('repeats linked source notes within its own duration at its Score start', async () => {
    const context = new TimeContext();
    const source = new GenericScore();
    source.setScoreText('i1 2 1 440');
    source.setTimeBehavior(TimeBehavior.NONE);
    const instance = new Instance();
    instance.setSoundObject(source);
    instance.setStartTime(TimePosition.beats(10));
    instance.setSubjectiveDuration(TimeDuration.beats(4));
    instance.setTimeBehavior(TimeBehavior.REPEAT);

    const expected = [10, 11, 12, 13];
    expect(
      Array.from(instance.generateForCSD(context, new CompileData(), 0, -1), (note) =>
        note.getStartTime(),
      ),
    ).toEqual(expected);
    expect(
      Array.from(await instance.generateForCSDAsync(context, new CompileData(), 0, -1), (note) =>
        note.getStartTime(),
      ),
    ).toEqual(expected);

    const generated = new JavaScriptObject();
    generated.setJavaScriptCode('score = "i1 2 1 440";');
    generated.setTimeBehavior(TimeBehavior.NONE);
    instance.setSoundObject(generated);
    expect(
      Array.from(await instance.generateForCSDAsync(context, new CompileData(), 0, -1), (note) =>
        note.getStartTime(),
      ),
    ).toEqual(expected);
  });
  describe('default state', () => {
    it('has no sound object', () => {
      const inst = new Instance();
      expect(inst.getSoundObject()).toBeNull();
    });

    it('has empty library id', () => {
      const inst = new Instance();
      expect(inst.getLibraryId()).toBe('');
    });
  });

  describe('library binding', () => {
    it('rejects unresolved library dependencies before typed acceptance', () => {
      const xml = `<soundObject type="Instance">
        <name>My Instance</name>
        <soundObjectReference soundObjectLibraryID="lib_0"/>
      </soundObject>`;
      const elem = Element.parse(xml);
      expect(() => Instance.loadFromXML(elem)).toThrow(/dependency is unresolved/);
      expect(() => Instance.loadFromXML(elem, new ObjRefLoadMap())).toThrow(
        /dependency is unresolved/,
      );
    });

    it('resolves library reference when objRefMap has the object', () => {
      const libObj = new GenericScore();
      libObj.setName('Library Score');

      const objRefMap = new ObjRefLoadMap();
      objRefMap.register('lib_0', libObj);

      const xml = `<soundObject type="Instance">
        <name>My Instance</name>
        <soundObjectReference soundObjectLibraryID="lib_0"/>
      </soundObject>`;
      const elem = Element.parse(xml);
      const inst = Instance.loadFromXML(elem, objRefMap);
      expect(inst.getSoundObject()).toBe(libObj);
      expect(inst.getLibraryId()).toBe('lib_0');
    });

    it('handles null reference safely', () => {
      const xml = `<soundObject type="Instance">
        <name>My Instance</name>
        <soundObjectReference soundObjectLibraryID="null"/>
      </soundObject>`;
      const elem = Element.parse(xml);
      const inst = Instance.loadFromXML(elem);
      expect(inst.getSoundObject()).toBeNull();
      expect(inst.getLibraryId()).toBe('');
    });
  });

  describe('saveAsXML', () => {
    it('saves soundObjectReference with library id', () => {
      const inst = new Instance();
      inst.setName('Test Instance');
      const libObj = new GenericScore();
      libObj.setName('Lib Score');
      inst.setSoundObject(libObj);

      const objRefMap = new ObjRefSaveMap();
      const xml = inst.saveAsXML(objRefMap);
      expect(xml.getAttribute('type')).toBe('blue.soundObject.Instance');

      const refElem = xml.getElement('soundObjectReference');
      expect(refElem).not.toBeNull();
      expect(refElem!.getAttribute('soundObjectLibraryID')).toBeTruthy();
    });
  });

  describe('deepCopy', () => {
    it('copies library id and shared sound object reference', () => {
      const original = new Instance();
      original.setName('Original');
      original.setLibraryId('lib_0');
      const libObj = new GenericScore();
      original.setSoundObject(libObj);

      const copy = original.deepCopy() as Instance;
      expect(copy.getLibraryId()).toBe('lib_0');
      // Java semantics: sound object reference is shared, not deep-copied
      expect(copy.getSoundObject()).toBe(libObj);
    });
  });
});
