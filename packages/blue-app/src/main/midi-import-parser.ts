import { parseMidi, type MidiData, type MidiEvent } from 'midi-file';
import {
  createMidiImportStreamKey,
  MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
  pairMidiImportStream,
  type MidiImportDocument,
  type MidiImportNoteEvent,
  type MidiImportStream,
  type MidiImportTempoChange,
  type MidiImportTrack,
} from '@blue/data';
import type { MidiImportPreview, MidiImportStreamPreview } from '../shared/midi-import';

export interface ParsedMidiImport {
  document: MidiImportDocument;
  preview: MidiImportPreview;
}

function parserError(error: unknown): Error {
  return new Error(error instanceof Error ? error.message : String(error));
}

function validateMidiHeader(data: MidiData): { format: 0 | 1; ticksPerBeat: number } {
  const ticksPerBeat = data.header.ticksPerBeat;
  if (data.header.format !== 0 && data.header.format !== 1) {
    throw new Error(
      `Unsupported MIDI format ${String(data.header.format)}; only formats 0 and 1 are supported.`,
    );
  }
  if (typeof ticksPerBeat !== 'number' || !Number.isInteger(ticksPerBeat) || ticksPerBeat <= 0) {
    throw new Error('Unsupported MIDI timing: the file must use a positive PPQ division.');
  }
  if (data.tracks.length !== data.header.numTracks) {
    throw new Error(
      `MIDI header expected ${data.header.numTracks} tracks but found ${data.tracks.length}.`,
    );
  }
  return { format: data.header.format, ticksPerBeat };
}

function createStream(trackIndex: number, channel: number): MidiImportStream {
  return {
    streamKey: createMidiImportStreamKey(trackIndex, channel),
    trackIndex,
    channel,
    events: [],
    noteCount: 0,
    warnings: [],
  };
}

function isNoteEvent(
  event: MidiEvent,
): event is Extract<MidiEvent, { type: 'noteOn' | 'noteOff' }> {
  return event.type === 'noteOn' || event.type === 'noteOff';
}

function normalizeTrack(trackIndex: number, events: MidiEvent[]): MidiImportTrack {
  let absoluteTick = 0;
  let trackName: string | undefined;
  const streams = new Map<number, MidiImportStream>();
  const tempoChanges: MidiImportTempoChange[] = [];

  for (const event of events) {
    if (!Number.isInteger(event.deltaTime) || event.deltaTime < 0) {
      throw new Error(`Invalid MIDI delta time in track ${trackIndex}.`);
    }
    absoluteTick += event.deltaTime;

    if (event.type === 'trackName' && trackName === undefined) {
      trackName = event.text;
    }
    if (event.type === 'setTempo') {
      if (!Number.isInteger(event.microsecondsPerBeat) || event.microsecondsPerBeat <= 0) {
        throw new Error(`Invalid MIDI tempo event in track ${trackIndex}.`);
      }
      tempoChanges.push({
        absoluteTick,
        bpm: 60_000_000 / event.microsecondsPerBeat,
        trackIndex,
      });
    }
    if (!isNoteEvent(event)) continue;

    if (
      !Number.isInteger(event.channel) ||
      event.channel < 0 ||
      event.channel > 15 ||
      !Number.isInteger(event.noteNumber) ||
      event.noteNumber < 0 ||
      event.noteNumber > 127 ||
      !Number.isInteger(event.velocity) ||
      event.velocity < 0 ||
      event.velocity > 127
    ) {
      throw new Error(`Invalid MIDI note event in track ${trackIndex}.`);
    }

    const stream = streams.get(event.channel) ?? createStream(trackIndex, event.channel);
    const noteEvent: MidiImportNoteEvent = {
      absoluteTick,
      type: event.type,
      noteNumber: event.noteNumber,
      velocity: event.velocity,
    };
    stream.events.push(noteEvent);
    stream.noteCount += event.type === 'noteOn' && event.velocity > 0 ? 1 : 0;
    stream.firstTick =
      stream.firstTick === undefined ? absoluteTick : Math.min(stream.firstTick, absoluteTick);
    stream.lastTick = Math.max(stream.lastTick ?? absoluteTick, absoluteTick);
    streams.set(event.channel, stream);
  }

  for (const stream of streams.values()) {
    stream.lastTick = absoluteTick;
  }

  return {
    trackIndex,
    ...(trackName === undefined ? {} : { name: trackName }),
    streams: [...streams.values()],
    tempoChanges,
    lastTick: absoluteTick,
  };
}

function buildPreview(
  fileName: string,
  format: 0 | 1,
  ticksPerBeat: number,
  tracks: MidiImportTrack[],
): MidiImportPreview {
  const streams: MidiImportStreamPreview[] = [];
  for (const track of tracks) {
    for (const stream of track.streams) {
      const { warnings } = pairMidiImportStream(stream);
      streams.push({
        streamKey: stream.streamKey,
        trackIndex: stream.trackIndex,
        ...(track.name === undefined ? {} : { trackName: track.name }),
        channel: stream.channel,
        noteCount: stream.noteCount,
        firstBeat: (stream.firstTick ?? 0) / ticksPerBeat,
        lastBeat: (stream.lastTick ?? track.lastTick) / ticksPerBeat,
        warnings,
        defaults: {
          streamKey: stream.streamKey,
          instrumentId: '1',
          noteTemplate: MIDI_IMPORT_DEFAULT_NOTE_TEMPLATE,
          trimTime: false,
        },
      });
    }
  }

  return { fileName, format, ticksPerBeat, streams };
}

export function parseMidiImportBytes(data: ArrayLike<number>, fileName: string): ParsedMidiImport {
  let parsed: MidiData;
  try {
    parsed = parseMidi(data);
  } catch (error) {
    throw parserError(error);
  }

  const { format, ticksPerBeat } = validateMidiHeader(parsed);
  const tracks = parsed.tracks.map((events, trackIndex) => normalizeTrack(trackIndex, events));
  const document: MidiImportDocument = {
    format,
    division: { kind: 'ppq', ticksPerBeat },
    tracks,
    tempoChanges: tracks.flatMap((track) => track.tempoChanges),
  };
  const preview = buildPreview(fileName, format, ticksPerBeat, tracks);
  if (preview.streams.length === 0) {
    throw new Error('The MIDI file does not contain any note-bearing streams.');
  }
  return { document, preview };
}
