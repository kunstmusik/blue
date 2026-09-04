import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import type { BlueData, JavaRuntimeClientContract, JavaScriptSession } from '@blue/data';

export interface SaveGeneratedCsdToDiskRequest {
  currentData: Pick<BlueData, 'toDiskCSD'> & Partial<Pick<BlueData, 'toDiskCSDAsync'>>;
  currentFilePath?: string | null;
  workDirectory?: string | null;
  mainWindow: Pick<BrowserWindow, 'webContents'>;
  dialogApi?: Pick<typeof dialog, 'showSaveDialog'>;
  writeFile?: typeof fs.writeFile;
  session?: JavaScriptSession;
  runtimeClient?: JavaRuntimeClientContract | null;
}

export async function saveGeneratedCsdToDisk(
  request: SaveGeneratedCsdToDiskRequest,
): Promise<string | null> {
  const dialogApi = request.dialogApi ?? dialog;
  const writeFile = request.writeFile ?? fs.writeFile;
  const projectBase = request.currentFilePath
    ? path.basename(request.currentFilePath, '.blue')
    : 'generated';
  const projectDir = request.currentFilePath ? path.dirname(request.currentFilePath) : undefined;
  const defaultDirectory = projectDir ?? (request.workDirectory?.trim() || undefined);

  const result = await dialogApi.showSaveDialog(request.mainWindow as BrowserWindow, {
    defaultPath: defaultDirectory
      ? path.join(defaultDirectory, `${projectBase}.csd`)
      : `${projectBase}.csd`,
    filters: [{ name: 'CSD Files', extensions: ['csd'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  let filePath = result.filePath;
  if (!filePath.endsWith('.csd')) {
    filePath += '.csd';
  }

  const csdText =
    request.runtimeClient && request.currentData.toDiskCSDAsync
      ? await request.currentData.toDiskCSDAsync(request.session, request.runtimeClient)
      : request.currentData.toDiskCSD(request.session);
  await writeFile(filePath, csdText, 'utf-8');
  request.mainWindow.webContents.send('save-complete', { filePath });

  return filePath;
}
