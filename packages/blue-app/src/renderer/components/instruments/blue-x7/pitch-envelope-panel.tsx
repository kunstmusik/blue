import React, { useRef, useState } from 'react';
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
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
}

export const PitchEnvelopePanel: React.FC<PitchEnvelopePanelProps> = ({
  pitchEnvelope,
  onApplyPatch,
}) => {
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

  const handlePointChange = (stage: number, rateOrLevel: 'rate' | 'level', min: number, max: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.max(min, Math.min(max, val));
        const currentPt = pitchEnvelope[stage] ?? { rate: 0, level: 0 };
        const nextPt = {
          ...currentPt,
          [rateOrLevel]: clamped,
        };
        onApplyPatch(`Change Pitch Env ${rateOrLevel.toUpperCase()}${stage + 1} to ${clamped}`, {
          type: 'setPitchEnvelopePoint',
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
    onApplyPatch(`Change Pitch Env Stage ${stageIndex + 1}`, {
      type: 'setPitchEnvelopePoint',
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
      onApplyPatch(`Change Pitch Env Stage ${finalStage.stageIndex + 1}`, {
        type: 'setPitchEnvelopePoint',
        stageIndex: finalStage.stageIndex,
        point: finalStage.point,
      });
    }
  };

  return (
    <div className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-3" data-testid="bluex7-peg-panel">
      <div className="flex items-center justify-between border-b border-blue-border pb-1">
        <span className="text-role-headline text-gray-200 uppercase tracking-wider">Pitch Envelope Generator (PEG)</span>
      </div>

      {/* SVG Pitch Envelope Graph */}
      <EnvelopeEditor
        envelope={
          (gestureStage
            ? pitchEnvelope.map((pt, i) =>
                i === gestureStage.stageIndex ? gestureStage.point : pt,
              )
            : pitchEnvelope) as typeof pitchEnvelope
        }
        title="Pitch Envelope Graph (Base: 50)"
        isPitchEnvelope={true}
        onChangeStage={handleStagePointChange}
        onGestureStart={() => {
          gestureActiveRef.current = true;
        }}
        onGestureCommit={handleGestureCommit}
      />

      {/* Numeric Rates and Levels */}
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((stage) => {
          const pt = pitchEnvelope[stage] ?? { rate: 0, level: 0 };
          return (
            <div key={stage} className="flex flex-col gap-1 rounded border border-blue-border/30 p-2 bg-blue-surface/20">
              <span className="text-role-subheadline font-medium text-gray-400">Stage {stage + 1}</span>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-0.5">
                  <label htmlFor={`bluex7-peg-r${stage + 1}`} className="text-role-subheadline text-blue-muted">
                    R{stage + 1}
                  </label>
                  <input
                    id={`bluex7-peg-r${stage + 1}`}
                    aria-label={`Pitch Rate ${stage + 1}`}
                    type="number"
                    min={0}
                    max={99}
                    value={pt.rate}
                    onChange={handlePointChange(stage, 'rate', 0, 99)}
                    className="w-full rounded border border-blue-border bg-blue-bg px-1 py-1 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <label htmlFor={`bluex7-peg-l${stage + 1}`} className="text-role-subheadline text-blue-muted">
                    L{stage + 1}
                  </label>
                  <input
                    id={`bluex7-peg-l${stage + 1}`}
                    aria-label={`Pitch Level ${stage + 1}`}
                    type="number"
                    min={0}
                    max={99}
                    value={pt.level}
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
  );
};
