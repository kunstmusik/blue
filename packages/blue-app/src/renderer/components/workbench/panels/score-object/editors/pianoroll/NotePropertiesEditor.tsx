import React, { useCallback, useEffect, useState } from 'react';
import type { NoteSnapshot } from './types';

interface NotePropertiesEditorProps {
  notes: NoteSnapshot[];
  selectedIndices: Set<number>;
  globalNoteTemplate: string;
  onPatch: (patch: Record<string, unknown>) => void;
}

export default function NotePropertiesEditor({
  notes,
  selectedIndices,
  globalNoteTemplate,
  onPatch,
}: NotePropertiesEditorProps): React.ReactElement {
  const [isUpdating, setIsUpdating] = useState(false);

  const singleNote = selectedIndices.size === 1
    ? notes[[...selectedIndices][0]!]
    : null;

  const hasOverride = singleNote != null && singleNote.noteTemplate != null && singleNote.noteTemplate !== '';
  const [overrideEnabled, setOverrideEnabled] = useState(hasOverride);
  const [templateText, setTemplateText] = useState(
    hasOverride && singleNote?.noteTemplate ? singleNote.noteTemplate : globalNoteTemplate
  );

  useEffect(() => {
    if (isUpdating) return;
    const note = selectedIndices.size === 1 ? notes[[...selectedIndices][0]!] : null;
    const hasNote = note != null && note.noteTemplate != null && note.noteTemplate !== '';
    setOverrideEnabled(hasNote);
    setTemplateText(hasNote && note?.noteTemplate ? note.noteTemplate : globalNoteTemplate);
  }, [selectedIndices, notes, globalNoteTemplate, isUpdating]);

  const handleOverrideChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setOverrideEnabled(checked);
    if (selectedIndices.size === 1) {
      const idx = [...selectedIndices][0]!;
      if (!checked) {
        setIsUpdating(true);
        onPatch({ pianoRollNoteBatch: { operations: [{ kind: 'update', noteIndex: idx, note: { ...notes[idx]!, noteTemplate: '' } }] } });
        setTimeout(() => setIsUpdating(false), 0);
      }
    }
  }, [selectedIndices, notes, onPatch]);

  const handleTemplateBlur = useCallback(() => {
    if (selectedIndices.size === 1 && overrideEnabled) {
      const idx = [...selectedIndices][0]!;
      setIsUpdating(true);
      onPatch({ pianoRollNoteBatch: { operations: [{ kind: 'update', noteIndex: idx, note: { ...notes[idx]!, noteTemplate: templateText } }] } });
      setTimeout(() => setIsUpdating(false), 0);
    }
  }, [selectedIndices, overrideEnabled, templateText, notes, onPatch]);

  const enabled = selectedIndices.size === 1;

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <label className="flex items-center gap-1 text-role-subheadline text-app-text cursor-pointer shrink-0">
        <input
          type="checkbox"
          className="accent-blue-accent"
          checked={overrideEnabled}
          onChange={handleOverrideChange}
          disabled={!enabled}
        />
        Override
      </label>
      <input
        type="text"
        className="flex-1 min-w-0 rounded border border-blue-border bg-blue-bg px-2 py-0.5 text-role-subheadline text-gray-100 font-mono focus:border-blue-accent focus:outline-none disabled:opacity-40"
        value={templateText}
        onChange={(e) => setTemplateText(e.target.value)}
        onBlur={handleTemplateBlur}
        disabled={!enabled || !overrideEnabled}
      />
    </div>
  );
}
