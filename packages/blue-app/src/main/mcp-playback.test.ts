import { describe, expect, it, vi } from 'vite-plus/test';
import { BlueData } from '@blue/data';
import type { McpAccessMode } from '../shared/mcp-server';
import type { McpAuthContext, McpDocumentReceipt } from './mcp-bridge';
import {
  createGuardedMcpPlaybackController,
  runGuardedPlaybackSequence,
  type McpPlaybackConfirmationOutcome,
} from './mcp-playback';
import { ProjectHistory } from './project-history';
import { ProjectSession } from './project-session';

function createPlaybackHarness() {
  const session = new ProjectSession();
  const initialData = new BlueData();
  session.replace(initialData, '/tmp/playback-test.blue');
  const history = new ProjectHistory({
    session,
    publishUpdated: () => undefined,
    retainedEntryLimit: 20,
  });

  let engineAvailable = true;
  let currentlyPlaying = false;
  let playingDocumentId: string | null = null;
  let listenerGeneration = 1;
  let credentialEpoch = 1;
  let accessMode: McpAccessMode = 'read-write';
  let confirmationOutcome: McpPlaybackConfirmationOutcome = 'approved';
  let confirmHook: (() => Promise<McpPlaybackConfirmationOutcome>) | null = null;
  let startPlaybackHook:
    | ((fence: {
        check: () => unknown;
      }) => Promise<{ ok: true; value: undefined } | { ok: false; code: any; message: string }>)
    | null = null;

  const confirmSpy = vi.fn(async () => {
    if (confirmHook) return confirmHook();
    return confirmationOutcome;
  });

  const dispatchPlaySpy = vi.fn(async () => {
    currentlyPlaying = true;
    playingDocumentId = session.read().documentId;
  });

  const stopSpy = vi.fn(async () => {
    currentlyPlaying = false;
    playingDocumentId = null;
  });

  const currentReceipt = (): McpDocumentReceipt | null => {
    const snap = session.read();
    if (!snap.data || !snap.documentId || !snap.stateId) return null;
    return {
      documentId: snap.documentId,
      revision: snap.revision,
      stateId: snap.stateId,
    };
  };

  const makeAuth = (overrides: Partial<McpAuthContext> = {}): McpAuthContext => {
    const capturedGen = listenerGeneration;
    const capturedEpoch = credentialEpoch;
    const signal = overrides.signal ?? new AbortController().signal;
    return {
      listenerGeneration: capturedGen,
      credentialEpoch: capturedEpoch,
      accessMode,
      action: 'runtime',
      signal,
      isAuthorized: () =>
        !signal.aborted &&
        capturedGen === listenerGeneration &&
        capturedEpoch === credentialEpoch &&
        accessMode === 'read-write',
      ...overrides,
    };
  };

  const controller = createGuardedMcpPlaybackController({
    getCurrentReceipt: currentReceipt,
    isEngineAvailable: () => engineAvailable,
    isCurrentlyPlaying: () => currentlyPlaying,
    getPlayingDocumentId: () => playingDocumentId,
    isLoopAuthorityCurrent: (grant) =>
      grant.listenerGeneration === listenerGeneration &&
      grant.credentialEpoch === credentialEpoch &&
      accessMode === 'read-write',
    confirmPlayback: confirmSpy,
    startPlayback: async (fence) => {
      if (startPlaybackHook) {
        return startPlaybackHook(fence) as Promise<{ ok: true; value: undefined }>;
      }
      const gate = fence.check();
      if (!gate.ok) return gate;
      await dispatchPlaySpy();
      return { ok: true, value: undefined };
    },
    stopPlayback: stopSpy,
  });

  return {
    session,
    history,
    controller,
    confirmSpy,
    dispatchPlaySpy,
    stopSpy,
    currentReceipt,
    makeAuth,
    setEngineAvailable: (next: boolean) => {
      engineAvailable = next;
    },
    setCurrentlyPlaying: (playing: boolean, docId: string | null) => {
      currentlyPlaying = playing;
      playingDocumentId = docId;
    },
    setConfirmationOutcome: (outcome: McpPlaybackConfirmationOutcome) => {
      confirmationOutcome = outcome;
    },
    setConfirmHook: (fn: (() => Promise<McpPlaybackConfirmationOutcome>) | null) => {
      confirmHook = fn;
    },
    setStartPlaybackHook: (fn: typeof startPlaybackHook) => {
      startPlaybackHook = fn;
    },
    setAccessMode: (mode: McpAccessMode) => {
      accessMode = mode;
    },
    rotateToken: () => {
      credentialEpoch += 1;
    },
    bumpGeneration: () => {
      listenerGeneration += 1;
    },
  };
}

