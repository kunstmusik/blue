import { formatJavaDouble } from '../utilities/number-format';

/** Paired MIDI event with a start and end tick, note number, and attack velocity. */
export interface MidiImportNote {
  /** Note-on timestamp in absolute MIDI ticks. */
  startTick: number;
  /** Note-off timestamp in absolute MIDI ticks. */
  endTick: number;
  /** MIDI pitch number. */
  noteNumber: number;
  /** MIDI velocity value. */
  velocity: number;
}

function getTemplateValues(
  instrumentId: string,
  note: MidiImportNote,
  startBeats: number,
  durationBeats: number,
): Record<string, string> {
  const key = note.noteNumber;
  const octave = Math.trunc(key / 12) + 3;
  const scaleDegree = key % 12;
  const velocity = note.velocity;

  return {
    '<INSTR_ID>': instrumentId,
    '<START>': formatJavaDouble(startBeats),
    '<DUR>': formatJavaDouble(durationBeats),
    '<KEY>': String(key),
    '<KEY_PCH>': `${octave}.${String(scaleDegree).padStart(2, '0')}`,
    '<KEY_OCT>': formatJavaDouble(key / 12.0 + 3.0),
    '<KEY_CPS>': formatJavaDouble(440.0 * Math.exp(Math.log(2) * ((key - 69) / 12))),
    '<VELOCITY>': String(velocity),
    '<VELOCITY_AMP>': formatJavaDouble(((velocity * velocity) / 16239.0) * 32768.0),
  };
}

/** Substitutes MIDI note data and timing values into a Csound note template. */
export function expandMidiNoteTemplate(
  template: string,
  instrumentId: string,
  note: MidiImportNote,
  startBeats: number,
  durationBeats: number,
): string {
  const values = getTemplateValues(instrumentId, note, startBeats, durationBeats);
  return template.replace(
    /<INSTR_ID>|<START>|<DUR>|<KEY_PCH>|<KEY_OCT>|<KEY_CPS>|<KEY>|<VELOCITY_AMP>|<VELOCITY>/g,
    (placeholder) => values[placeholder],
  );
}
