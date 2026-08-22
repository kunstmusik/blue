import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { BANK_SYSEX_SIZE, SINGLE_SYSEX_SIZE } from '@blue/data';
import type { BlueX7SysexReadResult } from '../shared/blue-x7-sysex';

export const BLUE_X7_IMPORT_SYSEX_CHANNEL = 'blue-x7:import-sysex';

function unsupportedSizeMessage(size: number): string {
  return `Unsupported DX7 SysEx file size: expected ${SINGLE_SYSEX_SIZE} bytes (single) or ${BANK_SYSEX_SIZE} bytes (bank), got ${size} bytes.`;
}

/**
 * Open the native file chooser and return detached bytes to the renderer.
 * Native code intentionally does not decode or mutate project state.
 */
export async function selectBlueX7SysexFile(
  ownerWindow?: BrowserWindow | null,
  mainWindow?: BrowserWindow | null,
): Promise<BlueX7SysexReadResult> {
  const windowToUse = ownerWindow ?? mainWindow ?? BrowserWindow.getFocusedWindow() ?? undefined;

  const options: OpenDialogOptions = {
    title: 'Import Yamaha DX7 SysEx File',
    filters: [
      { name: 'Yamaha DX7 SysEx (*.syx, *.dx7, *.bin)', extensions: ['syx', 'dx7', 'bin'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  };
  const result = windowToUse
    ? await dialog.showOpenDialog(windowToUse, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { status: 'canceled' };
  }

  const filePath = result.filePaths[0];
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return {
      status: 'error',
      code: 'invalid-request',
      message: 'The selected SysEx path was invalid.',
    };
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.size !== SINGLE_SYSEX_SIZE && stat.size !== BANK_SYSEX_SIZE) {
      return {
        status: 'error',
        code: 'unsupported-size',
        message: unsupportedSizeMessage(stat.size),
      };
    }

    const buffer = await fs.readFile(filePath);
    if (buffer.byteLength !== stat.size) {
      return {
        status: 'error',
        code: 'read-failed',
        message: `Failed to read SysEx file: file size changed while it was being read (expected ${stat.size} bytes, got ${buffer.byteLength}).`,
      };
    }

    const bytes = new Uint8Array(buffer).slice().buffer;
    return {
      status: 'selected',
      fileName: path.basename(filePath),
      bytes,
    };
  } catch (error) {
    return {
      status: 'error',
      code: 'read-failed',
      message: `Failed to read SysEx file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
