import React from 'react';
import { useMidiInputStore } from '../../stores/midi-input-store';
import SettingsSection from './SettingsSection';
import type { MidiInputDeviceRuntime } from '../../../shared/midi-input';
import { cn } from '../../lib/cn';

function phaseBadgeClass(phase: string): string {
  switch (phase) {
    case 'ready':
      return 'border border-app-success/40 bg-app-success/20 text-app-text font-medium';
    case 'partial':
      return 'border border-app-warning/40 bg-app-warning/20 text-app-text font-medium';
    case 'denied':
    case 'error':
      return 'border border-app-danger/40 bg-app-danger/20 text-app-text font-medium';
    case 'unsupported':
      return 'border border-app-border/40 bg-app-surface text-app-text-muted';
    default:
      return 'border border-app-accent/40 bg-app-accent/20 text-app-text font-medium';
  }
}

function connectionBadgeClass(connection: string, availability: string): string {
  if (availability === 'unavailable') {
    return 'border border-app-border/40 bg-app-surface text-app-text-muted';
  }
  switch (connection) {
    case 'connected':
      return 'border border-app-success/40 bg-app-success/20 text-app-text font-medium';
    case 'connecting':
      return 'border border-app-accent/40 bg-app-accent/20 text-app-text font-medium';
    case 'disconnecting':
      return 'border border-app-warning/40 bg-app-warning/20 text-app-text font-medium';
    case 'error':
      return 'border border-app-danger/40 bg-app-danger/20 text-app-text font-medium';
    default:
      return 'border border-app-border/40 bg-app-surface text-app-text-muted';
  }
}

function phaseIcon(phase: string): string {
  switch (phase) {
    case 'ready':
      return '✓';
    case 'partial':
      return '▲';
    case 'denied':
    case 'error':
      return '⚠';
    case 'unsupported':
      return '✕';
    default:
      return '●';
  }
}

function connectionIcon(connection: string, availability: string): string {
  if (availability === 'unavailable') return '○';
  switch (connection) {
    case 'connected':
      return '✓';
    case 'connecting':
      return '●';
    case 'disconnecting':
      return '▲';
    case 'error':
      return '⚠';
    default:
      return '○';
  }
}

interface VisibleRow {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  enabled: boolean;
  availability: 'available' | 'unavailable';
  connection: 'closed' | 'connecting' | 'connected' | 'disconnecting' | 'error';
  lastError: string;
  /** True when this device was discovered live but not yet saved as a preference. */
  discovered: boolean;
}

/**
 * Compute the displayed device list as the union of saved/draft preferences
 * and currently observed runtime devices. Newly discovered devices use the
 * service's enabled-by-default state; persisted
 * preferences for absent devices remain visible as `unavailable`.
 */
function mergeVisibleDevices(
  draft: {
    devices: Array<{
      id: string;
      name: string;
      manufacturer: string;
      version: string;
      enabled: boolean;
    }>;
  },
  snapshot: { devices: MidiInputDeviceRuntime[] } | null,
): VisibleRow[] {
  const runtimeById = new Map<string, MidiInputDeviceRuntime>();
  for (const device of snapshot?.devices ?? []) {
    runtimeById.set(device.id, device);
  }

  const seen = new Set<string>();
  const rows: VisibleRow[] = [];

  // Draft (saved) preferences first — these may include remembered devices
  // that are currently unplugged.
  for (const pref of draft.devices) {
    seen.add(pref.id);
    const runtime = runtimeById.get(pref.id);
    rows.push({
      id: pref.id,
      name: pref.name,
      manufacturer: pref.manufacturer,
      version: pref.version,
      enabled: pref.enabled,
      availability: runtime?.availability ?? 'unavailable',
      connection: runtime?.connection ?? 'closed',
      lastError: runtime?.lastError ?? '',
      discovered: false,
    });
  }

  // Discovered live devices that have no saved preference yet.
  for (const runtime of snapshot?.devices ?? []) {
    if (seen.has(runtime.id)) continue;
    rows.push({
      id: runtime.id,
      name: runtime.name,
      manufacturer: runtime.manufacturer,
      version: runtime.version,
      enabled: runtime.enabled,
      availability: runtime.availability,
      connection: runtime.connection,
      lastError: runtime.lastError ?? '',
      discovered: true,
    });
  }

  return rows;
}

