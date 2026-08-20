import React from 'react';
import type {
  MidiImportPreview,
  MidiImportSettings,
} from '../../../../shared/midi-import';

interface MidiImportStreamTableProps {
  preview: MidiImportPreview;
  rows: readonly MidiImportSettings[];
  onUpdate: (streamKey: string, patch: Partial<MidiImportSettings>) => void;
}

function formatBeat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export default function MidiImportStreamTable({
  preview,
  rows,
  onUpdate,
}: MidiImportStreamTableProps): React.ReactElement {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded border border-app-border/30 bg-black">
      <table className="w-full border-collapse text-role-callout text-app-text">
        <thead className="sticky top-0 bg-app-surface text-left text-app-text-muted">
          <tr>
            <th className="px-2 py-2 font-medium">Source</th>
            <th className="px-2 py-2 font-medium">Channel</th>
            <th className="px-2 py-2 font-medium">Notes / range</th>
            <th className="px-2 py-2 font-medium">Instrument ID</th>
            <th className="px-2 py-2 font-medium">Note template</th>
            <th className="px-2 py-2 font-medium">Trim</th>
          </tr>
        </thead>
        <tbody>
          {preview.streams.map((stream) => {
            const row = rows.find((candidate) => candidate.streamKey === stream.streamKey);
            if (!row) return null;
            return (
              <tr key={stream.streamKey} className="border-t border-app-border/20 align-top">
                <td className="whitespace-nowrap px-2 py-2">
                  <div>{stream.trackName ?? `Track ${stream.trackIndex}`}</div>
                  <div className="text-app-text-muted">#{stream.trackIndex}</div>
                  {stream.warnings.length > 0 ? (
                    <ul className="mt-1 max-w-64 space-y-0.5 text-amber-200">
                      {stream.warnings.map((warning, index) => (
                        <li key={`${warning.code}:${warning.tick ?? 'none'}:${index}`}>
                          {warning.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="px-2 py-2">{stream.channel + 1}</td>
                <td className="whitespace-nowrap px-2 py-2 text-app-text-muted">
                  {stream.noteCount} · {formatBeat(stream.firstBeat)}–{formatBeat(stream.lastBeat)} beats
                </td>
                <td className="px-2 py-2">
                  <input
                    className="w-24 rounded border border-app-border/30 bg-app-field px-2 py-1 text-role-body text-app-text outline-none focus:border-app-border/60"
                    value={row.instrumentId}
                    onChange={(event) => onUpdate(stream.streamKey, { instrumentId: event.target.value })}
                    aria-label={`Instrument ID for ${stream.streamKey}`}
                  />
                </td>
                <td className="min-w-[290px] px-2 py-2">
                  <input
                    className="w-full rounded border border-app-border/30 bg-app-field px-2 py-1 font-mono text-role-body text-app-text outline-none focus:border-app-border/60"
                    value={row.noteTemplate}
                    onChange={(event) => onUpdate(stream.streamKey, { noteTemplate: event.target.value })}
                    aria-label={`Note template for ${stream.streamKey}`}
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.trimTime}
                    onChange={(event) => onUpdate(stream.streamKey, { trimTime: event.target.checked })}
                    aria-label={`Trim time for ${stream.streamKey}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
