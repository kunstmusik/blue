import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import TimeUnitEditor from '../TimeUnitEditor';
import { formatTime, totalSecondsToTime } from '../../../../../time/time-unit-logic';
import {
  BLUE_INSPECTOR_FIELD_LABEL_CLASS,
  BLUE_INSPECTOR_INPUT_CLASS,
  BLUE_INSPECTOR_ROW_CLASS,
  BLUE_INSPECTOR_VALUE_TEXT_CLASS,
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
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  const colonParts = trimmed.split(':');
  if (colonParts.length < 2 || colonParts.length > 3) {
    return null;
  }

  const lastPart = colonParts[colonParts.length - 1] ?? '0';
  const secondParts = lastPart.split('.');
  if (secondParts.length > 2) {
    return null;
  }

  const hours = colonParts.length === 3 ? Number.parseInt(colonParts[0] ?? '0', 10) : 0;
  const minutes = Number.parseInt(colonParts[colonParts.length - 2] ?? '0', 10);
  const seconds = Number.parseInt(secondParts[0] ?? '0', 10);
  const milliseconds = secondParts.length === 2
    ? Number.parseInt((secondParts[1] ?? '0').padEnd(3, '0').slice(0, 3), 10)
    : 0;

  if ([hours, minutes, seconds, milliseconds].some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
}

export default function AudioClipScoreObjectEditor({ document, onPatch }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'audioClip') return <></>;

  const [fileStartDraft, setFileStartDraft] = useState(() => formatSecondsAsTime(editor.fileStartTime));

  useEffect(() => {
    setFileStartDraft(formatSecondsAsTime(editor.fileStartTime));
  }, [editor.fileStartTime]);

  const handleStartTimeCommit = useCallback((value: number, timeBase: string) => {
    onPatch({
      type: 'updateSharedProperties',
      target: document.target,
      patch: { startTime: { value, timeBase } },
    });
  }, [document.target, onPatch]);

  const handleDurationCommit = useCallback((value: number, timeBase: string) => {
    onPatch({
      type: 'updateSharedProperties',
      target: document.target,
      patch: { subjectiveDuration: { value, timeBase } },
    });
  }, [document.target, onPatch]);

  const handleFileChange = useCallback((audioFile: string) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { audioFile },
    });
  }, [document.target, onPatch]);

  const handleFileStartTimeChange = useCallback((fileStartTime: number) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fileStartTime },
    });
  }, [document.target, onPatch]);

  const commitFileStartDraft = useCallback(() => {
    const parsed = parseSecondsText(fileStartDraft);
    if (parsed === null) {
      setFileStartDraft(formatSecondsAsTime(editor.fileStartTime));
      return;
    }

    handleFileStartTimeChange(parsed);
    setFileStartDraft(formatSecondsAsTime(parsed));
  }, [editor.fileStartTime, fileStartDraft, handleFileStartTimeChange]);

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
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fadeIn },
    });
  }, [document.target, onPatch]);

  const handleFadeOutChange = useCallback((fadeOut: number) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { fadeOut },
    });
  }, [document.target, onPatch]);

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
            disabled
            readOnly
          />
        </FieldRow>

        <FieldRow label="Fade In (s)">
          <input
            type="number"
            className={INPUT_CLASS}
            value={editor.fadeIn}
            step={0.001}
            onChange={(e) => handleFadeInChange(parseFloat(e.target.value) || 0)}
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
            type="number"
            className={INPUT_CLASS}
            value={editor.fadeOut}
            step={0.001}
            onChange={(e) => handleFadeOutChange(parseFloat(e.target.value) || 0)}
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

      <FieldRow label="Channels">
        <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{editor.numChannels}</span>
      </FieldRow>

      <FieldRow label="Audio Duration">
        <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{formattedAudioDuration}</span>
      </FieldRow>
    </div>
  );
}
