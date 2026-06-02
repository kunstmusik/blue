import { useState, useCallback } from 'react';
import type { TempoMapSnapshot, TempoPointSnapshot, TempoMapPatch, TimeConversionContext } from '../../../../../shared/project-editor';
import { TIME_BASE_OPTIONS, formatForBase, parseForBase } from '../../../../time/time-unit-logic';

interface TempoMapEditorDialogProps {
  tempoMap: TempoMapSnapshot;
  timeContext: TimeConversionContext;
  onCommit: (patch: TempoMapPatch) => void;
  onClose: () => void;
}

interface TableRow {
  beatText: string;
  timeBase: string;
  tempoText: string;
  beat: number;
  tempo: number;
  curveType: TempoPointSnapshot['curveType'];
}

const BEAT_EPSILON = 0.001;
const SECONDARY_BUTTON_CLASS = 'rounded border border-app-border/40 bg-app-surface px-3 py-1 text-ui text-app-text transition-colors hover:bg-app-hover';

function formatNumber(value: number): string {
  return value.toString();
}

function parseNumberText(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function isZeroBeat(beat: number): boolean {
  return Math.abs(beat) < BEAT_EPSILON;
}

export default function TempoMapEditorDialog({
  tempoMap,
  timeContext,
  onCommit,
  onClose,
}: TempoMapEditorDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TableRow[]>(() =>
    tempoMap.points.map((p) => {
      const timeBase = p.timeBase ?? 'BEATS';
      return {
        beatText: formatForBase(p.beat, timeBase, timeContext, false),
        timeBase,
        tempoText: formatNumber(Math.round(p.tempo)),
        beat: p.beat,
        tempo: Math.round(p.tempo),
        curveType: p.curveType,
      };
    })
  );

  const handleAdd = useCallback(() => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const beat = last ? last.beat + 4.0 : 0;
      const timeBase = last?.timeBase ?? 'BEATS';
      return [
        ...prev,
        {
          beatText: formatForBase(beat, timeBase, timeContext, false),
          timeBase,
          tempoText: formatNumber(last ? last.tempo : 60),
          beat,
          tempo: last ? last.tempo : 60,
          curveType: 'constant' as const,
        },
      ];
    });
  }, [timeContext]);

  const validateBeat = useCallback((index: number, value: string): number | null => {
    const row = rows[index];
    const beat = row ? parseForBase(value, row.timeBase, timeContext, false) : parseNumberText(value);
    if (beat == null || beat < 0) {
      setError('Start time must be valid for the selected time unit');
      return null;
    }

    const duplicate = rows.some((row, i) => {
      if (i === index) return false;
      const otherBeat = parseForBase(row.beatText, row.timeBase, timeContext, false);
      return otherBeat != null && Math.abs(otherBeat - beat) < BEAT_EPSILON;
    });
    if (duplicate) {
      setError(`Time point ${formatForBase(beat, row?.timeBase ?? 'BEATS', timeContext, false)} already has a tempo point`);
      return null;
    }

    setError(null);
    return beat;
  }, [rows, timeContext]);

  const validateTempo = useCallback((value: string): number | null => {
    const tempo = parseNumberText(value);
    if (tempo == null || tempo < 1 || tempo > 999) {
      setError('Tempo must be between 1 and 999 BPM');
      return null;
    }
    setError(null);
    return Math.round(tempo);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const row = prev[index];
      const beat = row ? (parseForBase(row.beatText, row.timeBase, timeContext, false) ?? row.beat) : null;
      if (beat != null && isZeroBeat(beat)) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setError(null);
  }, [timeContext]);

  const handleBeatChange = useCallback((index: number, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], beatText: value };
      return next;
    });
  }, []);

  const revertBeat = useCallback((index: number) => {
    setRows((prev) => {
      const row = prev[index];
      if (!row) return prev;
      const next = [...prev];
      next[index] = {
        ...row,
        beatText: formatForBase(row.beat, row.timeBase, timeContext, false),
      };
      return next;
    });
    setError(null);
  }, [timeContext]);

  const commitBeat = useCallback((index: number, value?: string): boolean => {
    const row = rows[index];
    if (!row) return false;
    const beat = validateBeat(index, value ?? row.beatText);
    if (beat == null) {
      revertBeat(index);
      return false;
    }
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], beatText: formatForBase(beat, row.timeBase, timeContext, false), beat };
      return next;
    });
    return true;
  }, [revertBeat, rows, timeContext, validateBeat]);

  const handleTimeBaseChange = useCallback((index: number, timeBase: string) => {
    setRows((prev) => {
      const row = prev[index];
      if (!row) return prev;
      const currentBeat = parseForBase(row.beatText, row.timeBase, timeContext, false) ?? row.beat;
      const next = [...prev];
      next[index] = {
        ...row,
        timeBase,
        beat: currentBeat,
        beatText: formatForBase(currentBeat, timeBase, timeContext, false),
      };
      return next;
    });
    setError(null);
  }, [timeContext]);

  const handleTempoChange = useCallback((index: number, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], tempoText: value };
      return next;
    });
  }, []);

  const revertTempo = useCallback((index: number) => {
    setRows((prev) => {
      const row = prev[index];
      if (!row) return prev;
      const next = [...prev];
      next[index] = {
        ...row,
        tempoText: formatNumber(row.tempo),
      };
      return next;
    });
    setError(null);
  }, []);

  const commitTempo = useCallback((index: number, value?: string): boolean => {
    const row = rows[index];
    if (!row) return false;
    const tempo = validateTempo(value ?? row.tempoText);
    if (tempo == null) {
      revertTempo(index);
      return false;
    }
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], tempoText: formatNumber(tempo), tempo };
      return next;
    });
    return true;
  }, [revertTempo, rows, validateTempo]);

  const handleOk = useCallback(() => {
    const points: TempoPointSnapshot[] = [];
    const seenBeats: number[] = [];
    for (const row of rows) {
      const beat = parseForBase(row.beatText, row.timeBase, timeContext, false);
      if (beat == null || beat < 0) {
        setError('All start times must be valid for their selected time units');
        return;
      }
      if (seenBeats.some((existing) => Math.abs(existing - beat) < BEAT_EPSILON)) {
        setError(`Time point ${formatForBase(beat, row.timeBase, timeContext, false)} already has a tempo point`);
        return;
      }
      seenBeats.push(beat);

      const tempo = parseNumberText(row.tempoText);
      if (tempo == null || tempo < 1 || tempo > 999) {
        setError('All tempos must be between 1 and 999 BPM');
        return;
      }
      points.push({ beat, tempo: Math.round(tempo), curveType: row.curveType, timeBase: row.timeBase });
    }

    const sortedRows = points.sort((a, b) => a.beat - b.beat);
    if (sortedRows.length === 0) {
      setError('Tempo map must have at least one point');
      return;
    }
    if (sortedRows[0].beat !== 0) {
      setError('First tempo point must start at beat 0');
      return;
    }

    setError(null);
    onCommit({
      type: 'replaceTempoMap',
      map: {
        enabled: tempoMap.enabled,
        visible: tempoMap.visible,
        points: sortedRows,
      },
    });
    onClose();
  }, [rows, timeContext, tempoMap.enabled, tempoMap.visible, onCommit, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  const canDelete = rows.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="rounded-lg border border-app-border/40 bg-app-menu shadow-xl"
        style={{ minWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="px-4 pb-2 pt-3 text-sm font-medium text-app-text">Edit Tempo Map</h3>

        <div className="px-4 pb-2 max-h-[200px] overflow-y-auto">
          <table className="w-full text-ui">
            <thead>
              <tr className="text-app-text-muted">
                <th className="text-left py-1 pr-2 font-normal">Time Unit</th>
                <th className="text-left py-1 pr-2 font-normal">Start</th>
                <th className="text-left py-1 pr-2 font-normal">Tempo (BPM)</th>
                <th className="text-center py-1 font-normal w-14"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rowBeat = parseForBase(row.beatText, row.timeBase, timeContext, false) ?? row.beat;
                const isTimeZero = isZeroBeat(rowBeat);
                const canDeleteRow = canDelete && !isTimeZero;

                return (
                  <tr key={i} className="border-t border-app-border/10">
                    <td className="py-1 pr-2">
                      <select
                        className="w-full rounded border border-app-border/30 bg-app-field px-1.5 py-0.5 text-ui text-app-text outline-none focus:border-app-border/60"
                        value={row.timeBase}
                        onChange={(e) => handleTimeBaseChange(i, e.target.value)}
                      >
                        {TIME_BASE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="text"
                        className="w-full rounded border border-app-border/30 bg-app-field px-1.5 py-0.5 text-ui text-app-text outline-none focus:border-app-border/60"
                        value={row.beatText}
                        onChange={(e) => handleBeatChange(i, e.target.value)}
                        onBlur={(e) => commitBeat(i, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitBeat(i, e.currentTarget.value);
                          }
                        }}
                        disabled={isTimeZero}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        className="w-full rounded border border-app-border/30 bg-app-field px-1.5 py-0.5 text-ui text-app-text outline-none focus:border-app-border/60"
                        value={row.tempoText}
                        onChange={(e) => handleTempoChange(i, e.target.value)}
                        onBlur={(e) => commitTempo(i, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitTempo(i, e.currentTarget.value);
                          }
                        }}
                        min={1}
                        max={999}
                        step={1}
                      />
                    </td>
                    <td className="py-1 text-center">
                      <button
                        className={`rounded px-1.5 py-0.5 text-tiny ${canDeleteRow ? 'text-app-danger hover:bg-app-outline-strong' : 'cursor-not-allowed text-app-text-muted'}`}
                        disabled={!canDeleteRow}
                        onClick={() => handleRemove(i)}
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {error && (
            <p className="mt-2 text-tiny text-app-danger">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-app-border/20 px-4 py-2">
          <button
            className="rounded border border-app-border/30 bg-app-surface px-3 py-1 text-ui text-app-text hover:bg-app-hover"
            onClick={handleAdd}
          >
            Add
          </button>
          <div className="flex gap-2">
            <button
              className={SECONDARY_BUTTON_CLASS}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded border border-app-border/30 bg-app-surface px-3 py-1 text-ui text-app-text hover:bg-app-hover"
              onClick={handleOk}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
