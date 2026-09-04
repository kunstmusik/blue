import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  NoteProcessorChainSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  ScorePatch,
} from '../../../../../shared/project-editor';
import {
  BLUE_INSPECTOR_FIELD_LABEL_CLASS,
  BLUE_INSPECTOR_INPUT_CLASS,
  BLUE_INSPECTOR_ROW_CLASS,
  BLUE_INSPECTOR_VALUE_TEXT_CLASS,
} from '../shared/compactFieldStyles';
import TimeUnitEditor from './TimeUnitEditor';
import NoteProcessorChainEditor from './note-processors/NoteProcessorChainEditor';
import ColorPickerButton from '../../../ColorPicker';
import { AppSelect } from '../../../AppSelect';

interface ScoreObjectPropertiesFormProps {
  document: ScoreObjectEditorDocumentSnapshot;
  onPatch: (patch: ScorePatch) => void;
}

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

const INPUT_CLASS = BLUE_INSPECTOR_INPUT_CLASS;

function CommitTextInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const lastCommitted = useRef(value);

  useEffect(() => {
    setDraft(value);
    lastCommitted.current = value;
  }, [value]);

  const commit = useCallback(() => {
    if (draft !== lastCommitted.current) {
      lastCommitted.current = draft;
      onCommit(draft);
    }
  }, [draft, onCommit]);

  return (
    <input
      type="text"
      className={INPUT_CLASS}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

function ColorSwatch({
  color,
  onChange,
}: {
  color: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  const hex = `#${(color >>> 0).toString(16).padStart(8, '0').slice(2)}`;
  return (
    <div className="flex items-center gap-2">
      <ColorPickerButton
        value={hex}
        ariaLabel="Score object color"
        title="Score object color"
        className="h-6 w-6 rounded border border-blue-border"
        onChange={(hexVal) => {
          const r = parseInt(hexVal.slice(1, 3), 16);
          const g = parseInt(hexVal.slice(3, 5), 16);
          const b = parseInt(hexVal.slice(5, 7), 16);
          onChange((0xff000000 | (r << 16) | (g << 8) | b) >>> 0);
        }}
      />
      <span className="text-role-body text-app-text">{hex}</span>
    </div>
  );
}

function SelectInput({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <AppSelect
      className={BLUE_INSPECTOR_INPUT_CLASS}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      options={options}
    />
  );
}

const TIME_BEHAVIOR_OPTIONS = [
  { value: 'SCALE', label: 'Scale' },
  { value: 'REPEAT', label: 'Repeat' },
  { value: 'REPEAT_CLASSIC', label: 'Repeat (Classic)' },
  { value: 'NONE', label: 'None' },
];

function isRepeatBehavior(tb: string | undefined): boolean {
  return tb === 'REPEAT' || tb === 'REPEAT_CLASSIC';
}

export default function ScoreObjectPropertiesForm({
  document,
  onPatch,
}: ScoreObjectPropertiesFormProps): React.ReactElement {
  const shared = document.shared;
  const target = document.target;
  const timeCtx = document.timeContext;
  const tb = shared.timeBehavior;
  const isRepeat = isRepeatBehavior(tb);
  const hasRepeatPoint = shared.repeatPoint !== null && shared.repeatPoint !== undefined;
  const repeatPointEnabled = isRepeat && hasRepeatPoint;
  const [namedChainNames, setNamedChainNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined' || !window.blueAPI?.getNamedChainNames) {
      return () => {};
    }
    window.blueAPI
      .getNamedChainNames()
      .then((names) => {
        if (!cancelled) {
          setNamedChainNames(names);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNameCommit = useCallback(
    (name: string) => {
      onPatch({
        type: 'updateSharedProperties',
        target,
        patch: { name },
      });
    },
    [target, onPatch],
  );

  const handleStartTimeCommit = useCallback(
    (value: number, timeBase: string) => {
      onPatch({
        type: 'updateSharedProperties',
        target,
        patch: { startTime: { value, timeBase } },
      });
    },
    [target, onPatch],
  );

  const handleDurationCommit = useCallback(
    (value: number, timeBase: string) => {
      onPatch({
        type: 'updateSharedProperties',
        target,
        patch: { subjectiveDuration: { value, timeBase } },
      });
    },
    [target, onPatch],
  );

  const handleColorChange = useCallback(
    (backgroundColor: number) => {
      onPatch({
        type: 'updateSharedProperties',
        target,
        patch: { backgroundColor },
      });
    },
    [target, onPatch],
  );

  const handleTimeBehaviorChange = useCallback(
    (timeBehavior: string) => {
      onPatch({
        type: 'updateSoundObjectBehavior',
        target,
        patch: { timeBehavior },
      });
    },
    [target, onPatch],
  );

  const handleUseRepeatPointChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        onPatch({
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            repeatPoint: {
              value: shared.subjectiveDuration.value,
              timeBase: shared.subjectiveDuration.timeBase,
            },
          },
        });
      } else {
        onPatch({
          type: 'updateSoundObjectBehavior',
          target,
          patch: { repeatPoint: null },
        });
      }
    },
    [target, onPatch, shared.subjectiveDuration.timeBase, shared.subjectiveDuration.value],
  );

  const handleRepeatPointCommit = useCallback(
    (value: number, timeBase: string) => {
      onPatch({
        type: 'updateSoundObjectBehavior',
        target,
        patch: { repeatPoint: value <= 0 ? null : { value, timeBase } },
      });
    },
    [target, onPatch],
  );

  const handleImportNamedChain = useCallback(
    async (name: string): Promise<NoteProcessorChainSnapshot | null> => {
      if (!window.blueAPI?.getNamedChain) {
        return null;
      }
      try {
        return await window.blueAPI.getNamedChain(name);
      } catch {
        return null;
      }
    },
    [],
  );

  const handleSaveNamedChain = useCallback(
    (name: string, chain: NoteProcessorChainSnapshot): void => {
      onPatch({
        type: 'saveNamedNoteProcessorChain',
        name,
        chain,
      });
      setNamedChainNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    },
    [onPatch],
  );

  const showSoundObjectFields = target.supportsTimeBehavior && tb !== undefined;

  return (
    <div className="py-2">
      <FieldRow label="Name:">
        <CommitTextInput value={shared.name} onCommit={handleNameCommit} />
      </FieldRow>

      <FieldRow label="Start Time:">
        <TimeUnitEditor
          valueBeats={shared.startTime.value}
          timeBase={shared.startTime.timeBase}
          timeContext={timeCtx}
          durationMode={false}
          onCommit={handleStartTimeCommit}
        />
      </FieldRow>

      <FieldRow label="Subjective Duration:">
        <TimeUnitEditor
          valueBeats={shared.subjectiveDuration.value}
          timeBase={shared.subjectiveDuration.timeBase}
          timeContext={timeCtx}
          durationMode={true}
          onCommit={handleDurationCommit}
        />
      </FieldRow>

      <FieldRow label="End Time:">
        <div className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{shared.endTimeDisplay}</div>
      </FieldRow>

      <FieldRow label="Color:">
        <ColorSwatch color={shared.backgroundColor} onChange={handleColorChange} />
      </FieldRow>

      {showSoundObjectFields && (
        <>
          <FieldRow label="Time Behavior:">
            <SelectInput
              value={tb!}
              options={TIME_BEHAVIOR_OPTIONS}
              onChange={handleTimeBehaviorChange}
            />
          </FieldRow>

          {target.supportsRepeatPoint && (
            <>
              <FieldRow label="Use Repeat Point:">
                <input
                  type="checkbox"
                  checked={repeatPointEnabled}
                  disabled={!isRepeat}
                  onChange={(e) => handleUseRepeatPointChange(e.target.checked)}
                  className="accent-blue-accent"
                />
              </FieldRow>

              <FieldRow label="Repeat Point:">
                <TimeUnitEditor
                  valueBeats={shared.repeatPoint?.value ?? 0}
                  timeBase={shared.repeatPoint?.timeBase ?? 'beats'}
                  timeContext={timeCtx}
                  durationMode={true}
                  disabled={!repeatPointEnabled}
                  onCommit={handleRepeatPointCommit}
                />
              </FieldRow>
            </>
          )}

          {target.supportsNoteProcessorChain && shared.noteProcessorChain != null && (
            <div className="px-3 py-2 mt-2 border-t border-blue-border">
              <div className="text-role-headline font-bold text-gray-300 mb-1">Note Processors</div>
              <NoteProcessorChainEditor
                key={target.selectionId}
                chain={shared.noteProcessorChain}
                namedChainNames={namedChainNames}
                onImportNamedChain={handleImportNamedChain}
                onSaveNamedChain={handleSaveNamedChain}
                onCommit={(updated: NoteProcessorChainSnapshot) => {
                  onPatch({
                    type: 'replaceNoteProcessorChain',
                    target,
                    chain: updated,
                  });
                }}
              />
            </div>
          )}
        </>
      )}

      {target.displayContext === 'instance' && (
        <div className="px-3 py-2 mt-2 border-t border-blue-border">
          <div className="flex items-center gap-1.5 text-role-body text-blue-accent">
            <span>&#9432;</span>
            <span>Editing library object via Instance</span>
          </div>
        </div>
      )}
    </div>
  );
}
