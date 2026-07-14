/**
 * Shared OSC control contracts.
 *
 * Socket ownership stays in the Electron main process and command execution
 * stays in the primary renderer. Command definitions are shared because the
 * main process needs their matching rules and the renderer needs their
 * descriptions and callbacks. The callbacks act only on injected renderer
 * capabilities; they never cross IPC.
 */

export const OSC_DEFAULT_PREFERRED_PORT = 8000;
export const OSC_MIN_PORT = 1;
export const OSC_MAX_PORT = 65535;

export const OSC_CONTROL_GET_SNAPSHOT_CHANNEL = 'osc-control:get-snapshot';
export const OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL = 'osc-control:snapshot-changed';
export const OSC_CONTROL_COMMAND_CHANNEL = 'osc-control:command';

export interface OscServerPreferences {
  preferredPort: number;
}

export type OscServerPhase =
  | 'stopped'
  | 'starting'
  | 'listening'
  | 'restarting'
  | 'error';

export interface OscRuntimeDiagnostic {
  code: string | null;
  message: string;
  port: number | null;
}

export interface OscServerRuntimeSnapshot {
  phase: OscServerPhase;
  preferredPort: number;
  activePort: number | null;
  fallbackFrom: number | null;
  lastBindError: OscRuntimeDiagnostic | null;
  lastPacketError: OscRuntimeDiagnostic | null;
  revision: number;
  updatedAt: string;
}

export type OscCommandId =
  | 'score.play'
  | 'score.stop'
  | 'score.rewind'
  | 'score.markerNext'
  | 'score.markerPrevious'
  | 'blueLive.onOff'
  | 'blueLive.recompile'
  | 'blueLive.allNotesOff';

export const OSC_COMMAND_CATEGORIES = ['Score', 'Blue Live'] as const;
export type OscCommandCategory = typeof OSC_COMMAND_CATEGORIES[number];

/**
 * Renderer capabilities supplied at dispatch time. Keeping this structural
 * avoids a dependency from the shared OSC registry to renderer stores.
 */
export interface OscCommandExecutionContext {
  project: {
    loaded: boolean;
    flushPendingPatches(): Promise<void>;
    rewindToStart(): void;
    navigateToNextMarker(): void;
    navigateToPreviousMarker(): void;
  };
  playback: {
    startFresh(): Promise<void>;
    stop(): Promise<void>;
  };
  blueLive: {
    running: boolean;
    toggle(): Promise<unknown>;
    recompile(): Promise<unknown>;
    allNotesOff(): Promise<unknown>;
  };
}

export interface OscCommandDefinition {
  id: OscCommandId;
  addressPrefix: string;
  category: OscCommandCategory;
  description: string;
  execute(context: OscCommandExecutionContext): Promise<void>;
}

/**
 * The canonical, flat OSC command list. Keep Java Blue registration order:
 * matching uses the first registered prefix, not exact address equality. The
 * retired MIDI-toggle address is intentionally absent. Categories are only
 * display metadata and must not affect this order.
 */
