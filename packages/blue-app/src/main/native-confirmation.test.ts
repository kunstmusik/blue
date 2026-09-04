import { BrowserWindow, MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeConfirmationRequest } from '../shared/confirmation-dialog';
import { NativeConfirmationDialogSeam, showNativeConfirmation } from './native-confirmation';

describe('native-confirmation adapter', () => {
  let mockWindow: BrowserWindow;
  let mockSeam: NativeConfirmationDialogSeam;
  let showMessageBoxMock: ReturnType<typeof vi.fn<NativeConfirmationDialogSeam['showMessageBox']>>;

  const sampleRequest: NativeConfirmationRequest = {
    id: 'test-prompt',
    type: 'question',
    title: 'Confirm Delete',
    message: 'Are you sure you want to delete this item?',
    detail: 'This cannot be undone.',
    actions: [
      { id: 'delete', label: 'Delete Item', role: 'destructive' },
      { id: 'archive', label: 'Archive Instead', role: 'secondary' },
      { id: 'cancel', label: 'Cancel', role: 'cancel' },
    ],
    defaultActionId: 'cancel',
    cancelActionId: 'cancel',
    checkbox: {
      label: 'Apply to all items',
      checked: true,
    },
  };

  beforeEach(() => {
    mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as BrowserWindow;

    showMessageBoxMock = vi.fn().mockResolvedValue({
      response: 0,
      checkboxChecked: true,
    } as MessageBoxReturnValue);

    mockSeam = {
      showMessageBox: showMessageBoxMock,
    };
  });

  it('maps semantic actions to button labels, defaultId, and cancelId correctly', async () => {
    const result = await showNativeConfirmation(mockWindow, sampleRequest, mockSeam);

    expect(showMessageBoxMock).toHaveBeenCalledTimes(1);
    expect(mockWindow.isDestroyed).toHaveBeenCalled();

    const [passedWindow, options] = showMessageBoxMock.mock.calls[0] as [
      BrowserWindow,
      MessageBoxOptions,
    ];
    expect(passedWindow).toBe(mockWindow);
    expect(options.type).toBe('question');
    expect(options.title).toBe('Confirm Delete');
    expect(options.message).toBe('Are you sure you want to delete this item?');
    expect(options.detail).toBe('This cannot be undone.');
    expect(options.buttons).toEqual(['Delete Item', 'Archive Instead', 'Cancel']);
    expect(options.defaultId).toBe(2); // index of 'cancel'
    expect(options.cancelId).toBe(2); // index of 'cancel'
    expect(options.checkboxLabel).toBe('Apply to all items');
    expect(options.checkboxChecked).toBe(true);

    expect(result).toEqual({
      actionId: 'delete',
      outcome: 'selected',
      checkboxChecked: true,
    });
  });

  it('maps middle action response to semantic actionId', async () => {
    showMessageBoxMock.mockResolvedValueOnce({
      response: 1, // 'archive'
      checkboxChecked: false,
    });

    const result = await showNativeConfirmation(mockWindow, sampleRequest, mockSeam);
    expect(result).toEqual({
      actionId: 'archive',
      outcome: 'selected',
      checkboxChecked: false,
    });
  });

  it('maps cancel action response to dismissed outcome', async () => {
    showMessageBoxMock.mockResolvedValueOnce({
      response: 2, // 'cancel'
      checkboxChecked: false,
    });

    const result = await showNativeConfirmation(mockWindow, sampleRequest, mockSeam);
    expect(result).toEqual({
      actionId: 'cancel',
      outcome: 'dismissed',
      checkboxChecked: false,
    });
  });

  it('handles out of range response index safely as dismissal', async () => {
    showMessageBoxMock.mockResolvedValueOnce({
      response: -1,
      checkboxChecked: false,
    });

    const result = await showNativeConfirmation(mockWindow, sampleRequest, mockSeam);
    expect(result).toEqual({
      actionId: 'cancel',
      outcome: 'dismissed',
      checkboxChecked: true,
    });
  });

  it('returns owner-unavailable when owner is null, undefined, or destroyed', async () => {
    const nullOwnerResult = await showNativeConfirmation(null, sampleRequest, mockSeam);
    expect(nullOwnerResult).toEqual({
      actionId: 'cancel',
      outcome: 'owner-unavailable',
      checkboxChecked: true,
    });
    expect(showMessageBoxMock).not.toHaveBeenCalled();

    const destroyedWindow = {
      isDestroyed: vi.fn().mockReturnValue(true),
    } as unknown as BrowserWindow;

    const destroyedResult = await showNativeConfirmation(destroyedWindow, sampleRequest, mockSeam);
    expect(destroyedResult).toEqual({
      actionId: 'cancel',
      outcome: 'owner-unavailable',
      checkboxChecked: true,
    });
    expect(showMessageBoxMock).not.toHaveBeenCalled();
  });

  it('handles dialog rejection/error safely as failed outcome without throwing', async () => {
    showMessageBoxMock.mockRejectedValueOnce(new Error('IPC Disconnected'));

    const result = await showNativeConfirmation(mockWindow, sampleRequest, mockSeam);
    expect(result).toEqual({
      actionId: 'cancel',
      outcome: 'failed',
      checkboxChecked: true,
    });
  });

  it('handles invalid request payload safely as failed outcome', async () => {
    const invalidRequest = { id: '', message: '' };
    const result = await showNativeConfirmation(mockWindow, invalidRequest, mockSeam);
    expect(result).toEqual({
      actionId: 'cancel',
      outcome: 'failed',
    });
    expect(showMessageBoxMock).not.toHaveBeenCalled();
  });
});
