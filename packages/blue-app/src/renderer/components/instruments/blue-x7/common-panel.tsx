import React from 'react';
import type { BlueX7Common } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import { AlgorithmTopology } from './algorithm-topology';
import { AppSelect } from '../../AppSelect';

export interface CommonPanelProps {
  common: BlueX7Common;
  sharedSync?: number | 'mixed';
  sharedPms?: number | 'mixed';
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
  onOpenAlgorithmModal?: () => void;
}

export const CommonPanel: React.FC<CommonPanelProps> = ({
  common,
  sharedSync,
  sharedPms,
  onApplyPatch,
  onOpenAlgorithmModal,
}) => {
  const displayTranspose = common.keyTranspose - 24;

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
      const clamped = Math.max(-24, Math.min(24, semitones));
      onApplyPatch(`Change Key Transpose to ${clamped}`, {
        type: 'setCommonField',
        field: 'keyTranspose',
        value: clamped + 24,
      });
    }
  };

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      const clamped = Math.max(0, Math.min(7, val));
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
      const clamped = Math.max(0, Math.min(7, val));
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
          algorithm={common.algorithm}
          operatorEnabled={common.operatorEnabled}
          onToggleOperator={handleOperatorToggle}
          onOpenModal={onOpenAlgorithmModal}
        />

        <div className="min-w-0 flex-1 space-y-3 w-full">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Algorithm selector */}
            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-algorithm" className="text-role-body text-blue-muted">
                Algorithm (1–32)
              </label>
              <div className="flex items-center gap-1">
                <AppSelect
                  id="bluex7-algorithm"
                  aria-label="Algorithm"
                  value={common.algorithm}
                  onValueChange={handleAlgorithmChange}
                  options={Array.from({ length: 32 }, (_, index) => ({
                    value: index + 1,
                    label: `Algorithm ${index + 1}`,
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
                min={-24}
                max={24}
                value={displayTranspose}
                onChange={handleTransposeChange}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            {/* Feedback */}
            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-feedback" className="text-role-body text-blue-muted">
                Feedback (0–7)
              </label>
              <input
                id="bluex7-feedback"
                aria-label="Feedback"
                type="number"
                min={0}
                max={7}
                value={common.feedback}
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
                    checked={sharedSync === 1}
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
                    min={0}
                    max={7}
                    placeholder={sharedPms === 'mixed' ? 'mixed' : undefined}
                    value={typeof sharedPms === 'number' ? sharedPms : ''}
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
            const isEnabled = common.operatorEnabled[i] ?? true;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Toggle Operator ${i + 1}`}
                aria-pressed={isEnabled}
                onClick={() => handleOperatorToggle(i)}
                className={`rounded px-3 py-1 text-role-body font-medium transition-colors ${
                  isEnabled
                    ? 'bg-blue-accent text-white hover:bg-blue-accent/80'
                    : 'bg-blue-bg text-gray-400 border border-blue-border hover:bg-blue-surface'
                }`}
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
