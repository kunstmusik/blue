import { describe, expect, it } from 'vitest';
import { formatJavaRuntimeProtocolError } from './java-runtime-errors';

describe('java-runtime-errors', () => {
  it('formats Jython import failures with a stable prefix', () => {
    const formatted = formatJavaRuntimeProtocolError('Failed to initialize Java runtime session', {
      code: 'JYTHON_IMPORT_ERROR',
      message: 'ImportError: No module named orchestra',
    });

    expect(formatted).toBe(
      'Unable to import Jython modules: ImportError: No module named orchestra',
    );
  });

  it('formats Jython syntax failures with source location', () => {
    const formatted = formatJavaRuntimeProtocolError('Failed to reinitialize Jython runtime', {
      code: 'JYTHON_SYNTAX_ERROR',
      message: 'SyntaxError: invalid syntax',
      line: 3,
      column: 7,
    });

    expect(formatted).toBe('Jython syntax error: SyntaxError: invalid syntax (line 3, column 7)');
  });

  it('formats transport failures with a stable prefix', () => {
    const formatted = formatJavaRuntimeProtocolError('Failed to health-check Java runtime', {
      code: 'TRANSPORT_ERROR',
      message: 'Operation cannot be accomplished in current state',
    });

    expect(formatted).toBe(
      'Java runtime transport failed: Operation cannot be accomplished in current state',
    );
  });

  it('falls back to the protocol message for unmapped codes', () => {
    const formatted = formatJavaRuntimeProtocolError('Failed to health-check Java runtime', {
      code: 'SOMETHING_ELSE',
      message: 'custom failure',
    });

    expect(formatted).toBe('custom failure');
  });
});
