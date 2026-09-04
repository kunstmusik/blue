import React from 'react';
import type { BlueX7Lfo } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import { AppSelect } from '../../AppSelect';
import { blueX7WidgetDomain, type BlueX7WidgetDomain } from './catalog-domains';

const LFO_FIELD_DOMAINS = {
  speed: blueX7WidgetDomain('lfo.speed'),
  delay: blueX7WidgetDomain('lfo.delay'),
  pitchModulationDepth: blueX7WidgetDomain('lfo.pitchModulationDepth'),
  amplitudeModulationDepth: blueX7WidgetDomain('lfo.amplitudeModulationDepth'),
} as const;

export interface LfoPanelProps {
  lfo: BlueX7Lfo;
  effectiveValues?: ReadonlyMap<string, number>;
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

export const LfoPanel: React.FC<LfoPanelProps> = ({ lfo, effectiveValues, onApplyPatch }) => {
  const effective = (key: string, fallback: number): number =>
    effectiveValues?.get(key) ?? fallback;
  const handleFieldChange = (field: keyof BlueX7Lfo, label: string, domain: BlueX7WidgetDomain) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.max(domain.min, Math.min(domain.max, val));
        onApplyPatch(`Change LFO ${label} to ${clamped}`, {
          type: 'setLfoField',
          field,
          value: clamped,
        });
      }
    };
  };

  const handleWaveChange = (value: string) => {
    const val = parseInt(value, 10);
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
    <div
      className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-3"
      data-testid="bluex7-lfo-panel"
    >
      <div className="flex items-center justify-between border-b border-blue-border pb-1">
        <span className="text-role-headline font-bold text-gray-200 uppercase tracking-wider">
          Low Frequency Oscillator (LFO)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {/* Speed */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-speed" className="text-role-body text-blue-muted">
            Speed ({LFO_FIELD_DOMAINS.speed.min}–{LFO_FIELD_DOMAINS.speed.max})
          </label>
          <input
            id="bluex7-lfo-speed"
            aria-label="LFO Speed"
            type="number"
            min={LFO_FIELD_DOMAINS.speed.min}
            max={LFO_FIELD_DOMAINS.speed.max}
            value={effective('lfo.speed', lfo.speed)}
            onChange={handleFieldChange('speed', 'Speed', LFO_FIELD_DOMAINS.speed)}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* Delay */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-delay" className="text-role-body text-blue-muted">
            Delay ({LFO_FIELD_DOMAINS.delay.min}–{LFO_FIELD_DOMAINS.delay.max})
          </label>
          <input
            id="bluex7-lfo-delay"
            aria-label="LFO Delay"
            type="number"
            min={LFO_FIELD_DOMAINS.delay.min}
            max={LFO_FIELD_DOMAINS.delay.max}
            value={effective('lfo.delay', lfo.delay)}
            onChange={handleFieldChange('delay', 'Delay', LFO_FIELD_DOMAINS.delay)}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* PMD */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-pmd" className="text-role-body text-blue-muted">
            PMD ({LFO_FIELD_DOMAINS.pitchModulationDepth.min}–
            {LFO_FIELD_DOMAINS.pitchModulationDepth.max})
          </label>
          <input
            id="bluex7-lfo-pmd"
            aria-label="LFO Pitch Modulation Depth"
            type="number"
            min={LFO_FIELD_DOMAINS.pitchModulationDepth.min}
            max={LFO_FIELD_DOMAINS.pitchModulationDepth.max}
            value={effective('lfo.pitchModulationDepth', lfo.pitchModulationDepth)}
            onChange={handleFieldChange(
              'pitchModulationDepth',
              'PMD',
              LFO_FIELD_DOMAINS.pitchModulationDepth,
            )}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* AMD */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-amd" className="text-role-body text-blue-muted">
            AMD ({LFO_FIELD_DOMAINS.amplitudeModulationDepth.min}–
            {LFO_FIELD_DOMAINS.amplitudeModulationDepth.max})
          </label>
          <input
            id="bluex7-lfo-amd"
            aria-label="LFO Amplitude Modulation Depth"
            type="number"
            min={LFO_FIELD_DOMAINS.amplitudeModulationDepth.min}
            max={LFO_FIELD_DOMAINS.amplitudeModulationDepth.max}
            value={effective('lfo.amplitudeModulationDepth', lfo.amplitudeModulationDepth)}
            onChange={handleFieldChange(
              'amplitudeModulationDepth',
              'AMD',
              LFO_FIELD_DOMAINS.amplitudeModulationDepth,
            )}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* Waveform */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bluex7-lfo-wave" className="text-role-body text-blue-muted">
            Waveform
          </label>
          <AppSelect
            id="bluex7-lfo-wave"
            aria-label="LFO Waveform"
            value={effective('lfo.wave', lfo.wave)}
            onValueChange={handleWaveChange}
            options={LFO_WAVEFORMS}
            className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        </div>

        {/* Key Sync */}
        <div className="flex flex-col gap-1">
          <span className="text-role-body text-blue-muted">Sync</span>
          <label className="flex items-center gap-2 pt-1 text-role-body text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              aria-label="LFO Sync"
              checked={effective('lfo.sync', lfo.sync) === 1}
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
