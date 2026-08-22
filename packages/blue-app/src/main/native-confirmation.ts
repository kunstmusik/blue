import { BrowserWindow, dialog, MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import {
  createSafeCancellationResult,
  NativeConfirmationRequest,
  NativeConfirmationResult,
  validateNativeConfirmationRequest,
} from '../shared/confirmation-dialog';

export interface NativeConfirmationDialogSeam {
  showMessageBox(browserWindow: BrowserWindow, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;
}

export const defaultElectronDialogSeam: NativeConfirmationDialogSeam = {
  showMessageBox(browserWindow: BrowserWindow, options: MessageBoxOptions) {
    return dialog.showMessageBox(browserWindow, options);
  },
};

export async function showNativeConfirmation(
  owner: BrowserWindow | null | undefined,
  rawRequest: unknown,
  dialogSeam: NativeConfirmationDialogSeam = defaultElectronDialogSeam,
): Promise<NativeConfirmationResult> {
  const validation = validateNativeConfirmationRequest(rawRequest);
  if (!validation.valid || !validation.value) {
    return createSafeCancellationResult(null, 'failed');
  }

  const request = validation.value;

  if (!owner || owner.isDestroyed()) {
    return createSafeCancellationResult(request, 'owner-unavailable');
  }

  const buttons = request.actions.map((action) => action.label);
  const defaultIndex = request.actions.findIndex((action) => action.id === request.defaultActionId);
  const cancelIndex = request.actions.findIndex((action) => action.id === request.cancelActionId);

  const options: MessageBoxOptions = {
    type: request.type,
    title: request.title,
    message: request.message,
    buttons,
    defaultId: defaultIndex >= 0 ? defaultIndex : 0,
    cancelId: cancelIndex >= 0 ? cancelIndex : (buttons.length > 1 ? 1 : 0),
  };

  if (request.detail !== undefined) {
    options.detail = request.detail;
  }
  if (request.noLink !== undefined) {
    options.noLink = request.noLink;
  }
  if (request.checkbox) {
    options.checkboxLabel = request.checkbox.label;
    options.checkboxChecked = Boolean(request.checkbox.checked);
  }

  try {
    const result = await dialogSeam.showMessageBox(owner, options);
    const responseIndex = result.response;

    if (responseIndex < 0 || responseIndex >= request.actions.length) {
      return createSafeCancellationResult(request, 'dismissed');
    }

    const selectedAction = request.actions[responseIndex];
    const outcome = selectedAction.id === request.cancelActionId ? 'dismissed' : 'selected';

    const confirmationResult: NativeConfirmationResult = {
      actionId: selectedAction.id,
      outcome,
    };

    if (request.checkbox !== undefined) {
      confirmationResult.checkboxChecked = Boolean(result.checkboxChecked);
    }

    return confirmationResult;
  } catch (_err) {
    return createSafeCancellationResult(request, 'failed');
  }
}
