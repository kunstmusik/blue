import React from 'react';
import {
  OSC_COMMAND_CATEGORIES,
  OSC_COMMAND_REGISTRY,
  isValidOscPort,
  type OscServerPreferences,
  type OscServerRuntimeSnapshot,
} from '../../../shared/osc-control';
import SettingsField from './SettingsField';
import SettingsSection from './SettingsSection';
import { cn } from '../../lib/cn';

interface OscSettingsProps {
  settings: OscServerPreferences;
  runtime: OscServerRuntimeSnapshot | null;
  onChange: (settings: OscServerPreferences) => void;
}

function phaseLabel(runtime: OscServerRuntimeSnapshot | null): string {
  if (!runtime) return 'Checking listener status…';
  switch (runtime.phase) {
    case 'listening': return 'Listening';
    case 'starting': return 'Starting…';
    case 'restarting': return 'Restarting…';
    case 'error': return 'Not listening';
    default: return 'Stopped';
  }
}

function phaseClass(runtime: OscServerRuntimeSnapshot | null): string {
  if (runtime?.phase === 'listening') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (runtime?.phase === 'error') {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
}

export default function OscSettings({
  settings,
  runtime,
  onChange,
}: OscSettingsProps): React.ReactElement {
  const preferredPort = settings.preferredPort;
  const validPort = isValidOscPort(preferredPort);
  const activePort = runtime?.activePort ?? null;
  const usesFallback = activePort !== null && activePort !== runtime?.preferredPort;
  const diagnostic = runtime?.lastBindError ?? runtime?.lastPacketError ?? null;

  return (
    <SettingsSection
      title="OSC"
      dependencyNote="Blue accepts unauthenticated OSC on all IPv4 interfaces. Use it only on a trusted network and manage exposure with your host firewall."
    >
      <SettingsField
        label="Preferred Server Port"
        value={Number.isFinite(preferredPort) ? String(preferredPort) : ''}
        onChange={(value) => onChange({
          preferredPort: value.trim() === '' ? 0 : Number(value),
        })}
        type="number"
        min={1}
        max={65535}
        step={1}
        inputMode="numeric"
        placeholder="8000"
        description="Blue tries this inbound UDP port first. If it is already in use, it scans upward to the first available port without changing this preference."
      />
      {!validPort && (
        <p className="-mt-2 mb-4 text-role-body text-app-danger">
          Enter a whole port number from 1 through 65535 before applying.
        </p>
      )}

      <div className="rounded-md border border-app-border bg-app-surface p-4 text-role-body">
        <div className="mb-3 flex items-center gap-3">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5', phaseClass(runtime))}>
            {phaseLabel(runtime)}
          </span>
          {activePort !== null && (
            <span className="text-app-text-muted">Active port: <strong className="text-app-text">{activePort}</strong></span>
          )}
        </div>

        {usesFallback && runtime && (
          <p className="mb-2 text-app-warning">
            Port {runtime.preferredPort} was already in use; OSC is listening on fallback port {activePort}.
            The preferred port remains unchanged and will be retried on the next restart.
          </p>
        )}
        {runtime?.phase === 'listening' && !usesFallback && (
          <p className="text-app-text-muted">Listening on the preferred port {activePort}.</p>
        )}
        {diagnostic && (
          <p className="mt-2 text-app-danger">
            {diagnostic.message}{diagnostic.port ? ` (port ${diagnostic.port})` : ''}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-1 text-role-title-3 font-semibold text-app-text-strong">Supported OSC Messages</h3>
        <p className="mb-3 text-role-callout text-app-text-subtle">
          Message arguments and bundle timetags are ignored. Addresses use Java Blue-compatible prefix matching.
        </p>
        <div className="overflow-hidden rounded-md border border-app-border">
          <table className="w-full border-collapse text-left text-role-body" aria-label="Supported OSC messages">
            <thead className="bg-app-surface text-role-headline font-bold text-app-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Message</th>
                <th scope="col" className="px-3 py-2">Description</th>
              </tr>
            </thead>
            {OSC_COMMAND_CATEGORIES.map((category) => (
              <tbody key={category} className="divide-y divide-app-border border-t border-app-border">
                <tr className="bg-app-surface/60">
                  <th scope="colgroup" colSpan={2} className="px-3 py-1.5 text-role-headline font-bold text-app-text-muted">
                    {category}
                  </th>
                </tr>
                {OSC_COMMAND_REGISTRY.filter((command) => command.category === category).map((command) => (
                  <tr key={command.id} data-osc-command={command.id}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-role-body text-app-text">
                      {command.addressPrefix}
                    </td>
                    <td className="px-3 py-2 text-app-text-muted">{command.description}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </SettingsSection>
  );
}
