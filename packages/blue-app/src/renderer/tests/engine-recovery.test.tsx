// @vitest-environment jsdom

import React, { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useIPCListeners } from '../hooks/use-ipc-listeners';
import type { EngineRecoveryStatus } from '../../shared/engine-recovery';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

function ListenerHarness(): React.JSX.Element {
  useIPCListeners();
  return <div data-testid="listener-harness" />;
}

describe('Engine recovery renderer toast notifications', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  it('transitions from loading to success toast with matching operation ID', async () => {
    let recoveryCallback: ((status: EngineRecoveryStatus) => void) | null = null;
    const unsub = vi.fn();

    (window as any).blueAPI = {
      onProjectLoaded: () => () => {},
      onProjectClosed: () => () => {},
      onPlaybackStatus: () => () => {},
      onPlaybackClock: () => () => {},
      onPlaybackError: () => () => {},
      onNativeMenuCommand: () => () => {},
      onSaveComplete: () => () => {},
      onSaveError: () => () => {},
      onEngineOutput: () => () => {},
      onEngineOutputSelect: () => () => {},
      onEngineOutputReset: () => () => {},
      onRenderOperationStatus: () => () => {},
      onGeneratedCsd: () => () => {},
      onGeneratedCsdError: () => () => {},
      onBlueLiveStatus: () => () => {},
      onProjectDocumentUpdated: () => () => {},
      onEngineRecoveryStatus: (cb: (status: EngineRecoveryStatus) => void) => {
        recoveryCallback = cb;
        return unsub;
      },
    };

    await act(async () => {
      root?.render(
        <StrictMode>
          <ListenerHarness />
        </StrictMode>,
      );
    });

    expect(recoveryCallback).not.toBeNull();

    // 1. Recovering phase
    await act(async () => {
      recoveryCallback!({
        operationId: 'op-recovery-123',
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: 1,
        message: 'Recovering audio engine...',
        failureCategory: 'address-contention',
      });
    });

    expect(toast.loading).toHaveBeenCalledWith('Recovering audio engine...', {
      id: 'op-recovery-123',
    });

    // 2. Recovered phase
    await act(async () => {
      recoveryCallback!({
        operationId: 'op-recovery-123',
        sessionKind: 'realtime',
        phase: 'recovered',
        attempt: 1,
        message: 'Audio engine recovered',
      });
    });

    expect(toast.success).toHaveBeenCalledWith('Audio engine recovered', {
      id: 'op-recovery-123',
    });
  });

  it('transitions from loading to error toast on recovery failure', async () => {
    let recoveryCallback: ((status: EngineRecoveryStatus) => void) | null = null;

    (window as any).blueAPI = {
      onProjectLoaded: () => () => {},
      onProjectClosed: () => () => {},
      onPlaybackStatus: () => () => {},
      onPlaybackClock: () => () => {},
      onPlaybackError: () => () => {},
      onNativeMenuCommand: () => () => {},
      onSaveComplete: () => () => {},
      onSaveError: () => () => {},
      onEngineOutput: () => () => {},
      onEngineOutputSelect: () => () => {},
      onEngineOutputReset: () => () => {},
      onRenderOperationStatus: () => () => {},
      onGeneratedCsd: () => () => {},
      onGeneratedCsdError: () => () => {},
      onBlueLiveStatus: () => () => {},
      onProjectDocumentUpdated: () => () => {},
      onEngineRecoveryStatus: (cb: (status: EngineRecoveryStatus) => void) => {
        recoveryCallback = cb;
        return () => {};
      },
    };

    await act(async () => {
      root?.render(
        <StrictMode>
          <ListenerHarness />
        </StrictMode>,
      );
    });

    await act(async () => {
      recoveryCallback!({
        operationId: 'op-failed-456',
        sessionKind: 'realtime',
        phase: 'failed',
        attempt: 1,
        message: 'Audio engine recovery failed: timeout',
        failureCategory: 'readiness-timeout',
      });
    });

    expect(toast.error).toHaveBeenCalledWith('Audio engine recovery failed: timeout', {
      id: 'op-failed-456',
    });
  });
});
