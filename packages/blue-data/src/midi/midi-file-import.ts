import { BlueData } from '../blue-data';
import { CurveType } from '../time/curve-type';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { TempoPoint } from '../time/tempo-point';
import { GenericScore } from '../sound-objects/generic-score';
import { PolyObject } from '../sound-objects/poly-object';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import type { Score } from '../score/score';
import { pairMidiImportStream } from './midi-note-pairing';
import { expandMidiNoteTemplate } from './midi-note-template';
import type { MidiImportNote } from './midi-note-template';
export { expandMidiNoteTemplate } from './midi-note-template';
export { pairMidiImportStream } from './midi-note-pairing';
export type { MidiImportNote } from './midi-note-template';

/** Standard MIDI File format number. */
export type MidiImportFormat = 0 | 1 | 2;

/** Timing basis for MIDI ticks, expressed as ticks per beat or SMPTE frames and ticks. */
export type MidiImportDivision =
  | {
      /** Discriminant identifying the `ppq` variant. */
      kind: 'ppq';
      /** Number of MIDI ticks in a quarter note. */
      ticksPerBeat: number;
    }
  | {
      /** Discriminant identifying the `smpte` variant. */
      kind: 'smpte';
      /** Frame rate of the MIDI file timing division. */
      framesPerSecond: number;
      /** Number of MIDI ticks in a SMPTE frame. */
      ticksPerFrame: number;
    };

/** Stable category for a recoverable MIDI import warning. */
export type MidiImportWarningCode =
  | 'unmatched-note-off'
  | 'dangling-note-on'
  | 'invalid-note'
  | 'unsupported-event';

/** Recoverable warning associated with a MIDI track and optionally a channel and tick. */
export interface MidiImportWarning {
  /** Machine-readable reason for the diagnostic. */
  code: MidiImportWarningCode;
  /** Human-readable diagnostic text. */
  message: string;
  /** Index of the MIDI track associated with the warning. */
  trackIndex: number;
  /** MIDI channel associated with this event or stream. */
  channel?: number;
  /** MIDI tick associated with the diagnostic. */
  tick?: number;
}

/** An absolute-tick MIDI note-on or note-off event for one channel stream. */
export interface MidiImportNoteEvent {
  /** Timestamp in ticks from the start of the MIDI track. */
  absoluteTick: number;
  /** Whether the event starts or releases a note. */
  type: 'noteOn' | 'noteOff';
  /** MIDI pitch number. */
  noteNumber: number;
  /** MIDI velocity value. */
  velocity: number;
}

/** Events for one MIDI track and channel, plus counts and tick bounds. */
export interface MidiImportStream {
  /** Key identifying the source MIDI track and channel pair. */
  streamKey: string;
  /** Index of the MIDI source track. */
  trackIndex: number;
  /** MIDI channel associated with this event or stream. */
  channel: number;
  /** Note events in the order available to MIDI import. */
  events: MidiImportNoteEvent[];
  /** Count of note-on events with nonzero velocity, before note pairing. */
  noteCount: number;
  /** First tick occupied by the stream. */
  firstTick?: number;
  /** Last tick occupied by the stream. */
  lastTick?: number;
  /** Recoverable problems encountered during processing. */
  warnings: MidiImportWarning[];
}

/** Parsed MIDI track with channel streams and tempo events. */
export interface MidiImportTrack {
  /** Index of the MIDI source track. */
  trackIndex: number;
  /** Name associated with the MIDI import track. */
  name?: string;
  /** MIDI note streams split by channel. */
  streams: MidiImportStream[];
  /** Tempo changes encountered in this track. */
  tempoChanges: MidiImportTempoChange[];
  /** Last absolute tick covered by the track. */
  lastTick: number;
}

/** Tempo change at an absolute tick in a MIDI track. */
export interface MidiImportTempoChange {
  /** Absolute MIDI tick at which the new tempo starts. */
  absoluteTick: number;
  /** Tempo introduced by this event, in beats per minute. */
  bpm: number;
  /** Index of the MIDI source track. */
  trackIndex: number;
}

/** Parsed MIDI file data consumed by the project conversion pipeline. */
export interface MidiImportDocument {
  /** MIDI file format number from its header. */
  format: MidiImportFormat;
  /** Header timing division that gives tick values their meaning. */
  division: MidiImportDivision;
  /** Parsed tracks in MIDI file order. */
  tracks: MidiImportTrack[];
  /** Tempo events available to the overall project conversion. */
  tempoChanges: MidiImportTempoChange[];
}

