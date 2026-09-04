import { describe, expect, it } from 'vitest';
import { Note } from '../../src/sound-objects/note';
import { formatBlueNumber, formatJavaDouble } from '../../src/utilities/number-format';

describe('formatBlueNumber', () => {
  it('matches Blue formatting for small values and floating point noise', () => {
    expect(formatBlueNumber(0.00000001)).toBe('0.00000001');
    expect(formatBlueNumber(1.7000000000000002)).toBe('1.7');
    expect(formatBlueNumber(7)).toBe('7');
    expect(formatBlueNumber(-0)).toBe('0');
  });
});

describe('formatJavaDouble', () => {
  it('matches Java Double.toString() for common CSD values', () => {
    expect(formatJavaDouble(16)).toBe('16.0');
    expect(formatJavaDouble(108)).toBe('108.0');
    expect(formatJavaDouble(0.25)).toBe('0.25');
    expect(formatJavaDouble(0.00000001)).toBe('1.0E-8');
  });
});

describe('Note score formatting', () => {
  it('formats start times and durations like Java Blue note rendering', () => {
    const note = new Note();
    note.setPField('1', 1);
    note.setStartTime(16);
    note.setSubjectiveDuration(1.7000000000000002);

    expect(note.toScoreText()).toBe('i1\t16.0\t1.7');
  });
});
