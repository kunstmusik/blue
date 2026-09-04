import React from 'react';
import type { BlueX7Common } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import { AlgorithmTopology } from './algorithm-topology';
import { AppSelect } from '../../AppSelect';
import { blueX7WidgetDomain } from './catalog-domains';
import { cn } from '../../../lib/cn';

const ALGORITHM_DOMAIN = blueX7WidgetDomain('common.algorithm');
const TRANSPOSE_DOMAIN = blueX7WidgetDomain('common.transpose');
// The widget shows transpose as centered semitones (stored 0..48 → −24..+24).
const TRANSPOSE_SEMITONE_MIN = TRANSPOSE_DOMAIN.min - (TRANSPOSE_DOMAIN.min + TRANSPOSE_DOMAIN.max) / 2;
const TRANSPOSE_SEMITONE_MAX = TRANSPOSE_DOMAIN.max - (TRANSPOSE_DOMAIN.min + TRANSPOSE_DOMAIN.max) / 2;
const TRANSPOSE_CENTER_OFFSET = (TRANSPOSE_DOMAIN.min + TRANSPOSE_DOMAIN.max) / 2;
const FEEDBACK_DOMAIN = blueX7WidgetDomain('common.feedback');
const SHARED_PMS_DOMAIN = blueX7WidgetDomain('lfo.pitchModulationSensitivity');

export interface CommonPanelProps {
  common: BlueX7Common;
  sharedSync?: number | 'mixed';
  sharedPms?: number | 'mixed';
  effectiveValues?: ReadonlyMap<string, number>;
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
  onOpenAlgorithmModal?: () => void;
}

