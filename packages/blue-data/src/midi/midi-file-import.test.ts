import { describe, expect, it } from 'vitest';
import {
  buildMidiImportProject,
  createMidiImportStreamKey,
  expandMidiNoteTemplate,
  MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
  pairMidiImportStream,
  validateMidiImportSettings,
  type MidiImportDocument,
} from './midi-file-import';
import { BlueData } from '../blue-data';
import { GenericScore } from '../sound-objects/generic-score';
import { PolyObject } from '../sound-objects/poly-object';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { CurveType } from '../time/curve-type';

function createDocument(): MidiImportDocument {
  return {
    format: 0,
    division: { kind: 'ppq', ticksPerBeat: 480 },
    tracks: [
      {
        trackIndex: 0,
        name: 'Piano',
        tempoChanges: [],
        lastTick: 960,
        streams: [
          {
            streamKey: createMidiImportStreamKey(0, 0),
            trackIndex: 0,
            channel: 0,
            noteCount: 3,
            firstTick: 0,
            lastTick: 960,
            warnings: [],
            events: [
              { absoluteTick: 0, type: 'noteOn', noteNumber: 60, velocity: 100 },
              { absoluteTick: 240, type: 'noteOn', noteNumber: 60, velocity: 80 },
              { absoluteTick: 480, type: 'noteOn', noteNumber: 60, velocity: 0 },
              { absoluteTick: 720, type: 'noteOff', noteNumber: 60, velocity: 0 },
              { absoluteTick: 720, type: 'noteOn', noteNumber: 64, velocity: 127 },
              { absoluteTick: 960, type: 'noteOff', noteNumber: 64, velocity: 0 },
            ],
          },
        ],
      },
    ],
    tempoChanges: [],
  };
}

