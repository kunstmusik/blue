import { dialog, type BrowserWindow, type IpcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import {
  UNIFIED_LIBRARY_BROWSE_CHANNEL,
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
  UNIFIED_LIBRARY_PROJECT_COPY_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_DELETE_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_DELETE_PREVIEW_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_USAGE_CHANNEL,
  UNIFIED_LIBRARY_GET_MIGRATION_SUMMARY_CHANNEL,
  UNIFIED_LIBRARY_HISTORY_CHANNEL,
  UNIFIED_LIBRARY_MIGRATION_SUMMARY_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_UNDO_CHANNEL,
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
  isConfirmedLibraryInsertionRequest,
  isLibraryContextRequest,
  isLibraryInsertionRequest,
  isLibraryItemKey,
  isLibraryEditorPatchRequest,
  isLibraryEditorConflictRequest,
  isOpenLibraryEditorRequest,
  isSearchLibrariesRequest,
  isUserLibraryMutation,
  isLibraryType,
} from '../../shared/unified-library';
import { UnifiedLibraryService } from './service';

export interface UnifiedLibraryIpcOptions {
  readonly ipcMain: IpcMain;
  readonly service: UnifiedLibraryService;
  readonly getWindows: () => readonly BrowserWindow[];
}

export function registerUnifiedLibraryIpc(options: UnifiedLibraryIpcOptions): () => void {
  const { ipcMain, service, getWindows } = options;
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
  ipcMain.handle(UNIFIED_LIBRARY_PROJECT_COPY_CHANNEL, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      return Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid project copy request.', false) });
    }
    const value = request as { key?: unknown; parentId?: unknown };
    return isLibraryItemKey(value.key) && typeof value.parentId === 'string'
      ? service.copyProjectLibraryItemToUser(value.key, value.parentId)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid project copy request.', false) });
  });
  ipcMain.handle(UNIFIED_LIBRARY_GET_MIGRATION_SUMMARY_CHANNEL, () => service.getMigrationSummary());
  ipcMain.handle(UNIFIED_LIBRARY_HISTORY_CHANNEL, (_event, limit: unknown) => (
    service.getImportHistory(typeof limit === 'number' ? limit : 100)
  ));
  ipcMain.handle(UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL, async () => {
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: OpenDialogOptions = {
      title: 'Import Java Blue Library XML',
      filters: [{ name: 'Java Blue Library XML', extensions: ['xml'] }],
      properties: ['openFile', 'multiSelections'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : service.previewManualImport(result.filePaths);
  });
  ipcMain.handle(UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL, (_event, previewToken: unknown) => (
    typeof previewToken === 'string'
      ? service.executeManualImport(previewToken)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid import preview.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_IMPORT_UNDO_CHANNEL, (_event, batchId: unknown) => (
    typeof batchId === 'string'
      ? service.undoManualImport(batchId)
      : Promise.resolve({ ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid import batch.', false) })
  ));
  ipcMain.handle(UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL, async (_event, libraryType: unknown) => {
    if (!isLibraryType(libraryType)) return { ok: false as const, error: createLibraryServiceError('invalid-request', 'Invalid library type.', false) };
    const names = { instrument: 'userInstrumentLibrary.xml', udo: 'udoLibrary.xml', effect: 'effectsLibrary.xml', soundObject: 'soundObjectLibrary.xml' } as const;
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: SaveDialogOptions = {
      title: `Export ${libraryType} Library`, defaultPath: names[libraryType],
      filters: [{ name: 'Java Blue Library XML', extensions: ['xml'] }],
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : service.exportCurrentLibrary(libraryType, result.filePath);
  });
  ipcMain.handle(UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL, async () => {
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: OpenDialogOptions = {
      title: 'Export All Java Blue Libraries', properties: ['openDirectory', 'createDirectory'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0] ? null : service.exportAllLibraries(result.filePaths[0]);
  });
  ipcMain.handle(UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL, () => service.retryRecovery());
  ipcMain.handle(UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL, async () => {
    const owner = getWindows().find((window) => !window.isDestroyed());
    const options: OpenDialogOptions = {
      title: 'Restore Unified Library Backup',
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
  const removeMigration = service.onMigrationSummary((summary) => {
    send(UNIFIED_LIBRARY_MIGRATION_SUMMARY_CHANNEL, summary);
  });

  return () => {
    removeSnapshot();
    removeChanged();
    removeContext();
    removeEditor();
    removeMigration();
    ipcMain.removeHandler(UNIFIED_LIBRARY_GET_SNAPSHOT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_BROWSE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_SEARCH_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PREVIEW_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_SET_CONTEXT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_CLEAR_TARGET_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_PREVIEW_INSERTION_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_APPLY_INSERTION_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_MUTATE_CHANNEL);
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
    ipcMain.removeHandler(UNIFIED_LIBRARY_PROJECT_COPY_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_GET_MIGRATION_SUMMARY_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_HISTORY_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_IMPORT_UNDO_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL);
    ipcMain.removeHandler(UNIFIED_LIBRARY_RECOVERY_FRESH_CHANNEL);
  };
}
