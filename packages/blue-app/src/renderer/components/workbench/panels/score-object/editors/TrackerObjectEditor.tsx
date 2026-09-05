import React, { useCallback } from 'react';
import CommitNumberInput from '../../../../CommitNumberInput';
import { cn } from '../../../../../lib/cn';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import {
  BLUE_INSPECTOR_CONTROL_CLASS,
  BLUE_INSPECTOR_FIELD_LABEL_CLASS,
  BLUE_INSPECTOR_ROW_CLASS,
  BLUE_INSPECTOR_VALUE_TEXT_CLASS,
} from '../../shared/compactFieldStyles';

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={BLUE_INSPECTOR_ROW_CLASS}>
      <label className={BLUE_INSPECTOR_FIELD_LABEL_CLASS}>{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function TrackerObjectEditor({
  document,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'structured' || editor.editorFamily !== 'TrackerObject') return <></>;

  const { stepsPerBeat, trackData } = editor.payload as {
    stepsPerBeat: number;
    trackData: string[][];
  };

  const patch = useCallback(
    (p: Record<string, unknown>) => {
      onPatch({
        type: 'updateTypeSpecificEditor',
        target: document.target,
        patch: p,
      });
    },
    [document.target, onPatch],
  );

  const handleCellChange = useCallback(
    (trackIndex: number, stepIndex: number, value: string) => {
      patch({ updateTrackCell: { trackIndex, stepIndex, value } });
    },
    [patch],
  );

  const handleAddTrack = useCallback(() => {
    patch({ addTrack: true });
  }, [patch]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-3 px-3 py-2 border-b border-blue-border shrink-0">
        <FieldRow label="Steps/Beat">
          <CommitNumberInput
            min={1}
            max={64}
            step={1}
            className={cn('w-16', BLUE_INSPECTOR_CONTROL_CLASS)}
            value={stepsPerBeat}
            onChange={(val) => patch({ stepsPerBeat: val })}
            resolveValue={(text) => parseInt(text, 10) || 1}
          />
        </FieldRow>
        <FieldRow label="Tracks">
          <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{trackData.length}</span>
        </FieldRow>
      </div>

      <div className="flex-1 overflow-auto bg-black">
        {trackData.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-role-body text-blue-muted">
            No tracks
          </div>
        ) : (
          <table className="w-full border-collapse text-role-body">
            <thead>
              <tr className="border-b border-blue-border">
                <th className="px-2 py-1 text-left text-blue-muted font-normal w-16">Track</th>
                {trackData[0]?.map((_, si) => (
                  <th key={si} className="px-1 py-1 text-center text-blue-muted font-normal">
                    {si}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trackData.map((track, ti) => (
                <tr key={ti} className="border-b border-blue-border/50">
                  <td className="px-2 py-0.5 text-gray-400">{ti}</td>
                  {track.map((cell, si) => (
                    <td key={si} className="px-0.5 py-0.5">
                      <input
                        type="text"
                        className="w-full min-w-[3rem] rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 font-mono focus:border-blue-accent focus:outline-none text-center"
                        value={cell}
                        onChange={(e) => handleCellChange(ti, si, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-3 py-2">
          <button
            className="px-2 py-1 text-role-body rounded border border-blue-border text-blue-muted hover:bg-blue-border/30"
            onClick={handleAddTrack}
          >
            + Add Track
          </button>
        </div>
      </div>
    </div>
  );
}
