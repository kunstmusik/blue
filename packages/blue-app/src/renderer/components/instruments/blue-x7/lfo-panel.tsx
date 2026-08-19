import React from 'react';
import type { BlueX7Lfo } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';

export interface LfoPanelProps {
  lfo: BlueX7Lfo;
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
}

const LFO_WAVEFORMS = [
  { value: 0, label: 'Triangle' },
  { value: 1, label: 'Saw Down' },
  { value: 2, label: 'Saw Up' },
  { value: 3, label: 'Square' },
  { value: 4, label: 'Sine' },
  { value: 5, label: 'Sample & Hold' },
];

export const LfoPanel: React.FC<LfoPanelProps> = ({ lfo, onApplyPatch }) => {
  const handleFieldChange = (field: keyof BlueX7Lfo, label: string, min: number, max: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.max(min, Math.min(max, val));
        onApplyPatch(`Change LFO ${label} to ${clamped}`, {
          type: 'setLfoField',
          field,
          value: clamped,
        });
      }
    };
  };

  const handleWaveChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    onApplyPatch(`Change LFO Waveform to ${LFO_WAVEFORMS[val]?.label ?? val}`, {
      type: 'setLfoField',
      field: 'wave',
      value: val,
    });
  };

  const handleSyncToggle = () => {
    const nextVal = lfo.sync === 1 ? 0 : 1;
    onApplyPatch(`Set LFO Sync to ${nextVal === 1 ? 'On' : 'Off'}`, {
      type: 'setLfoField',
      field: 'sync',
      value: nextVal,
    });
  };

  return (
    <div className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-3" data-testid="bluex7-lfo-panel">
      <div className="flex items-center justify-between border-b border-blue-border pb-1">
        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Low Frequency Oscillator (LFO)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {/* Speed */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-speed" className="text-xs text-blue-muted">
            Speed (0–99)
          </label>
          <input
            id="bluex7-lfo-speed"
            aria-label="LFO Speed"
            type="number"
            min={0}
            max={99}
            value={lfo.speed}
            onChange={handleFieldChange('speed', 'Speed', 0, 99)}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-xs text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* Delay */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-delay" className="text-xs text-blue-muted">
            Delay (0–99)
          </label>
          <input
            id="bluex7-lfo-delay"
            aria-label="LFO Delay"
            type="number"
            min={0}
            max={99}
            value={lfo.delay}
            onChange={handleFieldChange('delay', 'Delay', 0, 99)}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-xs text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* PMD */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-pmd" className="text-xs text-blue-muted">
            PMD (0–99)
          </label>
          <input
            id="bluex7-lfo-pmd"
            aria-label="LFO Pitch Modulation Depth"
            type="number"
            min={0}
            max={99}
            value={lfo.pitchModulationDepth}
            onChange={handleFieldChange('pitchModulationDepth', 'PMD', 0, 99)}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-xs text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* AMD */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-amd" className="text-xs text-blue-muted">
            AMD (0–99)
          </label>
          <input
            id="bluex7-lfo-amd"
            aria-label="LFO Amplitude Modulation Depth"
            type="number"
            min={0}
            max={99}
            value={lfo.amplitudeModulationDepth}
            onChange={handleFieldChange('amplitudeModulationDepth', 'AMD', 0, 99)}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-xs text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* Waveform */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-wave" className="text-xs text-blue-muted">
            Waveform
          </label>
          <select
            id="bluex7-lfo-wave"
            aria-label="LFO Waveform"
            value={lfo.wave}
            onChange={handleWaveChange}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-xs text-gray-100 focus:border-blue-accent focus:outline-none"
          >
            {LFO_WAVEFORMS.map((wf) => (
              <option key={wf.value} value={wf.value}>
                {wf.label}
              </option>
            ))}
          </select>
        </div>

        {/* Key Sync */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-blue-muted">Sync</span>
          <label className="flex items-center gap-2 pt-1 text-xs text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              aria-label="LFO Sync"
              checked={lfo.sync === 1}
              onChange={handleSyncToggle}
              className="rounded border-blue-border"
            />
            Key Sync
          </label>
        </div>
      </div>
    </div>
  );
};
