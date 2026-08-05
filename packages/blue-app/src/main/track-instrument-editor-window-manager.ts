import { BrowserWindow } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';

import type { TrackInstrumentEditorRequest } from '../shared/project-editor';
import {
  PROJECT_DOCUMENT_UPDATED_CHANNEL,
  type ProjectDocumentUpdatedEvent,
} from '../shared/workbench-window-contract';
import {
  attachWindowStateHandlers,
  restoreWindowState,
} from './window-state-manager';

interface TrackInstrumentEditorWindowState {
  window: BrowserWindow;
  disposeStateHandlers: (() => void) | null;
  rootGroupId: string;
  trackId: string;
}

const trackInstrumentEditorWindows = new Map<string, TrackInstrumentEditorWindowState>();

function getWindowKey(request: TrackInstrumentEditorRequest): string {
  return `${request.track.projectSessionId}:${request.track.rootGroupId}:${request.track.trackId}`;
}

function buildTrackInstrumentEditorUrl(request: TrackInstrumentEditorRequest): string {
  const params = new URLSearchParams({
    rootGroupId: request.track.rootGroupId,
    trackId: request.track.trackId,
  });

  params.set('projectSessionId', String(request.track.projectSessionId));
  params.set('projectRevision', String(request.track.projectRevision));

  if (process.env.VITE_DEV_SERVER_URL) {
    const devBase = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '');
    return `${devBase}/track-instrument-editor.html?${params.toString()}`;
  }

  const fileUrl = pathToFileURL(
    path.join(__dirname, '..', 'renderer', 'track-instrument-editor.html'),
  );
  fileUrl.search = params.toString();
  return fileUrl.toString();
}

export interface TrackInstrumentEditorWindowOptions {
  initialZoomFactor?: number;
}

export function openTrackInstrumentEditorWindow(
  mainWindow: BrowserWindow | null,
  request: TrackInstrumentEditorRequest,
  options: TrackInstrumentEditorWindowOptions = {},
): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const key = getWindowKey(request);
  const existing = trackInstrumentEditorWindows.get(key);
  if (existing && !existing.window.isDestroyed()) {
    existing.window.focus();
    existing.window.show();
    return existing.window;
  }

  const editorWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    title: 'Track Instrument Editor',
    parent: mainWindow,
    frame: true,
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

  restoreWindowState(editorWindow, 'track-instrument-editor');
  const disposeStateHandlers = attachWindowStateHandlers(
    editorWindow,
    'track-instrument-editor',
  );

  trackInstrumentEditorWindows.set(key, {
    window: editorWindow,
    disposeStateHandlers,
    rootGroupId: request.track.rootGroupId,
    trackId: request.track.trackId,
  });

  editorWindow.once('ready-to-show', () => {
    if (!editorWindow.isDestroyed()) editorWindow.show();
  });

  editorWindow.on('closed', () => {
    disposeStateHandlers?.();
    trackInstrumentEditorWindows.delete(key);
  });

  editorWindow.loadURL(buildTrackInstrumentEditorUrl(request));
  return editorWindow;
}

export function closeTrackInstrumentEditorWindow(
  request: TrackInstrumentEditorRequest,
): void {
  const key = getWindowKey(request);
  const existing = trackInstrumentEditorWindows.get(key);
  if (existing && !existing.window.isDestroyed()) existing.window.close();
  trackInstrumentEditorWindows.delete(key);
}

export function closeTrackInstrumentEditorWindowsForTrack(
  rootGroupId: string,
  trackId: string,
): void {
  for (const [key, state] of trackInstrumentEditorWindows.entries()) {
    if (state.rootGroupId !== rootGroupId || state.trackId !== trackId) continue;
    if (!state.window.isDestroyed()) state.window.close();
    trackInstrumentEditorWindows.delete(key);
  }
}

export function closeTrackInstrumentEditorWindowsForGroup(rootGroupId: string): void {
  for (const [key, state] of trackInstrumentEditorWindows.entries()) {
    if (state.rootGroupId !== rootGroupId) continue;
    if (!state.window.isDestroyed()) state.window.close();
    trackInstrumentEditorWindows.delete(key);
  }
}

export function closeTrackInstrumentEditorWindows(): void {
  for (const [key, state] of trackInstrumentEditorWindows.entries()) {
    if (!state.window.isDestroyed()) state.window.close();
    trackInstrumentEditorWindows.delete(key);
  }
}

export function focusTrackInstrumentEditorWindow(
  request: TrackInstrumentEditorRequest,
): boolean {
  const existing = trackInstrumentEditorWindows.get(getWindowKey(request));
  if (!existing || existing.window.isDestroyed()) return false;
  existing.window.focus();
  existing.window.show();
  return true;
}

export function broadcastProjectDocumentUpdateToTrackInstrumentWindows(
  event: ProjectDocumentUpdatedEvent,
): void {
  for (const state of trackInstrumentEditorWindows.values()) {
    if (state.window.isDestroyed()) continue;
    state.window.webContents.send(PROJECT_DOCUMENT_UPDATED_CHANNEL, event);
  }
}
