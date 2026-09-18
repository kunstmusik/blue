import { describe, expect, it } from 'vitest';
import {
  formatAudioLayoutDiagnostic,
  isAudioLayoutDiagnostic,
  isAudioLayoutErrorPayload,
  type AudioLayoutDiagnostic,
} from './audio-layout';

describe('shared audio-layout diagnostics and guards (T009, T056)', () => {
  it('validates compliant AudioLayoutDiagnostic objects', () => {
    const validDiag: AudioLayoutDiagnostic = {
      code: 'UNSUPPORTED_SOURCE_CHANNELS',
      message:
        "Audio file '/audio/3ch.wav' has 3 channels; only mono (1) and stereo (2) are supported",
      filePath: '/audio/3ch.wav',
      observedChannels: 3,
    };
    expect(isAudioLayoutDiagnostic(validDiag)).toBe(true);

    const outputDiag: AudioLayoutDiagnostic = {
      code: 'UNSUPPORTED_OUTPUT_CHANNELS',
      message: 'Unsupported project output channel count (6)',
      outputChannels: 6,
    };
    expect(isAudioLayoutDiagnostic(outputDiag)).toBe(true);
  });

  it('rejects invalid or corrupted diagnostics', () => {
    expect(isAudioLayoutDiagnostic(null)).toBe(false);
    expect(isAudioLayoutDiagnostic({})).toBe(false);
    expect(isAudioLayoutDiagnostic({ code: 'UNKNOWN_CODE', message: 'foo' })).toBe(false);
    expect(isAudioLayoutDiagnostic({ code: 'MISSING_AUDIO_LAYOUT', message: 123 })).toBe(false);
    expect(
      isAudioLayoutDiagnostic({
        code: 'MISSING_AUDIO_LAYOUT',
        message: 'missing',
        filePath: 42,
      }),
    ).toBe(false);
  });

  it('keeps IPC error payloads typed and formats actionable details', () => {
    const diagnostic: AudioLayoutDiagnostic = {
      code: 'UNSUPPORTED_SOURCE_CHANNELS',
      message: 'Unsupported source channel count',
      filePath: 'audio\\surround.wav',
      observedChannels: 4,
    };
    const payload = { message: diagnostic.message, layoutDiagnostic: diagnostic };

    expect(isAudioLayoutErrorPayload(payload)).toBe(true);
    expect(formatAudioLayoutDiagnostic(diagnostic)).toBe(
      'Unsupported source channel count [UNSUPPORTED_SOURCE_CHANNELS; file: audio\\surround.wav; channels: 4]',
    );
    expect(
      isAudioLayoutErrorPayload({ ...payload, layoutDiagnostic: { ...diagnostic, code: 'bad' } }),
    ).toBe(false);
  });
});
