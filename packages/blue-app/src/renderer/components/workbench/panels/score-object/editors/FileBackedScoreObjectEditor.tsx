import React, { useEffect, useState } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import type {
  AudioFileMetadataState,
  AudioFileMetadataSnapshot,
} from '../../../../../shared/project-editor';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';
import {
  BLUE_INSPECTOR_FIELD_LABEL_CLASS,
  BLUE_INSPECTOR_INPUT_CLASS,
  BLUE_INSPECTOR_ROW_CLASS,
  BLUE_INSPECTOR_VALUE_TEXT_CLASS,
} from '../../shared/compactFieldStyles';

export function formatAudioDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00:00.000';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  let millis = Math.round((secs - wholeSecs) * 1000);
  if (millis >= 1000) {
    millis = 999;
  }
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(wholeSecs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={BLUE_INSPECTOR_ROW_CLASS}>
      <label className={BLUE_INSPECTOR_FIELD_LABEL_CLASS}>{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const inputCls = BLUE_INSPECTOR_INPUT_CLASS;

interface LocalAudioMetadata {
  targetKey: string;
  sourcePath: string;
  storedPath: string;
  metadata: AudioFileMetadataSnapshot;
}

export default function FileBackedScoreObjectEditor({ document, onPatch }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  const targetKey = JSON.stringify(document.target);
  const [activeTab, setActiveTab] = useState<'audioFile' | 'csound'>('audioFile');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [localMetadata, setLocalMetadata] = useState<LocalAudioMetadata | null>(null);

  useEffect(() => {
    setLocalMetadata((current) => current?.targetKey === targetKey ? current : null);
    setActionError(null);
    setSaveSuccessMessage(null);
  }, [targetKey]);

  // ─── AudioFile Editor ───
  if (editor.kind === 'audioFile') {
    const metadataOverride = localMetadata?.targetKey === targetKey
      && (localMetadata.sourcePath === editor.filePath || localMetadata.storedPath === editor.filePath)
      ? localMetadata.metadata
      : null;
    const metadataState: AudioFileMetadataState = metadataOverride
      ? {
          status: 'available',
          path: editor.filePath,
          formatType: metadataOverride.formatType,
          byteLength: metadataOverride.byteLength,
          encodingType: metadataOverride.encodingType,
          sampleRate: metadataOverride.sampleRate,
          sampleSizeInBits: metadataOverride.sampleSizeInBits,
          channels: metadataOverride.channels,
          isBigEndian: metadataOverride.isBigEndian,
          durationSeconds: metadataOverride.durationSeconds,
          frameCount: metadataOverride.frameCount,
          channelVariables: metadataOverride.channelVariables,
          unavailableFields: metadataOverride.unavailableFields,
        }
      : editor.metadata;

    const handleBrowse = async () => {
      setActionError(null);
      if (!window.blueAPI?.selectScoreObjectAudioFile) return;
      try {
        const result = await window.blueAPI.selectScoreObjectAudioFile({ currentPath: editor.filePath });
        if (result.status === 'selected') {
          setLocalMetadata({
            targetKey,
            sourcePath: editor.filePath,
            storedPath: result.storedPath,
            metadata: result.metadata,
          });
          onPatch({
            type: 'replaceAudioFileSource',
            target: document.target,
            filePath: result.storedPath,
            name: result.objectName,
          });
        } else if (result.status === 'error') {
          setActionError(result.message);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    };

    const handlePostCodeChange = (text: string) => {
      onPatch({
        type: 'updateAudioFilePostCode',
        target: document.target,
        csoundPostCode: text,
      });
    };

    const channelVariablesInfo = metadataState.status === 'available'
      && !metadataState.unavailableFields.includes('channels')
      ? `Channels mapped to: ${metadataState.channelVariables || 'aChannel1'}`
      : 'Channel variables unavailable';

    const metadataValue = (field: string, value: React.ReactNode): React.ReactNode => (
      metadataState.status === 'available' && metadataState.unavailableFields.includes(field)
        ? 'Unavailable'
        : value
    );

    return (
      <div className="flex h-full min-h-0 flex-col bg-blue-bg">
        <div className="border-b border-blue-border bg-app-surface-strong px-2 shrink-0">
          <div className="flex items-end gap-1">
            <button
              type="button"
              data-audio-file-tab="audioFile"
              className={[
                'border-b-2 px-3 py-2 text-role-body',
                activeTab === 'audioFile'
                  ? 'border-blue-accent text-app-text-strong font-medium'
                  : 'border-transparent text-blue-muted hover:text-app-text-strong',
              ].join(' ')}
              onClick={() => setActiveTab('audioFile')}
            >
              Audio File
            </button>
            <button
              type="button"
              data-audio-file-tab="csound"
              className={[
                'border-b-2 px-3 py-2 text-role-body',
                activeTab === 'csound'
                  ? 'border-blue-accent text-app-text-strong font-medium'
                  : 'border-transparent text-blue-muted hover:text-app-text-strong',
              ].join(' ')}
              onClick={() => setActiveTab('csound')}
            >
              Csound
            </button>
          </div>
        </div>

        {actionError && (
          <div className="px-3 py-1.5 text-role-body border-b shrink-0 bg-red-900/20 text-red-300 flex items-center justify-between">
            <span>{actionError}</span>
            <button
              className="underline text-blue-muted hover:text-gray-200 ml-2"
              onClick={() => setActionError(null)}
            >
              dismiss
            </button>
          </div>
        )}

        {activeTab === 'audioFile' && (
          <div className="py-2 flex-1 overflow-y-auto" data-testid="audio-file-tab-content">
            <div className={BLUE_INSPECTOR_ROW_CLASS}>
              <label className={BLUE_INSPECTOR_FIELD_LABEL_CLASS}>Sound File</label>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label="Sound File"
                  className={`${inputCls} bg-app-surface-subtle cursor-default`}
                  value={editor.filePath}
                />
                <button
                  type="button"
                  aria-label="Browse Audio File"
                  className="shrink-0 px-3 py-1 text-role-body rounded border border-blue-border text-gray-200 hover:bg-blue-border/30"
                  onClick={handleBrowse}
                >
                  ...
                </button>
              </div>
            </div>

            {metadataState.status === 'missing' && (
              <div className="mx-3 my-2 p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-role-body">
                <div className="font-semibold">Audio File Not Found</div>
                <div className="text-amber-300/80 text-role-callout mt-0.5">{metadataState.message}</div>
              </div>
            )}

            {metadataState.status === 'unreadable' && (
              <div className="mx-3 my-2 p-2 rounded bg-red-950/40 border border-red-800/60 text-red-200 text-role-body">
                <div className="font-semibold">Audio File Unreadable</div>
                <div className="text-red-300/80 text-role-callout mt-0.5">{metadataState.message}</div>
              </div>
            )}

            {metadataState.status === 'unsupported' && (
              <div className="mx-3 my-2 p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-role-body">
                <div className="font-semibold">Unsupported Audio Format</div>
                <div className="text-amber-300/80 text-role-callout mt-0.5">{metadataState.message}</div>
              </div>
            )}

            {metadataState.status === 'available' && (
              <div className="mt-2 pt-2 border-t border-blue-border/40" data-testid="audio-file-metadata-grid">
                <FieldRow label="Duration">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>
                    {metadataValue('durationSeconds', formatAudioDuration(metadataState.durationSeconds))}
                  </span>
                </FieldRow>
                <FieldRow label="Format Type">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{metadataValue('formatType', metadataState.formatType)}</span>
                </FieldRow>
                <FieldRow label="Byte Length">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{metadataValue('byteLength', metadataState.byteLength)}</span>
                </FieldRow>
                <FieldRow label="Encoding Type">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{metadataValue('encodingType', metadataState.encodingType)}</span>
                </FieldRow>
                <FieldRow label="Sample Rate">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{metadataValue('sampleRate', metadataState.sampleRate.toFixed(1))}</span>
                </FieldRow>
                <FieldRow label="Sample Size">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{metadataValue('sampleSizeInBits', metadataState.sampleSizeInBits)}</span>
                </FieldRow>
                <FieldRow label="Channels">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{metadataValue('channels', metadataState.channels)}</span>
                </FieldRow>
                <FieldRow label="Is Big Endian">
                  <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{metadataValue('isBigEndian', String(metadataState.isBigEndian))}</span>
                </FieldRow>
              </div>
            )}
          </div>
        )}

        {activeTab === 'csound' && (
          <div className="flex-1 flex flex-col min-h-0" data-testid="csound-tab-content">
            <div className="px-3 py-1.5 border-b border-blue-border bg-app-surface-subtle text-role-body text-gray-300 shrink-0" data-testid="channel-variables-info">
              {channelVariablesInfo}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <SelectedCodeEditor
                value={editor.csoundPostCode}
                mode="orc"
                active={true}
                readOnly={false}
                ariaLabel="Csound Post Code Editor"
                onChange={handlePostCodeChange}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── FrozenSoundObject Inspector ───
  if (editor.kind === 'frozenSoundObject') {
    const handleSaveCopy = async () => {
      setActionError(null);
      setSaveSuccessMessage(null);
      if (!window.blueAPI?.saveFrozenSoundObjectCopy) return;
      try {
        const result = await window.blueAPI.saveFrozenSoundObjectCopy({
          frozenWaveFileName: editor.frozenWaveFileName,
        });
        if (result.status === 'copied') {
          setSaveSuccessMessage(`Saved copy to: ${result.destinationPath}`);
        } else if (result.status === 'error') {
          setActionError(result.message);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    };

    return (
      <div className="flex h-full min-h-0 flex-col bg-blue-bg py-2 overflow-y-auto">
        {actionError && (
          <div className="mx-3 mb-2 px-3 py-1.5 text-role-body rounded bg-red-900/20 text-red-300 flex items-center justify-between border border-red-800/50">
            <span>{actionError}</span>
            <button
              className="underline text-blue-muted hover:text-gray-200 ml-2"
              onClick={() => setActionError(null)}
            >
              dismiss
            </button>
          </div>
        )}

        {saveSuccessMessage && (
          <div className="mx-3 mb-2 px-3 py-1.5 text-role-body rounded bg-green-900/20 text-green-300 flex items-center justify-between border border-green-800/50">
            <span>{saveSuccessMessage}</span>
            <button
              className="underline text-blue-muted hover:text-gray-200 ml-2"
              onClick={() => setSaveSuccessMessage(null)}
            >
              dismiss
            </button>
          </div>
        )}

        <FieldRow label="Object Name">
          <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{editor.sourceName || '(Unnamed)'}</span>
        </FieldRow>
        <FieldRow label="Type">
          <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{editor.sourceType || 'SoundObject'}</span>
        </FieldRow>
        <FieldRow label="Wave File">
          <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{editor.frozenWaveFileName}</span>
        </FieldRow>
        <FieldRow label="Channels">
          <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>
            {editor.numChannels > 0 ? editor.numChannels : 'Unavailable'}
          </span>
        </FieldRow>
        {editor.sourceDurationBeats !== null && (
          <FieldRow label="Duration">
            <span className={BLUE_INSPECTOR_VALUE_TEXT_CLASS}>{editor.sourceDurationBeats} beats</span>
          </FieldRow>
        )}

        {editor.artifactStatus === 'missing' && (
          <div className="mx-3 my-2 p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-role-body">
            <div className="font-semibold">Frozen Audio Artifact Missing</div>
            <div className="text-amber-300/80 text-role-callout mt-0.5">
              {editor.message || `Could not locate frozen file: ${editor.frozenWaveFileName}`}
            </div>
          </div>
        )}

        {editor.artifactStatus === 'unreadable' && (
          <div className="mx-3 my-2 p-2 rounded bg-red-950/40 border border-red-800/60 text-red-200 text-role-body">
            <div className="font-semibold">Frozen Audio Artifact Unreadable</div>
            <div className="text-red-300/80 text-role-callout mt-0.5">
              {editor.message || `Could not read frozen file: ${editor.frozenWaveFileName}`}
            </div>
          </div>
        )}

        <div className="mt-4 px-3 flex justify-end">
          <button
            type="button"
            aria-label="Save Copy"
            disabled={!editor.canSaveCopy}
            className="px-4 py-1.5 text-role-body font-medium rounded border border-blue-border text-gray-100 hover:bg-blue-border/30 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleSaveCopy}
          >
            Save Copy
          </button>
        </div>
      </div>
    );
  }

  // ─── Fallback for generic file-kind editor ───
  if (editor.kind === 'file') {
    const isAudioFile = editor.objectType === 'AudioFile';
    const isFrozen = editor.objectType === 'FrozenSoundObject';

    const patchField = (field: Record<string, unknown>) => {
      onPatch({
        type: 'updateTypeSpecificEditor',
        target: document.target,
        patch: field,
      });
    };

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

  return <></>;
}
