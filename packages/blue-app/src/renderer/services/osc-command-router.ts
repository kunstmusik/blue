import {
  findOscCommandById,
  type OscCommandEvent,
} from '../../shared/osc-control';

export interface OscProjectActions {
  loaded: boolean;
  flushPendingPatches(): Promise<void>;
  rewindToStart(): void;
  navigateToNextMarker(): void;
  navigateToPreviousMarker(): void;
}

export interface OscPlaybackActions {
  startFresh(): Promise<void>;
  stop(): Promise<void>;
}

export interface OscBlueLiveState {
  running: boolean;
}

export interface OscBlueLiveApi {
  toggleBlueLive(): Promise<unknown>;
  recompileBlueLive(): Promise<unknown>;
  sendBlueLiveAllNotesOff(): Promise<unknown>;
}

export interface OscCommandRouterDeps {
  getProject: () => OscProjectActions;
  getPlayback: () => OscPlaybackActions;
  getBlueLive: () => OscBlueLiveState;
  blueLiveApi: OscBlueLiveApi;
  onError?: (error: unknown, event: OscCommandEvent) => void;
}

/**
 * A single primary-renderer command queue. Socket delivery is synchronous and
 * UDP can burst messages, so preserving the queue prevents a later play from
 * seeing an uncommitted rewind/marker patch or two lifecycle calls from
 * creating concurrent engine operations.
 */
export class OscCommandRouter {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly deps: OscCommandRouterDeps) {}

  dispatch(event: OscCommandEvent): Promise<void> {
    const command = this.queue.then(() => this.execute(event));
    this.queue = command.catch((error: unknown) => {
      this.deps.onError?.(error, event);
    });
    return this.queue;
  }

  private async execute(event: OscCommandEvent): Promise<void> {
    const command = findOscCommandById(event.commandId);
    if (!command) return;

    const blueLive = this.deps.getBlueLive();
    await command.execute({
      project: this.deps.getProject(),
      playback: this.deps.getPlayback(),
      blueLive: {
        running: blueLive.running,
        toggle: () => this.deps.blueLiveApi.toggleBlueLive(),
        recompile: () => this.deps.blueLiveApi.recompileBlueLive(),
        allNotesOff: () => this.deps.blueLiveApi.sendBlueLiveAllNotesOff(),
      },
    });
  }
}
