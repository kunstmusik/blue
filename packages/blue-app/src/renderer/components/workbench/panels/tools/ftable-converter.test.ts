import { describe, expect, it } from 'vitest';
import { convertFTableToFtgen } from './ftable-converter';

describe('convertFTableToFtgen', () => {
  it('converts single f-statement to gi_ ftgen statement', () => {
    const input = 'f 1 0 1024 10 1';
    const output = convertFTableToFtgen(input);
    expect(output).toBe('gi_\tftgen 0, 0, 1024, 10, 1');
  });

  it('preserves comments on f-statements', () => {
    const input = 'f 2 0 4096 10 1 0.5 0.3 ; sine harmonics';
    const output = convertFTableToFtgen(input);
    expect(output).toBe('gi_\tftgen 0, 0, 4096, 10, 1, 0.5, 0.3\t; sine harmonics');
  });

  it('converts multiple f-statements separated by newlines', () => {
    const input = `f 1 0 1024 10 1
f 2 0 512 7 0 512 1`;
    const output = convertFTableToFtgen(input);
    expect(output).toBe(`gi_\tftgen 0, 0, 1024, 10, 1
gi_\tftgen 0, 0, 512, 7, 0, 512, 1`);
  });

  it('handles empty or non-f lines gracefully', () => {
    const input = `; Header comment
f 1 0 1024 10 1

; Footer comment`;
    const output = convertFTableToFtgen(input);
    expect(output).toBe(`
gi_\tftgen 0, 0, 1024, 10, 1

`);
  });
});
