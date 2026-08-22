import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import { showEngineRecoveryFailureDialog } from './engine-recovery-dialog';
import type { NativeConfirmationDialogSeam } from './native-confirmation';

const windowStub = {
  isDestroyed: () => false,
} as unknown as BrowserWindow;

function makeDialogSeam(responses: number[]) {
  const shownOptions: MessageBoxOptions[] = [];
  let index = 0;
  const showMessageBox = vi.fn(
    async (_window: BrowserWindow, options: MessageBoxOptions): Promise<MessageBoxReturnValue> => {
      shownOptions.push(options);
      const response = responses[Math.min(index, responses.length - 1)];
      index++;
      return { response } as MessageBoxReturnValue;
    },
  );
  const dialogSeam: NativeConfirmationDialogSeam = { showMessageBox };
  return { dialogSeam, shownOptions, showMessageBox };
}

describe('showEngineRecoveryFailureDialog actions', () => {
  it('offers Restart Audio Engine, Show Diagnostics, and Cancel', async () => {
    const { dialogSeam, shownOptions } = makeDialogSeam([2]);

    const action = await showEngineRecoveryFailureDialog(
      windowStub,
      'engine failed',
      'diagnostic detail',
      { onRestart: vi.fn() },
      { dialogSeam },
    );

    expect(action).toBe('cancel');
    expect(shownOptions[0].buttons).toEqual(['Restart Audio Engine', 'Show Diagnostics', 'Cancel']);
    expect(shownOptions[0].detail).toBe('engine failed');
  });

  it('invokes the restart action exactly once and shows no diagnostics dialog', async () => {
    const { dialogSeam, shownOptions } = makeDialogSeam([0]);
    const onRestart = vi.fn(async () => {});

    const action = await showEngineRecoveryFailureDialog(
      windowStub,
      'engine failed',
      'diagnostic detail',
      { onRestart },
      { dialogSeam },
    );

    expect(action).toBe('restart');
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(shownOptions).toHaveLength(1);
  });

  it('shows the diagnostics log with the provided detail and does not restart', async () => {
    const { dialogSeam, shownOptions } = makeDialogSeam([1]);
    const onRestart = vi.fn(async () => {});

    const action = await showEngineRecoveryFailureDialog(
      windowStub,
      'engine failed',
      'structured diagnostic detail',
      { onRestart },
      { dialogSeam },
    );

    expect(action).toBe('diagnostics');
    expect(onRestart).not.toHaveBeenCalled();
    expect(shownOptions).toHaveLength(2);
    expect(shownOptions[1].type).toBe('info');
    expect(shownOptions[1].detail).toBe('structured diagnostic detail');
  });

  it('takes no action on Cancel or dialog dismissal', async () => {
    for (const dismissResponse of [2, 2]) {
      const { dialogSeam, shownOptions } = makeDialogSeam([dismissResponse]);
      const onRestart = vi.fn(async () => {});

      const action = await showEngineRecoveryFailureDialog(
        windowStub,
        'engine failed',
        'diagnostic detail',
        { onRestart },
        { dialogSeam },
      );

      expect(action).toBe('cancel');
      expect(onRestart).not.toHaveBeenCalled();
      expect(shownOptions).toHaveLength(1);
    }
  });
});
