import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TimeConversionContext } from '../../../../../shared/project-editor';
import { TIME_BASE_OPTIONS, formatForBase, parseForBase } from '../../../../time/time-unit-logic';
import {
  BLUE_INSPECTOR_INPUT_CLASS,
  BLUE_INSPECTOR_TIME_BASE_SELECT_CLASS,
} from '../shared/compactFieldStyles';
import { AppSelect } from '../../../AppSelect';

export type { TimeConversionContext };

interface TimeUnitEditorProps {
  valueBeats: number;
  timeBase: string;
  timeContext: TimeConversionContext;
  durationMode: boolean;
  disabled?: boolean;
  onCommit: (beats: number, timeBase: string) => void;
}

export default function TimeUnitEditor({
  valueBeats,
  timeBase,
  timeContext,
  durationMode,
  disabled,
  onCommit,
}: TimeUnitEditorProps): React.ReactElement {
  const [draft, setDraft] = useState(() =>
    formatForBase(valueBeats, timeBase, timeContext, durationMode),
  );
  const [activeBase, setActiveBase] = useState(timeBase);
  const lastCommitted = useRef(valueBeats);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(formatForBase(valueBeats, activeBase, timeContext, durationMode));
      lastCommitted.current = valueBeats;
    }
  }, [valueBeats, activeBase, timeContext, durationMode]);

  useEffect(() => {
    if (timeBase !== activeBase) {
      setActiveBase(timeBase);
    }
  }, [timeBase, activeBase]);

  const commitText = useCallback(() => {
    const parsed = parseForBase(draft, activeBase, timeContext, durationMode);
    if (parsed === null) {
      setDraft(formatForBase(lastCommitted.current, activeBase, timeContext, durationMode));
      return;
    }
    if (Math.abs(parsed - lastCommitted.current) > 1e-10) {
      lastCommitted.current = parsed;
      onCommit(parsed, activeBase);
    }
    setDraft(formatForBase(parsed, activeBase, timeContext, durationMode));
  }, [draft, activeBase, timeContext, durationMode, onCommit]);

  const handleBaseChange = useCallback(
    (newBase: string) => {
      const currentBeats = lastCommitted.current;
      setDraft(formatForBase(currentBeats, newBase, timeContext, durationMode));
      setActiveBase(newBase);
      if (newBase !== timeBase) {
        lastCommitted.current = currentBeats;
        onCommit(currentBeats, newBase);
      }
    },
    [timeBase, timeContext, durationMode, onCommit],
  );

  return (
    <div className="flex flex-col gap-0.5">
      <AppSelect
        className={BLUE_INSPECTOR_TIME_BASE_SELECT_CLASS}
        value={activeBase}
        disabled={disabled}
        onValueChange={handleBaseChange}
        options={TIME_BASE_OPTIONS}
      />
      <input
        ref={inputRef}
        type="text"
        className={BLUE_INSPECTOR_INPUT_CLASS}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitText();
        }}
      />
    </div>
  );
}
