import { describe, expect, it } from 'vitest';
import {
  JAVA_RUNTIME_METHODS,
  createJavaRuntimeRequest,
  decodeJavaRuntimeResponse,
  encodeJavaRuntimeRequest,
} from './java-runtime-protocol';

describe('java-runtime-protocol', () => {
  it('encodes requests with the expected method names', () => {
    const request = createJavaRuntimeRequest('req-1', JAVA_RUNTIME_METHODS.HEALTH, 'secret', {});
    const encoded = encodeJavaRuntimeRequest(request).toString('utf-8');

    expect(encoded).toContain('"method":"runtime.health"');
    expect(encoded).toContain('"authToken":"secret"');
  });

  it('decodes success responses', () => {
    const response = decodeJavaRuntimeResponse<{ accepted: boolean }>(JSON.stringify({
      id: 'req-2',
      ok: true,
      result: { accepted: true },
      stdout: '',
      stderr: '',
      elapsedMs: 5,
    }));

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.accepted).toBe(true);
      expect(response.elapsedMs).toBe(5);
    }
  });

  it('decodes failure responses', () => {
    const response = decodeJavaRuntimeResponse(JSON.stringify({
      id: 'req-3',
      ok: false,
      error: { code: 'PROTOCOL_ERROR', message: 'Bad request' },
      stdout: '',
      stderr: '',
      elapsedMs: 2,
    }));

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('PROTOCOL_ERROR');
    }
  });
});