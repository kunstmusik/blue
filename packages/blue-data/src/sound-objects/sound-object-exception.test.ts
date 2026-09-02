import { describe, expect, it } from 'vitest';
import { SoundObjectException } from './sound-object-exception';

describe('SoundObjectException', () => {
  it('instantiates with a message', () => {
    const error = new SoundObjectException('Failed to generate notes');
    expect(error.message).toBe('Failed to generate notes');
    expect(error.name).toBe('SoundObjectException');
    expect(error.cause).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SoundObjectException);
  });

  it('preserves an underlying Error cause', () => {
    const rootCause = new Error('Syntax error in python script');
    const error = new SoundObjectException('Execution failed', rootCause);
    expect(error.message).toBe('Execution failed');
    expect(error.cause).toBe(rootCause);
  });

  it('preserves non-Error cause values via ES2022 options', () => {
    const error = new SoundObjectException('Custom error code', { code: 'SYNTAX_ERR', line: 42 });
    expect(error.message).toBe('Custom error code');
    expect(error.cause).toEqual({ code: 'SYNTAX_ERR', line: 42 });
  });
});
