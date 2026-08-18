import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import TimeUnitEditor from '../TimeUnitEditor';
import {
  beatsToSeconds,
  formatTime,
  secondsToBeats,
  totalSecondsToTime,
} from '../../../../../time/time-unit-logic';
import {
  BLUE_INSPECTOR_FIELD_LABEL_CLASS,
  BLUE_INSPECTOR_INPUT_CLASS,
  BLUE_INSPECTOR_ROW_CLASS,
} from '../../shared/compactFieldStyles';

const INPUT_CLASS = BLUE_INSPECTOR_INPUT_CLASS;
const FADE_TYPE_OPTIONS = [
  { value: 'LINEAR', label: 'Linear' },
  { value: 'CONSTANT_POWER', label: 'Constant Power' },
  { value: 'SYMMETRIC', label: 'Symmetric' },
  { value: 'FAST', label: 'Fast' },
  { value: 'SLOW', label: 'Slow' },
] as const;

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={BLUE_INSPECTOR_ROW_CLASS}>
      <label className={BLUE_INSPECTOR_FIELD_LABEL_CLASS}>{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function formatSecondsAsTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const parts = totalSecondsToTime(value);
  return formatTime(parts.hours, parts.minutes, parts.seconds, parts.ms);
}

function parseSecondsText(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (!trimmed.includes(':')) {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const colonParts = trimmed.split(':');
  if (colonParts.length < 2 || colonParts.length > 3) {
    return null;
  }

  const lastPart = (colonParts[colonParts.length - 1] ?? '0').trim();
  const secondParts = lastPart.split('.');
  if (secondParts.length > 2) {
    return null;
  }

  const parseInteger = (part: string): number | null => {
    const normalized = part.trim();
    if (!/^\d+$/.test(normalized)) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };

  const hours = colonParts.length === 3 ? parseInteger(colonParts[0] ?? '0') : 0;
  const minutes = parseInteger(colonParts[colonParts.length - 2] ?? '0');
  const seconds = parseInteger(secondParts[0] ?? '0');
  const milliseconds = secondParts.length === 2
    ? parseInteger((secondParts[1] ?? '').padEnd(3, '0').slice(0, 3))
    : 0;

  if ([hours, minutes, seconds, milliseconds].some((part) => part === null || part < 0)) {
    return null;
  }

  return (hours! * 3600) + (minutes! * 60) + seconds! + (milliseconds! / 1000);
}

export default function AudioClipScoreObjectEditor({ document, onPatch }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'audioClip') return <></>;

  const [fileStartDraft, setFileStartDraft] = useState(() => formatSecondsAsTime(editor.fileStartTime));
  const [fadeInDraft, setFadeInDraft] = useState(() => formatSecondsAsTime(editor.fadeIn));
  const [fadeOutDraft, setFadeOutDraft] = useState(() => formatSecondsAsTime(editor.fadeOut));

  useEffect(() => {
    setFileStartDraft(formatSecondsAsTime(editor.fileStartTime));
  }, [editor.fileStartTime]);

  useEffect(() => {
    setFadeInDraft(formatSecondsAsTime(editor.fadeIn));
  }, [editor.fadeIn]);

  useEffect(() => {
    setFadeOutDraft(formatSecondsAsTime(editor.fadeOut));
  }, [editor.fadeOut]);

  const handleStartTimeCommit = useCallback((value: number, timeBase: string) => {
    onPatch({
      type: 'updateSharedProperties',
      target: document.target,
      patch: { startTime: { value, timeBase } },
    });
  }, [document.target, onPatch]);

  const handleDurationCommit = useCallback((value: number, timeBase: string) => {
    const availableDurationBeats = secondsToBeats(
      Math.max(0, editor.audioDuration - editor.fileStartTime),
      document.timeContext,
    );
    const clampedValue = editor.looping || editor.audioDuration <= 0
      ? Math.max(0.0001, value)
      : Math.max(0.0001, Math.min(value, availableDurationBeats));
    onPatch({
      type: 'updateSharedProperties',
      target: document.target,
      patch: { subjectiveDuration: { value: clampedValue, timeBase } },
    });
  }, [document.target, document.timeContext, editor.audioDuration, editor.fileStartTime, editor.looping, onPatch]);

  const handleFileChange = useCallback((audioFile: string) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { audioFile },
    });
  }, [document.target, onPatch]);

  const handleFileStartTimeChange = useCallback((fileStartTime: number) => {
    const clamped = editor.audioDuration > 0
      ? Math.max(0, Math.min(fileStartTime, editor.audioDuration))
      : Math.max(0, fileStartTime);
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fileStartTime: clamped },
    });
  }, [document.target, editor.audioDuration, onPatch]);

  const commitFileStartDraft = useCallback(() => {
    const parsed = parseSecondsText(fileStartDraft);
    if (parsed === null) {
      setFileStartDraft(formatSecondsAsTime(editor.fileStartTime));
      return;
    }

    const clamped = editor.audioDuration > 0
      ? Math.max(0, Math.min(parsed, editor.audioDuration))
      : Math.max(0, parsed);
    handleFileStartTimeChange(clamped);
    setFileStartDraft(formatSecondsAsTime(clamped));
  }, [editor.audioDuration, editor.fileStartTime, fileStartDraft, handleFileStartTimeChange]);

  const handleFileStartKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitFileStartDraft();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setFileStartDraft(formatSecondsAsTime(editor.fileStartTime));
    }
  }, [commitFileStartDraft, editor.fileStartTime]);

  const handleFadeInChange = useCallback((fadeIn: number) => {
    const durationSeconds = Math.max(
      0,
      beatsToSeconds(document.shared.subjectiveDuration.value, document.timeContext),
    );
    const maxFadeIn = Math.max(0, durationSeconds - editor.fadeOut);
    const clamped = Math.max(0, Math.min(fadeIn, maxFadeIn));
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fadeIn: clamped },
    });
  }, [document.shared.subjectiveDuration.value, document.target, document.timeContext, editor.fadeOut, onPatch]);

  const commitFadeInDraft = useCallback(() => {
    const parsed = parseSecondsText(fadeInDraft);
    if (parsed === null) {
      setFadeInDraft(formatSecondsAsTime(editor.fadeIn));
      return;
    }

    const durationSeconds = Math.max(
      0,
      beatsToSeconds(document.shared.subjectiveDuration.value, document.timeContext),
    );
    const maxFadeIn = Math.max(0, durationSeconds - editor.fadeOut);
    const clamped = Math.max(0, Math.min(parsed, maxFadeIn));
    handleFadeInChange(clamped);
    setFadeInDraft(formatSecondsAsTime(clamped));
  }, [document.shared.subjectiveDuration.value, document.timeContext, editor.fadeIn, editor.fadeOut, fadeInDraft, handleFadeInChange]);

  const handleFadeInKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitFadeInDraft();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setFadeInDraft(formatSecondsAsTime(editor.fadeIn));
    }
  }, [commitFadeInDraft, editor.fadeIn]);

  const handleFadeOutChange = useCallback((fadeOut: number) => {
    const durationSeconds = Math.max(
      0,
      beatsToSeconds(document.shared.subjectiveDuration.value, document.timeContext),
    );
    const maxFadeOut = Math.max(0, durationSeconds - editor.fadeIn);
    const clamped = Math.max(0, Math.min(fadeOut, maxFadeOut));
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fadeOut: clamped },
    });
  }, [document.shared.subjectiveDuration.value, document.target, document.timeContext, editor.fadeIn, onPatch]);

  const commitFadeOutDraft = useCallback(() => {
    const parsed = parseSecondsText(fadeOutDraft);
    if (parsed === null) {
      setFadeOutDraft(formatSecondsAsTime(editor.fadeOut));
      return;
    }

    const durationSeconds = Math.max(
      0,
      beatsToSeconds(document.shared.subjectiveDuration.value, document.timeContext),
    );
    const maxFadeOut = Math.max(0, durationSeconds - editor.fadeIn);
    const clamped = Math.max(0, Math.min(parsed, maxFadeOut));
    handleFadeOutChange(clamped);
    setFadeOutDraft(formatSecondsAsTime(clamped));
  }, [document.shared.subjectiveDuration.value, document.timeContext, editor.fadeIn, editor.fadeOut, fadeOutDraft, handleFadeOutChange]);

  const handleFadeOutKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitFadeOutDraft();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setFadeOutDraft(formatSecondsAsTime(editor.fadeOut));
    }
  }, [commitFadeOutDraft, editor.fadeOut]);

  const handleFadeInTypeChange = useCallback((fadeInType: string) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fadeInType },
    });
  }, [document.target, onPatch]);

  const handleFadeOutTypeChange = useCallback((fadeOutType: string) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fadeOutType },
    });
  }, [document.target, onPatch]);

  const handleLoopingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { looping: e.target.checked },
    });
  }, [document.target, onPatch]);

  const formattedAudioDuration = useMemo(
    () => formatSecondsAsTime(editor.audioDuration),
    [editor.audioDuration],
  );

  return (
    <div className="h-full overflow-y-auto py-2">
      <FieldRow label="Audio File">
        <input
          type="text"
          className={INPUT_CLASS}
          value={editor.audioFile}
          disabled
          onChange={(e) => handleFileChange(e.target.value)}
        />
      </FieldRow>

      <FieldRow label="Start Time">
        <TimeUnitEditor
          valueBeats={document.shared.startTime.value}
          timeBase={document.shared.startTime.timeBase}
          timeContext={document.timeContext}
          durationMode={false}
          onCommit={handleStartTimeCommit}
        />
      </FieldRow>

      <FieldRow label="Duration">
        <TimeUnitEditor
          valueBeats={document.shared.subjectiveDuration.value}
          timeBase={document.shared.subjectiveDuration.timeBase}
          timeContext={document.timeContext}
          durationMode={true}
          onCommit={handleDurationCommit}
        />
      </FieldRow>

      <div className="mx-3 mt-2 rounded border border-blue-border/60 p-2">
        <div className="mb-1 text-ui text-app-text">File Properties</div>

        <FieldRow label="File Start">
          <input
            type="text"
            className={INPUT_CLASS}
            value={fileStartDraft}
            title="File start offset (H:MM:SS.mmm)"
            onChange={(e) => setFileStartDraft(e.target.value)}
            onBlur={commitFileStartDraft}
            onKeyDown={handleFileStartKeyDown}
          />
        </FieldRow>

        <FieldRow label="Duration">
          <input
            type="text"
            className={INPUT_CLASS}
            value={formattedAudioDuration}
            title="Total audio file duration"
            disabled
            readOnly
          />
        </FieldRow>

        <FieldRow label="Fade In (s)">
          <input
            type="text"
            className={INPUT_CLASS}
            value={fadeInDraft}
            title="Fade in time in seconds"
            onChange={(e) => setFadeInDraft(e.target.value)}
            onBlur={commitFadeInDraft}
            onKeyDown={handleFadeInKeyDown}
          />
        </FieldRow>

        <FieldRow label="Fade In Type">
          <select
            className={INPUT_CLASS}
            value={editor.fadeInType}
            onChange={(e) => handleFadeInTypeChange(e.target.value)}
          >
            {FADE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Fade Out (s)">
          <input
            type="text"
            className={INPUT_CLASS}
            value={fadeOutDraft}
            title="Fade out time in seconds"
            onChange={(e) => setFadeOutDraft(e.target.value)}
            onBlur={commitFadeOutDraft}
            onKeyDown={handleFadeOutKeyDown}
          />
        </FieldRow>

        <FieldRow label="Fade Out Type">
          <select
            className={INPUT_CLASS}
            value={editor.fadeOutType}
            onChange={(e) => handleFadeOutTypeChange(e.target.value)}
          >
            {FADE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Looping">
          <input
            type="checkbox"
            checked={editor.looping}
            onChange={handleLoopingChange}
            className="rounded border border-blue-border"
          />
        </FieldRow>
      </div>
    </div>
  );
}
