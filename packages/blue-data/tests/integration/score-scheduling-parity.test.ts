import { beforeAll, describe, expect, it } from 'vitest';
import { BlueData } from '../../src/blue-data';
import { NoteList } from '../../src/sound-objects/note-list';
import { Note } from '../../src/sound-objects/note';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { JavaScriptObject } from '../../src/sound-objects/javascript-object';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { TimeBehavior } from '../../src/sound-objects/time-behavior';
import { TimeContext } from '../../src/time/time-context';
import { CompileData } from '../../src/compile-data';
import {
  disposeJavaScriptCompileState,
  initializeJavaScriptRuntime,
} from '../../src/javascript-runtime';

function createNote(instrId: string, start: number, duration: number): Note {
  const note = new Note();
  note.setPField(instrId, 1);
  note.setStartTime(start);
  note.setSubjectiveDuration(duration);
  return note;
}

beforeAll(async () => {
  await initializeJavaScriptRuntime();
});

describe('NoteList merge parity', () => {
  it('preserves append order instead of re-sorting by start time', () => {
    const first = new NoteList([createNote('1', 10, 1)]);
    const second = new NoteList([createNote('2', 5, 1)]);

    first.merge(second);

    expect(first.getNote(0).getPField(1)).toBe('1');
    expect(first.getNote(1).getPField(1)).toBe('2');
  });
});

describe('BlueData score scheduling parity', () => {
  it('buildScoreText renders only provided score events', () => {
    const data = new BlueData();
    const notes = new NoteList([createNote('1', 127.75, 0.25)]);

    const scoreText = (data as any).buildScoreText('', '', notes) as string;
    const scoreEvents = scoreText.split(/\r?\n/).filter((line) => line.startsWith('i'));

    expect(scoreEvents).toEqual(['i1\t127.75\t0.25']);
  });
});

describe('Score-based sound object parity', () => {
  it('GenericScore applies its sound object start offset', () => {
    const score = new GenericScore();
    score.setScoreText('i1 0 1 60');
    score.setStartTime(TimePosition.beats(16));
    score.setSubjectiveDuration(TimeDuration.beats(4));
    score.setTimeBehavior(TimeBehavior.NONE);

    const notes = score.generateForCSD(new TimeContext(), new CompileData(), 0, -1);

    expect(notes.getNote(0).getStartTime()).toBe(16);
  });

  it('JavaScriptObject applies its sound object start offset', () => {
    const object = new JavaScriptObject();
    object.setJavaScriptCode('score = "i1 0 1 60";');
    object.setStartTime(TimePosition.beats(16));
    object.setSubjectiveDuration(TimeDuration.beats(4));
    object.setTimeBehavior(TimeBehavior.NONE);

    const compileData = new CompileData();

    try {
      const notes = object.generateForCSD(new TimeContext(), compileData, 0, -1);

      expect(notes.getNote(0).getStartTime()).toBe(16);
    } finally {
      disposeJavaScriptCompileState(compileData);
    }
  });
});
