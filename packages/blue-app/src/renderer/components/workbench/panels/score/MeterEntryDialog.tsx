import { useState, useEffect, useCallback } from 'react';
import type { MeterMapSnapshot, MeterMapPatch } from '../../../../../shared/project-editor';
import { parseMeterSignature, isPowerOfTwo } from './meter-map-utils';

const SECONDARY_BUTTON_CLASS = 'rounded border border-app-border/40 bg-app-surface px-3 py-1 text-ui text-app-text transition-colors hover:bg-app-hover';

interface MeterEntryDialogProps {
  entryIndex: number;
  meterMap: MeterMapSnapshot;
  onMeterPatch: (patch: MeterMapPatch) => void;
  onClose: () => void;
}

export default function MeterEntryDialog({
  entryIndex,
  meterMap,
  onMeterPatch,
  onClose,
}: MeterEntryDialogProps) {
  const entries = meterMap.entries;
  const entry = entries[entryIndex];
  const isFirst = entryIndex === 0;

  const prevMeasure = isFirst ? 1 : entries[entryIndex - 1].measure + 1;
  const nextMeasure = entryIndex < entries.length - 1 ? entries[entryIndex + 1].measure - 1 : 9999;

  const [measure, setMeasure] = useState(entry.measure.toString());
  const [signatureText, setSignatureText] = useState(`${entry.numBeats}/${entry.beatLength}`);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMeasure(entry.measure.toString());
    setSignatureText(`${entry.numBeats}/${entry.beatLength}`);
  }, [entry.measure, entry.numBeats, entry.beatLength]);

  const handleOk = useCallback(() => {
    const parsed = parseMeterSignature(signatureText);
    if (!parsed) {
      setError('Invalid signature format (use N/D)');
      return;
    }

    const measureNum = parseInt(measure, 10);
    if (!Number.isInteger(measureNum) || measureNum < 1) {
      setError('Measure must be a positive integer');
      return;
    }

    if (!isFirst && measureNum < prevMeasure) {
      setError(`Measure must be >= ${prevMeasure}`);
      return;
    }
    if (measureNum > nextMeasure) {
      setError(`Measure must be <= ${nextMeasure}`);
      return;
    }

    setError(null);
    onMeterPatch({
      type: 'meter-map-update-entry',
      previousMeasure: entry.measure,
      measure: isFirst ? 1 : measureNum,
      numBeats: parsed.numBeats,
      beatLength: parsed.beatLength,
    });
    onClose();
  }, [entry.measure, isFirst, prevMeasure, nextMeasure, measure, signatureText, onMeterPatch, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleOk();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleOk, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="min-w-60 rounded-lg border border-app-border/40 bg-app-menu p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="mb-3 text-sm font-medium text-app-text">
          {isFirst ? 'Edit Initial Time Signature' : `Edit Time Signature at Measure ${entry.measure}`}
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="w-20 text-ui text-app-text-muted">Measure</label>
            <input
              type="number"
              className="flex-1 rounded border border-app-border/30 bg-app-field px-2 py-1 text-ui text-app-text outline-none focus:border-app-border/60"
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              disabled={isFirst}
              min={isFirst ? 1 : prevMeasure}
              max={nextMeasure}
              step={1}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-20 text-ui text-app-text-muted">Time Signature</label>
            <input
              type="text"
              className="flex-1 rounded border border-app-border/30 bg-app-field px-2 py-1 text-ui text-app-text outline-none focus:border-app-border/60"
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              placeholder="e.g. 4/4 or 7/8"
            />
          </div>
          {error && (
            <p className="text-tiny text-app-danger">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
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
  );
}