describe('MIDI file import conversion', () => {
  it('expands Java-compatible key and velocity placeholders', () => {
    const note = { startTick: 0, endTick: 480, noteNumber: 69, velocity: 127 };

    expect(expandMidiNoteTemplate(
      '<INSTR_ID> <START> <DUR> <KEY> <KEY_PCH> <KEY_OCT> <KEY_CPS> <VELOCITY> <VELOCITY_AMP>',
      '7',
      note,
      0,
      1,
    )).toBe('7 0.0 1.0 69 8.09 8.75 440.0 127 32546.035593324712');
  });

  it('pairs velocity-zero note-ons and overlapping same-key notes by FIFO', () => {
    const result = buildMidiImportProject(createDocument(), [{
      streamKey: '0:0',
      instrumentId: '1',
      noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
      trimTime: false,
    }]);
    const root = result.data.getScore()[0] as PolyObject;
    const score = root[0][0] as GenericScore;

    expect(score.getScoreText()).toBe('i1 0.0 1.0 60 100\ni1 0.5 1.0 60 80\ni1 1.5 0.5 64 127');
    expect(result.warnings).toEqual([]);
    expect(score.getStartTime().getValue()).toBe(0);
    expect(score.getSubjectiveDuration().getValue()).toBe(2);
    expect(result.data.getScore().getTimeContext().getTempoMap().isEnabled()).toBe(true);
    expect(result.data.getScore().getTimeContext().getTempoMap().getTempo()).toBe(120);
  });

  it('configures the Score tempo map from MIDI tempo changes', () => {
    const document = createDocument();
    document.tempoChanges = [
      { absoluteTick: 0, bpm: 120, trackIndex: 0 },
      { absoluteTick: 480, bpm: 90, trackIndex: 0 },
    ];

    const result = buildMidiImportProject(document, [{
      streamKey: '0:0',
      instrumentId: '1',
      noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
      trimTime: false,
    }]);
    const tempoMap = result.data.getScore().getTimeContext().getTempoMap();

    expect(tempoMap.isEnabled()).toBe(true);
    expect(tempoMap.size()).toBe(2);
    expect(tempoMap.getTempo(0)).toBe(120);
    expect(tempoMap.getBeat(1)).toBe(1);
    expect(tempoMap.getTempo(1)).toBe(90);
    expect(tempoMap.getCurveType(1)).toBe(CurveType.CONSTANT);
  });

  it('preserves stream order and XML shape for a TrackLayerGroup import', () => {
    const document = createDocument();
    document.tracks[0].streams.push({
      streamKey: '0:1',
      trackIndex: 0,
      channel: 1,
      noteCount: 1,
      firstTick: 0,
      lastTick: 960,
      warnings: [],
      events: [
        { absoluteTick: 0, type: 'noteOn', noteNumber: 67, velocity: 90 },
        { absoluteTick: 480, type: 'noteOff', noteNumber: 67, velocity: 0 },
      ],
    });
    const settings = [
      {
        streamKey: '0:0',
        instrumentId: '1',
        noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
        trimTime: false,
      },
      {
        streamKey: '0:1',
        instrumentId: '2',
        noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
        trimTime: false,
      },
    ];
    const result = buildMidiImportProject(document, settings, { layerGroupType: 'TRACK' });
    const loaded = BlueData.loadFromString(result.data.saveToString());
    const root = loaded.getScore()[0] as TrackLayerGroup;

    expect(root).toBeInstanceOf(TrackLayerGroup);
    expect(root).toHaveLength(2);
    expect(root.map((track) => track.getName())).toEqual(['Track 0 Ch 1', 'Track 0 Ch 2']);
    expect(root[0]).toHaveLength(1);
    expect(root[0][0]).toBeInstanceOf(GenericScore);
    expect((root[1][0] as GenericScore).getScoreText()).toContain('i2 0.0 1.0 67 90');

    const polyRoot = buildMidiImportProject(document, settings).data.getScore()[0] as PolyObject;
    expect(Array.from(polyRoot, (layer) => layer.getName())).toEqual(['Track 0 Ch 1', 'Track 0 Ch 2']);
  });

  it('normalizes a trimmed stream to its first note', () => {
    const document = createDocument();
    document.tracks[0].streams[0].events = document.tracks[0].streams[0].events.map((event) => ({
      ...event,
      absoluteTick: event.absoluteTick + 480,
    }));
    document.tracks[0].streams[0].lastTick = 1440;

    const result = buildMidiImportProject(document, [{
      streamKey: '0:0',
      instrumentId: ' 3 ',
      noteTemplate: ` ${MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE} `,
      trimTime: true,
    }]);
    const root = result.data.getScore()[0] as PolyObject;
    const score = root[0][0] as GenericScore;

    expect(score.getStartTime().getValue()).toBe(1);
    expect(score.getScoreText()).toContain('i3 0.0 1.0 60 100');
    expect(score.getSubjectiveDuration().getValue()).toBe(2);
  });

  it('reports unmatched note-offs and closes dangling note-ons at stream end', () => {
    const document = createDocument();
    document.tracks[0].streams[0].events = [
      { absoluteTick: 0, type: 'noteOff', noteNumber: 48, velocity: 0 },
      { absoluteTick: 120, type: 'noteOn', noteNumber: 48, velocity: 90 },
    ];
    document.tracks[0].streams[0].lastTick = 480;

    const result = buildMidiImportProject(document, [{
      streamKey: '0:0',
      instrumentId: '1',
      noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
      trimTime: false,
    }]);

    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'unmatched-note-off',
      'dangling-note-on',
    ]);
    expect(result.data.getScore()[0]).toBeInstanceOf(PolyObject);
  });

  it('rejects a zero-valued instrument ID', () => {
    expect(() => validateMidiImportSettings(createDocument(), [{
      streamKey: '0:0',
      instrumentId: '0.0',
      noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
      trimTime: false,
    }])).toThrow('Instrument ID must not be zero');
  });

  it('rejects invalid tempo changes before constructing a project', () => {
    const document = createDocument();
    document.tempoChanges = [{ absoluteTick: 0, bpm: Number.NaN, trackIndex: 0 }];

    expect(() => buildMidiImportProject(document, [{
      streamKey: '0:0',
      instrumentId: '1',
      noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
      trimTime: false,
    }])).toThrow('invalid tempo change');
  });

  it('reports invalid velocities without emitting invalid notes', () => {
    const stream = createDocument().tracks[0].streams[0];
    stream.events = [
      { absoluteTick: 0, type: 'noteOn', noteNumber: 60, velocity: Number.NaN },
    ];

    const paired = pairMidiImportStream(stream);

    expect(paired.notes).toEqual([]);
    expect(paired.warnings.map((warning) => warning.code)).toContain('invalid-note');
  });

  it('round-trips generated score objects through Blue XML', () => {
    const document = createDocument();
    document.tempoChanges = [
      { absoluteTick: 0, bpm: 120, trackIndex: 0 },
      { absoluteTick: 480, bpm: 90, trackIndex: 0 },
    ];
    const result = buildMidiImportProject(document, [{
      streamKey: '0:0',
      instrumentId: '1',
      noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
      trimTime: false,
    }]);
    const loaded = BlueData.loadFromString(result.data.saveToString());
    const root = loaded.getScore()[0] as PolyObject;
    const score = root[0][0] as GenericScore;

    expect(root).toBeInstanceOf(PolyObject);
    expect(score).toBeInstanceOf(GenericScore);
    expect(score.getScoreText()).toContain('i1 0.0 1.0 60 100');
    const tempoMap = loaded.getScore().getTimeContext().getTempoMap();
    expect(tempoMap.isEnabled()).toBe(true);
    expect(tempoMap.getTempo(0)).toBe(120);
    expect(tempoMap.getBeat(1)).toBe(1);
    expect(tempoMap.getTempo(1)).toBe(90);
  });
});
