import React, { useRef, useState } from 'react';
import type { BlueX7Operator, BlueX7EnvelopePoint } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import { EnvelopeEditor } from './envelope-editor';
import { AppSelect } from '../../AppSelect';

export interface OperatorPanelProps {
  operators: [
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
  ];
  operatorEnabled: [boolean, boolean, boolean, boolean, boolean, boolean];
  sharedSync?: number | 'mixed';
  sharedPms?: number | 'mixed';
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
}

const CURVE_TYPES = [
  { value: 0, label: '-LIN' },
  { value: 1, label: '-EXP' },
  { value: 2, label: '+EXP' },
  { value: 3, label: '+LIN' },
];

export const OperatorPanel: React.FC<OperatorPanelProps> = ({
  operators,
  operatorEnabled,
  sharedSync,
  sharedPms,
  onApplyPatch,
}) => {
  const [selectedOpIndex, setSelectedOpIndex] = useState<number>(0);
  const currentOp = operators[selectedOpIndex] ?? operators[0];

  // Envelope gestures (pointer drags, arrow-key edits) update a working stage
  // point during the gesture and dispatch exactly one patch on commit, so a
  // whole drag is a single undo step instead of one entry per pointer-move.
  const gestureActiveRef = useRef(false);
  const gestureStageRef = useRef<{
    stageIndex: number;
    point: BlueX7EnvelopePoint;
  } | null>(null);
  const [gestureStage, setGestureStage] = useState<{
    stageIndex: number;
    point: BlueX7EnvelopePoint;
  } | null>(null);

  const cancelEnvelopeGesture = () => {
    gestureActiveRef.current = false;
    gestureStageRef.current = null;
    setGestureStage(null);
  };

  const handleFieldChange = (field: keyof BlueX7Operator, label: string, min: number, max: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.max(min, Math.min(max, val));
        onApplyPatch(`Change Op ${selectedOpIndex + 1} ${label} to ${clamped}`, {
          type: 'setOperatorField',
          operatorIndex: selectedOpIndex,
          field,
          value: clamped,
        });
      }
    };
  };

  const handleSelectFieldChange = (field: keyof BlueX7Operator, label: string) => {
    return (value: string) => {
      const val = parseInt(value, 10);
      onApplyPatch(`Change Op ${selectedOpIndex + 1} ${label} to ${val}`, {
        type: 'setOperatorField',
        operatorIndex: selectedOpIndex,
        field,
        value: val,
      });
    };
  };

  const handleSyncToggle = () => {
    const currentValue = typeof sharedSync === 'number' ? sharedSync : currentOp.sync;
    const nextVal = currentValue === 1 ? 0 : 1;
    onApplyPatch(`Set All Oscillators Sync to ${nextVal === 1 ? 'On' : 'Off'}`, {
      type: 'setSharedOscillatorSync',
      value: nextVal,
    });
  };

  const handlePitchModulationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      const clamped = Math.max(0, Math.min(7, val));
      onApplyPatch(`Set All PMS to ${clamped}`, {
        type: 'setSharedPitchModulationSensitivity',
        value: clamped,
      });
    }
  };

  const displayedSync = typeof sharedSync === 'number' ? sharedSync : currentOp.sync;
  const displayedPms = typeof sharedPms === 'number' ? sharedPms : currentOp.modulationPitch;

  const handleEnvelopePointChange = (stage: number, rateOrLevel: 'rate' | 'level', min: number, max: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.max(min, Math.min(max, val));
        const currentPt = currentOp.envelope[stage] ?? { rate: 0, level: 0 };
        const nextPt = {
          ...currentPt,
          [rateOrLevel]: clamped,
        };
        onApplyPatch(`Change Op ${selectedOpIndex + 1} Env ${rateOrLevel.toUpperCase()}${stage + 1} to ${clamped}`, {
          type: 'setOperatorEnvelopePoint',
          operatorIndex: selectedOpIndex,
          stageIndex: stage,
          point: nextPt,
        });
      }
    };
  };

  const handleStagePointChange = (stageIndex: number, point: BlueX7EnvelopePoint) => {
    if (gestureActiveRef.current) {
      gestureStageRef.current = { stageIndex, point };
      setGestureStage({ stageIndex, point });
      return;
    }
    onApplyPatch(`Change Op ${selectedOpIndex + 1} Env Stage ${stageIndex + 1}`, {
      type: 'setOperatorEnvelopePoint',
      operatorIndex: selectedOpIndex,
      stageIndex,
      point,
    });
  };

  const handleGestureCommit = () => {
    if (!gestureActiveRef.current) {
      return;
    }
    gestureActiveRef.current = false;
    const finalStage = gestureStageRef.current;
    gestureStageRef.current = null;
    setGestureStage(null);
    if (finalStage) {
      onApplyPatch(`Change Op ${selectedOpIndex + 1} Env Stage ${finalStage.stageIndex + 1}`, {
        type: 'setOperatorEnvelopePoint',
        operatorIndex: selectedOpIndex,
        stageIndex: finalStage.stageIndex,
        point: finalStage.point,
      });
    }
  };

  return (
    <div className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-3" data-testid="bluex7-operator-panel">
      {/* Operator Tabs Header */}
      <div className="flex flex-col gap-2 border-b border-blue-border pb-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-role-headline font-bold text-gray-200 uppercase tracking-wider">Operators</span>
        <div className="flex min-w-0 flex-wrap gap-1" role="tablist" aria-label="Operator Selector">
          {Array.from({ length: 6 }, (_, i) => {
            const isSelected = selectedOpIndex === i;
            const isEnabled = operatorEnabled[i] ?? true;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Select Operator ${i + 1}`}
                onClick={() => {
                  cancelEnvelopeGesture();
                  setSelectedOpIndex(i);
                }}
                className={`rounded px-3 py-1 text-role-body font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-accent text-white font-semibold'
                    : 'bg-blue-bg text-gray-300 border border-blue-border hover:bg-blue-surface'
                }`}
              >
                Op {i + 1} {!isEnabled && '(Muted)'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Operator Parameters Grid */}
      <div className="space-y-3">
        {/* Frequency & Mode */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-mode" className="text-role-body text-blue-muted">
              Mode
            </label>
            <AppSelect
              id="bluex7-op-mode"
              aria-label="Operator Mode"
              value={currentOp.mode}
              onValueChange={handleSelectFieldChange('mode', 'Mode')}
              options={[
                { value: 0, label: 'Ratio (Freq)' },
                { value: 1, label: 'Fixed (Hz)' },
              ]}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-coarse" className="text-role-body text-blue-muted">
              Freq Coarse (0–31)
            </label>
            <input
              id="bluex7-op-coarse"
              aria-label="Frequency Coarse"
              type="number"
              min={0}
              max={31}
              value={currentOp.freqCoarse}
              onChange={handleFieldChange('freqCoarse', 'Freq Coarse', 0, 31)}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-fine" className="text-role-body text-blue-muted">
              Freq Fine (0–99)
            </label>
            <input
              id="bluex7-op-fine"
              aria-label="Frequency Fine"
              type="number"
              min={0}
              max={99}
              value={currentOp.freqFine}
              onChange={handleFieldChange('freqFine', 'Freq Fine', 0, 99)}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-detune" className="text-role-body text-blue-muted">
              Detune (-7..+7)
            </label>
            <input
              id="bluex7-op-detune"
              aria-label="Detune"
              type="number"
              min={-7}
              max={7}
              value={currentOp.detune}
              onChange={handleFieldChange('detune', 'Detune', -7, 7)}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-role-body text-blue-muted">Oscillator Sync</span>
            <label className="flex items-center gap-2 pt-1 text-role-body text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Operator Oscillator Sync"
                checked={displayedSync === 1}
                ref={(el) => {
                  if (el) el.indeterminate = sharedSync === 'mixed';
                }}
                onChange={handleSyncToggle}
                className="rounded border-blue-border"
              />
              Sync
            </label>
          </div>
        </div>

        {/* Output & Sensitivity */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-output-level" className="text-role-body text-blue-muted">
              Output Level (0–99)
            </label>
            <input
              id="bluex7-op-output-level"
              aria-label="Output Level"
              type="number"
              min={0}
              max={99}
              value={currentOp.outputLevel}
              onChange={handleFieldChange('outputLevel', 'Output Level', 0, 99)}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-velocity-sens" className="text-role-body text-blue-muted">
              Velocity Sens (0–7)
            </label>
            <input
              id="bluex7-op-velocity-sens"
              aria-label="Velocity Sensitivity"
              type="number"
              min={0}
              max={7}
              value={currentOp.velocitySensitivity}
              onChange={handleFieldChange('velocitySensitivity', 'Velocity Sensitivity', 0, 7)}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-ams" className="text-role-body text-blue-muted">
              AM Sensitivity (0–3)
            </label>
            <input
              id="bluex7-op-ams"
              aria-label="Amplitude Modulation Sensitivity"
              type="number"
              min={0}
              max={3}
              value={currentOp.modulationAmplitude}
              onChange={handleFieldChange('modulationAmplitude', 'AM Sensitivity', 0, 3)}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-pms" className="text-role-body text-blue-muted">
              PM Sensitivity (0–7)
            </label>
            <input
              id="bluex7-op-pms"
              aria-label="Pitch Modulation Sensitivity"
              type="number"
              min={0}
              max={7}
              value={displayedPms}
              placeholder={sharedPms === 'mixed' ? 'mixed' : undefined}
              onChange={handlePitchModulationChange}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Keyboard Scaling */}
        <div className="rounded border border-blue-border/50 bg-blue-bg/40 p-2 space-y-2">
          <span className="text-role-headline font-bold text-gray-300">Keyboard Level & Rate Scaling</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-breakpoint" className="text-role-body text-blue-muted">
                Breakpoint (0–99)
              </label>
              <input
                id="bluex7-op-breakpoint"
                aria-label="Breakpoint"
                type="number"
                min={0}
                max={99}
                value={currentOp.breakpoint}
                onChange={handleFieldChange('breakpoint', 'Breakpoint', 0, 99)}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-curve-left" className="text-role-body text-blue-muted">
                Curve Left
              </label>
              <AppSelect
                id="bluex7-op-curve-left"
                aria-label="Curve Left"
                value={currentOp.curveLeft}
                onValueChange={handleSelectFieldChange('curveLeft', 'Curve Left')}
                options={CURVE_TYPES}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-depth-left" className="text-role-body text-blue-muted">
                Depth Left (0–99)
              </label>
              <input
                id="bluex7-op-depth-left"
                aria-label="Depth Left"
                type="number"
                min={0}
                max={99}
                value={currentOp.depthLeft}
                onChange={handleFieldChange('depthLeft', 'Depth Left', 0, 99)}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-curve-right" className="text-role-body text-blue-muted">
                Curve Right
              </label>
              <AppSelect
                id="bluex7-op-curve-right"
                aria-label="Curve Right"
                value={currentOp.curveRight}
                onValueChange={handleSelectFieldChange('curveRight', 'Curve Right')}
                options={CURVE_TYPES}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-depth-right" className="text-role-body text-blue-muted">
                Depth Right (0–99)
              </label>
              <input
                id="bluex7-op-depth-right"
                aria-label="Depth Right"
                type="number"
                min={0}
                max={99}
                value={currentOp.depthRight}
                onChange={handleFieldChange('depthRight', 'Depth Right', 0, 99)}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-krs" className="text-role-body text-blue-muted">
                Rate Scaling (0–7)
              </label>
              <input
                id="bluex7-op-krs"
                aria-label="Keyboard Rate Scaling"
                type="number"
                min={0}
                max={7}
                value={currentOp.keyboardRateScaling}
                onChange={handleFieldChange('keyboardRateScaling', 'Rate Scaling', 0, 7)}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Graphical Envelope Editor */}
        <EnvelopeEditor
          envelope={
            (gestureStage
              ? currentOp.envelope.map((pt, i) =>
                  i === gestureStage.stageIndex ? gestureStage.point : pt,
                )
              : currentOp.envelope) as typeof currentOp.envelope
          }
          title={`Operator ${selectedOpIndex + 1} Envelope`}
          onChangeStage={handleStagePointChange}
          onGestureStart={() => {
            gestureActiveRef.current = true;
          }}
          onGestureCommit={handleGestureCommit}
        />

        {/* 4-Stage Envelope Numeric Editor */}
        <div className="rounded border border-blue-border/50 bg-blue-bg/40 p-2 space-y-2">
          <span className="text-role-headline font-bold text-gray-300">Envelope (Rates & Levels 0–99)</span>
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((stage) => {
              const pt = currentOp.envelope[stage] ?? { rate: 0, level: 0 };
              return (
                <div key={stage} className="flex flex-col gap-1 rounded border border-blue-border/30 p-2 bg-blue-surface/20">
                  <span className="text-role-callout font-medium text-gray-400">Stage {stage + 1}</span>
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <label htmlFor={`bluex7-op-r${stage + 1}`} className="text-role-callout text-blue-muted">
                        R{stage + 1}
                      </label>
                      <input
                        id={`bluex7-op-r${stage + 1}`}
                        aria-label={`Operator Rate ${stage + 1}`}
                        type="number"
                        min={0}
                        max={99}
                        value={pt.rate}
                        onChange={handleEnvelopePointChange(stage, 'rate', 0, 99)}
                        className="w-full rounded border border-blue-border bg-blue-bg px-1 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <label htmlFor={`bluex7-op-l${stage + 1}`} className="text-role-callout text-blue-muted">
                        L{stage + 1}
                      </label>
                      <input
                        id={`bluex7-op-l${stage + 1}`}
                        aria-label={`Operator Level ${stage + 1}`}
                        type="number"
                        min={0}
                        max={99}
                        value={pt.level}
                        onChange={handleEnvelopePointChange(stage, 'level', 0, 99)}
                        className="w-full rounded border border-blue-border bg-blue-bg px-1 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
