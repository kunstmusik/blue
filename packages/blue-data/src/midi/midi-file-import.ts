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

export type MidiImportFormat = 0 | 1 | 2;

export type MidiImportDivision =
  | { kind: 'ppq'; ticksPerBeat: number }
  | { kind: 'smpte'; framesPerSecond: number; ticksPerFrame: number };

export type MidiImportWarningCode =
  | 'unmatched-note-off'
  | 'dangling-note-on'
  | 'invalid-note'
  | 'unsupported-event';

export interface MidiImportWarning {
  code: MidiImportWarningCode;
  message: string;
  trackIndex: number;
  channel?: number;
  tick?: number;
}

export interface MidiImportNoteEvent {
  absoluteTick: number;
  type: 'noteOn' | 'noteOff';
  noteNumber: number;
  velocity: number;
}

export interface MidiImportStream {
  streamKey: string;
  trackIndex: number;
  channel: number;
  events: MidiImportNoteEvent[];
  noteCount: number;
  firstTick?: number;
  lastTick?: number;
  warnings: MidiImportWarning[];
}

export interface MidiImportTrack {
  trackIndex: number;
  name?: string;
  streams: MidiImportStream[];
  tempoChanges: MidiImportTempoChange[];
  lastTick: number;
}

export interface MidiImportTempoChange {
  absoluteTick: number;
  bpm: number;
  trackIndex: number;
}

export interface MidiImportDocument {
  format: MidiImportFormat;
  division: MidiImportDivision;
  tracks: MidiImportTrack[];
  tempoChanges: MidiImportTempoChange[];
}

export interface MidiImportSettings {
  streamKey: string;
  instrumentId: string;
  noteTemplate: string;
  trimTime: boolean;
}

export interface MidiImportConversionResult {
  data: BlueData;
  warnings: MidiImportWarning[];
}

export type MidiImportLayerGroupType = 'TRACK' | 'SOUND_OBJECT';

export interface MidiImportBuildOptions {
  layerGroupType?: MidiImportLayerGroupType;
}

export const MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE = 'i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>';

export const MIDI_IMPORT_DEFAULT_TEMPO_BPM = 120;

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

export function isMidiImportInstrumentIdZero(instrumentId: string): boolean {
  const trimmed = instrumentId.trim();
  if (trimmed.length === 0) return false;
  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) && numericValue === 0;
}

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
