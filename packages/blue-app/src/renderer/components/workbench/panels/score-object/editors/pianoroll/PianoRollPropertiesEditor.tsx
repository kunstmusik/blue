import React, { useCallback } from 'react';
import type { PianoRollPayload } from './types';
import { PCH_LABELS } from './types';
import ScaleSelectionPanel from './ScaleSelectionPanel';
import FieldDefinitionsEditor from './FieldDefinitionsEditor';
import {
  BLUE_INSPECTOR_FIELD_LABEL_CLASS,
  BLUE_INSPECTOR_INPUT_CLASS,
  BLUE_INSPECTOR_ROW_CLASS,
} from '../../../shared/compactFieldStyles';

const inputCls = BLUE_INSPECTOR_INPUT_CLASS;

interface PianoRollPropertiesEditorProps {
  payload: PianoRollPayload;
  onPatch: (patch: Record<string, unknown>) => void;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={BLUE_INSPECTOR_ROW_CLASS}>
      <label className={BLUE_INSPECTOR_FIELD_LABEL_CLASS}>{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function PianoRollPropertiesEditor({
  payload,
  onPatch,
}: PianoRollPropertiesEditorProps): React.ReactElement {
  const { instrumentId, noteTemplate, pchGenerationMethod, transposition, scale, baseFrequency, fieldDefinitions } = payload as PianoRollPayload & { baseFrequency?: number };

  const handleScaleChange = useCallback((newScale: typeof scale) => {
    onPatch({ scale: newScale });
  }, [onPatch]);

  return (
    <div className="overflow-y-auto h-full">
      <div className="py-2">
        <FieldRow label="Instrument ID">
          <input type="text" className={inputCls} value={instrumentId}
            onChange={(e) => onPatch({ instrumentId: e.target.value })} />
        </FieldRow>
        <FieldRow label="Note Template">
          <div className="flex items-center gap-1">
            <input type="text" className={`${inputCls} font-mono`} value={noteTemplate}
              onChange={(e) => onPatch({ noteTemplate: e.target.value })} />
          </div>
        </FieldRow>
        <FieldRow label="Scale">
          <ScaleSelectionPanel scale={scale} onScaleChange={handleScaleChange} />
        </FieldRow>
        <FieldRow label="Pitch Generation">
          <div className="flex gap-2">
            {PCH_LABELS.map((label, i) => (
              <label key={i} className="flex items-center gap-1 text-body text-gray-200">
                <input
                  type="radio"
                  className="accent-blue-accent"
                  checked={pchGenerationMethod === i}
                  onChange={() => onPatch({ pchGenerationMethod: i })}
                />
                {label}
              </label>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Transposition">
          <input type="number" className={inputCls} value={transposition} step={1}
            onChange={(e) => onPatch({ transposition: parseInt(e.target.value, 10) || 0 })} />
        </FieldRow>
        <div className="px-3 py-2">
          <FieldDefinitionsEditor fieldDefinitions={fieldDefinitions} onPatch={onPatch} />
        </div>
      </div>
    </div>
  );
}
