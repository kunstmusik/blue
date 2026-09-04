import { useState, useEffect, useCallback } from 'react';
import type { TempoMapSnapshot, TempoMapPatch } from '../../../../../shared/project-editor';

const BEAT_EPSILON = 0.001;
const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-body text-app-text transition-colors hover:bg-app-hover';

interface TempoPointDialogProps {
  pointIndex: number;
  tempoMap: TempoMapSnapshot;
  onTempoPatch: (patch: TempoMapPatch) => void;
  onClose: () => void;
}

export default function TempoPointDialog({
  pointIndex,
  tempoMap,
  onTempoPatch,
  onClose,
}: TempoPointDialogProps) {
  const points = tempoMap.points;
  const point = points[pointIndex];
  const isTimeZero = Math.abs(point.beat) < BEAT_EPSILON;

  const prevBeat = pointIndex === 0 ? 0 : points[pointIndex - 1].beat + BEAT_EPSILON;
  const nextBeat =
    pointIndex < points.length - 1 ? points[pointIndex + 1].beat - BEAT_EPSILON : Infinity;

  const [beat, setBeat] = useState(point.beat.toString());
  const [tempo, setTempo] = useState(Math.round(point.tempo).toString());

  useEffect(() => {
    setBeat(point.beat.toString());
    setTempo(Math.round(point.tempo).toString());
  }, [point.beat, point.tempo]);

  const handleOk = useCallback(() => {
    const newBeat = isTimeZero ? 0 : Math.max(prevBeat, Math.min(nextBeat, parseFloat(beat) || 0));
    const newTempo = Math.max(1, Math.min(999, parseFloat(tempo) || 60));

    onTempoPatch({
      type: 'updateTempoPoint',
      index: pointIndex,
      patch: {
        beat: newBeat,
        tempo: newTempo,
      },
    });
    onClose();
  }, [pointIndex, isTimeZero, prevBeat, nextBeat, beat, tempo, onTempoPatch, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleOk();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleOk, onClose],
  );

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
        <h3 className="mb-3 text-role-title-3 font-semibold text-app-text">
          {isTimeZero ? 'Edit Initial Tempo' : `Edit Tempo Point ${pointIndex + 1}`}
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="w-14 text-role-body text-app-text-muted">Beat</label>
            <input
              type="number"
              className="flex-1 rounded border border-app-border/30 bg-app-field px-2 py-1 text-role-body text-app-text outline-none focus:border-app-border/60"
              value={beat}
              onChange={(e) => setBeat(e.target.value)}
              disabled={isTimeZero}
              min={prevBeat}
              max={isTimeZero ? 0 : nextBeat === Infinity ? undefined : nextBeat}
              step={0.001}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-14 text-role-body text-app-text-muted">Tempo</label>
            <input
              type="number"
              className="flex-1 rounded border border-app-border/30 bg-app-field px-2 py-1 text-role-body text-app-text outline-none focus:border-app-border/60"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              min={1}
              max={999}
              step={1}
            />
            <span className="text-role-callout text-app-text-muted">BPM</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
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
  );
}
