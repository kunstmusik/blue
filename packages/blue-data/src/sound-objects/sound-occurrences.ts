import { CompileData } from '../compile-data';
import { replaceTrackInstrumentP1 } from '../score/score-generation-options';
import { Instance } from './instance';
import { NoteList } from './note-list';
import { PolyObject } from './poly-object';
import { Sound } from './sound';
import type { SoundObject } from './sound-object';

const DEFER_SOUND_INSTRUMENTS = Symbol('deferSoundInstruments');

export function deferSoundInstruments(compileData: CompileData): void {
  compileData.setCompilationVariable(DEFER_SOUND_INSTRUMENTS, true);
}

export function isSoundInstrumentDeferred(compileData: CompileData): boolean {
  return compileData.getCompilationVariable(DEFER_SOUND_INSTRUMENTS) === true;
}

export function withSoundOccurrences(
  compileData: CompileData,
  renderOrigin: number,
  clipStart: number,
  clipEnd: number,
  generate: () => NoteList,
): NoteList {
  if (isSoundInstrumentDeferred(compileData)) return generate();
  deferSoundInstruments(compileData);
  try {
    const notes = generate();
    finalizeSoundInstruments(notes, compileData, renderOrigin, clipEnd, clipStart);
    return notes;
  } finally {
    compileData.clearCompilationVariable(DEFER_SOUND_INSTRUMENTS);
  }
}

export async function withSoundOccurrencesAsync(
  compileData: CompileData,
  renderOrigin: number,
  clipStart: number,
  clipEnd: number,
  generate: () => Promise<NoteList>,
): Promise<NoteList> {
  if (isSoundInstrumentDeferred(compileData)) return generate();
  deferSoundInstruments(compileData);
  try {
    const notes = await generate();
    finalizeSoundInstruments(notes, compileData, renderOrigin, clipEnd, clipStart);
    return notes;
  } finally {
    compileData.clearCompilationVariable(DEFER_SOUND_INSTRUMENTS);
  }
}

/** Full source generation is required before transforming a Sound-containing graph. */
export function containsSound(object: SoundObject, visited = new Set<SoundObject>()): boolean {
  if (visited.has(object)) return false;
  visited.add(object);
  if (object instanceof Sound) return true;
  if (object instanceof Instance) {
    const source = object.getSoundObject();
    return source !== null && containsSound(source, visited);
  }
  return (
    object instanceof PolyObject &&
    object.some((layer) => layer.some((child) => containsSound(child, visited)))
  );
}

/** Bind only surviving final occurrences, after every parent and score processor. */
export function finalizeSoundInstruments(
  notes: NoteList,
  compileData: CompileData,
  renderStart: number,
  renderEnd: number,
  clipStart = renderStart,
): void {
  const relativeStart = clipStart - renderStart;
  const usedNumbers = new Set<number>();
  notes.removeIf((note) => {
    if (!note.getSoundOccurrence() && !note.getDeferredFileSeek()) return false;
    return (
      note.getEndTime() <= relativeStart ||
      (renderEnd > renderStart && note.getStartTime() >= renderEnd - renderStart)
    );
  });
  for (const note of notes) {
    const seek = note.getDeferredFileSeek();
    if (seek) {
      const start = Math.max(relativeStart, note.getStartTime());
      const end =
        renderEnd > clipStart
          ? Math.min(note.getEndTime(), renderEnd - renderStart)
          : note.getEndTime();
      const elapsedSeconds =
        seek.context.beatsToSeconds(start + renderStart) -
        seek.context.beatsToSeconds(note.getStartTime() + renderStart);
      note.setPField(String(Number(note.getPField(seek.pField)) + elapsedSeconds), seek.pField);
      note.setStartTime(start);
      note.setSubjectiveDuration(end - start);
      note.setDeferredFileSeek(undefined);
    }
    const occurrence = note.getSoundOccurrence();
    if (!occurrence) continue;
    const p1 = note.getPField(1);
    const match = /^-?(\d+)(?:\.\d+)?$/.exec(p1 ?? '');
    // A processor can deliberately retarget the event to another instrument.
    if (!match || Number(match[1]) !== occurrence.instrumentNumber) {
      note.setSoundOccurrence(undefined);
      continue;
    }
    const instrument = occurrence.instrument.deepCopy();
    const start = Math.max(relativeStart, note.getStartTime());
    const end =
      renderEnd > renderStart
        ? Math.min(note.getEndTime(), renderEnd - renderStart)
        : note.getEndTime();
    const absoluteStart = start + renderStart;
    const absoluteEnd = end + renderStart;
    for (const parameter of instrument.getParameters()) {
      parameter.setCompilationVarName('');
      parameter.setPoints(
        parameter.getPoints().map((point) => ({
          time: occurrence.envelopeStart + renderStart + point.time * occurrence.envelopeDuration,
          value: point.value,
        })),
      );
      const points = parameter.getPoints();
      if (points.length > 0) {
        const startValue = parameter.getValue(absoluteStart);
        const endValue = parameter.getValue(absoluteEnd);
        parameter.setPoints([
          { time: absoluteStart, value: startValue },
          ...points.filter((point) => point.time > absoluteStart && point.time < absoluteEnd),
          { time: absoluteEnd, value: endValue },
        ]);
        parameter.setEvaluationTimeBounds(absoluteStart, absoluteEnd);
      }
    }
    const number = usedNumbers.has(occurrence.instrumentNumber)
      ? compileData.reserveInstrumentNumber()
      : occurrence.instrumentNumber;
    usedNumbers.add(occurrence.instrumentNumber);
    compileData.addInstrument(instrument, number);
    if (occurrence.trackId) compileData.addInstrSourceId(instrument, occurrence.trackId);
    note.setPField(replaceTrackInstrumentP1(p1, number)!, 1);
    note.setStartTime(start);
    note.setSubjectiveDuration(end - start);
    note.setSoundOccurrence(undefined);
  }
}
