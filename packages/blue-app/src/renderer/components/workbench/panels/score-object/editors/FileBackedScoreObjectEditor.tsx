import React, { useCallback } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import {
  BLUE_INSPECTOR_FIELD_LABEL_CLASS,
  BLUE_INSPECTOR_INPUT_CLASS,
  BLUE_INSPECTOR_ROW_CLASS,
  BLUE_INSPECTOR_VALUE_TEXT_CLASS,
} from '../../shared/compactFieldStyles';

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={BLUE_INSPECTOR_ROW_CLASS}>
      <label className={BLUE_INSPECTOR_FIELD_LABEL_CLASS}>{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const inputCls = BLUE_INSPECTOR_INPUT_CLASS;

export default function FileBackedScoreObjectEditor({ document, onPatch }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'file') return <></>;

  const isAudioFile = editor.objectType === 'AudioFile';
  const isFrozen = editor.objectType === 'FrozenSoundObject';

  const patchField = useCallback((field: Record<string, unknown>) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: field,
    });
  }, [document.target, onPatch]);

  return (
    <div className="py-2">
      <FieldRow label={isFrozen ? 'Wave File' : 'Sound File'}>
        <input
          type="text"
          className={inputCls}
          value={editor.filePath}
          onChange={(e) => patchField({ filePath: e.target.value })}
        />
      </FieldRow>

      {isAudioFile && (
        <FieldRow label="Post Code">
          <textarea
            className={`${inputCls} font-mono`}
            rows={4}
            value={editor.csoundPostCode ?? ''}
            onChange={(e) => patchField({ csoundPostCode: e.target.value })}
          />
        </FieldRow>
      )}

      {isFrozen && (
        <>
          <FieldRow label="Channels">
            <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{editor.numChannels ?? 0}</span>
          </FieldRow>
          {editor.originalObjectType && (
            <FieldRow label="Original Type">
              <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{editor.originalObjectType}</span>
            </FieldRow>
          )}
        </>
      )}
    </div>
  );
}
