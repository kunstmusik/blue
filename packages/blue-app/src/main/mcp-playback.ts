import type {
  McpAuthContext,
  McpDocumentReceipt,
  McpDomainErrorCode,
  McpResult,
} from './mcp-bridge';

export type McpPlaybackConfirmationOutcome =
  | 'approved'
  | 'declined'
  | 'cancelled'
  | 'owner-unavailable';

export interface McpPlaybackFence {
  check(): McpResult<true>;
}

export interface McpTransportOutcome {
  readonly receipt: McpDocumentReceipt;
  readonly status: 'started' | 'already_playing' | 'stopped' | 'already_stopped';
  readonly playing: boolean;
}

export interface McpPlaybackGrant {
  readonly receipt: McpDocumentReceipt;
  readonly listenerGeneration: number;
  readonly credentialEpoch: number;
  readonly writeAccessEpoch?: number;
}

export interface McpPlaybackControllerDeps {
  readonly getCurrentReceipt: () => McpDocumentReceipt | null;
  readonly isEngineAvailable: () => boolean;
  readonly isCurrentlyPlaying: () => boolean;
  /** Document ID currently playing in the engine, or null if stopped/unknown. */
  readonly getPlayingDocumentId: () => string | null;
  /**
   * Checks whether current MCP service/credential/access-mode authority still
   * permits deferred continuations (such as automatic loop restarts) for the
   * granted listener generation and credential epoch.
   */
  readonly isLoopAuthorityCurrent?: (grant: McpPlaybackGrant) => boolean;
  readonly confirmPlayback: (request: {
    receipt: McpDocumentReceipt;
    signal: AbortSignal;
  }) => Promise<McpPlaybackConfirmationOutcome>;
  /**
   * Executes the runtime playback start path (CSD generation, engine setup/retry,
   * and dispatch). Must invoke `fence.check()` after async boundaries and before
   * dispatching playback to the engine.
   */
  readonly startPlayback: (fence: McpPlaybackFence) => Promise<McpResult<void>>;
  readonly stopPlayback: () => Promise<void>;
}

export interface McpPlaybackController {
  transportPlay(
    auth: McpAuthContext,
    expectedReceipt: McpDocumentReceipt,
  ): Promise<McpResult<McpTransportOutcome>>;
  transportStop(
    auth: McpAuthContext,
    expectedReceipt: McpDocumentReceipt,
  ): Promise<McpResult<McpTransportOutcome>>;
  /**
   * Determines whether an automatic loop restart may proceed.
   * Returns true for non-MCP (UI) playback, or for MCP-initiated playback when
   * both the still-approved project receipt and read-write MCP authority hold.
   */
  canRestartLoopPlayback(): boolean;
  /** Returns a fence bound to the active MCP performance for loop restarts, or undefined for UI playback. */
  createLoopRestartFence(): McpPlaybackFence | undefined;
  clearMcpPlaybackGrant(): void;
  getActiveMcpPlaybackGrant(): McpPlaybackGrant | null;
}

export interface GuardedPlaybackSequenceHooks<TJava, TRender> {
  readonly prepareRuntime: () => Promise<boolean>;
  readonly runProjectOnLoad: () => Promise<TJava>;
  readonly generateRealtimeCsd: (javaResult: TJava) => Promise<TRender>;
  readonly dispatchAndRecover: (renderResult: TRender) => Promise<boolean>;
}

/**
 * Sequences runtime setup, project on-load execution, CSD generation, and engine
 * dispatch while checking an optional MCP playback fence immediately before each
 * stage that can invoke project-authored execution or start the engine.
 */
export async function runGuardedPlaybackSequence<TJava, TRender>(
  hooks: GuardedPlaybackSequenceHooks<TJava, TRender>,
  fence?: McpPlaybackFence,
): Promise<boolean> {
  if (fence && !fence.check().ok) {
    return false;
  }
  const ready = await hooks.prepareRuntime();
  if (!ready) {
    return false;
  }
  if (fence && !fence.check().ok) {
    return false;
  }
  const javaResult = await hooks.runProjectOnLoad();
  if (fence && !fence.check().ok) {
    return false;
  }
  const renderResult = await hooks.generateRealtimeCsd(javaResult);
  if (fence && !fence.check().ok) {
    return false;
  }
  return hooks.dispatchAndRecover(renderResult);
}

