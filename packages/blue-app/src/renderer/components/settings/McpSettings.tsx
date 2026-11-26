import React, { useState } from 'react';
import {
  MCP_DEFAULT_PREFERRED_PORT,
  MCP_MAX_PORT,
  MCP_MIN_PORT,
  isMcpClientConfigTarget,
  isValidMcpPort,
  type McpAccessMode,
  type McpClientConfigTarget,
  type McpServerPreferences,
  type McpServerStatus,
} from '../../../shared/mcp-server';
import { cn } from '../../lib/cn';
import {
  SettingsCheckboxField,
  SettingsDraftNumberField,
  SettingsSelectField,
  SETTINGS_NARROW_FIELD_CLASS,
} from './SettingsField';
import SettingsSection from './SettingsSection';

interface McpSettingsProps {
  settings: McpServerPreferences;
  status: McpServerStatus | null;
  onChange: (settings: McpServerPreferences) => void;
}

type ActionFeedback = {
  tone: 'success' | 'warning' | 'error';
  message: string;
};

const CLIENT_LABELS: Record<McpClientConfigTarget, string> = {
  cursor: 'Cursor',
  vscode: 'VS Code',
  codex: 'Codex',
};

const CLIENT_DESCRIPTIONS: Record<McpClientConfigTarget, string> = {
  cursor: 'Copies Cursor mcpServers JSON with the active loopback URL and Bearer header.',
  vscode: 'Copies VS Code mcp.json using a password prompt input without embedding the raw token.',
  codex: 'Copies Codex TOML referencing the BLUE_MCP_TOKEN environment variable.',
};

const ACTION_BUTTON_CLASS =
  'rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-role-body text-app-text transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus enabled:hover:border-app-accent enabled:hover:text-app-text-strong disabled:cursor-not-allowed disabled:opacity-50';

function phaseLabel(status: McpServerStatus | null): string {
  if (!status) return 'Checking server status…';
  switch (status.phase) {
    case 'listening':
      return 'Listening';
    case 'starting':
      return 'Starting…';
    case 'restarting':
      return 'Restarting…';
    case 'error':
      return 'Error';
    default:
      return 'Stopped';
  }
}

