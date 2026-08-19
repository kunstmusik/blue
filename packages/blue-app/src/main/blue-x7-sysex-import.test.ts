import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dialog } from 'electron';
import {
  selectBlueX7SysexFile,
} from './blue-x7-sysex-import';

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(),
  },
}));

describe('BlueX7 SysEx Import — Main Process Service', () => {
  const fixturesDir = path.join(__dirname, '..', '..', '..', 'blue-data', 'src', 'instruments', 'blue-x7', 'test-fixtures');
  const singleSyxPath = path.join(fixturesDir, 'single-voice.syx');
  const bankSyxPath = path.join(fixturesDir, 'voice-bank.syx');

  const singleBytes = new Uint8Array(fs.readFileSync(singleSyxPath));
  const bankBytes = new Uint8Array(fs.readFileSync(bankSyxPath));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decodes single and bank SysEx buffers in memory', () => {
    expect(singleBytes).toHaveLength(163);
    expect(bankBytes).toHaveLength(4104);
  });

  it('returns canceled when user dismisses the file dialog', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });

    const res = await selectBlueX7SysexFile();
    expect(res).toEqual({ status: 'canceled' });
  });

  it('returns detached bytes for a single-voice file chosen in dialog', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [singleSyxPath],
    });

    const res = await selectBlueX7SysexFile();
    expect(res.status).toBe('selected');
    if (res.status === 'selected') {
      expect(res.fileName).toBe('single-voice.syx');
      expect(new Uint8Array(res.bytes)).toEqual(singleBytes);
    }
  });

  it('returns detached bytes for a bank file chosen in dialog', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [bankSyxPath],
    });

    const res = await selectBlueX7SysexFile();
    expect(res.status).toBe('selected');
    if (res.status === 'selected') {
      expect(res.fileName).toBe('voice-bank.syx');
      expect(new Uint8Array(res.bytes)).toEqual(bankBytes);
    }
  });

  it('rejects unsupported file sizes before reading file content', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/dev/null'],
    });

    const res = await selectBlueX7SysexFile();
    expect(res).toMatchObject({ status: 'error', code: 'unsupported-size' });
  });

  it('returns error when file does not exist or cannot be read', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/nonexistent/dx7/patch.syx'],
    });

    const res = await selectBlueX7SysexFile();
    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect(res.code).toBe('read-failed');
      expect(res.message).toContain('Failed to read SysEx file');
    }
  });
});
