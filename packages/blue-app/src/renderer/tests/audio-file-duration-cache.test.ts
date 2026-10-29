import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAudioFileDurationCache,
  getAudioFileDuration,
  subscribeAudioFileDuration,
} from '../components/workbench/panels/score/layer-groups/audio-file-duration-cache';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
afterEach(() => {
  clearAudioFileDurationCache();
  vi.unstubAllGlobals();
});

describe('audio duration metadata cache', () => {
  it('uses header metadata and keeps live subscribers across project resets', async () => {
    const getMetadata = vi.fn(async () => ({ durationSeconds: 12 }));
    const readBytes = vi.fn();
    vi.stubGlobal('window', {
      blueAPI: { getAudioFileMetadata: getMetadata, readAudioFileBytes: readBytes },
    });
    const listener = vi.fn();
    const unsubscribe = subscribeAudioFileDuration(listener);
    try {
      expect(getAudioFileDuration('audio.wav')).toBeNull();
      getAudioFileDuration('audio.wav');
      await flush();
      expect(getMetadata).toHaveBeenCalledOnce();
      expect(readBytes).not.toHaveBeenCalled();
      expect(getAudioFileDuration('audio.wav')).toBe(12);
      clearAudioFileDurationCache();
      getAudioFileDuration('other.wav');
      await flush();
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
    }
  });

  it('ignores old-project metadata without dropping the replacement request', async () => {
    let finishOld!: (value: { durationSeconds: number }) => void;
    let finishNew!: (value: { durationSeconds: number }) => void;
    const getMetadata = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          }),
      );
    vi.stubGlobal('window', { blueAPI: { getAudioFileMetadata: getMetadata } });
    getAudioFileDuration('same.wav');
    clearAudioFileDurationCache();
    getAudioFileDuration('same.wav');
    finishOld({ durationSeconds: 99 });
    await flush();
    expect(getAudioFileDuration('same.wav')).toBeNull();
    expect(getMetadata).toHaveBeenCalledTimes(2);
    finishNew({ durationSeconds: 7 });
    await flush();
    expect(getAudioFileDuration('same.wav')).toBe(7);
  });
});
