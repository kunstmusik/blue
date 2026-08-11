import * as fs from 'node:fs';
import * as path from 'node:path';
import { LEGACY_LIBRARY_FORMATS } from '@blue/data';
import { dialog, type BrowserWindow, type IpcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import {
  UNIFIED_LIBRARY_BROWSE_CHANNEL,
  UNIFIED_LIBRARY_BEGIN_DRAG_CHANNEL,
  UNIFIED_LIBRARY_CANCEL_DRAG_CHANNEL,
  UNIFIED_LIBRARY_PREVIEW_TRANSFER_CHANNEL,
  UNIFIED_LIBRARY_APPLY_TRANSFER_CHANNEL,
  UNIFIED_LIBRARY_APPLY_INSERTION_CHANNEL,
  UNIFIED_LIBRARY_DRAFT_RESOLVE_CHANNEL,
  UNIFIED_LIBRARY_DRAFT_SHUTDOWN_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_CHANGED_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_CLOSE_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_GET_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_OPEN_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_PATCH_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_REVERT_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_RESOLVE_CONFLICT_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_SAVE_CHANNEL,
  UNIFIED_LIBRARY_MUTATE_CHANNEL,
  UNIFIED_LIBRARY_PREPARE_MUTATION_CHANNEL,
  UNIFIED_LIBRARY_CUT_TO_CLIPBOARD_CHANNEL,
  UNIFIED_LIBRARY_SET_CLIPBOARD_CHANNEL,
  UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL,
  UNIFIED_LIBRARY_CAPTURE_SCORE_SOUND_OBJECT_CHANNEL,
  UNIFIED_LIBRARY_CAPTURE_TRACK_INSTRUMENT_CHANNEL,
  UNIFIED_LIBRARY_CAPTURE_BLUE_LIVE_SOUND_OBJECT_CHANNEL,
  UNIFIED_LIBRARY_ADD_SCORE_SOUND_OBJECT_CHANNEL,
  UNIFIED_LIBRARY_TRANSFER_TO_USER_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_DELETE_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_DELETE_PREVIEW_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_USAGE_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_DIRECTORY_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL,
  UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL,
  UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL,
  UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL,
  UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL,
  UNIFIED_LIBRARY_RECOVERY_FRESH_CHANNEL,
  UNIFIED_LIBRARY_CLEAR_TARGET_CHANNEL,
  UNIFIED_LIBRARY_CHANGED_CHANNEL,
  UNIFIED_LIBRARY_CONTEXT_CHANGED_CHANNEL,
  UNIFIED_LIBRARY_GET_SNAPSHOT_CHANNEL,
  UNIFIED_LIBRARY_PREVIEW_CHANNEL,
  UNIFIED_LIBRARY_PREVIEW_INSERTION_CHANNEL,
  UNIFIED_LIBRARY_SEARCH_CHANNEL,
  UNIFIED_LIBRARY_SET_CONTEXT_CHANNEL,
  UNIFIED_LIBRARY_SNAPSHOT_CHANGED_CHANNEL,
  createLibraryServiceError,
  isBrowseLibraryRequest,
  isBeginLibraryDragRequest,
  isLibraryTransferPreviewRequest,
  isLibraryTransferSourceReference,
  isConfirmedLibraryInsertionRequest,
  isLibraryContextRequest,
  isLibraryInsertionRequest,
  isLibraryItemKey,
  isLibraryEditorPatchRequest,
  isLibraryEditorConflictRequest,
  isOpenLibraryEditorRequest,
  isSearchLibrariesRequest,
  isUserLibraryMutation,
  isPrepareLibraryMutationRequest,
  isCutLibraryToClipboardRequest,
  isLibraryInteractionClipboard,
  isBsbCanvasClipboard,
  isScoreTimelineSoundObjectRequest,
  isTrackInstrumentClipboardRequest,
  isBlueLiveSoundObjectClipboardRequest,
  isLibraryType,
} from '../../shared/unified-library';
import { UnifiedLibraryService } from './service';
import { resolveWorkDirectoryDefaultPath } from '../work-directory';

export interface UnifiedLibraryIpcOptions {
  readonly ipcMain: IpcMain;
  readonly service: UnifiedLibraryService;
  readonly getWindows: () => readonly BrowserWindow[];
  readonly getWorkDirectory?: () => string | undefined;
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every((entry) => typeof entry === 'string');
}

export function registerUnifiedLibraryIpc(options: UnifiedLibraryIpcOptions): () => void {
  const { ipcMain, service, getWindows } = options;
  const getWorkDirectory = options.getWorkDirectory;
  ipcMain.handle(UNIFIED_LIBRARY_GET_SNAPSHOT_CHANNEL, () => service.getSnapshot());
  ipcMain.handle(UNIFIED_LIBRARY_BROWSE_CHANNEL, (_event, request: unknown) => (
    isBrowseLibraryRequest(request)
      ? service.browseLibraries(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid library browse request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_SEARCH_CHANNEL, (_event, request: unknown) => (
    isSearchLibrariesRequest(request)
      ? service.searchLibraries(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid library search request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_PREVIEW_CHANNEL, (_event, key: unknown) => (
    isLibraryItemKey(key)
      ? service.getLibraryItemPreview(key)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid library preview key.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_BEGIN_DRAG_CHANNEL, (_event, request: unknown) => (
    isBeginLibraryDragRequest(request)
      ? service.beginLibraryDrag(request)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid drag request.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_CANCEL_DRAG_CHANNEL, (_event, dragSessionId: unknown) => {
    if (typeof dragSessionId === 'string') service.cancelLibraryDrag(dragSessionId);
  });
  ipcMain.handle(UNIFIED_LIBRARY_PREVIEW_TRANSFER_CHANNEL, (_event, request: unknown) => (
    isLibraryTransferPreviewRequest(request)
      ? service.previewLibraryTransfer(request)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid transfer request.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_APPLY_TRANSFER_CHANNEL, (_event, previewToken: unknown) => (
    typeof previewToken === 'string'
      ? service.applyLibraryTransfer(previewToken)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid transfer preview.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_SET_CONTEXT_CHANNEL, (_event, request: unknown) => (
    isLibraryContextRequest(request)
      ? service.setLibraryContext(request)
      : {
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid library context.', false),
        }
  ));
  ipcMain.handle(UNIFIED_LIBRARY_CLEAR_TARGET_CHANNEL, () => service.clearLibraryInsertionTarget());
  ipcMain.handle(UNIFIED_LIBRARY_PREVIEW_INSERTION_CHANNEL, (_event, request: unknown) => (
    isLibraryInsertionRequest(request)
      ? service.previewLibraryInsertion(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid insertion preview request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_APPLY_INSERTION_CHANNEL, (_event, request: unknown) => (
    isConfirmedLibraryInsertionRequest(request)
      ? service.applyLibraryInsertion(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid insertion request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_MUTATE_CHANNEL, (_event, request: unknown) => (
    isUserLibraryMutation(request)
      ? service.applyLibraryMutation(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid library mutation.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_PREPARE_MUTATION_CHANNEL, (_event, request: unknown) => (
    isPrepareLibraryMutationRequest(request)
      ? service.prepareLibraryMutation(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid library mutation preview.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_CUT_TO_CLIPBOARD_CHANNEL, (_event, request: unknown) => (
    isCutLibraryToClipboardRequest(request)
      ? service.cutLibraryToClipboard(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid Library Cut request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_SET_CLIPBOARD_CHANNEL, (_event, clipboard: unknown) => (
    clipboard === null || isLibraryInteractionClipboard(clipboard)
      ? service.setClipboard(clipboard)
      : false
  ));
  ipcMain.handle(UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL, (_event, clipboard: unknown) => (
    clipboard === null || isBsbCanvasClipboard(clipboard)
      ? service.setBsbClipboard(clipboard)
      : false
  ));
  ipcMain.handle(UNIFIED_LIBRARY_CAPTURE_SCORE_SOUND_OBJECT_CHANNEL, (_event, request: unknown) => (
    isScoreTimelineSoundObjectRequest(request)
      ? service.captureScoreSoundObjectClipboard(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid timeline SoundObject request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_CAPTURE_TRACK_INSTRUMENT_CHANNEL, (_event, request: unknown) => (
    isTrackInstrumentClipboardRequest(request)
      ? service.captureTrackInstrumentClipboard(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid Track instrument request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_CAPTURE_BLUE_LIVE_SOUND_OBJECT_CHANNEL, (_event, request: unknown) => (
    isBlueLiveSoundObjectClipboardRequest(request)
      ? service.captureBlueLiveSoundObjectClipboard(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid Blue Live SoundObject request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_ADD_SCORE_SOUND_OBJECT_CHANNEL, (_event, request: unknown) => (
    isScoreTimelineSoundObjectRequest(request)
      ? service.addScoreSoundObjectToProjectLibrary(request)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid timeline SoundObject request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EDITOR_OPEN_CHANNEL, (_event, request: unknown) => (
    isOpenLibraryEditorRequest(request)
      ? service.openLibraryItemEditor(request.key, request.pinned ?? false)
      : Promise.resolve({
          ok: false as const,
          error: createLibraryServiceError('invalid-request', 'Invalid editor request.', false),
        })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EDITOR_GET_CHANNEL, (_event, sessionId: unknown) => (
    typeof sessionId === 'string'
      ? service.getLibraryEditorSession(sessionId)
      : { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid editor session.', false) }
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EDITOR_PATCH_CHANNEL, (_event, request: unknown) => (
    isLibraryEditorPatchRequest(request)
      ? service.patchLibraryEditorSession(request)
      : { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid editor patch.', false) }
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EDITOR_SAVE_CHANNEL, (_event, sessionId: unknown) => (
    typeof sessionId === 'string'
      ? service.saveLibraryEditorSession(sessionId)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid editor session.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EDITOR_REVERT_CHANNEL, (_event, sessionId: unknown) => (
    typeof sessionId === 'string'
      ? service.revertLibraryEditorSession(sessionId)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid editor session.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EDITOR_RESOLVE_CONFLICT_CHANNEL, (_event, request: unknown) => (
    isLibraryEditorConflictRequest(request)
      ? service.resolveLibraryEditorConflict(request)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid conflict resolution.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EDITOR_CLOSE_CHANNEL, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null || !('sessionId' in request)) {
      return { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid close request.', false) };
    }
    const { sessionId, decision } = request as { sessionId?: unknown; decision?: unknown };
    return typeof sessionId === 'string' && (decision === undefined || decision === 'discard' || decision === 'cancel')
      ? service.closeLibraryEditorSession(sessionId, decision)
      : { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid close request.', false) };
  });
  ipcMain.handle(UNIFIED_LIBRARY_DRAFT_SHUTDOWN_CHANNEL, (_event, reason: unknown) => (
    reason === 'quit' || reason === 'closeProject' || reason === 'switchProject'
      ? service.prepareLibraryDraftShutdown(reason)
      : { reason: 'quit' as const, dirtySessionIds: [], mayContinue: false }
  ));
  ipcMain.handle(UNIFIED_LIBRARY_DRAFT_RESOLVE_CHANNEL, (_event, decision: unknown) => (
    decision === 'save' || decision === 'discard' || decision === 'cancel'
      ? service.resolveLibraryDraftShutdown(decision)
      : Promise.resolve({ mayContinue: false })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_PROJECT_USAGE_CHANNEL, (_event, key: unknown) => (
    isLibraryItemKey(key)
      ? service.getProjectLibraryUsage(key)
      : { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid project library key.', false) }
  ));
  ipcMain.handle(UNIFIED_LIBRARY_PROJECT_DELETE_PREVIEW_CHANNEL, (_event, key: unknown) => (
    isLibraryItemKey(key)
      ? service.previewProjectLibraryDelete(key)
      : { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid project library key.', false) }
  ));
  ipcMain.handle(UNIFIED_LIBRARY_PROJECT_DELETE_CHANNEL, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      return { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid project delete request.', false) };
    }
    const value = request as { key?: unknown; confirmationToken?: unknown };
    return isLibraryItemKey(value.key) && typeof value.confirmationToken === 'string'
      ? service.deleteProjectLibraryItem(value.key, value.confirmationToken)
      : { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid project delete request.', false) };
  });
  ipcMain.handle(UNIFIED_LIBRARY_TRANSFER_TO_USER_CHANNEL, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      return Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid Library transfer request.', false) });
    }
    const value = request as { source?: unknown; parentId?: unknown };
    return isLibraryTransferSourceReference(value.source) && typeof value.parentId === 'string'
      ? service.copyLibraryTransferToUser(value.source, value.parentId)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid Library transfer request.', false) });
  });
  ipcMain.handle(UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL, async () => {
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: OpenDialogOptions = {
      title: 'Import Java Blue Library XML',
      defaultPath: resolveWorkDirectoryDefaultPath(getWorkDirectory?.()),
      filters: [{ name: 'Java Blue Library XML', extensions: ['xml'] }],
      properties: ['openFile', 'multiSelections'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : service.previewManualImport(result.filePaths);
  });
  ipcMain.handle(UNIFIED_LIBRARY_IMPORT_DIRECTORY_CHANNEL, async () => {
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: OpenDialogOptions = {
      title: 'Import Java Blue Configuration Directory',
      defaultPath: resolveWorkDirectoryDefaultPath(getWorkDirectory?.()),
      properties: ['openDirectory'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const sourcePaths = Object.values(LEGACY_LIBRARY_FORMATS)
      .map((descriptor) => path.join(result.filePaths[0]!, descriptor.fileName))
      .filter((sourcePath) => fs.existsSync(sourcePath));
    return service.previewManualImport(sourcePaths);
  });
  ipcMain.handle(UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL, (_event, request: unknown) => (
    typeof request === 'object'
      && request !== null
      && typeof (request as { previewToken?: unknown }).previewToken === 'string'
      && isStringRecord((request as { folderSelections?: unknown }).folderSelections)
      ? service.executeManualImport(
          (request as { previewToken: string }).previewToken,
          (request as { folderSelections: Readonly<Record<string, string>> }).folderSelections,
        )
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid import preview.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL, async (_event, libraryType: unknown) => {
    if (!isLibraryType(libraryType)) return { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid library type.', false) };
    const names = { instrument: 'userInstrumentLibrary.xml', udo: 'udoLibrary.xml', effect: 'effectsLibrary.xml', soundObject: 'soundObjectLibrary.xml' } as const;
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: SaveDialogOptions = {
      title: `Export ${libraryType} Library`,
      defaultPath: resolveWorkDirectoryDefaultPath(getWorkDirectory?.(), names[libraryType]),
      filters: [{ name: 'Java Blue Library XML', extensions: ['xml'] }],
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    const exported = await service.exportCurrentLibrary(libraryType, result.filePath, async (preflight) => {
      const output = preflight.outputs[0]!;
      const confirmation = owner
        ? await dialog.showMessageBox(owner, {
            type: output.overwritesExisting ? 'warning' : 'info',
            buttons: ['Cancel', output.overwritesExisting ? 'Overwrite' : 'Export'],
            defaultId: 0,
            cancelId: 0,
            title: 'Review Library Export',
            message: output.overwritesExisting
              ? `“${path.basename(output.targetPath)}” will be replaced.`
              : `Export “${path.basename(output.targetPath)}”?`,
            detail: `Compatibility preflight passed for ${output.itemCount} items. ${output.unsupportedPreservedCount} unsupported items will be preserved unchanged. No content will be omitted.`,
          })
        : await dialog.showMessageBox({
            type: output.overwritesExisting ? 'warning' : 'info',
            buttons: ['Cancel', output.overwritesExisting ? 'Overwrite' : 'Export'],
            defaultId: 0, cancelId: 0, title: 'Review Library Export',
            message: output.overwritesExisting
              ? `“${path.basename(output.targetPath)}” will be replaced.`
              : `Export “${path.basename(output.targetPath)}”?`,
            detail: `Compatibility preflight passed for ${output.itemCount} items. ${output.unsupportedPreservedCount} unsupported items will be preserved unchanged. No content will be omitted.`,
          });
      return confirmation.response === 1;
    });
    return exported.ok && !exported.value ? null : exported;
  });
  ipcMain.handle(UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL, async () => {
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: OpenDialogOptions = {
      title: 'Export All Java Blue Libraries',
      defaultPath: resolveWorkDirectoryDefaultPath(getWorkDirectory?.()),
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const exported = await service.exportAllLibraries(result.filePaths[0], async (preflight) => {
      const existingNames = preflight.outputs
        .filter((output) => output.overwritesExisting)
        .map((output) => path.basename(output.targetPath));
      const itemCount = preflight.outputs.reduce((sum, output) => sum + output.itemCount, 0);
      const unsupportedCount = preflight.outputs.reduce((sum, output) => sum + output.unsupportedPreservedCount, 0);
      const messageOptions = {
        type: existingNames.length > 0 ? 'warning' as const : 'info' as const,
        buttons: ['Cancel', existingNames.length > 0 ? 'Overwrite All' : 'Export All'],
        defaultId: 0,
        cancelId: 0,
        title: 'Review Library Exports',
        message: existingNames.length > 0
          ? `${existingNames.length} library export ${existingNames.length === 1 ? 'file will be replaced' : 'files will be replaced'}.`
          : 'Export all four Java Blue libraries?',
        detail: `Compatibility preflight passed for all four files and ${itemCount} items. ${unsupportedCount} unsupported items will be preserved unchanged. No content will be omitted.${existingNames.length > 0 ? `\n\nReplace: ${existingNames.join(', ')}` : ''}`,
      };
      const confirmation = owner
        ? await dialog.showMessageBox(owner, messageOptions)
        : await dialog.showMessageBox(messageOptions);
      return confirmation.response === 1;
    });
    return exported.ok && !exported.value ? null : exported;
  });
  ipcMain.handle(UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL, () => service.retryRecovery());
  ipcMain.handle(UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL, async () => {
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: OpenDialogOptions = {
      title: 'Restore Unified Library Backup',
      defaultPath: resolveWorkDirectoryDefaultPath(getWorkDirectory?.()),
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
      properties: ['openFile'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0] ? null : service.restoreRecoveryBackup(result.filePaths[0]);
  });
  ipcMain.handle(UNIFIED_LIBRARY_RECOVERY_FRESH_CHANNEL, () => service.createFreshRecoveryDatabase());

  const send = (channel: string, payload: unknown): void => {
    for (const window of getWindows()) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    }
  };
  const removeSnapshot = service.onSnapshot((snapshot) => {
    send(UNIFIED_LIBRARY_SNAPSHOT_CHANGED_CHANNEL, snapshot);
  });
  const removeChanged = service.onChanged((event) => {
    send(UNIFIED_LIBRARY_CHANGED_CHANNEL, event);
  });
  const removeContext = service.onContext((context) => {
    send(UNIFIED_LIBRARY_CONTEXT_CHANGED_CHANNEL, context);
  });
  const removeEditor = service.onEditorSession((session) => {
    send(UNIFIED_LIBRARY_EDITOR_CHANGED_CHANNEL, session);
  });

  return () => {
    removeSnapshot();
    removeChanged();
    removeContext();
    removeEditor();
    ipcMain.removeHandler(UNIFIED_LIBRARY_GET_SNAPSHOT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_BROWSE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_SEARCH_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PREVIEW_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_BEGIN_DRAG_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_CANCEL_DRAG_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PREVIEW_TRANSFER_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_APPLY_TRANSFER_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_SET_CONTEXT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_CLEAR_TARGET_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PREVIEW_INSERTION_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_APPLY_INSERTION_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_MUTATE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PREPARE_MUTATION_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_CUT_TO_CLIPBOARD_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_SET_CLIPBOARD_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_CAPTURE_SCORE_SOUND_OBJECT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_CAPTURE_TRACK_INSTRUMENT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_CAPTURE_BLUE_LIVE_SOUND_OBJECT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_ADD_SCORE_SOUND_OBJECT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EDITOR_OPEN_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EDITOR_GET_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EDITOR_PATCH_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EDITOR_SAVE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EDITOR_REVERT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EDITOR_RESOLVE_CONFLICT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EDITOR_CLOSE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_DRAFT_SHUTDOWN_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_DRAFT_RESOLVE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PROJECT_USAGE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PROJECT_DELETE_PREVIEW_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PROJECT_DELETE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_TRANSFER_TO_USER_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_IMPORT_DIRECTORY_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_RECOVERY_FRESH_CHANNEL);
  };
}
