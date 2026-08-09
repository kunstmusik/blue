import type {
  MidiImportStream,
  MidiImportWarning,
} from './midi-file-import';
import type { MidiImportNote } from './midi-note-template';

interface OpenNote {
  startTick: number;
  velocity: number;
}

export function pairMidiImportStream(
  stream: MidiImportStream,
): { notes: MidiImportNote[]; warnings: MidiImportWarning[] } {
  const warnings = [...stream.warnings];
  const openNotes = new Map<number, OpenNote[]>();
  const notes: MidiImportNote[] = [];
  const orderedEvents = stream.events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.absoluteTick - b.event.absoluteTick || a.index - b.index);

  const closeNote = (noteNumber: number, endTick: number, velocity: number, startTick: number): void => {
    if (endTick < startTick) {
      warnings.push({
        code: 'invalid-note',
        message: `Ignored note ${noteNumber} with a negative duration.`,
        trackIndex: stream.trackIndex,
        channel: stream.channel,
        tick: endTick,
      });
      return;
    }
    notes.push({ startTick, endTick, noteNumber, velocity });
  };

  for (const { event } of orderedEvents) {
    if (
      !Number.isInteger(event.noteNumber) ||
      event.noteNumber < 0 ||
      event.noteNumber > 127 ||
      !Number.isFinite(event.absoluteTick) ||
      event.absoluteTick < 0 ||
      !Number.isInteger(event.velocity) ||
      event.velocity < 0 ||
      event.velocity > 127
    ) {
      warnings.push({
        code: 'invalid-note',
        message: `Ignored invalid MIDI note event for key ${event.noteNumber}.`,
        trackIndex: stream.trackIndex,
        channel: stream.channel,
        tick: event.absoluteTick,
      });
      continue;
    }

    const isNoteOn = event.type === 'noteOn' && event.velocity > 0;
    if (isNoteOn) {
      const queue = openNotes.get(event.noteNumber) ?? [];
      queue.push({ startTick: event.absoluteTick, velocity: event.velocity });
      openNotes.set(event.noteNumber, queue);
      continue;
    }

    const queue = openNotes.get(event.noteNumber);
    const openNote = queue?.shift();
    if (!openNote) {
      warnings.push({
        code: 'unmatched-note-off',
        message: `Ignored unmatched note-off for key ${event.noteNumber}.`,
        trackIndex: stream.trackIndex,
        channel: stream.channel,
        tick: event.absoluteTick,
      });
      continue;
    }

    closeNote(event.noteNumber, event.absoluteTick, openNote.velocity, openNote.startTick);
    if (queue?.length === 0) {
      openNotes.delete(event.noteNumber);
    }
  }

  const eventEnd = stream.events.reduce(
    (maxTick, event) => Number.isFinite(event.absoluteTick)
      ? Math.max(maxTick, event.absoluteTick)
      : maxTick,
    0,
  );
  const hasValidStreamEnd = stream.lastTick === undefined || (
    Number.isFinite(stream.lastTick) && stream.lastTick >= 0
  );
  if (!hasValidStreamEnd) {
    warnings.push({
      code: 'invalid-note',
      message: 'Ignored an invalid MIDI stream end tick.',
      trackIndex: stream.trackIndex,
      channel: stream.channel,
      tick: stream.lastTick,
    });
  }
  const streamEnd = hasValidStreamEnd && stream.lastTick !== undefined
    ? stream.lastTick
    : eventEnd;
  for (const [noteNumber, queue] of openNotes) {
    for (const openNote of queue) {
      const endTick = Math.max(openNote.startTick, streamEnd);
      warnings.push({
        code: 'dangling-note-on',
        message: `Closed dangling note-on for key ${noteNumber} at the end of the stream.`,
        trackIndex: stream.trackIndex,
        channel: stream.channel,
        tick: endTick,
      });
      closeNote(noteNumber, endTick, openNote.velocity, openNote.startTick);
    }
  }

  notes.sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick || a.noteNumber - b.noteNumber);
  return { notes, warnings };
}
