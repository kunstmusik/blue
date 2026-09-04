// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { decodeAudioUrl, encodeAudioPath } from './audio-url';

describe('audio-url (renderer)', () => {
  it('produces a blue-audio:// url', () => {
    expect(encodeAudioPath('/x.wav')).toMatch(/^blue-audio:\/\/file\//);
  });

  it('round-trips paths with spaces, unicode, and slashes', () => {
    const cases = [
      '/a/b.wav',
      'C:\\Users\\Steven\\renders\\café.wav',
      '/tmp/with space and (parens).flac',
      '/home/Steven/中文 文件.aiff',
      '/a/b/c/d/e/f.mp3',
    ];
    for (const c of cases) {
      expect(decodeAudioUrl(encodeAudioPath(c))).toBe(c);
    }
  });

  it('returns null for a malformed url', () => {
    expect(decodeAudioUrl(':::not-a-url')).toBeNull();
  });
});
