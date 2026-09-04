import type { CompileData } from '../compile-data';
import { NoteList } from '../sound-objects/note-list';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { Note } from '../sound-objects/note';
import { TimeBehavior } from '../sound-objects/time-behavior';

export function applyNoteProcessorChain(nl: NoteList, npc: NoteProcessorChain): NoteList {
  return npc.apply(nl);
}

export async function applyNoteProcessorChainAsync(
  nl: NoteList,
  npc: NoteProcessorChain,
  compileData?: CompileData,
): Promise<NoteList> {
  return npc.applyAsync(nl, compileData);
}

export function setScoreStart(nl: NoteList, offset: number): void {
  for (const note of nl) {
    note.setStartTime(note.getStartTime() + offset);
  }
}

/** Convert absolute score times to the performance-relative render origin. */
export function rebaseScoreToRenderStart(nl: NoteList, renderStart: number): void {
  if (renderStart <= 0) return;
  setScoreStart(nl, -renderStart);
  nl.removeIf((note) => note.getStartTime() < 0);
}

export function getTotalDuration(notes: NoteList): number {
  let max = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes.getNote(i);
    const end = n.getStartTime() + n.getObjectiveDuration();
    if (end > max) max = end;
  }
  return max;
}

function scaleScore(notes: NoteList, multiplier: number): void {
  for (let i = 0; i < notes.length; i++) {
    const n = notes.getNote(i);
    n.setStartTime(n.getStartTime() * multiplier);
    n.setSubjectiveDuration(n.getObjectiveDuration() * multiplier);
  }
}

export function applyTimeBehavior(
  notes: NoteList,
  timeBehavior: TimeBehavior,
  subjectiveDuration: number,
  repeatPointBeats: number,
  durationForScale: number = -1,
): void {
  if (notes.length === 0) return;

  if (timeBehavior === TimeBehavior.SCALE) {
    let dur = durationForScale;
    if (dur < 0) dur = getTotalDuration(notes);
    if (dur > 0) {
      const multiplier = subjectiveDuration / dur;
      scaleScore(notes, multiplier);
    }
  } else if (timeBehavior === TimeBehavior.REPEAT) {
    const originalNotes = notes.deepCopy();
    originalNotes.sort();

    let objDur = durationForScale >= 0 ? durationForScale : getTotalDuration(originalNotes);
    let repeatDur = objDur;
    if (objDur > 0 && repeatPointBeats > 0) {
      repeatDur = repeatPointBeats;
    }

    if (repeatDur <= 0) return;

    notes.clear();

    let windowStart = 0;
    let windowEnd = Math.min(repeatDur, subjectiveDuration);

    while (windowStart < subjectiveDuration) {
      const tempNL = originalNotes.deepCopy();
      setScoreStart(tempNL, windowStart);

      const end = windowEnd;
      tempNL.removeIf((n) => n.getStartTime() >= end);

      for (const note of tempNL) {
        const noteStart = note.getStartTime();
        if (noteStart + note.getSubjectiveDuration() > windowEnd) {
          note.setSubjectiveDuration(windowEnd - noteStart);
        }
      }

      notes.merge(tempNL);
      windowStart += repeatDur;
      windowEnd = Math.min(windowStart + repeatDur, subjectiveDuration);
    }
  } else if (timeBehavior === TimeBehavior.REPEAT_CLASSIC) {
    const originalNotes = notes.deepCopy();
    originalNotes.sort();

    let objDur = durationForScale >= 0 ? durationForScale : getTotalDuration(originalNotes);
    let repeatDur = objDur;
    if (objDur > 0 && repeatPointBeats > 0) {
      repeatDur = repeatPointBeats;
    }

    if (repeatDur <= 0) return;

    notes.clear();

    let startVal = 0;
    while (startVal + repeatDur < subjectiveDuration) {
      const tempNL = originalNotes.deepCopy();
      setScoreStart(tempNL, startVal);
      notes.merge(tempNL);
      startVal += repeatDur;
    }

    const remainingDur = subjectiveDuration - startVal;
    for (let i = 0; i < originalNotes.length; i++) {
      const origNote = originalNotes.getNote(i);
      if (origNote.getStartTime() + origNote.getSubjectiveDuration() <= remainingDur) {
        const note = Note.fromOther(origNote);
        note.setStartTime(note.getStartTime() + startVal);
        notes.add(note);
      } else {
        break;
      }
    }
  }
}

function stripMultiLineComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function expandPluses(notes: NoteList): void {
  if (notes.length < 2) return;

  let previousNote = notes.getNote(0);
  for (let i = 1; i < notes.length; i++) {
    const note = notes.getNote(i);
    const p2 = note.getPField(2);
    if (p2 === '+') {
      note.setPField(
        (previousNote.getStartTime() + previousNote.getSubjectiveDuration()).toString(),
        2,
      );
    }
    previousNote = note;
  }
}

