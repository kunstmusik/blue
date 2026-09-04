import { describe, expect, it, vi } from 'vitest';
import type { JavaRuntimeClientContract } from '@blue/data';
import { testPythonInstrument } from './python-instrument-test';

describe('testPythonInstrument', () => {
  it('returns error when Java runtime client is not available', async () => {
    const result = await testPythonInstrument(
      { code: 'instrument = "aout oscili 32000, 440, 1"' },
      { javaRuntimeClient: null },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Java runtime is unavailable');
  });

  it('evaluates instrument code via Java runtime client when available', async () => {
    const evaluateJythonInstrument = vi.fn(async () => ({
      ok: true as const,
      result: {
        instrumentText: 'aout oscili 32000, 440, 1',
      },
    }));

    const mockClient: Partial<JavaRuntimeClientContract> = {
      evaluateJythonInstrument:
        evaluateJythonInstrument as unknown as JavaRuntimeClientContract['evaluateJythonInstrument'],
    };

    const result = await testPythonInstrument(
      { code: 'instrument = "aout oscili 32000, 440, 1"', assignmentId: 'py1' },
      { javaRuntimeClient: mockClient as JavaRuntimeClientContract },
    );

    expect(result.ok).toBe(true);
    expect(result.output).toBe('aout oscili 32000, 440, 1');
    expect(evaluateJythonInstrument).toHaveBeenCalledWith({
      code: 'instrument = "aout oscili 32000, 440, 1"',
    });
  });

  it('handles evaluation failure from Java runtime client', async () => {
    const evaluateJythonInstrument = vi.fn(async () => ({
      ok: false as const,
      error: {
        message: 'SyntaxError: invalid syntax on line 2',
      },
    }));

    const mockClient: Partial<JavaRuntimeClientContract> = {
      evaluateJythonInstrument:
        evaluateJythonInstrument as unknown as JavaRuntimeClientContract['evaluateJythonInstrument'],
    };

    const result = await testPythonInstrument(
      { code: 'invalid python code' },
      { javaRuntimeClient: mockClient as JavaRuntimeClientContract },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('SyntaxError: invalid syntax on line 2');
  });

  it('handles thrown runtime exceptions gracefully', async () => {
    const evaluateJythonInstrument = vi.fn(async () => {
      throw new Error('Connection reset');
    });

    const mockClient: Partial<JavaRuntimeClientContract> = {
      evaluateJythonInstrument:
        evaluateJythonInstrument as unknown as JavaRuntimeClientContract['evaluateJythonInstrument'],
    };

    const result = await testPythonInstrument(
      { code: 'instrument = ""' },
      { javaRuntimeClient: mockClient as JavaRuntimeClientContract },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Connection reset');
  });
});
