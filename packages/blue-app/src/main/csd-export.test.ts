import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { BlueData, Channel } from '@blue/data';

import { saveGeneratedCsdToDisk } from './csd-export';

vi.mock('electron', () => ({ dialog: { showSaveDialog: vi.fn() } }));

describe('saveGeneratedCsdToDisk', () => {
  it('uses the configured work directory for an unsaved project', async () => {
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const showSaveDialog = vi.fn(async () => ({
      canceled: true,
      filePath: undefined,
    }));

    await saveGeneratedCsdToDisk({
      currentData: { toDiskCSD },
      currentFilePath: null,
      workDirectory: '/tmp/work',
      mainWindow: { webContents: { send: vi.fn() } } as any,
      dialogApi: { showSaveDialog } as any,
    });

    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ defaultPath: path.join('/tmp/work', 'generated.csd') }),
    );
    expect(toDiskCSD).not.toHaveBeenCalled();
  });

  it('does not generate, write, or publish when export is cancelled', async () => {
    const toDiskCSD = vi.fn(() => 'must-not-run');
    const writeFile = vi.fn(async () => undefined);
    const send = vi.fn();

    await expect(
      saveGeneratedCsdToDisk({
        currentData: { toDiskCSD },
        currentFilePath: '/native/project.blue',
        mainWindow: { webContents: { send } } as any,
        dialogApi: {
          showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined })),
        } as any,
        writeFile: writeFile as any,
      }),
    ).resolves.toBeNull();

    expect(toDiskCSD).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('calls toDiskCSD and writes the selected CSD file', async () => {
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const send = vi.fn();
    const showSaveDialog = vi.fn(async () => ({
      canceled: false,
      filePath: '/tmp/project',
    }));
    const writeFile = vi.fn(async () => undefined);

    const filePath = await saveGeneratedCsdToDisk({
      currentData: { toDiskCSD },
      currentFilePath: '/Users/stevenyi/work/blue-electron/project.blue',
      mainWindow: { webContents: { send } } as any,
      dialogApi: { showSaveDialog } as any,
      writeFile: writeFile as any,
    });

    expect(toDiskCSD).toHaveBeenCalledTimes(1);
    expect(showSaveDialog).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith('/tmp/project.csd', 'disk-csd', 'utf-8');
    expect(send).not.toHaveBeenCalled();
    expect(filePath).toBe('/tmp/project.csd');
  });

  it('prefers toDiskCSDAsync when a runtime client is available', async () => {
    const toDiskCSD = vi.fn(() => 'sync-csd');
    const toDiskCSDAsync = vi.fn(async () => 'async-csd');
    const send = vi.fn();
    const showSaveDialog = vi.fn(async () => ({
      canceled: false,
      filePath: '/tmp/async-project.csd',
    }));
    const writeFile = vi.fn(async () => undefined);
    const session = { kind: 'js-session' } as any;
    const runtimeClient = { kind: 'java-runtime' } as any;

    const filePath = await saveGeneratedCsdToDisk({
      currentData: { toDiskCSD, toDiskCSDAsync },
      currentFilePath: '/Users/stevenyi/work/blue-electron/project.blue',
      mainWindow: { webContents: { send } } as any,
      dialogApi: { showSaveDialog } as any,
      writeFile: writeFile as any,
      session,
      runtimeClient,
    });

    expect(toDiskCSDAsync).toHaveBeenCalledTimes(1);
    expect(toDiskCSDAsync).toHaveBeenCalledWith(session, runtimeClient, undefined);
    expect(toDiskCSD).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith('/tmp/async-project.csd', 'async-csd', 'utf-8');
    expect(filePath).toBe('/tmp/async-project.csd');
  });

  it('exports disk CSD preserving score pan law configuration (T018)', async () => {
    const data = new BlueData();
    data.getMixer().setPanningEnabled(true);
    data.getMixer().setPanLawDb(-4.5);
    data.getMixer().setPanOffCenterBoost(true);
    data.getMixer().setEnabled(true);

    const ch = new Channel();
    ch.setName('Track 1');
    ch.setPan(0.5);
    data.getMixer().getChannels().push(ch);

    const send = vi.fn();
    const showSaveDialog = vi.fn(async () => ({
      canceled: false,
      filePath: '/tmp/pan-law-export.csd',
    }));
    let writtenCsd = '';
    const writeFile = vi.fn(async (_path: string, content: string) => {
      writtenCsd = content;
    });

    const filePath = await saveGeneratedCsdToDisk({
      currentData: data,
      currentFilePath: '/tmp/test.blue',
      mainWindow: { webContents: { send } } as any,
      dialogApi: { showSaveDialog } as any,
      writeFile: writeFile as any,
    });

    expect(filePath).toBe('/tmp/pan-law-export.csd');
    expect(writtenCsd).toContain('<CsoundSynthesizer>');
    expect(writtenCsd).toContain('k_bal_l = min(1, 2 * (1 -');
  });
});
