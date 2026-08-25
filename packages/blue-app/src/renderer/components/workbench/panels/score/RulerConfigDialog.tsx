import { useState, useEffect } from 'react';
import { TimeBase } from '@blue/data';
import type { ScoreTimeStateSnapshot } from '../../../../../shared/project-editor';
import { useHostDocument } from '../../../../hooks/use-host-document';

const SECONDARY_BUTTON_CLASS = 'px-3 py-1 text-role-body text-blue-text bg-blue-surface/40 hover:bg-blue-surface/70 rounded border border-blue-border/40 transition-colors cursor-pointer';

export type TimebaseUpdateMode = 'UPDATE_ALL' | 'UPDATE_MATCHING';

export interface RulerConfigChanges {
  primaryTimeDisplay: string;
  secondaryRulerEnabled: boolean;
  secondaryTimeDisplay: string;
  smpteFrameRate: number;
  scoreObjectUpdateMode: TimebaseUpdateMode | null;
  markerUpdateMode: TimebaseUpdateMode | null;
}

interface Props {
  timeState: ScoreTimeStateSnapshot;
  onApply: (changes: RulerConfigChanges) => void;
  onClose: () => void;
}

const TIME_DISPLAY_OPTIONS: { value: string; label: string }[] = [
  { value: TimeBase.BEATS, label: 'Beats' },
  { value: TimeBase.BBT, label: 'BBT' },
  { value: TimeBase.BBST, label: 'BBST' },
  { value: TimeBase.BBF, label: 'BBF' },
  { value: TimeBase.TIME, label: 'Time' },
  { value: TimeBase.SMPTE, label: 'SMPTE' },
  { value: TimeBase.SECONDS, label: 'Seconds' },
  { value: TimeBase.FRAME, label: 'Samples' },
];

const SMPTE_FRAME_RATES = [
  { value: 23.976, label: '23.976 fps' },
  { value: 24, label: '24 fps' },
  { value: 25, label: '25 fps' },
  { value: 29.97, label: '29.97 fps (drop)' },
  { value: 30, label: '30 fps' },
  { value: 50, label: '50 fps' },
  { value: 59.94, label: '59.94 fps' },
  { value: 60, label: '60 fps' },
];