function expandRamps(notes: NoteList): void {
  for (let i = 0; i < notes.length; i++) {
    const currentNote = notes.getNote(i);

    for (let j = 0; j < currentNote.getPCount(); j++) {
      const pField = currentNote.getPField(j + 1);
      if (pField === '>' || pField === '<') {
        const headIndex = findRampHead(notes, i, j + 1);
        const tailIndex = findRampTail(notes, i, j + 1);

        if (headIndex < 0 || tailIndex < 0) continue;

        const startNote = notes.getNote(headIndex);
        const endNote = notes.getNote(tailIndex);

        const b = parseFloat(startNote.getPField(j + 1)!);
        const rise = parseFloat(endNote.getPField(j + 1)!) - b;
        const run = endNote.getStartTime() - startNote.getStartTime();
        const m = run !== 0 ? rise / run : 0;

        for (let k = headIndex + 1; k < tailIndex; k++) {
          const tempNote = notes.getNote(k);
          const x = tempNote.getStartTime() - startNote.getStartTime();
          const newVal = m * x + b;
          tempNote.setPField(newVal.toString(), j + 1);
        }
      }
    }
  }
}

function findRampHead(notes: NoteList, currentIndex: number, pFieldNum: number): number {
  const prev = currentIndex - 1;
  if (prev < 0) return -1;

  let pField: string;
  try {
    pField = notes.getNote(prev).getPField(pFieldNum) ?? '';
  } catch {
    return -1;
  }

  if (pField === '>' || pField === '<') {
    return findRampHead(notes, prev, pFieldNum);
  }

  try {
    parseFloat(pField);
  } catch {
    return -2;
  }

  return prev;
}

function findRampTail(notes: NoteList, currentIndex: number, pFieldNum: number): number {
  const next = currentIndex + 1;
  if (next >= notes.length) return -1;

  let pField: string;
  try {
    pField = notes.getNote(next).getPField(pFieldNum) ?? '';
  } catch {
    return -1;
  }

  if (pField === '>' || pField === '<') {
    return findRampTail(notes, next, pFieldNum);
  }

  try {
    parseFloat(pField);
  } catch {
    return -2;
  }

  return next;
}

export function getNotes(scoreText: string): NoteList {
  const notes = new NoteList();
  let previousNote: Note | null = null;

  if (!scoreText || scoreText.length === 0) return notes;

  const len = scoreText.length;
  const lastIndex = len - 1;

  let start = -1;
  let end = -1;
  let collecting = false;

  for (let i = 0; i < len; i++) {
    const c = scoreText.charAt(i);

    if (!collecting) {
      if (c === ';') {
        while (i < lastIndex) {
          i++;
          if (scoreText.charAt(i) === '\n') break;
        }
      } else if (c === '/' && i < len - 2) {
        const next = scoreText.charAt(i + 1);
        if (next === '/') {
          while (i < lastIndex) {
            i++;
            if (scoreText.charAt(i) === '\n') break;
          }
        } else if (next === '*') {
          while (i < lastIndex) {
            i++;
            if (scoreText.charAt(i) === '*' && i < len - 2 && scoreText.charAt(i + 1) === '/') {
              i++;
              break;
            }
          }
        }
      } else if (c > ' ') {
        collecting = true;
        start = i;
      }
    } else {
      if (c === ';') {
        end = i - 1;
      } else if (c === '/' && i < len - 2) {
        const next = scoreText.charAt(i + 1);
        if (next === '/') {
          end = i - 1;
        } else if (next === '*') {
          let j = i;
          while (j < lastIndex) {
            j++;
            if (scoreText.charAt(j) === '\n') {
              end = i - 1;
            }
            if (scoreText.charAt(j) === '*' && j < len - 2 && scoreText.charAt(j + 1) === '/') {
              i = j + 1;
              break;
            }
          }
        }
      } else if (c === '\n') {
        if (i < lastIndex) {
          const nextC = scoreText.charAt(i + 1);
          if ((nextC >= '0' && nextC <= '9') || nextC === '"' || nextC === '.') {
            continue;
          }
          end = i;
        } else {
          end = i;
        }
      } else if (i === lastIndex) {
        end = i;
      }

      if (end >= 0) {
        const noteText = stripMultiLineComments(scoreText.substring(start, end + 1));

        if (noteText.charAt(0) === 'i') {
          const tempNote = Note.createNoteFromText(noteText, previousNote);
          if (tempNote !== null) {
            notes.add(tempNote);
            previousNote = tempNote;
          }
        }

        collecting = false;
        start = -1;
        end = -1;
      }
    }
  }

  expandPluses(notes);
  expandRamps(notes);

  return notes;
}

export function getBaseTen(pch: string): number {
  const index = pch.indexOf('.');
  let octave: number;
  let pitch: number;

  if (index === -1) {
    octave = parseInt(pch, 10);
    pitch = 0;
  } else if (index === 0 || index === pch.length - 1) {
    octave = parseInt('0' + pch.substring(0, index), 10);
    pitch = parseFloat('0' + pch.substring(index));
  } else {
    octave = parseInt(pch.substring(0, index), 10);
    pitch = parseFloat(pch.substring(index));
  }

  pitch = pitch * 100;
  return octave * 12 + pitch;
}

export function normalizeNoteList(notes: NoteList): void {
  notes.normalizeNoteList();
}
