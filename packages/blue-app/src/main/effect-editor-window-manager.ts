import { BrowserWindow } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';

import type { EffectEditorRequest } from '../shared/project-editor';
import {
  attachWindowStateHandlers,
  restoreWindowState,
} from './window-state-manager';

type EffectEditorMode = 'interface' | 'edit';

interface EffectEditorKey {
  mode: EffectEditorMode;
  key: string;
}

interface EffectEditorWindowState {
  window: BrowserWindow;
  disposeStateHandlers: (() => void) | null;
}

const effectEditorWindows = new Map<string, EffectEditorWindowState>();

function getWindowKey(request: EffectEditorRequest, mode: EffectEditorMode): string {
  return `${mode}:${request.ownerType}:${request.effectId}`;
}

function buildEffectEditorUrl(request: EffectEditorRequest, mode: EffectEditorMode): string {
  const params = new URLSearchParams({
    ownerType: request.ownerType,
    effectId: request.effectId,
    mode,
  });

  if (request.projectRef) {
    params.set('channelId', request.projectRef.channelId);
    params.set('chain', request.projectRef.chain);
    params.set('entryId', request.projectRef.entryId);
  }

  if (request.libraryRef) {
    params.set('libraryEffectId', request.libraryRef.libraryEffectId);
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    const devBase = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '');
    return `${devBase}/effect-editor.html?${params.toString()}`;
  }

  const fileUrl = pathToFileURL(
    path.join(__dirname, '..', 'renderer', 'effect-editor.html'),
  );
  fileUrl.search = params.toString();
  return fileUrl.toString();
}

export interface EffectEditorWindowOptions {
  /**
   * Initial Chromium/Electron page zoom factor (`percent / 100`) applied
   * before the effect editor/interface renderer becomes visible (SPEC 061).
   */
  initialZoomFactor?: number;
}

export function openEffectInterfaceWindow(
  mainWindow: BrowserWindow | null,
  request: EffectEditorRequest,
  interfaceWidth?: number,
  interfaceHeight?: number,
  options: EffectEditorWindowOptions = {},
): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const key = getWindowKey(request, 'interface');
  const existing = effectEditorWindows.get(key);
  if (existing && !existing.window.isDestroyed()) {
    existing.window.focus();
    existing.window.show();
    return existing.window;
  }

  const effectWindow = new BrowserWindow({
    title: 'Effect Interface',
    parent: mainWindow,
    modal: false,
    show: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      ...(options.initialZoomFactor !== undefined
        ? { zoomFactor: options.initialZoomFactor }
        : {}),
    },
  });

  if (interfaceWidth && interfaceHeight) {
    effectWindow.setContentSize(interfaceWidth, interfaceHeight);
  } else {
    effectWindow.setContentSize(460, 560);
  }

  restoreWindowState(effectWindow, 'effect-interface');
  const disposeStateHandlers = attachWindowStateHandlers(effectWindow, 'effect-interface');

  effectEditorWindows.set(key, { window: effectWindow, disposeStateHandlers });

  effectWindow.once('ready-to-show', () => {
    if (!effectWindow.isDestroyed()) {
      effectWindow.show();
    }
  });

  effectWindow.on('closed', () => {
    disposeStateHandlers?.();
    effectEditorWindows.delete(key);
  });

  effectWindow.loadURL(buildEffectEditorUrl(request, 'interface'));
  return effectWindow;
}

export function openEffectEditorWindow(
  mainWindow: BrowserWindow | null,
  request: EffectEditorRequest,
  options: EffectEditorWindowOptions = {},
): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const key = getWindowKey(request, 'edit');
  const existing = effectEditorWindows.get(key);
  if (existing && !existing.window.isDestroyed()) {
    existing.window.focus();
    existing.window.show();
    return existing.window;
  }

  const effectWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    title: 'Effect Editor',
    parent: mainWindow,
    modal: true,
    show: false,
    resizable: true,
    minimizable: false,
    maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      ...(options.initialZoomFactor !== undefined
        ? { zoomFactor: options.initialZoomFactor }
        : {}),
    },
  });

  restoreWindowState(effectWindow, 'effect-editor');
  const disposeStateHandlers = attachWindowStateHandlers(effectWindow, 'effect-editor');

  effectEditorWindows.set(key, { window: effectWindow, disposeStateHandlers });

  effectWindow.once('ready-to-show', () => {
    if (!effectWindow.isDestroyed()) {
      effectWindow.show();
    }
  });

  effectWindow.on('closed', () => {
    disposeStateHandlers?.();
    effectEditorWindows.delete(key);
  });

  effectWindow.loadURL(buildEffectEditorUrl(request, 'edit'));
  return effectWindow;
}

export function closeEffectEditorWindow(request: EffectEditorRequest): void {
  for (const mode of ['edit', 'interface'] as const) {
    const key = getWindowKey(request, mode);
    const existing = effectEditorWindows.get(key);
    if (existing && !existing.window.isDestroyed()) {
      existing.window.close();
    }
    effectEditorWindows.delete(key);
  }
}

export function closeEffectEditorWindowsForOwner(ownerType: 'project' | 'library'): void {
  for (const [key, state] of effectEditorWindows.entries()) {
    if (!key.includes(`:${ownerType}:`)) {
      continue;
    }
    if (!state.window.isDestroyed()) {
      state.window.close();
    }
    effectEditorWindows.delete(key);
  }
}

export function focusEffectEditorWindow(request: EffectEditorRequest): boolean {
  for (const mode of ['edit', 'interface'] as const) {
    const key = getWindowKey(request, mode);
    const existing = effectEditorWindows.get(key);
    if (existing && !existing.window.isDestroyed()) {
      existing.window.focus();
      existing.window.show();
      return true;
    }
  }
  return false;
}

export function closeStaleEffectEditorWindows(
  validEffectIds: Set<string>,
  ownerType: 'project' | 'library',
): void {
  for (const [key, state] of effectEditorWindows.entries()) {
    if (!key.includes(`:${ownerType}:`)) continue;
    const effectId = key.split(':').pop();
    if (effectId && !validEffectIds.has(effectId)) {
      if (!state.window.isDestroyed()) {
        state.window.close();
      }
      effectEditorWindows.delete(key);
    }
  }
}