function phaseClass(status: McpServerStatus | null): string {
  if (status?.phase === 'listening') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (status?.phase === 'error') {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
}

function toAccessMode(value: string): McpAccessMode {
  return value === 'read-write' ? 'read-write' : 'read-only';
}

export default function McpSettings({
  settings,
  status,
  onChange,
}: McpSettingsProps): React.ReactElement {
  const [clientTarget, setClientTarget] = useState<McpClientConfigTarget>('cursor');
  const [busyAction, setBusyAction] = useState<'copy-token' | 'copy-config' | 'rotate' | null>(
    null,
  );
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const preferredPort = settings.preferredPort;
  const validPort = isValidMcpPort(preferredPort);
  const activePort = status?.phase === 'listening' ? status.activePort : null;
  const endpointUrl = activePort !== null ? `http://127.0.0.1:${activePort}/mcp` : null;
  const canCopy =
    status?.phase === 'listening' &&
    status.activePort !== null &&
    status.credentialStorage !== null;

  const handleCopyCredential = async () => {
    setBusyAction('copy-token');
    try {
      const result = await window.blueAPI.copyMcpCredential();
      if (result.ok) {
        setFeedback({
          tone: 'success',
          message: 'Bearer credential copied to clipboard.',
        });
      } else {
        setFeedback({ tone: 'error', message: result.message });
      }
    } catch {
      setFeedback({
        tone: 'error',
        message: 'Failed to copy the MCP bearer credential.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyClientConfig = async () => {
    setBusyAction('copy-config');
    try {
      const result = await window.blueAPI.copyMcpClientConfig(clientTarget);
      if (result.ok) {
        setFeedback({
          tone: 'success',
          message: `Copied ${CLIENT_LABELS[clientTarget]} configuration to clipboard.`,
        });
      } else {
        setFeedback({ tone: 'error', message: result.message });
      }
    } catch {
      setFeedback({
        tone: 'error',
        message: `Failed to copy ${CLIENT_LABELS[clientTarget]} configuration.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRotateCredential = async () => {
    setBusyAction('rotate');
    try {
      const result = await window.blueAPI.rotateMcpCredential();
      if (result.ok) {
        if (result.storage === 'session-only') {
          setFeedback({
            tone: 'warning',
            message:
              'Credential rotated for this session only. Previous sessions were closed; no secure system credential store is available.',
          });
        } else {
          setFeedback({
            tone: 'success',
            message: 'Credential rotated and persisted. Previous sessions were closed.',
          });
        }
      } else {
        setFeedback({ tone: 'error', message: result.message });
      }
    } catch {
      setFeedback({
        tone: 'error',
        message: 'Failed to rotate the MCP credential.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <SettingsSection
      title="MCP"
      dependencyNote="Blue binds the local MCP endpoint only on 127.0.0.1 with bearer-token authentication. Keep copied credentials private."
    >
      <SettingsCheckboxField
        label="Enable MCP Server"
        checked={settings.enabled}
        onChange={(enabled) => onChange({ ...settings, enabled })}
        description="Expose a local Streamable HTTP MCP server on IPv4 loopback (127.0.0.1)."
      />

      <SettingsSelectField
        label="Access Mode"
        value={settings.accessMode}
        onChange={(value) => onChange({ ...settings, accessMode: toAccessMode(value) })}
        description="Read-only permits project and engine inspection. Read-write also permits supported edits, playback, and confined disk renders."
      >
        <option value="read-only">Read-only</option>
        <option value="read-write">Read-write</option>
      </SettingsSelectField>
      {settings.accessMode === 'read-write' && (
        <p className="-mt-2 mb-4 text-role-callout text-app-warning">
          Read-write access allows authenticated local MCP clients to edit the active project,
          trigger playback, and start approved renders.
        </p>
      )}

      <SettingsDraftNumberField
        label="Preferred Server Port"
        value={Number.isFinite(preferredPort) ? String(preferredPort) : ''}
        onChange={(value) =>
          onChange({
            ...settings,
            preferredPort: value.trim() === '' ? 0 : Number(value),
          })
        }
        min={MCP_MIN_PORT}
        max={MCP_MAX_PORT}
        step={1}
        stepBase={MCP_DEFAULT_PREFERRED_PORT}
        inputMode="numeric"
        placeholder={String(MCP_DEFAULT_PREFERRED_PORT)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
        description="Blue tries this loopback port first. If it is already in use, it binds an available fallback port without changing this preference."
      />
      {!validPort && (
        <p className="-mt-2 mb-4 text-role-body text-app-danger">
          Enter a whole port number from {MCP_MIN_PORT} through {MCP_MAX_PORT} before applying.
        </p>
      )}

      <div className="rounded-md border border-app-border bg-app-surface p-4 text-role-body">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span
            className={cn('inline-flex items-center rounded-full px-2 py-0.5', phaseClass(status))}
          >
            {phaseLabel(status)}
          </span>
          {endpointUrl && (
            <span className="text-app-text-muted">
              Endpoint: <code className="font-mono text-app-text-strong">{endpointUrl}</code>
            </span>
          )}
        </div>

        {status?.phase === 'listening' && status.fallbackFrom !== null && activePort !== null && (
          <p className="mb-2 text-app-warning">
            Port {status.fallbackFrom} was already in use; MCP is listening on fallback port{' '}
            {activePort}. Preferred port {status.preferredPort} remains unchanged and will be
            retried on restart.
          </p>
        )}

        {status?.phase === 'listening' && status.fallbackFrom === null && activePort !== null && (
          <p className="mb-2 text-app-text-muted">Listening on preferred port {activePort}.</p>
        )}

        {status?.credentialStorage === 'persisted' && (
          <p className="text-app-text-muted">
            Credential storage: <strong className="text-app-text">Persisted</strong> (encrypted in
            the system credential store).
          </p>
        )}

        {status?.credentialStorage === 'session-only' && (
          <p className="rounded border border-app-warning/40 bg-app-warning/10 px-2.5 py-1.5 text-app-warning">
            Credential storage: <strong>Session-only</strong> — no secure system credential store is
            available, so the token stays in memory for this run only.
          </p>
        )}

        {status && status.credentialStorage === null && (
          <p className="text-app-text-muted">Credential storage: Not provisioned yet.</p>
        )}

        {status?.error && (
          <p className="mt-2 text-app-danger" role="alert">
            {status.error.message}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-role-title-3 font-semibold text-app-text-strong">
          Credentials and Client Configuration
        </h3>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canCopy || busyAction !== null}
            onClick={() => void handleCopyCredential()}
            className={ACTION_BUTTON_CLASS}
          >
            {busyAction === 'copy-token' ? 'Copying…' : 'Copy Credential'}
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleRotateCredential()}
            className={ACTION_BUTTON_CLASS}
          >
            {busyAction === 'rotate' ? 'Rotating…' : 'Rotate Credential'}
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SettingsSelectField
            label="Client Target"
            value={clientTarget}
            onChange={(value) => {
              if (isMcpClientConfigTarget(value)) {
                setClientTarget(value);
              }
            }}
            containerClassName="mb-0"
            description={CLIENT_DESCRIPTIONS[clientTarget]}
          >
            <option value="cursor">Cursor</option>
            <option value="vscode">VS Code</option>
            <option value="codex">Codex</option>
          </SettingsSelectField>
          <button
            type="button"
            disabled={!canCopy || busyAction !== null}
            onClick={() => void handleCopyClientConfig()}
            className={ACTION_BUTTON_CLASS}
          >
            {busyAction === 'copy-config' ? 'Copying…' : 'Copy Client Config'}
          </button>
        </div>

        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'mt-4 rounded-md border px-3 py-2 text-role-body',
              feedback.tone === 'success' &&
                'border-app-success/40 bg-app-success/10 text-app-text',
              feedback.tone === 'warning' &&
                'border-app-warning/40 bg-app-warning/10 text-app-warning',
              feedback.tone === 'error' && 'border-app-danger/40 bg-app-danger/10 text-app-danger',
            )}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