export default function MidiSettings(): React.ReactElement {
  const draft = useMidiInputStore((s) => s.draftMidiInput);
  const snapshot = useMidiInputStore((s) => s.snapshot);
  const upsertDraftDeviceFromRuntime = useMidiInputStore((s) => s.upsertDraftDeviceFromRuntime);

  const phase = snapshot?.phase ?? 'idle';
  const aggregateMessage = snapshot?.message ?? null;

  const rows = mergeVisibleDevices(draft, snapshot);
  const phaseHelp: string | null = (() => {
    switch (phase) {
      case 'unsupported':
        return 'This runtime does not expose Web MIDI. Connect a device and rescan, or restart the app.';
      case 'denied':
        return 'MIDI permission was denied. Grant access in your OS/browser permissions and rescan.';
      case 'error':
        return 'Discovery failed. Rescan to retry; if the problem persists, restart the app.';
      case 'requestingAccess':
      case 'discovering':
        return 'Looking for MIDI input devices…';
      case 'idle':
        return 'MIDI service is not running in this window. Rescan or restart the app.';
      default:
        return null;
    }
  })();

  const onRescan = (): void => {
    void window.blueAPI?.requestMidiInputRescan?.();
  };

  const handleToggle = (row: VisibleRow, enabled: boolean): void => {
    // Newly discovered devices must be seeded into the draft with their live
    // metadata; for already-drafted devices, just flip the enabled flag.
    if (row.discovered) {
      upsertDraftDeviceFromRuntime(
        { id: row.id, name: row.name, manufacturer: row.manufacturer, version: row.version },
        { enabled },
      );
    } else {
      useMidiInputStore.getState().setDraftDeviceEnabled(row.id, enabled);
    }
  };

  return (
    <SettingsSection title="MIDI">
      <div className="mb-3 flex items-center gap-3" role="status" aria-live="polite">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-role-callout',
            phaseBadgeClass(phase),
          )}
        >
          <span aria-hidden="true">{phaseIcon(phase)}</span>
          <span>{phase}</span>
        </span>
        {(aggregateMessage || phaseHelp) && (
          <span className="text-role-body text-app-text-muted">
            {aggregateMessage ?? phaseHelp}
          </span>
        )}
        <button
          type="button"
          onClick={onRescan}
          className="ml-auto inline-flex items-center rounded-md border border-app-border bg-transparent px-3 py-1 text-role-body text-app-text transition-colors hover:border-app-accent/60 hover:text-app-text-strong"
          title="Refresh the available MIDI input device list without changing preferences"
        >
          Rescan
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-app-border px-4 py-3 text-role-body text-app-text-muted">
          No MIDI input devices found. Connect a controller and press Rescan, or check that the OS
          has granted MIDI access to Blue.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-app-border bg-black">
          <table className="w-full text-role-body">
            <thead className="bg-app-surface text-role-headline font-bold text-app-text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Enabled</th>
                <th className="px-3 py-2 text-left">Device</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-app-border">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => handleToggle(row, e.target.checked)}
                      aria-label={`Enable ${row.name || row.id}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-app-text-strong">{row.name || row.id}</div>
                    <div className="text-app-text-subtle">
                      {row.manufacturer || 'Unknown manufacturer'}
                      {row.version ? ` · ${row.version}` : ''}
                      {row.availability === 'unavailable' && (
                        <span className="ml-2 italic text-app-text-subtle">(unavailable)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-role-callout',
                        connectionBadgeClass(row.connection, row.availability),
                      )}
                    >
                      <span aria-hidden="true">
                        {connectionIcon(row.connection, row.availability)}
                      </span>
                      <span>
                        {row.availability === 'unavailable' ? 'unavailable' : row.connection}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-app-text-muted">{row.lastError || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsSection>
  );
}