export default function RulerConfigDialog({ timeState, onApply, onClose }: Props) {
  const [primaryTimeDisplay, setPrimaryTimeDisplay] = useState(timeState.primaryTimeDisplay);
  const [secondaryRulerEnabled, setSecondaryRulerEnabled] = useState(timeState.secondaryRulerEnabled);
  const [secondaryTimeDisplay, setSecondaryTimeDisplay] = useState(timeState.secondaryTimeDisplay);
  const [smpteFrameRate, setSmpteFrameRate] = useState(timeState.smpteFrameRate);

  const [updateScoreObjects, setUpdateScoreObjects] = useState(true);
  const [scoreObjectMode, setScoreObjectMode] = useState<TimebaseUpdateMode>('UPDATE_ALL');
  const [updateMarkers, setUpdateMarkers] = useState(true);
  const [markerMode, setMarkerMode] = useState<TimebaseUpdateMode>('UPDATE_ALL');

  const hostWindow = useHostDocument()?.defaultView ?? null;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // Escape must be observed in the window hosting this dialog (popout-safe).
    if (!hostWindow) return undefined;
    hostWindow.addEventListener('keydown', handleKeyDown);
    return () => hostWindow.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hostWindow]);

  function handleOk() {
    onApply({
      primaryTimeDisplay,
      secondaryRulerEnabled,
      secondaryTimeDisplay,
      smpteFrameRate,
      scoreObjectUpdateMode: updateScoreObjects ? scoreObjectMode : null,
      markerUpdateMode: updateMarkers ? markerMode : null,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-blue-border/50 bg-app-menu text-blue-text shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-4">
          <h2 className="text-role-title-2 font-bold border-b border-blue-border/30 pb-2">Ruler Configuration</h2>

          {/* Primary Ruler */}
          <fieldset className="space-y-2">
            <legend className="text-role-headline font-bold text-blue-text">Primary Ruler</legend>
            <div className="flex items-center gap-2">
              <label className="text-role-body text-blue-muted w-16 shrink-0">Format:</label>
              <select
                className="flex-1 bg-blue-surface border border-blue-border/40 rounded px-2 py-1 text-role-body text-blue-text cursor-pointer"
                value={primaryTimeDisplay}
                onChange={(e) => setPrimaryTimeDisplay(e.target.value)}
              >
                {TIME_DISPLAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* Update ScoreObjects */}
          <fieldset className="space-y-1">
            <label className="flex items-center gap-2 text-role-body text-blue-text cursor-pointer">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 cursor-pointer"
                checked={updateScoreObjects}
                onChange={(e) => setUpdateScoreObjects(e.target.checked)}
              />
              Update ScoreObjects
            </label>
            <div className="ml-6 space-y-0.5">
              <label className="flex items-center gap-2 text-role-body text-blue-muted cursor-pointer">
                <input
                  type="radio"
                  name="scoreObjectMode"
                  className="w-3 h-3 cursor-pointer"
                  checked={scoreObjectMode === 'UPDATE_ALL'}
                  disabled={!updateScoreObjects}
                  onChange={() => setScoreObjectMode('UPDATE_ALL')}
                />
                Update All TimeBases
              </label>
              <label className="flex items-center gap-2 text-role-body text-blue-muted cursor-pointer">
                <input
                  type="radio"
                  name="scoreObjectMode"
                  className="w-3 h-3 cursor-pointer"
                  checked={scoreObjectMode === 'UPDATE_MATCHING'}
                  disabled={!updateScoreObjects}
                  onChange={() => setScoreObjectMode('UPDATE_MATCHING')}
                />
                Update Matching TimeBases
              </label>
            </div>
          </fieldset>

          {/* Update Markers */}
          <fieldset className="space-y-1">
            <label className="flex items-center gap-2 text-role-body text-blue-text cursor-pointer">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 cursor-pointer"
                checked={updateMarkers}
                onChange={(e) => setUpdateMarkers(e.target.checked)}
              />
              Update Markers
            </label>
            <div className="ml-6 space-y-0.5">
              <label className="flex items-center gap-2 text-role-body text-blue-muted cursor-pointer">
                <input
                  type="radio"
                  name="markerMode"
                  className="w-3 h-3 cursor-pointer"
                  checked={markerMode === 'UPDATE_ALL'}
                  disabled={!updateMarkers}
                  onChange={() => setMarkerMode('UPDATE_ALL')}
                />
                Update All TimeBases
              </label>
              <label className="flex items-center gap-2 text-role-body text-blue-muted cursor-pointer">
                <input
                  type="radio"
                  name="markerMode"
                  className="w-3 h-3 cursor-pointer"
                  checked={markerMode === 'UPDATE_MATCHING'}
                  disabled={!updateMarkers}
                  onChange={() => setMarkerMode('UPDATE_MATCHING')}
                />
                Update Matching TimeBases
              </label>
            </div>
          </fieldset>

          {/* Secondary Ruler */}
          <fieldset className="space-y-2">
            <legend className="text-role-headline font-bold text-blue-text">Secondary Ruler</legend>
            <label className="flex items-center gap-2 text-role-body text-blue-text cursor-pointer">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 cursor-pointer"
                checked={secondaryRulerEnabled}
                onChange={(e) => setSecondaryRulerEnabled(e.target.checked)}
              />
              Enabled
            </label>
            {secondaryRulerEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-role-body text-blue-muted w-16 shrink-0">Format:</label>
                <select
                  className="flex-1 bg-blue-surface border border-blue-border/40 rounded px-2 py-1 text-role-body text-blue-text cursor-pointer"
                  value={secondaryTimeDisplay}
                  onChange={(e) => setSecondaryTimeDisplay(e.target.value)}
                >
                  {TIME_DISPLAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>

          {/* SMPTE Settings */}
          <fieldset className="space-y-2">
            <legend className="text-role-headline font-bold text-blue-text">SMPTE Settings</legend>
            <div className="flex items-center gap-2">
              <label className="text-role-body text-blue-muted w-16 shrink-0">Frame Rate:</label>
              <select
                className="flex-1 bg-blue-surface border border-blue-border/40 rounded px-2 py-1 text-role-body text-blue-text cursor-pointer"
                value={smpteFrameRate}
                onChange={(e) => setSmpteFrameRate(Number(e.target.value))}
              >
                {SMPTE_FRAME_RATES.map((rate) => (
                  <option key={rate.value} value={rate.value}>{rate.label}</option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-blue-border/30">
            <button
              className={SECONDARY_BUTTON_CLASS}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1 text-role-body text-blue-text bg-blue-accent/20 hover:bg-blue-accent/30 rounded transition-colors font-medium cursor-pointer"
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
