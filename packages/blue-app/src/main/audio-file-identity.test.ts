import { describe, expect, it } from 'vitest';

import { canonicalAudioFileIdentity } from './audio-file-identity';

describe('canonicalAudioFileIdentity', () => {
  it('collapses relative and absolute aliases after native realpath resolution', () => {
    const realpath = (filePath: string): string =>
      filePath === 'relative/clip.wav' ? '/project/audio/clip.wav' : filePath;

    expect(canonicalAudioFileIdentity('relative/clip.wav', { realpath })).toBe(
      canonicalAudioFileIdentity('/project/audio/clip.wav', { realpath }),
    );
  });

  it('uses Windows separator and case rules without changing the supplied path', () => {
    const seen: string[] = [];
    const realpath = (filePath: string): string => {
      seen.push(filePath);
      return filePath;
    };

    const first = canonicalAudioFileIdentity('C:\\Projects\\Audio\\Clip.WAV', {
      platform: 'win32',
      realpath,
    });
    const second = canonicalAudioFileIdentity('c:/projects/audio/clip.wav', {
      platform: 'win32',
      realpath,
    });

    expect(first).toBe(second);
    expect(seen).toEqual(['C:\\Projects\\Audio\\Clip.WAV', 'c:/projects/audio/clip.wav']);
  });

  it('collapses supported symlink aliases at the identity boundary', () => {
    const realpath = (filePath: string): string =>
      filePath === '/project/audio/link.wav' ? '/project/audio/clip.wav' : filePath;

    expect(canonicalAudioFileIdentity('/project/audio/link.wav', { realpath })).toBe(
      canonicalAudioFileIdentity('/project/audio/clip.wav', { realpath }),
    );
  });
});
