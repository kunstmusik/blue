import React, { useEffect, useRef, useState } from 'react';
import type { BlueX7EnvelopePoint } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import { EnvelopeEditor } from './envelope-editor';

export interface PitchEnvelopePanelProps {
  pitchEnvelope: [
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
  ];
  active?: boolean;
  effectiveValues?: ReadonlyMap<string, number>;
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
}

export const PitchEnvelopePanel: React.FC<PitchEnvelopePanelProps> = ({
  pitchEnvelope,
  active = true,
  effectiveValues,
  onApplyPatch,
}) => {
  // Maintain local working envelope for instant responsiveness and zero-snapback
  const [localEnvelope, setLocalEnvelope] = useState<typeof pitchEnvelope>(pitchEnvelope);
  const gestureActiveRef = useRef(false);
  const activeDragRef = useRef<{ stageIndex: number; point: BlueX7EnvelopePoint } | null>(null);

  // Sync with incoming canonical pitchEnvelope prop when not actively dragging
  useEffect(() => {
    if (!gestureActiveRef.current) {
      setLocalEnvelope(pitchEnvelope);
    }
  }, [pitchEnvelope]);

  const cancelEnvelopeGesture = () => {
    gestureActiveRef.current = false;
    activeDragRef.current = null;
    setLocalEnvelope(pitchEnvelope);
  };

  useEffect(() => {
    if (!active) {
      cancelEnvelopeGesture();
    }
  }, [active]);

  const handlePointChange = (
    stage: number,
    rateOrLevel: 'rate' | 'level',
    min: number,
    max: number,
  ) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.max(min, Math.min(max, val));
        const currentPt = localEnvelope[stage] ?? { rate: 0, level: 0 };
        const nextPt = {
          ...currentPt,
          [rateOrLevel]: clamped,
        };
        const nextEnvelope = localEnvelope.map((pt, i) =>
          i === stage ? nextPt : pt,
        ) as typeof pitchEnvelope;
        setLocalEnvelope(nextEnvelope);
        onApplyPatch(`Change Pitch Env ${rateOrLevel.toUpperCase()}${stage + 1} to ${clamped}`, {
          type: 'setPitchEnvelopePoint',
          stageIndex: stage,
          point: nextPt,
        });
      }
    };
  };

  const handleStagePointChange = (stageIndex: number, point: BlueX7EnvelopePoint) => {
    activeDragRef.current = { stageIndex, point };
    setLocalEnvelope(
      (prev) => prev.map((pt, i) => (i === stageIndex ? point : pt)) as typeof pitchEnvelope,
    );
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
      onApplyPatch(`Change Pitch Env Stage ${finalDrag.stageIndex + 1}`, {
        type: 'setPitchEnvelopePoint',
        stageIndex: finalDrag.stageIndex,
        point: finalDrag.point,
      });
    }
  };

  return (
    <div
      className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-4"
      data-testid="bluex7-peg-panel"
    >
      <div className="flex items-center justify-between border-b border-blue-border pb-1">
        <span className="text-role-headline font-bold text-gray-200 uppercase tracking-wider">
          Pitch Envelope Generator (PEG)
        </span>
      </div>

      {/* SVG Pitch Envelope Graph */}
      <EnvelopeEditor
        envelope={localEnvelope}
        title="Pitch Envelope Graph (Base: 50)"
        isPitchEnvelope={true}
        active={active}
        onChangeStage={handleStagePointChange}
        onGestureStart={handleGestureStart}
        onGestureCommit={handleGestureCommit}
        onGestureCancel={cancelEnvelopeGesture}
      />

      {/* Numeric Rates and Levels */}
      <div className="rounded border border-blue-border/50 bg-blue-bg/40 p-2.5 space-y-2">
        <span className="text-role-headline font-bold text-gray-300">
          Envelope (Rates & Levels 0–99)
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((stage) => {
            const pt = localEnvelope[stage] ?? { rate: 0, level: 0 };
            const displayRate =
              gestureActiveRef.current && activeDragRef.current?.stageIndex === stage
                ? pt.rate
                : (effectiveValues?.get(`pitchEnvelope.${stage + 1}.rate`) ?? pt.rate);
            const displayLevel =
              gestureActiveRef.current && activeDragRef.current?.stageIndex === stage
                ? pt.level
                : (effectiveValues?.get(`pitchEnvelope.${stage + 1}.level`) ?? pt.level);
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
                      htmlFor={`bluex7-peg-r${stage + 1}`}
                      className="text-role-callout text-blue-muted"
                    >
                      R{stage + 1}
                    </label>
                    <input
                      id={`bluex7-peg-r${stage + 1}`}
                      aria-label={`Pitch Rate ${stage + 1}`}
                      type="number"
                      min={0}
                      max={99}
                      value={displayRate}
                      onChange={handlePointChange(stage, 'rate', 0, 99)}
                      className="w-full rounded border border-blue-border bg-blue-bg px-1 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <label
                      htmlFor={`bluex7-peg-l${stage + 1}`}
                      className="text-role-callout text-blue-muted"
                    >
                      L{stage + 1}
                    </label>
                    <input
                      id={`bluex7-peg-l${stage + 1}`}
                      aria-label={`Pitch Level ${stage + 1}`}
                      type="number"
                      min={0}
                      max={99}
                      value={displayLevel}
                      onChange={handlePointChange(stage, 'level', 0, 99)}
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
  );
};
