import { useState, useCallback } from 'react';
import type { MeterMapSnapshot, MeterMapPatch, MeterEntryInput } from '../../../../../shared/project-editor';
import { parseMeterSignature, isPowerOfTwo } from './meter-map-utils';
import { cn } from '../../../../lib/cn';

const SECONDARY_BUTTON_CLASS = 'rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-body text-app-text transition-colors hover:bg-app-hover';

interface MeterMapEditorDialogProps {
  meterMap: MeterMapSnapshot;
  onCommit: (patch: MeterMapPatch) => void;
  onClose: () => void;
}

interface TableRow {
  measure: string;
  signatureText: string;
  numBeats: number;
  beatLength: number;
}

function parseMeasureText(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const measure = Number(trimmed);
  return Number.isInteger(measure) ? measure : null;
}

export default function MeterMapEditorDialog({
  meterMap,
  onCommit,
  onClose,
}: MeterMapEditorDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TableRow[]>(() =>
    meterMap.entries.map((e) => ({
      measure: e.measure.toString(),
      signatureText: `${e.numBeats}/${e.beatLength}`,
      numBeats: e.numBeats,
      beatLength: e.beatLength,
    }))
  );

  const handleAdd = useCallback(() => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const lastMeasure = last ? (parseMeasureText(last.measure) ?? 1) : 1;
      return [
        ...prev,
        {
          measure: (lastMeasure + 8).toString(),
          signatureText: '4/4',
          numBeats: 4,
          beatLength: 4,
        },
      ];
    });
  }, []);

  const validateMeasure = useCallback((index: number, value: string): number | null => {
    const measure = parseMeasureText(value);
    if (measure == null || measure < 1) {
      setError('Measure must be a positive integer');
      return null;
    }

    if (index === 0 && measure !== 1) {
      setError('First meter entry must start at measure 1');
      return null;
    }

    const duplicate = rows.some((row, i) => i !== index && parseMeasureText(row.measure) === measure);
    if (duplicate) {
      setError(`Measure ${measure} already has a meter entry`);
      return null;
    }

    setError(null);
    return measure;
  }, [rows]);

  const validateSignature = useCallback((value: string): { numBeats: number; beatLength: number } | null => {
    const parsed = parseMeterSignature(value);
    if (!parsed || !Number.isInteger(parsed.numBeats) || parsed.numBeats < 1 || !isPowerOfTwo(parsed.beatLength)) {
      setError('Invalid signature format (use N/D with a power-of-two denominator)');
      return null;
    }
    setError(null);
    return parsed;
  }, []);

  const handleRemove = useCallback((index: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setError(null);
  }, []);

  const handleMeasureChange = useCallback((index: number, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], measure: value };
      return next;
    });
  }, []);

  const commitMeasure = useCallback((index: number, value?: string): boolean => {
    const row = rows[index];
    if (!row) return false;
    const measure = validateMeasure(index, value ?? row.measure);
    if (measure == null) return false;
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], measure: measure.toString() };
      return next;
    });
    return true;
  }, [rows, validateMeasure]);

  const handleSignatureChange = useCallback((index: number, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], signatureText: value };
      return next;
    });
  }, []);

  const commitSignature = useCallback((index: number, value?: string): boolean => {
    const row = rows[index];
    if (!row) return false;
    const parsed = validateSignature(value ?? row.signatureText);
    if (!parsed) return false;
    setRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        signatureText: `${parsed.numBeats}/${parsed.beatLength}`,
        numBeats: parsed.numBeats,
        beatLength: parsed.beatLength,
      };
      return next;
    });
    return true;
  }, [rows, validateSignature]);

  const handleOk = useCallback(() => {
    const entries: MeterEntryInput[] = [];
    const seenMeasures = new Set<number>();
    for (const row of rows) {
      const measure = parseMeasureText(row.measure);
      if (measure == null || measure < 1) {
        setError('All measures must be positive integers');
        return;
      }
      if (seenMeasures.has(measure)) {
        setError(`Measure ${measure} already has a meter entry`);
        return;
      }
      seenMeasures.add(measure);
      const parsed = parseMeterSignature(row.signatureText);
      if (!parsed || !Number.isInteger(parsed.numBeats) || parsed.numBeats < 1 || !isPowerOfTwo(parsed.beatLength)) {
        setError('All time signatures must use N/D with a power-of-two denominator');
        return;
      }
      entries.push({ measure, numBeats: parsed.numBeats, beatLength: parsed.beatLength });
    }
    if (entries.length === 0) {
      setError('Meter map must have at least one entry');
      return;
    }

    const sorted = [...entries].sort((a, b) => a.measure - b.measure);
    if (sorted[0].measure !== 1) {
      setError('First meter entry must start at measure 1');
      return;
    }

    setError(null);
    onCommit({ type: 'meter-map-replace', entries: sorted });
    onClose();
  }, [rows, onCommit, onClose]);

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
        style={{ minWidth: 320 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="px-4 pb-2 pt-3 text-role-title-3 font-semibold text-app-text">Edit Time Signature Map</h3>

        <div className="px-4 pb-2 max-h-[200px] overflow-y-auto bg-black">
          <table className="w-full text-role-body">
            <thead>
              <tr className="text-app-text-muted">
                <th className="text-left py-1 pr-2 font-normal">Measure</th>
                <th className="text-left py-1 pr-2 font-normal">Time Signature</th>
                <th className="text-center py-1 font-normal w-14"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-app-border/10">
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      className="w-full rounded border border-app-border/30 bg-app-field px-1.5 py-0.5 text-role-body text-app-text outline-none focus:border-app-border/60"
                      value={row.measure}
                      onChange={(e) => handleMeasureChange(i, e.target.value)}
                      onBlur={(e) => commitMeasure(i, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitMeasure(i, e.currentTarget.value);
                        }
                      }}
                      disabled={i === 0}
                      min={1}
                      step={1}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      className="w-full rounded border border-app-border/30 bg-app-field px-1.5 py-0.5 text-role-body text-app-text outline-none focus:border-app-border/60"
                      value={row.signatureText}
                      onChange={(e) => handleSignatureChange(i, e.target.value)}
                      onBlur={(e) => commitSignature(i, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitSignature(i, e.currentTarget.value);
                        }
                      }}
                    />
                  </td>
                  <td className="py-1 text-center">
                    <button
                      className={cn(
                        'rounded px-1.5 py-0.5 text-role-callout',
                        canDelete ? 'text-app-danger hover:bg-app-outline-strong' : 'cursor-not-allowed text-app-text-muted',
                      )}
                      disabled={!canDelete}
                      onClick={() => handleRemove(i)}
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && (
            <p className="mt-2 text-role-callout text-app-danger">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-app-border/20 px-4 py-2">
          <button
            className="rounded border border-app-border/30 bg-app-surface px-3 py-1 text-role-body text-app-text hover:bg-app-hover"
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
              className="rounded border border-app-border/30 bg-app-surface px-3 py-1 text-role-body text-app-text hover:bg-app-hover"
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
