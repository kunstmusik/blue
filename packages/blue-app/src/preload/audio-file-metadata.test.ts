import { describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({
  clipboard: { writeText: vi.fn(), readText: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke },
  webUtils: { getPathForFile: vi.fn(() => '') },
}));

describe('audio metadata preload contract', () => {
  it('forwards native paths and preserves metadata/unavailable responses', async () => {
    await import('./preload');
    const { contextBridge } = await import('electron');
    const expose = vi.mocked(contextBridge.exposeInMainWorld);
    const api = expose.mock.calls.find(([name]) => name === 'blueAPI')![1] as {
      getAudioFileMetadata: (path: string) => Promise<unknown>;
    };
    const filePath = String.raw`C:\Users\Composer\audio.wav`;
    const result = { sampleRate: 48000, channels: 2, durationSeconds: 60 };
    invoke.mockResolvedValueOnce(result).mockResolvedValueOnce(null);
    await expect(api.getAudioFileMetadata(filePath)).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith('get-audio-file-metadata', filePath);
    await expect(api.getAudioFileMetadata(filePath)).resolves.toBeNull();
  });
});
