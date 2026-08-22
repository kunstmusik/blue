import type { BrowserWindow } from 'electron';
import { NativeConfirmationDialogSeam, showNativeConfirmation } from './native-confirmation';

export type EngineRecoveryDialogAction = 'restart' | 'diagnostics' | 'cancel';

export interface EngineRecoveryDialogActions {
  /** Restarts the engine activity after cleaning up current-owner and provably orphaned sessions. */
  onRestart: () => Promise<void> | void;
}

export interface EngineRecoveryDialogDependencies {
  dialogSeam?: NativeConfirmationDialogSeam;
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
  const result = await showNativeConfirmation(
    window,
    {
      id: 'engine-recovery-failure',
      type: 'error',
      title: 'Audio Engine Recovery Failed',
      message: 'Audio Engine Recovery Failed',
      detail: errorMessage,
      actions: [
        { id: 'restart', label: 'Restart Audio Engine', role: 'accept' },
        { id: 'diagnostics', label: 'Show Diagnostics', role: 'secondary' },
        { id: 'cancel', label: 'Cancel', role: 'cancel' },
      ],
      defaultActionId: 'restart',
      cancelActionId: 'cancel',
    },
    dependencies.dialogSeam,
  );

  if (result.actionId === 'restart' && result.outcome === 'selected') {
    await actions.onRestart();
    return 'restart';
  }

  if (result.actionId === 'diagnostics' && result.outcome === 'selected') {
    await showNativeConfirmation(
      window,
      {
        id: 'engine-recovery-diagnostics',
        type: 'info',
        title: 'Audio Engine Diagnostics',
        message: 'Audio Engine Diagnostic Log',
        detail: diagnostics,
        actions: [{ id: 'close', label: 'Close', role: 'accept' }],
        defaultActionId: 'close',
        cancelActionId: 'close',
      },
      dependencies.dialogSeam,
    );
    return 'diagnostics';
  }

  return 'cancel';
}