interface ActiveMcpPerformance {
  readonly grant: McpPlaybackGrant;
  readonly fallbackAuthCheck: () => boolean;
  revoked: boolean;
}

function err<T>(code: McpDomainErrorCode, message: string): McpResult<T> {
  return { ok: false, code, message };
}

function ok<T>(value: T): McpResult<T> {
  return { ok: true, value };
}

function receiptsMatch(a: McpDocumentReceipt, b: McpDocumentReceipt): boolean {
  return a.documentId === b.documentId && a.revision === b.revision && a.stateId === b.stateId;
}

/**
 * Coordinates MCP-initiated timeline play, targeted stop, and loop-restart
 * authority fencing without mutating project history.
 */
export function createGuardedMcpPlaybackController(
  deps: McpPlaybackControllerDeps,
): McpPlaybackController {
  let transitionInFlight = false;
  let activePerformance: ActiveMcpPerformance | null = null;

  const checkAccessAndReceipt = (
    auth: McpAuthContext,
    expectedReceipt: McpDocumentReceipt,
  ): McpResult<McpDocumentReceipt> => {
    if (auth.signal.aborted) {
      return err('CANCELLED', 'The MCP transport request was cancelled.');
    }
    if (!auth.isAuthorized() || auth.accessMode !== 'read-write' || auth.action !== 'runtime') {
      return err(
        'ACCESS_DENIED',
        'Read-write MCP authorization is required to control timeline playback.',
      );
    }
    const currentReceipt = deps.getCurrentReceipt();
    if (!currentReceipt) {
      return err(
        'NO_ACTIVE_PROJECT',
        'No project is currently open in Blue. Open or create a project and retry.',
      );
    }
    if (!receiptsMatch(currentReceipt, expectedReceipt)) {
      return err(
        'CONFLICT',
        'The active project changed before the transport request could take effect. Reread the receipt and retry.',
      );
    }
    return ok(currentReceipt);
  };

  async function transportPlay(
    auth: McpAuthContext,
    expectedReceipt: McpDocumentReceipt,
  ): Promise<McpResult<McpTransportOutcome>> {
    const admission = checkAccessAndReceipt(auth, expectedReceipt);
    if (!admission.ok) return admission;

    if (deps.isCurrentlyPlaying()) {
      const playingDocId = deps.getPlayingDocumentId();
      if (playingDocId === expectedReceipt.documentId) {
        return ok({
          receipt: admission.value,
          status: 'already_playing',
          playing: true,
        });
      }
      return err('BUSY', 'Another engine playback session is currently active.');
    }

    if (!deps.isEngineAvailable()) {
      return err(
        'ENGINE_UNAVAILABLE',
        'The Blue Csound engine is unavailable for timeline playback.',
      );
    }

    if (transitionInFlight) {
      return err('BUSY', 'Another MCP transport transition is already in progress.');
    }

    transitionInFlight = true;
    try {
      const fence: McpPlaybackFence = {
        check: () => {
          const recheck = checkAccessAndReceipt(auth, expectedReceipt);
          if (!recheck.ok) return recheck;
          if (!deps.isEngineAvailable()) {
            return err(
              'ENGINE_UNAVAILABLE',
              'The Blue Csound engine became unavailable before playback dispatch.',
            );
          }
          return ok(true);
        },
      };

      let confirmation: McpPlaybackConfirmationOutcome;
      try {
        confirmation = await deps.confirmPlayback({
          receipt: expectedReceipt,
          signal: auth.signal,
        });
      } catch (error) {
        if (auth.signal.aborted) {
          return err('CANCELLED', 'Timeline playback approval was cancelled.');
        }
        return err(
          'ACCESS_DENIED',
          `Timeline playback approval failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (confirmation === 'cancelled' || auth.signal.aborted) {
        return err('CANCELLED', 'Timeline playback request was cancelled.');
      }
      if (confirmation === 'declined' || confirmation === 'owner-unavailable') {
        return err(
          'ACCESS_DENIED',
          confirmation === 'owner-unavailable'
            ? 'Local confirmation window is unavailable for MCP playback.'
            : 'Local approval for timeline playback was declined.',
        );
      }

      const postConfirm = fence.check();
      if (!postConfirm.ok) return postConfirm;

      const startResult = await deps.startPlayback(fence);
      if (!startResult.ok) {
        return startResult;
      }

      const currentReceipt = deps.getCurrentReceipt();
      const postStartAuthorityValid =
        !auth.signal.aborted &&
        auth.isAuthorized() &&
        auth.accessMode === 'read-write' &&
        currentReceipt !== null &&
        receiptsMatch(currentReceipt, expectedReceipt);

      activePerformance = {
        grant: {
          receipt: expectedReceipt,
          listenerGeneration: auth.listenerGeneration,
          credentialEpoch: auth.credentialEpoch,
          writeAccessEpoch: auth.writeAccessEpoch,
        },
        fallbackAuthCheck: () => auth.isAuthorized() && auth.accessMode === 'read-write',
        revoked: !postStartAuthorityValid,
      };

      return ok({
        receipt: expectedReceipt,
        status: 'started',
        playing: true,
      });
    } finally {
      transitionInFlight = false;
    }
  }

  async function transportStop(
    auth: McpAuthContext,
    expectedReceipt: McpDocumentReceipt,
  ): Promise<McpResult<McpTransportOutcome>> {
    const admission = checkAccessAndReceipt(auth, expectedReceipt);
    if (!admission.ok) return admission;

    if (!deps.isCurrentlyPlaying()) {
      activePerformance = null;
      return ok({
        receipt: admission.value,
        status: 'already_stopped',
        playing: false,
      });
    }

    const playingDocId = deps.getPlayingDocumentId();
    if (playingDocId !== null && playingDocId !== expectedReceipt.documentId) {
      return err(
        'CONFLICT',
        'Active playback belongs to a different project document and was not stopped.',
      );
    }

    if (transitionInFlight) {
      return err('BUSY', 'Another MCP transport transition is already in progress.');
    }

    transitionInFlight = true;
    try {
      const preStopRecheck = checkAccessAndReceipt(auth, expectedReceipt);
      if (!preStopRecheck.ok) return preStopRecheck;

      const currentPlayingDocId = deps.getPlayingDocumentId();
      if (currentPlayingDocId !== null && currentPlayingDocId !== expectedReceipt.documentId) {
        return err(
          'CONFLICT',
          'Active playback changed to a different project document and was not stopped.',
        );
      }

      await deps.stopPlayback();
      activePerformance = null;

      return ok({
        receipt: preStopRecheck.value,
        status: 'stopped',
        playing: false,
      });
    } finally {
      transitionInFlight = false;
    }
  }

  function canRestartLoopPlayback(): boolean {
    if (!activePerformance) {
      // UI-initiated playback is not fenced by an MCP grant.
      return true;
    }

    if (activePerformance.revoked) {
      // Retain MCP origin until playback actually stops or UI replaces it so
      // repeated completion checks never revert to UI-loop behavior.
      return false;
    }

    const currentReceipt = deps.getCurrentReceipt();
    if (!currentReceipt || !receiptsMatch(currentReceipt, activePerformance.grant.receipt)) {
      activePerformance.revoked = true;
      return false;
    }

    const authorityOk = deps.isLoopAuthorityCurrent
      ? deps.isLoopAuthorityCurrent(activePerformance.grant)
      : activePerformance.fallbackAuthCheck();

    if (!authorityOk) {
      activePerformance.revoked = true;
      return false;
    }

    return true;
  }

  function createLoopRestartFence(): McpPlaybackFence | undefined {
    if (!activePerformance) {
      return undefined;
    }
    return {
      check: () => {
        if (!canRestartLoopPlayback()) {
          return err('ACCESS_DENIED', 'MCP loop restart authority is no longer valid.');
        }
        if (!deps.isEngineAvailable()) {
          return err(
            'ENGINE_UNAVAILABLE',
            'The Blue Csound engine became unavailable before loop restart.',
          );
        }
        return ok(true);
      },
    };
  }

  function clearMcpPlaybackGrant(): void {
    activePerformance = null;
  }

  function getActiveMcpPlaybackGrant(): McpPlaybackGrant | null {
    return activePerformance && !activePerformance.revoked ? { ...activePerformance.grant } : null;
  }

  return {
    transportPlay,
    transportStop,
    canRestartLoopPlayback,
    createLoopRestartFence,
    clearMcpPlaybackGrant,
    getActiveMcpPlaybackGrant,
  };
}
