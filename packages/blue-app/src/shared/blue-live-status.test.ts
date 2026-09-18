import { describe, expect, it } from 'vitest';

import { isBlueLiveStatusSnapshot } from './blue-live-status';

describe('Blue Live status contract', () => {
  it('accepts a typed layout diagnostic on an error snapshot', () => {
    expect(
      isBlueLiveStatusSnapshot({
        status: 'error',
        running: false,
        message: 'Missing audio layout',
        sessionId: 4,
        projectRevision: 7,
        layoutDiagnostic: {
          code: 'MISSING_AUDIO_LAYOUT',
          message: 'Missing audio file',
          filePath: 'audio/clip.wav',
        },
      }),
    ).toBe(true);
  });

  it('rejects malformed diagnostics before renderer state receives them', () => {
    expect(
      isBlueLiveStatusSnapshot({
        status: 'error',
        running: false,
        sessionId: 4,
        layoutDiagnostic: {
          code: 'UNSUPPORTED_SOURCE_CHANNELS',
          message: 'bad',
          observedChannels: Number.NaN,
        },
      }),
    ).toBe(false);
  });
});
