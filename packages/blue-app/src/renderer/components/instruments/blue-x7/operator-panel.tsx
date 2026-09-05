import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BlueX7Operator, BlueX7EnvelopePoint } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import { EnvelopeEditor } from './envelope-editor';
import { BlueX7TabList, type BlueX7TabItem } from './tab-list';
import { AppSelect } from '../../AppSelect';
import { LiveNumberInput } from '../../CommitNumberInput';
import { blueX7WidgetDomain, type BlueX7WidgetDomain } from './catalog-domains';

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
  effectiveValues?: ReadonlyMap<string, number>;
  instanceId?: string;
  active?: boolean;
  onVisibleOperatorChange?: (operatorIndex: number) => void;
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
}

const CURVE_TYPES = [
  { value: 0, label: '-LIN' },
  { value: 1, label: '-EXP' },
  { value: 2, label: '+EXP' },
  { value: 3, label: '+LIN' },
];

const SHARED_PMS_DOMAIN = blueX7WidgetDomain('lfo.pitchModulationSensitivity');

export const OperatorPanel: React.FC<OperatorPanelProps> = ({
  operators,
  operatorEnabled,
  sharedSync,
  sharedPms,
  effectiveValues,
  instanceId: providedInstanceId,
  active = true,
  onVisibleOperatorChange,
  onApplyPatch,
}) => {
  const generatedId = useId().replace(/:/g, '');
  const instanceId = providedInstanceId ?? `bluex7-ops-${generatedId}`;
  const [selectedOpIndex, setSelectedOpIndex] = useState<number>(0);
  const currentOp = operators[selectedOpIndex] ?? operators[0];
  const operatorKey = (suffix: string): string => `operator.${selectedOpIndex + 1}.${suffix}`;
  const effective = (key: string, fallback: number): number =>
    effectiveValues?.get(key) ?? fallback;
  const effectiveOperator = (suffix: string, fallback: number): number =>
    effective(operatorKey(suffix), fallback);
  // Widget bounds resolve through the selected operator's catalog descriptor
  // so the numeric editors can never drift from patch validation.
  const domainOf = (semanticKey: string): BlueX7WidgetDomain =>
    blueX7WidgetDomain(operatorKey(semanticKey));

  // Maintain local working envelopes for instant responsiveness and zero-snapback
  const [localEnvelopes, setLocalEnvelopes] = useState<
    [
      [BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint],
      [BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint],
      [BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint],
      [BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint],
      [BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint],
      [BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint],
    ]
  >(() => operators.map((op) => op.envelope) as any);

  const gestureActiveRef = useRef(false);
  const activeDragRef = useRef<{ stageIndex: number; point: BlueX7EnvelopePoint } | null>(null);

  // Sync with incoming canonical operators prop when not actively dragging
  useEffect(() => {
    if (!gestureActiveRef.current) {
      setLocalEnvelopes(operators.map((op) => op.envelope) as any);
    }
  }, [operators]);

  const currentLocalEnvelope = localEnvelopes[selectedOpIndex] ?? currentOp.envelope;

  const cancelEnvelopeGesture = () => {
    gestureActiveRef.current = false;
    activeDragRef.current = null;
    setLocalEnvelopes(operators.map((op) => op.envelope) as any);
  };

  useEffect(() => {
    if (!active) {
      cancelEnvelopeGesture();
    }
  }, [active]);

  const integerDomainResolver = (domain: BlueX7WidgetDomain) => (text: string) => {
    const val = parseInt(text, 10);
    if (Number.isNaN(val)) return null;
    return Math.max(domain.min, Math.min(domain.max, val));
  };

  const handleFieldChange = (
    field: keyof BlueX7Operator,
    label: string,
    domain: BlueX7WidgetDomain,
  ) => {
    return (val: number) => {
      const clamped = Math.max(domain.min, Math.min(domain.max, Math.round(val)));
      onApplyPatch(`Change Op ${selectedOpIndex + 1} ${label} to ${clamped}`, {
        type: 'setOperatorField',
        operatorIndex: selectedOpIndex,
        field,
        value: clamped,
      });
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

  const handlePitchModulationChange = (val: number) => {
    const clamped = Math.max(
      SHARED_PMS_DOMAIN.min,
      Math.min(SHARED_PMS_DOMAIN.max, Math.round(val)),
    );
    onApplyPatch(`Set All PMS to ${clamped}`, {
      type: 'setSharedPitchModulationSensitivity',
      value: clamped,
    });
  };

  const displayedSync = effective(
    'common.oscillatorKeySync',
    typeof sharedSync === 'number' ? sharedSync : currentOp.sync,
  );
  const displayedPms = effective(
    'lfo.pitchModulationSensitivity',
    typeof sharedPms === 'number' ? sharedPms : currentOp.modulationPitch,
  );

  const handleEnvelopePointChange = (
    stage: number,
    rateOrLevel: 'rate' | 'level',
    domain: BlueX7WidgetDomain,
  ) => {
    return (val: number) => {
      const clamped = Math.max(domain.min, Math.min(domain.max, Math.round(val)));
      const currentPt = currentLocalEnvelope[stage] ?? { rate: 0, level: 0 };
      const nextPt = {
        ...currentPt,
        [rateOrLevel]: clamped,
      };
      setLocalEnvelopes((prev) => {
        const next = [...prev] as typeof localEnvelopes;
        const opEnv = next[selectedOpIndex];
        if (opEnv) {
          next[selectedOpIndex] = opEnv.map((pt, i) => (i === stage ? nextPt : pt)) as any;
        }
        return next;
      });
      onApplyPatch(
        `Change Op ${selectedOpIndex + 1} Env ${rateOrLevel.toUpperCase()}${stage + 1} to ${clamped}`,
        {
          type: 'setOperatorEnvelopePoint',
          operatorIndex: selectedOpIndex,
          stageIndex: stage,
          point: nextPt,
        },
      );
    };
  };

  const handleStagePointChange = (stageIndex: number, point: BlueX7EnvelopePoint) => {
    activeDragRef.current = { stageIndex, point };
    setLocalEnvelopes((prev) => {
      const next = [...prev] as typeof localEnvelopes;
      const opEnv = next[selectedOpIndex];
      if (opEnv) {
        next[selectedOpIndex] = opEnv.map((pt, i) => (i === stageIndex ? point : pt)) as any;
      }
      return next;
    });
  };

  const handleGestureStart = () => {
    gestureActiveRef.current = true;
  };

  const handleGestureCommit = () => {
    if (!gestureActiveRef.current) {
      return;
    }
    gestureActiveRef.current = false;
    const finalDrag = activeDragRef.current;
    activeDragRef.current = null;
    if (finalDrag) {
      onApplyPatch(`Change Op ${selectedOpIndex + 1} Env Stage ${finalDrag.stageIndex + 1}`, {
        type: 'setOperatorEnvelopePoint',
        operatorIndex: selectedOpIndex,
        stageIndex: finalDrag.stageIndex,
        point: finalDrag.point,
      });
    }
  };

  const operatorTabs: readonly BlueX7TabItem<string>[] = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const isEnabled = operatorEnabled[i] ?? true;
        return {
          key: String(i),
          label: `Op ${i + 1}`,
          badge: !isEnabled ? (
            <span className="text-role-callout text-gray-400 font-normal">(Muted)</span>
          ) : undefined,
          ariaLabel: `Select Operator ${i + 1}${!isEnabled ? ' (Muted)' : ''}`,
          testId: `operator-tab-${i + 1}`,
        };
      }),
    [operatorEnabled],
  );

  return (
    <div
      className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-3"
      data-testid="bluex7-operator-panel"
    >
      {/* Operator Tabs Header */}
      <div className="flex flex-col gap-2 border-b border-blue-border pb-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-role-headline font-bold text-gray-200 uppercase tracking-wider">
          Operators
        </span>
        <BlueX7TabList
          instanceId={instanceId}
          ariaLabel="Operator Selector"
          tabs={operatorTabs}
          activeTab={String(selectedOpIndex)}
          onSelectTab={(key) => {
            const idx = parseInt(key, 10);
            cancelEnvelopeGesture();
            setSelectedOpIndex(idx);
            onVisibleOperatorChange?.(idx);
          }}
        />
      </div>

      {/* Operator Parameters Grid */}
      <div
        id={`${instanceId}-panel-${selectedOpIndex}`}
        role="tabpanel"
        aria-labelledby={`${instanceId}-tab-${selectedOpIndex}`}
        className="space-y-3"
        data-testid="bluex7-operator-workstation"
      >
        {/* Frequency & Mode */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-mode" className="text-role-body text-blue-muted">
              Mode
            </label>
            <AppSelect
              id="bluex7-op-mode"
              aria-label="Operator Mode"
              value={effectiveOperator('oscillatorMode', currentOp.mode)}
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
              Freq Coarse ({domainOf('frequencyCoarse').min}–{domainOf('frequencyCoarse').max})
            </label>
            <LiveNumberInput
              id="bluex7-op-coarse"
              aria-label="Frequency Coarse"
              step={1}
              min={domainOf('frequencyCoarse').min}
              max={domainOf('frequencyCoarse').max}
              value={effectiveOperator('frequencyCoarse', currentOp.freqCoarse)}
              onChange={handleFieldChange('freqCoarse', 'Freq Coarse', domainOf('frequencyCoarse'))}
              resolveValue={integerDomainResolver(domainOf('frequencyCoarse'))}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              containerClassName="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-fine" className="text-role-body text-blue-muted">
              Freq Fine ({domainOf('frequencyFine').min}–{domainOf('frequencyFine').max})
            </label>
            <LiveNumberInput
              id="bluex7-op-fine"
              aria-label="Frequency Fine"
              step={1}
              min={domainOf('frequencyFine').min}
              max={domainOf('frequencyFine').max}
              value={effectiveOperator('frequencyFine', currentOp.freqFine)}
              onChange={handleFieldChange('freqFine', 'Freq Fine', domainOf('frequencyFine'))}
              resolveValue={integerDomainResolver(domainOf('frequencyFine'))}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              containerClassName="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-detune" className="text-role-body text-blue-muted">
              Detune ({domainOf('detune').min}..+{domainOf('detune').max})
            </label>
            <LiveNumberInput
              id="bluex7-op-detune"
              aria-label="Detune"
              step={1}
              min={domainOf('detune').min}
              max={domainOf('detune').max}
              value={effectiveOperator('detune', currentOp.detune)}
              onChange={handleFieldChange('detune', 'Detune', domainOf('detune'))}
              resolveValue={integerDomainResolver(domainOf('detune'))}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              containerClassName="w-full"
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
                  if (el)
                    el.indeterminate =
                      sharedSync === 'mixed' && !effectiveValues?.has('common.oscillatorKeySync');
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
              Output Level ({domainOf('outputLevel').min}–{domainOf('outputLevel').max})
            </label>
            <LiveNumberInput
              id="bluex7-op-output-level"
              aria-label="Output Level"
              step={1}
              min={domainOf('outputLevel').min}
              max={domainOf('outputLevel').max}
              value={effectiveOperator('outputLevel', currentOp.outputLevel)}
              onChange={handleFieldChange('outputLevel', 'Output Level', domainOf('outputLevel'))}
              resolveValue={integerDomainResolver(domainOf('outputLevel'))}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              containerClassName="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-velocity-sens" className="text-role-body text-blue-muted">
              Velocity Sens ({domainOf('velocitySensitivity').min}–
              {domainOf('velocitySensitivity').max})
            </label>
            <LiveNumberInput
              id="bluex7-op-velocity-sens"
              aria-label="Velocity Sensitivity"
              step={1}
              min={domainOf('velocitySensitivity').min}
              max={domainOf('velocitySensitivity').max}
              value={effectiveOperator('velocitySensitivity', currentOp.velocitySensitivity)}
              onChange={handleFieldChange(
                'velocitySensitivity',
                'Velocity Sensitivity',
                domainOf('velocitySensitivity'),
              )}
              resolveValue={integerDomainResolver(domainOf('velocitySensitivity'))}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              containerClassName="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-ams" className="text-role-body text-blue-muted">
              AM Sensitivity ({domainOf('amplitudeModulationSensitivity').min}–
              {domainOf('amplitudeModulationSensitivity').max})
            </label>
            <LiveNumberInput
              id="bluex7-op-ams"
              aria-label="Amplitude Modulation Sensitivity"
              step={1}
              min={domainOf('amplitudeModulationSensitivity').min}
              max={domainOf('amplitudeModulationSensitivity').max}
              value={effectiveOperator(
                'amplitudeModulationSensitivity',
                currentOp.modulationAmplitude,
              )}
              onChange={handleFieldChange(
                'modulationAmplitude',
                'AM Sensitivity',
                domainOf('amplitudeModulationSensitivity'),
              )}
              resolveValue={integerDomainResolver(domainOf('amplitudeModulationSensitivity'))}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              containerClassName="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bluex7-op-pms" className="text-role-body text-blue-muted">
              PM Sensitivity ({SHARED_PMS_DOMAIN.min}–{SHARED_PMS_DOMAIN.max})
            </label>
            <LiveNumberInput
              id="bluex7-op-pms"
              aria-label="Pitch Modulation Sensitivity"
              step={1}
              min={SHARED_PMS_DOMAIN.min}
              max={SHARED_PMS_DOMAIN.max}
              stepBase={SHARED_PMS_DOMAIN.min}
              value={
                sharedPms === 'mixed' && !effectiveValues?.has('lfo.pitchModulationSensitivity')
                  ? null
                  : displayedPms
              }
              placeholder={
                sharedPms === 'mixed' && !effectiveValues?.has('lfo.pitchModulationSensitivity')
                  ? 'mixed'
                  : undefined
              }
              onChange={handlePitchModulationChange}
              resolveValue={(text) => {
                const val = parseInt(text, 10);
                if (Number.isNaN(val)) return null;
                return Math.max(SHARED_PMS_DOMAIN.min, Math.min(SHARED_PMS_DOMAIN.max, val));
              }}
              className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              containerClassName="w-full"
            />
          </div>
        </div>

        {/* Keyboard Scaling */}
        <div className="rounded border border-blue-border/50 bg-blue-bg/40 p-2 space-y-2">
          <span className="text-role-headline font-bold text-gray-300">
            Keyboard Level & Rate Scaling
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-breakpoint" className="text-role-body text-blue-muted">
                Breakpoint ({domainOf('breakpoint').min}–{domainOf('breakpoint').max})
              </label>
              <LiveNumberInput
                id="bluex7-op-breakpoint"
                aria-label="Breakpoint"
                step={1}
                min={domainOf('breakpoint').min}
                max={domainOf('breakpoint').max}
                value={effectiveOperator('breakpoint', currentOp.breakpoint)}
                onChange={handleFieldChange('breakpoint', 'Breakpoint', domainOf('breakpoint'))}
                resolveValue={integerDomainResolver(domainOf('breakpoint'))}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                containerClassName="w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-curve-left" className="text-role-body text-blue-muted">
                Curve Left
              </label>
              <AppSelect
                id="bluex7-op-curve-left"
                aria-label="Curve Left"
                value={effectiveOperator('curveLeft', currentOp.curveLeft)}
                onValueChange={handleSelectFieldChange('curveLeft', 'Curve Left')}
                options={CURVE_TYPES}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-depth-left" className="text-role-body text-blue-muted">
                Depth Left ({domainOf('depthLeft').min}–{domainOf('depthLeft').max})
              </label>
              <LiveNumberInput
                id="bluex7-op-depth-left"
                aria-label="Depth Left"
                step={1}
                min={domainOf('depthLeft').min}
                max={domainOf('depthLeft').max}
                value={effectiveOperator('depthLeft', currentOp.depthLeft)}
                onChange={handleFieldChange('depthLeft', 'Depth Left', domainOf('depthLeft'))}
                resolveValue={integerDomainResolver(domainOf('depthLeft'))}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                containerClassName="w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-curve-right" className="text-role-body text-blue-muted">
                Curve Right
              </label>
              <AppSelect
                id="bluex7-op-curve-right"
                aria-label="Curve Right"
                value={effectiveOperator('curveRight', currentOp.curveRight)}
                onValueChange={handleSelectFieldChange('curveRight', 'Curve Right')}
                options={CURVE_TYPES}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-depth-right" className="text-role-body text-blue-muted">
                Depth Right ({domainOf('depthRight').min}–{domainOf('depthRight').max})
              </label>
              <LiveNumberInput
                id="bluex7-op-depth-right"
                aria-label="Depth Right"
                step={1}
                min={domainOf('depthRight').min}
                max={domainOf('depthRight').max}
                value={effectiveOperator('depthRight', currentOp.depthRight)}
                onChange={handleFieldChange('depthRight', 'Depth Right', domainOf('depthRight'))}
                resolveValue={integerDomainResolver(domainOf('depthRight'))}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                containerClassName="w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bluex7-op-krs" className="text-role-body text-blue-muted">
                Rate Scaling ({domainOf('keyboardRateScaling').min}–
                {domainOf('keyboardRateScaling').max})
              </label>
              <LiveNumberInput
                id="bluex7-op-krs"
                aria-label="Keyboard Rate Scaling"
                step={1}
                min={domainOf('keyboardRateScaling').min}
                max={domainOf('keyboardRateScaling').max}
                value={effectiveOperator('keyboardRateScaling', currentOp.keyboardRateScaling)}
                onChange={handleFieldChange(
                  'keyboardRateScaling',
                  'Rate Scaling',
                  domainOf('keyboardRateScaling'),
                )}
                resolveValue={integerDomainResolver(domainOf('keyboardRateScaling'))}
                className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                containerClassName="w-full"
              />
            </div>
          </div>
        </div>

        {/* Graphical Envelope Editor */}
        <EnvelopeEditor
          envelope={currentLocalEnvelope}
          title={`Operator ${selectedOpIndex + 1} Envelope`}
          active={active}
          cancelKey={selectedOpIndex}
          onChangeStage={handleStagePointChange}
          onGestureStart={handleGestureStart}
          onGestureCommit={handleGestureCommit}
          onGestureCancel={cancelEnvelopeGesture}
        />

        {/* 4-Stage Envelope Numeric Editor */}
        <div className="rounded border border-blue-border/50 bg-blue-bg/40 p-2 space-y-2">
          <span className="text-role-headline font-bold text-gray-300">
            Envelope (Rates & Levels {domainOf('envelope.1.rate').min}–
            {domainOf('envelope.1.rate').max})
          </span>
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((stage) => {
              const pt = currentLocalEnvelope[stage] ?? { rate: 0, level: 0 };
              const displayRate =
                gestureActiveRef.current && activeDragRef.current?.stageIndex === stage
                  ? pt.rate
                  : effectiveOperator(`envelope.${stage + 1}.rate`, pt.rate);
              const displayLevel =
                gestureActiveRef.current && activeDragRef.current?.stageIndex === stage
                  ? pt.level
                  : effectiveOperator(`envelope.${stage + 1}.level`, pt.level);
              return (
                <div
                  key={stage}
                  className="flex flex-col gap-1 rounded border border-blue-border/30 p-2 bg-blue-surface/20"
                >
                  <span className="text-role-callout font-medium text-gray-400">
                    Stage {stage + 1}
                  </span>
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <label
                        htmlFor={`bluex7-op-r${stage + 1}`}
                        className="text-role-callout text-blue-muted"
                      >
                        R{stage + 1}
                      </label>
                      <LiveNumberInput
                        id={`bluex7-op-r${stage + 1}`}
                        aria-label={`Operator Rate ${stage + 1}`}
                        step={1}
                        min={domainOf(`envelope.${stage + 1}.rate`).min}
                        max={domainOf(`envelope.${stage + 1}.rate`).max}
                        value={displayRate}
                        onChange={handleEnvelopePointChange(
                          stage,
                          'rate',
                          domainOf(`envelope.${stage + 1}.rate`),
                        )}
                        resolveValue={integerDomainResolver(domainOf(`envelope.${stage + 1}.rate`))}
                        className="w-full rounded border border-blue-border bg-blue-bg px-1 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                        containerClassName="w-full"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <label
                        htmlFor={`bluex7-op-l${stage + 1}`}
                        className="text-role-callout text-blue-muted"
                      >
                        L{stage + 1}
                      </label>
                      <LiveNumberInput
                        id={`bluex7-op-l${stage + 1}`}
                        aria-label={`Operator Level ${stage + 1}`}
                        step={1}
                        min={domainOf(`envelope.${stage + 1}.level`).min}
                        max={domainOf(`envelope.${stage + 1}.level`).max}
                        value={displayLevel}
                        onChange={handleEnvelopePointChange(
                          stage,
                          'level',
                          domainOf(`envelope.${stage + 1}.level`),
                        )}
                        resolveValue={integerDomainResolver(
                          domainOf(`envelope.${stage + 1}.level`),
                        )}
                        className="w-full rounded border border-blue-border bg-blue-bg px-1 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                        containerClassName="w-full"
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