/** Per-stream controls for instrument assignment, note text, and time trimming. */
export interface MidiImportSettings {
  /** Identifies the source stream these settings apply to. */
  streamKey: string;
  /** Csound instrument ID substituted into this stream's note template. */
  instrumentId: string;
  /** Csound text template expanded once per imported note. */
  noteTemplate: string;
  /** Whether to remove leading time before the selected stream starts. */
  trimTime: boolean;
}

/** Generated Blue project together with warnings encountered during MIDI conversion. */
export interface MidiImportConversionResult {
  /** Blue project constructed from the selected MIDI streams. */
  data: BlueData;
  /** Warnings collected while building the generated project. */
  warnings: MidiImportWarning[];
}

/** Whether MIDI import creates tracks or a polyphonic sound-object group. */
export type MidiImportLayerGroupType = 'TRACK' | 'SOUND_OBJECT';

/** Selects the representation used for imported MIDI streams. */
export interface MidiImportBuildOptions {
  /** Destination layer group family for the generated notes. */
  layerGroupType?: MidiImportLayerGroupType;
}

/** Default Csound note template used for each imported MIDI stream. */
export const MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE = 'i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>';

/** Tempo used when importing MIDI with no initial tempo event, in beats per minute. */
export const MIDI_IMPORT_DEFAULT_TEMPO_BPM = 120;

/** Recognized placeholders in MIDI import note templates. */
export const MIDI_IMPORT_PLACEHOLDERS = [
  '<INSTR_ID>',
  '<START>',
  '<DUR>',
  '<KEY>',
  '<KEY_PCH>',
  '<KEY_OCT>',
  '<KEY_CPS>',
  '<VELOCITY>',
  '<VELOCITY_AMP>',
] as const;

/** Checks whether the supplied instrument ID denotes numeric instrument zero. */
export function isMidiImportInstrumentIdZero(instrumentId: string): boolean {
  const trimmed = instrumentId.trim();
  if (trimmed.length === 0) return false;
  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) && numericValue === 0;
}

/** Creates a key for a MIDI track and channel pair. */
export function createMidiImportStreamKey(trackIndex: number, channel: number): string {
  return `${trackIndex}:${channel}`;
}

function getStreamMap(document: MidiImportDocument): Map<string, MidiImportStream> {
  const streams = new Map<string, MidiImportStream>();
  for (const track of document.tracks) {
    for (const stream of track.streams) {
      streams.set(stream.streamKey, stream);
    }
  }
  return streams;
}

function validateDocument(document: MidiImportDocument): void {
  if (document.format !== 0 && document.format !== 1) {
    throw new Error(
      `Unsupported MIDI format ${document.format}; only formats 0 and 1 are supported.`,
    );
  }

  if (
    document.division.kind !== 'ppq' ||
    !Number.isInteger(document.division.ticksPerBeat) ||
    document.division.ticksPerBeat <= 0
  ) {
    throw new Error('Unsupported MIDI timing: the file must use a positive PPQ division.');
  }

  for (const change of document.tempoChanges) {
    if (
      !Number.isFinite(change.absoluteTick) ||
      change.absoluteTick < 0 ||
      !Number.isFinite(change.bpm) ||
      change.bpm <= 0
    ) {
      throw new Error('The MIDI file contains an invalid tempo change.');
    }
  }
}

/** Checks settings before converting a parsed MIDI stream to Csound notes. */
export function validateMidiImportSettings(
  document: MidiImportDocument,
  settings: readonly MidiImportSettings[],
): void {
  validateDocument(document);

  const streams = getStreamMap(document);
  if (streams.size === 0) {
    throw new Error('The MIDI file does not contain any note-bearing streams.');
  }
  if (settings.length !== streams.size) {
    throw new Error('MIDI import settings do not match the parsed source streams.');
  }

  const seen = new Set<string>();
  for (const setting of settings) {
    if (seen.has(setting.streamKey) || !streams.has(setting.streamKey)) {
      throw new Error(`Invalid MIDI import stream: ${setting.streamKey}`);
    }
    seen.add(setting.streamKey);

    if (setting.instrumentId.trim().length === 0) {
      throw new Error(`Instrument ID is required for stream ${setting.streamKey}.`);
    }
    if (isMidiImportInstrumentIdZero(setting.instrumentId)) {
      throw new Error(`Instrument ID must not be zero for stream ${setting.streamKey}.`);
    }
    if (setting.noteTemplate.trim().length === 0) {
      throw new Error(`Note template is required for stream ${setting.streamKey}.`);
    }
  }
}