export const CommonPanel: React.FC<CommonPanelProps> = ({
  common,
  sharedSync,
  sharedPms,
  effectiveValues,
  onApplyPatch,
  onOpenAlgorithmModal,
}) => {
  const effective = (key: string, fallback: number): number => effectiveValues?.get(key) ?? fallback;
  const displayedAlgorithm = effective('common.algorithm', common.algorithm);
  const displayTranspose = effective('common.transpose', common.keyTranspose) - 24;
  const displayedFeedback = effective('common.feedback', common.feedback);
  const displayedSync = effective(
    'common.oscillatorKeySync',
    typeof sharedSync === 'number' ? sharedSync : 0,
  );
  const displayedPms = effective(
    'lfo.pitchModulationSensitivity',
    typeof sharedPms === 'number' ? sharedPms : 0,
  );
  const displayedOperatorEnabled = common.operatorEnabled.map((enabled, index) => (
    effective(`operator.${index + 1}.enabled`, enabled ? 1 : 0) >= 0.5
  ));

  const handleAlgorithmChange = (value: string) => {
    const val = parseInt(value, 10);
    onApplyPatch(`Change Algorithm to ${val}`, {
      type: 'setCommonField',
      field: 'algorithm',
      value: val,
    });
  };

  const handleTransposeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const semitones = parseInt(e.target.value, 10);
    if (!Number.isNaN(semitones)) {
      const clamped = Math.max(TRANSPOSE_SEMITONE_MIN, Math.min(TRANSPOSE_SEMITONE_MAX, semitones));
      onApplyPatch(`Change Key Transpose to ${clamped}`, {
        type: 'setCommonField',
        field: 'keyTranspose',
        value: clamped + TRANSPOSE_CENTER_OFFSET,
      });
    }
  };

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      const clamped = Math.max(FEEDBACK_DOMAIN.min, Math.min(FEEDBACK_DOMAIN.max, val));
      onApplyPatch(`Change Feedback to ${clamped}`, {
        type: 'setCommonField',
        field: 'feedback',
        value: clamped,
      });
    }
  };

  const handleOperatorToggle = (index: number) => {
    const current = common.operatorEnabled[index] ?? true;
    onApplyPatch(`Toggle Operator ${index + 1} ${!current ? 'On' : 'Off'}`, {
      type: 'setOperatorEnabled',
      operatorIndex: index,
      enabled: !current,
    });
  };

  const handleSharedSyncToggle = () => {
    const nextVal = sharedSync === 1 ? 0 : 1;
    onApplyPatch(`Set All Oscillators Sync to ${nextVal === 1 ? 'On' : 'Off'}`, {
      type: 'setSharedOscillatorSync',
      value: nextVal,
    });
  };

  const handleSharedPmsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      const clamped = Math.max(SHARED_PMS_DOMAIN.min, Math.min(SHARED_PMS_DOMAIN.max, val));
      onApplyPatch(`Set All PMS to ${clamped}`, {
        type: 'setSharedPitchModulationSensitivity',
        value: clamped,
      });
    }
  };

  return (
    <div className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-3" data-testid="bluex7-common-panel">
      <div className="flex items-center justify-between border-b border-blue-border pb-1">
        <span className="text-role-headline font-bold text-gray-200 uppercase tracking-wider">Common & Algorithms</span>
      </div>

      <div className="flex min-w-0 flex-col sm:flex-row gap-4 items-start">
        <AlgorithmTopology
          algorithm={displayedAlgorithm}
          operatorEnabled={displayedOperatorEnabled}
          onToggleOperator={handleOperatorToggle}
          onOpenModal={onOpenAlgorithmModal}
        />

        <div className="min-w-0 flex-1 space-y-3 w-full">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Algorithm selector */}
            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-algorithm" className="text-role-body text-blue-muted">
                Algorithm ({ALGORITHM_DOMAIN.min}–{ALGORITHM_DOMAIN.max})
              </label>
              <div className="flex items-center gap-1">
                <AppSelect
                  id="bluex7-algorithm"
                  aria-label="Algorithm"
                  value={displayedAlgorithm}
                  onValueChange={handleAlgorithmChange}
                  options={Array.from({ length: ALGORITHM_DOMAIN.max - ALGORITHM_DOMAIN.min + 1 }, (_, index) => ({
                    value: ALGORITHM_DOMAIN.min + index,
                    label: `Algorithm ${ALGORITHM_DOMAIN.min + index}`,
                  }))}
                  className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                />
                {onOpenAlgorithmModal && (
                  <button
                    type="button"
                    aria-label="Algorithm Dialog"
                    onClick={onOpenAlgorithmModal}
                    className="rounded border border-blue-border bg-blue-surface px-2 py-1 text-role-body text-gray-200 hover:bg-blue-accent/20"
                    title="View Algorithms"
                  >
                    Diagram
                  </button>
                )}
              </div>
            </div>

            {/* Key Transpose */}
            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-key-transpose" className="text-role-body text-blue-muted">
                Key Transpose ({displayTranspose >= 0 ? `+${displayTranspose}` : displayTranspose} st)
              </label>
              <input
                id="bluex7-key-transpose"
                aria-label="Key Transpose"
                type="number"
                min={TRANSPOSE_SEMITONE_MIN}
                max={TRANSPOSE_SEMITONE_MAX}
                value={displayTranspose}
                onChange={handleTransposeChange}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            {/* Feedback */}
            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-feedback" className="text-role-body text-blue-muted">
                Feedback ({FEEDBACK_DOMAIN.min}–{FEEDBACK_DOMAIN.max})
              </label>
              <input
                id="bluex7-feedback"
                aria-label="Feedback"
                type="number"
                min={FEEDBACK_DOMAIN.min}
                max={FEEDBACK_DOMAIN.max}
                value={displayedFeedback}
                onChange={handleFeedbackChange}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            {/* Shared Controls */}
            <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
              <span className="text-role-body text-blue-muted">Shared Sync & PMS</span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-role-body text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Shared Oscillator Sync"
                    checked={displayedSync === 1}
                    ref={(el) => {
                      if (el) el.indeterminate = sharedSync === 'mixed';
                    }}
                    onChange={handleSharedSyncToggle}
                    className="rounded border-blue-border"
                  />
                  Sync
                </label>
                <div className="flex items-center gap-1">
                  <label htmlFor="bluex7-shared-pms" className="text-role-body text-blue-muted">
                    PMS
                  </label>
                  <input
                    id="bluex7-shared-pms"
                    aria-label="Shared Pitch Modulation Sensitivity"
                    type="number"
                    min={SHARED_PMS_DOMAIN.min}
                    max={SHARED_PMS_DOMAIN.max}
                    placeholder={sharedPms === 'mixed' && !effectiveValues?.has('lfo.pitchModulationSensitivity') ? 'mixed' : undefined}
                    value={effectiveValues?.has('lfo.pitchModulationSensitivity') || typeof sharedPms === 'number' ? displayedPms : ''}
                    onChange={handleSharedPmsChange}
                    className="w-14 rounded border border-blue-border bg-blue-bg px-1 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operator Enable Toggles */}
      <div className="flex flex-col gap-1 border-t border-blue-border/50 pt-2">
        <span className="text-role-body text-blue-muted">Operator Output Enables (1–6)</span>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => {
            const isEnabled = displayedOperatorEnabled[i] ?? true;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Toggle Operator ${i + 1}`}
                aria-pressed={isEnabled}
                onClick={() => handleOperatorToggle(i)}
                className={cn(
                  'rounded px-3 py-1 text-role-body font-medium transition-colors',
                  isEnabled
                    ? 'bg-blue-accent text-white hover:bg-blue-accent/80'
                    : 'border border-blue-border bg-blue-bg text-gray-400 hover:bg-blue-surface',
                )}
              >
                Op {i + 1}: {isEnabled ? 'ON' : 'OFF'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
