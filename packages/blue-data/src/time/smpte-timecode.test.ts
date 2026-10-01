import { describe, expect, it } from 'vitest';
import {
  formatSmpte,
  parseSmpte,
  secondsToSmpteFrame,
  smpteFrameToSeconds,
} from './smpte-timecode';

// Independent vectors: specs/115-smpte-timecode/public-calculation-basis.md,
// SMPTE ST 12-1:2014 §§4.9, 5.2.1–5.2.2 (no source adaptation).
describe('SMPTE physical frames and labels', () => {
  it.each([
    [23.976, '00:00:59:22'],
    [24, '00:01:00:00'],
    [25, '00:01:00:00'],
    [29.97, '00:00:59:28'],
    [30, '00:01:00:00'],
    [50, '00:01:00:00'],
    [59.94, '00:00:59:56'],
    [60, '00:01:00:00'],
  ])('formats 60 elapsed seconds at %s NDF', (frameRate, label) => {
    expect(formatSmpte(60, { frameRate, dropFrame: false })).toBe(label);
  });
  it.each([
    [29.97, 1799, '00:00:59;29'],
    [29.97, 1800, '00:01:00;02'],
    [29.97, 17981, '00:09:59;29'],
    [29.97, 17982, '00:10:00;00'],
    [29.97, 107892, '01:00:00;00'],
    [59.94, 3599, '00:00:59;59'],
    [59.94, 3600, '00:01:00;04'],
    [59.94, 35963, '00:09:59;59'],
    [59.94, 35964, '00:10:00;00'],
    [59.94, 215784, '01:00:00;00'],
  ])('counts %s DF frame %s', (frameRate, frame, label) => {
    const seconds = (frame * 1001) / (frameRate === 29.97 ? 30000 : 60000);
    expect(formatSmpte(seconds, { frameRate, dropFrame: true })).toBe(label);
    expect(parseSmpte(label, { frameRate, dropFrame: true })).toBe(seconds);
  });
  it.each([
    '00:01:00;00',
    '00:01:00;01',
    '00:60:00;02',
    '00:00:60;00',
    '00:00:00;30',
    '-1:00:00;00',
    '00:00:00;00junk',
    '00:00:00:00',
    'NaN',
  ])('rejects invalid DF input %s', (label) => {
    expect(parseSmpte(label, { frameRate: 29.97, dropFrame: true })).toBeNull();
  });
  it('retains extended hours and distinguishes exact starts from adjacent subframes', () => {
    expect(parseSmpte('25:00:00:00', { frameRate: 29.97, dropFrame: false })).toBe(90090);
    for (const rate of [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]) {
      const finalStart = smpteFrameToSeconds(8998201053687, rate)!;
      for (const dropFrame of rate === 29.97 || rate === 59.94 ? [false, true] : [false]) {
        const format = { frameRate: rate, dropFrame };
        expect(parseSmpte(formatSmpte(finalStart, format)!, format)).toBe(finalStart);
      }
      for (const frame of [1, 1800, 5184001, 8998201053687]) {
        const start = smpteFrameToSeconds(frame, rate)!;
        expect(secondsToSmpteFrame(start, rate)).toBe(frame);
        const offset = Math.max(32 * Number.EPSILON * frame, 1e-7);
        const previous = smpteFrameToSeconds(frame - 1, rate)!;
        const delta = (start - previous) * offset;
        expect(secondsToSmpteFrame(start - delta, rate)).toBe(frame - 1);
      }
    }
    expect(smpteFrameToSeconds(8998201053688, 24)).toBeNull();
    expect(formatSmpte(Infinity, { frameRate: 24, dropFrame: false })).toBeNull();
    expect(parseSmpte('00:00:00;00', { frameRate: 30, dropFrame: true })).toBeNull();
    for (const frames of ['00', '01', '02', '03']) {
      expect(parseSmpte(`00:01:00;${frames}`, { frameRate: 59.94, dropFrame: true })).toBeNull();
    }
  });
});
