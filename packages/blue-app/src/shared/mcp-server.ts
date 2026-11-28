/**
 * Shared local MCP server contracts.
 *
 * The listener, the bearer credential, and clipboard content stay in the
 * Electron main process. Only preferences, sanitized runtime status, and copy
 * action results cross IPC; the credential never does.
 */

export const MCP_DEFAULT_PREFERRED_PORT = 8765;
export const MCP_MIN_PORT = 1024;
export const MCP_MAX_PORT = 65535;

export const MCP_SERVER_GET_STATUS_CHANNEL = 'mcp-server:get-status';
export const MCP_SERVER_STATUS_CHANGED_CHANNEL = 'mcp-server:status-changed';
export const MCP_SERVER_COPY_CREDENTIAL_CHANNEL = 'mcp-server:copy-credential';
export const MCP_SERVER_COPY_CLIENT_CONFIG_CHANNEL = 'mcp-server:copy-client-config';
export const MCP_SERVER_ROTATE_CREDENTIAL_CHANNEL = 'mcp-server:rotate-credential';

export type McpAccessMode = 'read-only' | 'read-write';
export type McpClientConfigTarget = 'cursor' | 'vscode' | 'codex' | 'opencode' | 'antigravity';

export interface McpServerPreferences {
  enabled: boolean;
  preferredPort: number;
  accessMode: McpAccessMode;
}

export type McpServicePhase = 'stopped' | 'starting' | 'restarting' | 'listening' | 'error';

/** Where the current credential is kept. Describes storage only, never the credential. */
export type McpCredentialStorage = 'persisted' | 'session-only';

export interface McpServerStatus {
  phase: McpServicePhase;
  preferredPort: number;
  accessMode: McpAccessMode;
  /** Present only while listening. */
  activePort: number | null;
  /** The occupied preferred port when listening on a fallback; otherwise null. */
  fallbackFrom: number | null;
  /** Null until a credential is provisioned for the current run. */
  credentialStorage: McpCredentialStorage | null;
  /** Sanitized: never carries the credential, request headers, or stack traces. */
  error: { code: string; message: string } | null;
  revision: number;
  updatedAt: string;
}

export type McpCopyResult = { ok: true } | { ok: false; code: 'MCP_UNAVAILABLE'; message: string };

export type McpRotateResult =
  | { ok: true; storage: McpCredentialStorage }
  | { ok: false; code: 'MCP_UNAVAILABLE' | 'ROTATION_FAILED'; message: string };

export function isValidMcpPort(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MCP_MIN_PORT &&
    value <= MCP_MAX_PORT
  );
}

export function createDefaultMcpServerPreferences(): McpServerPreferences {
  return {
    enabled: false,
    preferredPort: MCP_DEFAULT_PREFERRED_PORT,
    accessMode: 'read-only',
  };
}

/**
 * Settings saved before MCP existed receive the defaults. Invalid persisted
 * enablement or access mode fails closed: the service stays off and read-only.
 */
export function normalizeMcpServerPreferences(saved: unknown): McpServerPreferences {
  const value = (!saved || typeof saved !== 'object' ? {} : saved) as Partial<
    Record<keyof McpServerPreferences, unknown>
  >;
  return {
    enabled: value.enabled === true,
    preferredPort: isValidMcpPort(value.preferredPort)
      ? value.preferredPort
      : MCP_DEFAULT_PREFERRED_PORT,
    accessMode: value.accessMode === 'read-write' ? 'read-write' : 'read-only',
  };
}

export function createInitialMcpServerStatus(
  preferences: McpServerPreferences = createDefaultMcpServerPreferences(),
): McpServerStatus {
  return {
    phase: 'stopped',
    preferredPort: preferences.preferredPort,
    accessMode: preferences.accessMode,
    activePort: null,
    fallbackFrom: null,
    credentialStorage: null,
    error: null,
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function isMcpServerStatus(value: unknown): value is McpServerStatus {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<McpServerStatus>;
  const error = status.error;
  return (
    (status.phase === 'stopped' ||
      status.phase === 'starting' ||
      status.phase === 'restarting' ||
      status.phase === 'listening' ||
      status.phase === 'error') &&
    isValidMcpPort(status.preferredPort) &&
    (status.accessMode === 'read-only' || status.accessMode === 'read-write') &&
    (status.activePort === null || isValidMcpPort(status.activePort)) &&
    (status.fallbackFrom === null || isValidMcpPort(status.fallbackFrom)) &&
    (status.credentialStorage === null ||
      status.credentialStorage === 'persisted' ||
      status.credentialStorage === 'session-only') &&
    (error === null ||
      (typeof error === 'object' &&
        typeof error.code === 'string' &&
        typeof error.message === 'string')) &&
    typeof status.revision === 'number' &&
    typeof status.updatedAt === 'string'
  );
}

export function isMcpClientConfigTarget(value: unknown): value is McpClientConfigTarget {
  return (
    value === 'cursor' ||
    value === 'vscode' ||
    value === 'codex' ||
    value === 'opencode' ||
    value === 'antigravity'
  );
}

export function isMcpCopyResult(value: unknown): value is McpCopyResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  if (result.ok === true) {
    return Object.keys(result).length === 1;
  }
  if (result.ok === false) {
    return result.code === 'MCP_UNAVAILABLE' && typeof result.message === 'string';
  }
  return false;
}

export function isMcpRotateResult(value: unknown): value is McpRotateResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  if (result.ok === true) {
    return (
      Object.keys(result).length === 2 &&
      (result.storage === 'persisted' || result.storage === 'session-only')
    );
  }
  if (result.ok === false) {
    return (
      (result.code === 'MCP_UNAVAILABLE' || result.code === 'ROTATION_FAILED') &&
      typeof result.message === 'string'
    );
  }
  return false;
}
