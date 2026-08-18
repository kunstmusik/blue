import { dialog, type BrowserWindow, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron';

export type EngineRecoveryDialogAction = 'restart' | 'diagnostics' | 'cancel';

export interface EngineRecoveryDialogActions {
  /** Restarts the engine activity after cleaning up current-owner and provably orphaned sessions. */
  onRestart: () => Promise<void> | void;
}

export interface EngineRecoveryDialogDependencies {
  showMessageBox?: (window: BrowserWindow, options: MessageBoxOptions) => Promise<MessageBoxReturnValue>;
}

/**
 * Presents the FR-016 recovery failure dialog with the Restart Audio Engine,
 * Show Diagnostics, and Cancel actions. Extracted from main.ts so the action
 * semantics are unit-testable.
 */
export async function showEngineRecoveryFailureDialog(
  window: BrowserWindow,
  errorMessage: string,
  diagnostics: string,
  actions: EngineRecoveryDialogActions,
  dependencies: EngineRecoveryDialogDependencies = {},
): Promise<EngineRecoveryDialogAction> {
  const showMessageBox =
    dependencies.showMessageBox ?? ((win, options) => dialog.showMessageBox(win, options));

  const result = await showMessageBox(window, {
    type: 'error',
    title: 'Audio Engine Recovery Failed',
    message: 'Audio Engine Recovery Failed',
    detail: errorMessage,
    buttons: ['Restart Audio Engine', 'Show Diagnostics', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });

  if (result.response === 0) {
    await actions.onRestart();
    return 'restart';
  }

  if (result.response === 1) {
    await showMessageBox(window, {
      type: 'info',
      title: 'Audio Engine Diagnostics',
      message: 'Audio Engine Diagnostic Log',
      detail: diagnostics,
      buttons: ['Close'],
      defaultId: 0,
    });
    return 'diagnostics';
  }

  return 'cancel';
}