describe('createGuardedMcpPlaybackController', () => {
  it('requires local approval, handles decline/cancel without starting, and never writes ProjectHistory', async () => {
    const h = createPlaybackHarness();
    const receipt = h.currentReceipt()!;
    const beforeXml = h.session.read().data!.saveToString();

    h.setConfirmationOutcome('declined');
    const declined = await h.controller.transportPlay(h.makeAuth(), receipt);
    expect(declined).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    expect(h.dispatchPlaySpy).not.toHaveBeenCalled();

    h.setConfirmationOutcome('owner-unavailable');
    const noOwner = await h.controller.transportPlay(h.makeAuth(), receipt);
    expect(noOwner).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    expect(h.dispatchPlaySpy).not.toHaveBeenCalled();

    const abortController = new AbortController();
    h.setConfirmHook(async () => {
      abortController.abort();
      return 'cancelled';
    });
    const cancelled = await h.controller.transportPlay(
      h.makeAuth({ signal: abortController.signal }),
      receipt,
    );
    expect(cancelled).toMatchObject({ ok: false, code: 'CANCELLED' });
    expect(h.dispatchPlaySpy).not.toHaveBeenCalled();

    h.setConfirmHook(null);
    h.setConfirmationOutcome('approved');
    const started = await h.controller.transportPlay(h.makeAuth(), receipt);
    expect(started).toEqual({
      ok: true,
      value: { receipt, status: 'started', playing: true },
    });
    expect(h.dispatchPlaySpy).toHaveBeenCalledTimes(1);

    // Idempotent play when already playing same project (no second confirmation)
    const alreadyPlaying = await h.controller.transportPlay(h.makeAuth(), receipt);
    expect(alreadyPlaying).toEqual({
      ok: true,
      value: { receipt, status: 'already_playing', playing: true },
    });
    expect(h.confirmSpy).toHaveBeenCalledTimes(4);

    expect(h.history.read().canUndo).toBe(false);
    expect(h.history.read().canRedo).toBe(false);
    expect(h.currentReceipt()).toEqual(receipt);
    expect(h.session.read().data!.saveToString()).toBe(beforeXml);
  });

  it('fences project replacement, delayed CSD/setup/retry, token revocation, and mode changes', async () => {
    const h = createPlaybackHarness();
    const initialReceipt = h.currentReceipt()!;

    // 1. Project replaced while awaiting confirmation
    h.setConfirmHook(async () => {
      h.session.replace(new BlueData(), '/tmp/other.blue');
      return 'approved';
    });
    const replacedDuringConfirm = await h.controller.transportPlay(h.makeAuth(), initialReceipt);
    expect(replacedDuringConfirm).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(h.dispatchPlaySpy).not.toHaveBeenCalled();

    // 2. Token rotated during delayed engine retry
    const receipt2 = h.currentReceipt()!;
    h.setConfirmHook(null);
    h.setConfirmationOutcome('approved');
    const auth2 = h.makeAuth();
    h.setStartPlaybackHook(async (fence) => {
      // Simulate async CSD generation -> still valid
      expect(fence.check()).toMatchObject({ ok: true });
      // Simulate token revocation before retry dispatch
      h.rotateToken();
      const afterRevoke = fence.check() as { ok: false; code: string; message: string };
      expect(afterRevoke.ok).toBe(false);
      expect(afterRevoke.code).toBe('ACCESS_DENIED');
      return afterRevoke;
    });
    const revokedBeforeDispatch = await h.controller.transportPlay(auth2, receipt2);
    expect(revokedBeforeDispatch).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    expect(h.dispatchPlaySpy).not.toHaveBeenCalled();

    // 3. Access mode changed to read-only during delayed setup
    const auth3 = h.makeAuth();
    h.setStartPlaybackHook(async (fence) => {
      h.setAccessMode('read-only');
      return fence.check() as { ok: false; code: string; message: string };
    });
    const modeChanged = await h.controller.transportPlay(auth3, receipt2);
    expect(modeChanged).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    expect(h.dispatchPlaySpy).not.toHaveBeenCalled();
  });

  it('fences automatic loop restarts permanently per MCP performance origin while preserving ordinary UI loops (T051)', async () => {
    const h = createPlaybackHarness();
    const receipt = h.currentReceipt()!;
    const requestAbort = new AbortController();
    const auth = h.makeAuth({ signal: requestAbort.signal });

    const started = await h.controller.transportPlay(auth, receipt);
    expect(started.ok).toBe(true);
    expect(h.controller.canRestartLoopPlayback()).toBe(true);
    expect(h.controller.createLoopRestartFence()).toBeDefined();

    // Completing the stateless HTTP request signal alone does not kill loop authority
    requestAbort.abort();
    expect(h.controller.canRestartLoopPlayback()).toBe(true);

    // Revoking token stops future loop restarts on repeated checks without reverting to UI loop
    h.rotateToken();
    expect(h.controller.canRestartLoopPlayback()).toBe(false);
    expect(h.controller.canRestartLoopPlayback()).toBe(false);
    expect(h.controller.createLoopRestartFence()?.check()).toMatchObject({
      ok: false,
      code: 'ACCESS_DENIED',
    });
    expect(h.stopSpy).not.toHaveBeenCalled();

    // Post-start authority expiry (e.g. token rotated right after playCSD succeeded)
    // still returns 'started' but permanently marks the started performance revoked for looping
    h.setCurrentlyPlaying(false, null);
    let lateAuthValid = true;
    const lateExpireAuth = h.makeAuth({ isAuthorized: () => lateAuthValid });
    h.setStartPlaybackHook(async (fence) => {
      expect(fence.check().ok).toBe(true);
      await h.dispatchPlaySpy();
      lateAuthValid = false;
      return { ok: true, value: undefined };
    });
    const startedWithLateExpiry = await h.controller.transportPlay(lateExpireAuth, receipt);
    expect(startedWithLateExpiry).toEqual({
      ok: true,
      value: { receipt, status: 'started', playing: true },
    });
    expect(h.controller.canRestartLoopPlayback()).toBe(false);
    expect(h.controller.canRestartLoopPlayback()).toBe(false);
    h.setStartPlaybackHook(null);

    // Re-authorize and start again; mode switch to read-only blocks repeated loop restart checks
    h.setCurrentlyPlaying(false, null);
    expect((await h.controller.transportPlay(h.makeAuth(), receipt)).ok).toBe(true);
    h.setAccessMode('read-only');
    expect(h.controller.canRestartLoopPlayback()).toBe(false);
    expect(h.controller.canRestartLoopPlayback()).toBe(false);
    expect(h.stopSpy).not.toHaveBeenCalled();

    // Re-authorize and start again; project mutation/replacement blocks repeated loop restart checks
    h.setAccessMode('read-write');
    h.setCurrentlyPlaying(false, null);
    expect((await h.controller.transportPlay(h.makeAuth(), receipt)).ok).toBe(true);
    h.session.recordMutation({ changed: true });
    expect(h.controller.canRestartLoopPlayback()).toBe(false);
    expect(h.controller.canRestartLoopPlayback()).toBe(false);

    // Non-MCP (UI) playback has no MCP grant/fence and always loops
    h.controller.clearMcpPlaybackGrant();
    expect(h.controller.canRestartLoopPlayback()).toBe(true);
    expect(h.controller.createLoopRestartFence()).toBeUndefined();
  });

  it('aborts guarded playback preparation before project on-load, CSD generation, or dispatch/retry when revoked or stale (T050)', async () => {
    const h = createPlaybackHarness();
    const receipt = h.currentReceipt()!;

    const confirmed = await h.controller.transportPlay(h.makeAuth(), receipt);
    expect(confirmed.ok).toBe(true);
    const loopFence = h.controller.createLoopRestartFence()!;

    // 1. Revoked during prepareRuntime -> never calls runProjectOnLoad, generateRealtimeCsd, or dispatch
    const onLoadSpy1 = vi.fn(async () => null);
    const csdSpy1 = vi.fn(async () => 'csd');
    const dispatchSpy1 = vi.fn(async () => true);
    const aborted1 = await runGuardedPlaybackSequence(
      {
        prepareRuntime: async () => {
          h.rotateToken();
          return true;
        },
        runProjectOnLoad: onLoadSpy1,
        generateRealtimeCsd: csdSpy1,
        dispatchAndRecover: dispatchSpy1,
      },
      loopFence,
    );
    expect(aborted1).toBe(false);
    expect(onLoadSpy1).not.toHaveBeenCalled();
    expect(csdSpy1).not.toHaveBeenCalled();
    expect(dispatchSpy1).not.toHaveBeenCalled();

    // 2. Stale receipt after runProjectOnLoad -> never calls generateRealtimeCsd or dispatch
    const h2 = createPlaybackHarness();
    const receipt2 = h2.currentReceipt()!;
    h2.setConfirmationOutcome('approved');
    const auth2 = h2.makeAuth();
    let capturedFence!: { check: () => { ok: boolean } };
    h2.setStartPlaybackHook(async (fence) => {
      capturedFence = fence;
      const csdSpy2 = vi.fn(async () => 'csd');
      const dispatchSpy2 = vi.fn(async () => true);
      const res = await runGuardedPlaybackSequence(
        {
          prepareRuntime: async () => true,
          runProjectOnLoad: async () => {
            h2.session.recordMutation({ changed: true });
            return null;
          },
          generateRealtimeCsd: csdSpy2,
          dispatchAndRecover: dispatchSpy2,
        },
        fence,
      );
      expect(res).toBe(false);
      expect(csdSpy2).not.toHaveBeenCalled();
      expect(dispatchSpy2).not.toHaveBeenCalled();
      return fence.check() as { ok: false; code: 'CONFLICT'; message: string };
    });
    const staleDuringSetup = await h2.controller.transportPlay(auth2, receipt2);
    expect(staleDuringSetup).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(capturedFence.check().ok).toBe(false);

    // 3. Revoked during generateRealtimeCsd -> never dispatches or retries to engine
    const h3 = createPlaybackHarness();
    const receipt3 = h3.currentReceipt()!;
    h3.setStartPlaybackHook(async (fence) => {
      const dispatchSpy3 = vi.fn(async () => true);
      const res = await runGuardedPlaybackSequence(
        {
          prepareRuntime: async () => true,
          runProjectOnLoad: async () => null,
          generateRealtimeCsd: async () => {
            h3.rotateToken();
            return 'csd';
          },
          dispatchAndRecover: dispatchSpy3,
        },
        fence,
      );
      expect(res).toBe(false);
      expect(dispatchSpy3).not.toHaveBeenCalled();
      return fence.check() as { ok: false; code: 'ACCESS_DENIED'; message: string };
    });
    const revokedDuringCsd = await h3.controller.transportPlay(h3.makeAuth(), receipt3);
    expect(revokedDuringCsd).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
  });

  it('stops only the expected active project and handles idempotent stop', async () => {
    const h = createPlaybackHarness();
    const receipt = h.currentReceipt()!;

    // Already stopped -> idempotent
    const alreadyStopped = await h.controller.transportStop(h.makeAuth(), receipt);
    expect(alreadyStopped).toEqual({
      ok: true,
      value: { receipt, status: 'already_stopped', playing: false },
    });
    expect(h.stopSpy).not.toHaveBeenCalled();

    // Active playback belongs to a different document -> refuse without stopping
    h.setCurrentlyPlaying(true, 'doc-different');
    const wrongTarget = await h.controller.transportStop(h.makeAuth(), receipt);
    expect(wrongTarget).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(h.stopSpy).not.toHaveBeenCalled();

    // Active playback matches current document -> stop
    h.setCurrentlyPlaying(true, receipt.documentId);
    const stopped = await h.controller.transportStop(h.makeAuth(), receipt);
    expect(stopped).toEqual({
      ok: true,
      value: { receipt, status: 'stopped', playing: false },
    });
    expect(h.stopSpy).toHaveBeenCalledTimes(1);
    expect(h.history.read().canUndo).toBe(false);
  });
});
