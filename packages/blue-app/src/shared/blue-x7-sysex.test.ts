import { describe, expect, it } from 'vitest';
import {
  isBlueX7SysexReadResult,
  validateBlueX7SysexReadResult,
  type BlueX7SysexReadResult,
} from './blue-x7-sysex';

describe('BlueX7 SysEx Read Result Runtime Validation', () => {
  it('validates canceled result', () => {
    const res: BlueX7SysexReadResult = { status: 'canceled' };
    expect(isBlueX7SysexReadResult(res)).toBe(true);
    expect(validateBlueX7SysexReadResult(res)).toEqual({ status: 'canceled' });
  });

  it('validates error result', () => {
    const res: BlueX7SysexReadResult = {
      status: 'error',
      code: 'read-failed',
      message: 'Failed to read SysEx file',
    };
    expect(isBlueX7SysexReadResult(res)).toBe(true);
    expect(validateBlueX7SysexReadResult(res)).toEqual(res);
  });

  it('validates selected file result', () => {
    const res: BlueX7SysexReadResult = {
      status: 'selected',
      fileName: 'BRASS 1.syx',
      bytes: new ArrayBuffer(163),
    };
    expect(isBlueX7SysexReadResult(res)).toBe(true);
    expect(validateBlueX7SysexReadResult(res)).toEqual(res);
  });

  it('rejects invalid payloads', () => {
    expect(isBlueX7SysexReadResult(null)).toBe(false);
    expect(isBlueX7SysexReadResult({})).toBe(false);
    expect(isBlueX7SysexReadResult({ status: 'unknown' })).toBe(false);
    expect(isBlueX7SysexReadResult({ status: 'selected', fileName: 'x.syx' })).toBe(false);
    expect(isBlueX7SysexReadResult({ status: 'selected', fileName: 'x.syx', bytes: new ArrayBuffer(10) })).toBe(false);
    expect(isBlueX7SysexReadResult({ status: 'error', code: 'unknown', message: 'bad' })).toBe(false);
    expect(() => validateBlueX7SysexReadResult({ status: 'invalid' })).toThrow(/Invalid BlueX7 SysEx read result payload/);
  });
});
