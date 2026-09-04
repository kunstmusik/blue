import { describe, it, expect } from 'vitest';
import type {
  ScoreObjectBarRendererSnapshot,
  GenericBarRendererSnapshot,
  CommentBarRendererSnapshot,
  LetterBarRendererSnapshot,
  PianoRollBarRendererSnapshot,
  AudioFileBarRendererSnapshot,
  FrozenSoundObjectBarRendererSnapshot,
  AudioClipBarRendererSnapshot,
  FallbackBarRendererSnapshot,
} from '../../shared/project-editor';

describe('ScoreObjectBarRendererSnapshot contract', () => {
  it('creates generic renderer for GenericScore', () => {
    const snap: GenericBarRendererSnapshot = {
      kind: 'generic',
      labelLines: ['My Score'],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
    };
    expect(snap.kind).toBe('generic');
    expect(snap.labelLines).toEqual(['My Score']);
    expect(snap.repeatPointBeats).toBeNull();
  });

  it('creates generic renderer with repeat point', () => {
    const snap: GenericBarRendererSnapshot = {
      kind: 'generic',
      labelLines: ['Repeated'],
      timeBehavior: 'REPEAT',
      repeatPointBeats: 4.0,
    };
    expect(snap.kind).toBe('generic');
    expect(snap.timeBehavior).toBe('REPEAT');
    expect(snap.repeatPointBeats).toBe(4.0);
  });

  it('creates comment renderer', () => {
    const snap: CommentBarRendererSnapshot = {
      kind: 'comment',
      labelLines: ['A comment'],
    };
    expect(snap.kind).toBe('comment');
    expect(snap.labelLines).toEqual(['A comment']);
  });

  it('creates letter renderer for LineObject', () => {
    const snap: LetterBarRendererSnapshot = {
      kind: 'letter',
      letter: 'L',
      labelLines: ['Line'],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
      mappingStatus: 'supported',
    };
    expect(snap.kind).toBe('letter');
    expect(snap.letter).toBe('L');
    expect(snap.mappingStatus).toBe('supported');
  });

  it('creates letter renderer with fallback for ObjectBuilder', () => {
    const snap: LetterBarRendererSnapshot = {
      kind: 'letter',
      letter: 'O',
      labelLines: ['Builder'],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
      mappingStatus: 'fallback',
    };
    expect(snap.kind).toBe('letter');
    expect(snap.letter).toBe('O');
    expect(snap.mappingStatus).toBe('fallback');
  });

  it('creates letter renderer with fallback for ClojureObject', () => {
    const snap: LetterBarRendererSnapshot = {
      kind: 'letter',
      letter: 'C',
      labelLines: ['Clojure'],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
      mappingStatus: 'fallback',
    };
    expect(snap.letter).toBe('C');
    expect(snap.mappingStatus).toBe('fallback');
  });

  const letterMappings: Array<{ type: string; letter: string }> = [
    { type: 'LineObject', letter: 'L' },
    { type: 'ZakLineObject', letter: 'L' },
    { type: 'External', letter: 'E' },
    { type: 'Instance', letter: 'I' },
    { type: 'PythonObject', letter: 'P' },
    { type: 'JavaScriptObject', letter: 'J' },
    { type: 'JMask', letter: 'J' },
    { type: 'Sound', letter: 'S' },
    { type: 'TrackerObject', letter: 'T' },
  ];

  for (const mapping of letterMappings) {
    it(`maps ${mapping.type} to letter "${mapping.letter}"`, () => {
      const snap: LetterBarRendererSnapshot = {
        kind: 'letter',
        letter: mapping.letter,
        labelLines: [mapping.type],
        timeBehavior: 'NONE',
        repeatPointBeats: null,
        mappingStatus: 'supported',
      };
      expect(snap.letter).toBe(mapping.letter);
    });
  }

  it('creates PianoRoll renderer with notes', () => {
    const snap: PianoRollBarRendererSnapshot = {
      kind: 'pianoRoll',
      labelLines: ['Piano'],
      timeBehavior: 'SCALE',
      repeatPointBeats: null,
      scaleDegreeCount: 12,
      notesDurationBeats: 8.0,
      notes: [
        { octave: 5, scaleDegree: 0, startBeats: 0, durationBeats: 1 },
        { octave: 5, scaleDegree: 2, startBeats: 1, durationBeats: 1 },
      ],
    };
    expect(snap.kind).toBe('pianoRoll');
    expect(snap.notes.length).toBe(2);
    expect(snap.scaleDegreeCount).toBe(12);
  });

  it('creates AudioFile renderer', () => {
    const snap: AudioFileBarRendererSnapshot = {
      kind: 'audioFile',
      labelLines: ['test.wav'],
      audioFilePath: '/path/to/test.wav',
      waveformKey: 'af:/path/to/test.wav',
    };
    expect(snap.kind).toBe('audioFile');
    expect(snap.waveformKey).toBe('af:/path/to/test.wav');
  });

  it('creates AudioFile renderer with null waveform for empty path', () => {
    const snap: AudioFileBarRendererSnapshot = {
      kind: 'audioFile',
      labelLines: [''],
      audioFilePath: '',
      waveformKey: null,
    };
    expect(snap.waveformKey).toBeNull();
  });

  it('creates FrozenSoundObject renderer', () => {
    const snap: FrozenSoundObjectBarRendererSnapshot = {
      kind: 'frozenSoundObject',
      labelLines: ['Frozen'],
      frozenWaveFileName: 'frozen.wav',
      waveformKey: 'fso:frozen.wav',
      originalDurationBeats: 4.0,
      currentDurationBeats: 8.0,
    };
    expect(snap.kind).toBe('frozenSoundObject');
    expect(snap.originalDurationBeats).toBe(4.0);
    expect(snap.currentDurationBeats).toBe(8.0);
  });

  it('creates FrozenSoundObject renderer with null original duration', () => {
    const snap: FrozenSoundObjectBarRendererSnapshot = {
      kind: 'frozenSoundObject',
      labelLines: ['Frozen'],
      frozenWaveFileName: '',
      waveformKey: null,
      originalDurationBeats: null,
      currentDurationBeats: 8.0,
    };
    expect(snap.originalDurationBeats).toBeNull();
  });

  it('creates AudioClip renderer with fades', () => {
    const snap: AudioClipBarRendererSnapshot = {
      kind: 'audioClip',
      labelLines: ['Clip'],
      audioFilePath: 'clip.wav',
      waveformKey: 'aclp:clip.wav',
      fileStartTimeBeats: 2.0,
      audioDurationBeats: 10.0,
      looping: true,
      fadeInBeats: 0.5,
      fadeInType: 'LINEAR',
      fadeOutBeats: 1.0,
      fadeOutType: 'CONSTANT_POWER',
    };
    expect(snap.kind).toBe('audioClip');
    expect(snap.looping).toBe(true);
    expect(snap.fadeInType).toBe('LINEAR');
    expect(snap.fadeOutType).toBe('CONSTANT_POWER');
  });

  it('creates fallback renderer for unknown types', () => {
    const snap: FallbackBarRendererSnapshot = {
      kind: 'fallback',
      labelLines: ['Unknown'],
      reason: 'unknown-type',
      javaRenderer: 'CSDSoundObject',
    };
    expect(snap.kind).toBe('fallback');
    expect(snap.reason).toBe('unknown-type');
  });

  it('discriminated union dispatches on kind', () => {
    const snaps: ScoreObjectBarRendererSnapshot[] = [
      { kind: 'generic', labelLines: [], timeBehavior: 'NONE', repeatPointBeats: null },
      { kind: 'comment', labelLines: [] },
      {
        kind: 'letter',
        letter: 'L',
        labelLines: [],
        timeBehavior: 'NONE',
        repeatPointBeats: null,
        mappingStatus: 'supported',
      },
      {
        kind: 'pianoRoll',
        labelLines: [],
        timeBehavior: 'NONE',
        repeatPointBeats: null,
        scaleDegreeCount: 12,
        notesDurationBeats: 0,
        notes: [],
      },
      { kind: 'audioFile', labelLines: [], audioFilePath: '', waveformKey: null },
      {
        kind: 'frozenSoundObject',
        labelLines: [],
        frozenWaveFileName: '',
        waveformKey: null,
        originalDurationBeats: null,
        currentDurationBeats: 0,
      },
      {
        kind: 'audioClip',
        labelLines: [],
        audioFilePath: '',
        waveformKey: null,
        fileStartTimeBeats: 0,
        audioDurationBeats: 0,
        looping: false,
        fadeInBeats: 0,
        fadeInType: 'LINEAR',
        fadeOutBeats: 0,
        fadeOutType: 'LINEAR',
      },
      { kind: 'fallback', labelLines: [], reason: 'unknown-type' },
    ];

    for (const snap of snaps) {
      switch (snap.kind) {
        case 'generic':
          expect(snap.timeBehavior).toBeDefined();
          break;
        case 'comment':
          expect(snap.labelLines).toBeDefined();
          break;
        case 'letter':
          expect(snap.letter).toBeTruthy();
          break;
        case 'pianoRoll':
          expect(Array.isArray(snap.notes)).toBe(true);
          break;
        case 'audioFile':
          expect(snap).toHaveProperty('audioFilePath');
          break;
        case 'frozenSoundObject':
          expect(snap).toHaveProperty('frozenWaveFileName');
          break;
        case 'audioClip':
          expect(snap).toHaveProperty('looping');
          break;
        case 'fallback':
          expect(snap.reason).toBeDefined();
          break;
      }
    }
  });
});
