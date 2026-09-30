import { describe, it, expect } from 'vitest';
import { CompileData } from '../compile-data';
import { GenericScore } from '../sound-objects/generic-score';
import { TimeContext } from '../time/time-context';
import { getNotes, NoteParseException } from './score';

describe('ScoreUtilities.getNotes', () => {
  it('should parse simple score text', () => {
    const scoreText = 'i1 0 1 440';
    const notes = getNotes(scoreText);
    expect(notes.length).toBe(1);
    expect(notes.getNote(0).toScoreText()).toBe('i1\t0.0\t1\t440');
  });

  it('should parse score text with comments', () => {
    const scoreText = '; comment\ni1 0 1 440 ; another comment';
    const notes = getNotes(scoreText);
    expect(notes.length).toBe(1);
    expect(notes.getNote(0).toScoreText()).toBe('i1\t0.0\t1\t440');
  });

  it('should handle leading/trailing whitespace', () => {
    const scoreText = '   \ni1 0 1 440   \n';
    const notes = getNotes(scoreText);
    expect(notes.length).toBe(1);
  });

  it('should reject a too-short i event with its line and text', () => {
    let error: unknown;
    try {
      getNotes('i1 0 1 440\nf1 0 1024 10\ni1 0\nf2 0 1024 20');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(NoteParseException);
    expect(error).toMatchObject({ lineNumber: 3 });
    expect((error as Error).message).toContain(
      'NoteParseException\nLine Number: 3\nNote Text: i1 0',
    );
  });

  it('should preserve supported shorthand while ignoring non-i statements', () => {
    const notes = getNotes(
      'f1 0 1024 10\n' +
        'i1 0 1 100\n' +
        '0.5\n' +
        'i1 + 1 . [300 + 100]\n' +
        'i1 + 1 >\n' +
        'i1 + 1 200',
    );

    expect(notes.length).toBe(4);
    expect(notes.getNote(1).getStartTime()).toBe(1);
    expect(notes.getNote(1).getPField(4)).toBe('100');
    expect(notes.getNote(1).getPField(5)).toBe('400');
    expect(notes.getNote(2).getStartTime()).toBe(2);
    expect(notes.getNote(2).getPField(4)).toBe('150');
    expect(notes.getNote(3).getStartTime()).toBe(3);
  });

  it('should surface score parse errors from GenericScore generation', async () => {
    const score = new GenericScore();
    score.setScoreText('i1 0');

    expect(() => score.generateForCSD(new TimeContext(), new CompileData(), 0, -1)).toThrow(
      NoteParseException,
    );
    await expect(
      score.generateForCSDAsync(new TimeContext(), new CompileData(), 0, -1),
    ).rejects.toThrow(NoteParseException);
  });
});