function createMidiImportScoreText(
  notes: readonly MidiImportNote[],
  setting: MidiImportSettings,
  ticksPerBeat: number,
  firstStartBeats: number,
): string {
  return notes
    .map((note) => {
      const rawStartBeats = note.startTick / ticksPerBeat;
      const startBeats = setting.trimTime ? rawStartBeats - firstStartBeats : rawStartBeats;
      const durationBeats = (note.endTick - note.startTick) / ticksPerBeat;
      return expandMidiNoteTemplate(
        setting.noteTemplate,
        setting.instrumentId,
        note,
        startBeats,
        durationBeats,
      );
    })
    .join('\n');
}

function configureMidiImportTempoMap(
  score: Score,
  document: MidiImportDocument,
  ticksPerBeat: number,
): void {
  const tempoMap = score.getTimeContext().getTempoMap();
  tempoMap.reset();
  tempoMap.setTempo(MIDI_IMPORT_DEFAULT_TEMPO_BPM);

  const tempoChanges = new Map<number, MidiImportTempoChange>();
  for (const change of document.tempoChanges) {
    tempoChanges.set(change.absoluteTick, change);
  }

  for (const change of [...tempoChanges.values()].sort((a, b) => a.absoluteTick - b.absoluteTick)) {
    const beat = change.absoluteTick / ticksPerBeat;
    if (beat <= 0) {
      tempoMap.setTempo(change.bpm);
    } else {
      tempoMap.addTempoPoint(new TempoPoint(beat, change.bpm, CurveType.CONSTANT));
    }
  }

  tempoMap.setEnabled(true);
}

/**
 * Converts selected beat-based MIDI streams into a new Blue project.
 *
 * @param document - Parsed Standard MIDI File with a ticks-per-beat timing division.
 * @param settings - Per-stream selection, instrument assignment, note template, and trimming settings.
 * @param options - Selects track layers or a polyphonic sound-object group. Defaults to the sound-object group.
 * @returns A new project and recoverable warnings from pairing note events.
 * @throws Error when import settings are invalid or no selected stream yields importable notes.
 */
export function buildMidiImportProject(
  document: MidiImportDocument,
  settings: readonly MidiImportSettings[],
  options: MidiImportBuildOptions = {},
): MidiImportConversionResult {
  validateMidiImportSettings(document, settings);
  const ticksPerBeat = document.division.kind === 'ppq' ? document.division.ticksPerBeat : 0;
  const streams = getStreamMap(document);
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;
  configureMidiImportTempoMap(score, document, ticksPerBeat);

  const root = options.layerGroupType === 'TRACK' ? new TrackLayerGroup() : new PolyObject(true);
  root.setName('MIDI Import');
  const warnings: MidiImportWarning[] = [];
  let rootDuration = 0;

  for (const setting of settings) {
    const stream = streams.get(setting.streamKey);
    if (!stream) {
      throw new Error(`MIDI stream ${setting.streamKey} is no longer available.`);
    }

    const paired = pairMidiImportStream(stream);
    warnings.push(...paired.warnings);
    if (paired.notes.length === 0) {
      continue;
    }

    const firstStartTick = paired.notes[0].startTick;
    const lastEndTick = paired.notes.reduce(
      (maxTick, note) => Math.max(maxTick, note.endTick),
      firstStartTick,
    );
    const firstStartBeats = firstStartTick / ticksPerBeat;
    const scoreStartBeats = setting.trimTime ? firstStartBeats : 0;
    const normalizedSetting: MidiImportSettings = {
      ...setting,
      instrumentId: setting.instrumentId.trim(),
      noteTemplate: setting.noteTemplate.trim(),
    };
    const scoreText = createMidiImportScoreText(
      paired.notes,
      normalizedSetting,
      ticksPerBeat,
      firstStartBeats,
    );
    const scoreDurationBeats = setting.trimTime
      ? (lastEndTick - firstStartTick) / ticksPerBeat
      : lastEndTick / ticksPerBeat;

    const scoreObject = new GenericScore();
    scoreObject.setName(`Track ${stream.trackIndex} Ch ${stream.channel + 1}`);
    scoreObject.setScoreText(scoreText);
    scoreObject.setStartTime(TimePosition.beats(scoreStartBeats));
    scoreObject.setSubjectiveDuration(TimeDuration.beats(Math.max(0, scoreDurationBeats)));

    const layer = root.newLayerAt(root.length);
    layer.setName(scoreObject.getName());
    layer.push(scoreObject);
    rootDuration = Math.max(rootDuration, scoreStartBeats + scoreDurationBeats);
  }

  if (root.length === 0) {
    throw new Error('The MIDI file does not contain any importable notes.');
  }

  if (root instanceof PolyObject) {
    root.setSubjectiveDuration(TimeDuration.beats(Math.max(0, rootDuration)));
  }
  score.push(root);
  return { data, warnings };
}