export const OSC_COMMAND_REGISTRY: readonly OscCommandDefinition[] = [
  {
    id: 'score.play',
    addressPrefix: '/score/play',
    category: 'Score',
    description: 'Start a fresh regular-score performance.',
    async execute({ project, playback }) {
      if (!project.loaded) return;
      await project.flushPendingPatches();
      await playback.startFresh();
    },
  },
  {
    id: 'score.stop',
    addressPrefix: '/score/stop',
    category: 'Score',
    description: 'Stop the active regular-score performance.',
    async execute({ playback }) {
      await playback.stop();
    },
  },
  {
    id: 'score.rewind',
    addressPrefix: '/score/rewind',
    category: 'Score',
    description: 'Move the score playhead to the beginning.',
    async execute({ project }) {
      if (!project.loaded) return;
      project.rewindToStart();
      await project.flushPendingPatches();
    },
  },
  {
    id: 'score.markerNext',
    addressPrefix: '/score/markerNext',
    category: 'Score',
    description: 'Move the score playhead to the next marker.',
    async execute({ project }) {
      if (!project.loaded) return;
      project.navigateToNextMarker();
      await project.flushPendingPatches();
    },
  },
  {
    id: 'score.markerPrevious',
    addressPrefix: '/score/markerPrevious',
    category: 'Score',
    description: 'Move the score playhead to the previous marker.',
    async execute({ project }) {
      if (!project.loaded) return;
      project.navigateToPreviousMarker();
      await project.flushPendingPatches();
    },
  },
  {
    id: 'blueLive.onOff',
    addressPrefix: '/blueLive/onOff',
    category: 'Blue Live',
    description: 'Start or stop the active Blue Live session.',
    async execute({ project, blueLive }) {
      if (!project.loaded && !blueLive.running) return;
      await blueLive.toggle();
    },
  },
  {
    id: 'blueLive.recompile',
    addressPrefix: '/blueLive/recompile',
    category: 'Blue Live',
    description: 'Recompile the active Blue Live session.',
    async execute({ project, blueLive }) {
      if (!project.loaded) return;
      await blueLive.recompile();
    },
  },
  {
    id: 'blueLive.allNotesOff',
    addressPrefix: '/blueLive/allNotesOff',
    category: 'Blue Live',
    description: 'Send all-notes-off to the active Blue Live session.',
    async execute({ blueLive }) {
      if (!blueLive.running) return;
      await blueLive.allNotesOff();
    },
  },
];

export interface OscCommandEvent {
  sequence: number;
  commandId: OscCommandId;
  receivedAddress: string;
  receivedAt: string;
}

export function isValidOscPort(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= OSC_MIN_PORT
    && value <= OSC_MAX_PORT;
}

export function createDefaultOscServerPreferences(): OscServerPreferences {
  return { preferredPort: OSC_DEFAULT_PREFERRED_PORT };
}

/**
 * Structured settings win when valid. Otherwise a valid legacy placeholder
 * can seed the first real OSC preference; invalid/missing values use Java's
 * default port.
 */
export function normalizeOscServerPreferences(
  preferences: Partial<OscServerPreferences> | null | undefined,
  legacyInputPort?: unknown,
): OscServerPreferences {
  if (isValidOscPort(preferences?.preferredPort)) {
    return { preferredPort: preferences.preferredPort };
  }
  if (isValidOscPort(legacyInputPort)) {
    return { preferredPort: legacyInputPort };
  }
  return createDefaultOscServerPreferences();
}

export function createInitialOscServerRuntimeSnapshot(
  preferences: OscServerPreferences = createDefaultOscServerPreferences(),
): OscServerRuntimeSnapshot {
  return {
    phase: 'stopped',
    preferredPort: preferences.preferredPort,
    activePort: null,
    fallbackFrom: null,
    lastBindError: null,
    lastPacketError: null,
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function findOscCommand(address: unknown): OscCommandDefinition | null {
  if (typeof address !== 'string') return null;
  return OSC_COMMAND_REGISTRY.find((command) => address.startsWith(command.addressPrefix)) ?? null;
}

export function findOscCommandById(commandId: OscCommandId): OscCommandDefinition | null {
  return OSC_COMMAND_REGISTRY.find((command) => command.id === commandId) ?? null;
}

export function isOscServerRuntimeSnapshot(value: unknown): value is OscServerRuntimeSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<OscServerRuntimeSnapshot>;
  return (
    snapshot.phase === 'stopped'
    || snapshot.phase === 'starting'
    || snapshot.phase === 'listening'
    || snapshot.phase === 'restarting'
    || snapshot.phase === 'error'
  )
    && isValidOscPort(snapshot.preferredPort)
    && (snapshot.activePort === null || isValidOscPort(snapshot.activePort))
    && (snapshot.fallbackFrom === null || isValidOscPort(snapshot.fallbackFrom))
    && typeof snapshot.revision === 'number'
    && typeof snapshot.updatedAt === 'string';
}

export function isOscCommandEvent(value: unknown): value is OscCommandEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<OscCommandEvent>;
  return typeof event.sequence === 'number'
    && Number.isInteger(event.sequence)
    && event.sequence > 0
    && OSC_COMMAND_REGISTRY.some((command) => command.id === event.commandId)
    && typeof event.receivedAddress === 'string'
    && typeof event.receivedAt === 'string';
}
