// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileBackedScoreObjectEditor, {
  formatAudioDuration,
} from '../components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor';
import type {
  ScoreObjectEditorDocumentSnapshot,
} from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange?: (text: string) => void; ariaLabel?: string }) => (
    <textarea
      aria-label={ariaLabel ?? 'Csound Post Code Editor'}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

describe('formatAudioDuration', () => {
  it('formats duration in h:mm:ss.sss', () => {
    expect(formatAudioDuration(0)).toBe('0:00:00.000');
    expect(formatAudioDuration(1.5)).toBe('0:00:01.500');
    expect(formatAudioDuration(65.123)).toBe('0:01:05.123');
    expect(formatAudioDuration(3661.042)).toBe('1:01:01.042');
  });
});

describe('FileBackedScoreObjectEditor — AudioFile', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const baseTarget = {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'AudioFile',
    editorObjectType: 'AudioFile',
    ownerKind: 'timeline' as const,
    displayContext: 'timeline' as const,
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };

  const createAudioDoc = (
    metadataState = { status: 'empty' as const },
    filePath = 'sample.wav',
    csoundPostCode = '; post code',
  ): ScoreObjectEditorDocumentSnapshot => ({
    target: baseTarget,
    shared: {
      objectId: 'obj-1',
      name: 'Sample Audio',
      objectType: 'AudioFile',
      startBeats: 0,
      durationBeats: 4,
      layerLabel: 'Layer 1',
      layerIndex: 0,
      startTime: { value: 0, timeBase: 'BEATS' },
      subjectiveDuration: { value: 4, timeBase: 'BEATS' },
    },
    editor: {
      kind: 'audioFile',
      target: baseTarget,
      filePath,
      csoundPostCode,
      metadata: metadataState,
      canChooseFile: true,
    },
    timeContext: {
      sampleRate: 44100,
      tempo: 60,
    },
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    window.blueAPI = {
      ...window.blueAPI,
      selectScoreObjectAudioFile: vi.fn(),
      saveFrozenSoundObjectCopy: vi.fn(),
    } as any;
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it('renders Audio File and Csound tabs and defaults to Audio File tab', () => {
    const doc = createAudioDoc();
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    const audioTab = container!.querySelector('[data-audio-file-tab="audioFile"]');
    const csoundTab = container!.querySelector('[data-audio-file-tab="csound"]');
    expect(audioTab).not.toBeNull();
    expect(csoundTab).not.toBeNull();
    expect(container!.querySelector('[data-testid="audio-file-tab-content"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="csound-tab-content"]')).toBeNull();
  });

  it('renders non-editable path field and browse button', () => {
    const doc = createAudioDoc({ status: 'empty' }, 'music/intro.wav');
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    const input = container!.querySelector('input[aria-label="Sound File"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('music/intro.wav');
    expect(input.readOnly).toBe(true);

    const browseBtn = container!.querySelector('button[aria-label="Browse Audio File"]');
    expect(browseBtn).not.toBeNull();
  });

  it('calls selectScoreObjectAudioFile and patches source on browse selection', async () => {
    const onPatch = vi.fn();
    const selectMock = vi.fn().mockResolvedValue({
      status: 'selected',
      storedPath: 'media/new_audio.wav',
      objectName: 'new_audio.wav',
      metadata: {
        formatType: 'WAV',
        byteLength: 176400,
        encodingType: 'PCM',
        sampleRate: 44100,
        sampleSizeInBits: 16,
        channels: 2,
        isBigEndian: false,
        durationSeconds: 2.0,
        frameCount: 88200,
        channelVariables: 'aChannel1, aChannel2',
        unavailableFields: [],
      },
      copiedToMedia: true,
    });
    window.blueAPI.selectScoreObjectAudioFile = selectMock;

    const doc = createAudioDoc({ status: 'empty' }, 'old_audio.wav');
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const browseBtn = container!.querySelector('button[aria-label="Browse Audio File"]') as HTMLButtonElement;
    await act(async () => {
      browseBtn.click();
    });

    expect(selectMock).toHaveBeenCalledWith({ currentPath: 'old_audio.wav' });
    expect(onPatch).toHaveBeenCalledWith({
      type: 'replaceAudioFileSource',
      target: baseTarget,
      filePath: 'media/new_audio.wav',
      name: 'new_audio.wav',
    });
  });

  it('renders full metadata grid when metadata is available', () => {
    const doc = createAudioDoc({
      status: 'available',
      path: 'sample.wav',
      formatType: 'WAV',
      byteLength: 176444,
      encodingType: 'PCM',
      sampleRate: 44100,
      sampleSizeInBits: 16,
      channels: 2,
      isBigEndian: false,
      durationSeconds: 1.0,
      frameCount: 44100,
      channelVariables: 'aChannel1, aChannel2',
      unavailableFields: [],
    });

    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    const grid = container!.querySelector('[data-testid="audio-file-metadata-grid"]');
    expect(grid).not.toBeNull();
    expect(grid!.textContent).toContain('0:00:01.000');
    expect(grid!.textContent).toContain('WAV');
    expect(grid!.textContent).toContain('176444');
    expect(grid!.textContent).toContain('PCM');
    expect(grid!.textContent).toContain('44100.0');
    expect(grid!.textContent).toContain('16');
    expect(grid!.textContent).toContain('2');
    expect(grid!.textContent).toContain('false');
  });

  it('renders missing file banner when status is missing', () => {
    const doc = createAudioDoc({
      status: 'missing',
      path: 'sample.wav',
      message: 'Could not find file: sample.wav',
    });

    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    expect(container!.textContent).toContain('Audio File Not Found');
    expect(container!.textContent).toContain('Could not find file: sample.wav');
  });

  it('renders unreadable file banner when status is unreadable', () => {
    const doc = createAudioDoc({
      status: 'unreadable',
      path: 'sample.wav',
      message: 'Could not read file: sample.wav',
    });

    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    expect(container!.textContent).toContain('Audio File Unreadable');
    expect(container!.textContent).toContain('Could not read file: sample.wav');
  });

  it('renders unsupported format banner when status is unsupported', () => {
    const doc = createAudioDoc({
      status: 'unsupported',
      path: 'sample.wav',
      message: 'Unsupported audio format (magic=0x12345678)',
    });

    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    expect(container!.textContent).toContain('Unsupported Audio Format');
    expect(container!.textContent).toContain('Unsupported audio format');
  });

  it('renders explicit unavailable values for partially readable metadata', () => {
    const doc = createAudioDoc({
      status: 'available',
      path: 'partial.wav',
      formatType: 'WAV',
      byteLength: 44,
      encodingType: 'PCM',
      sampleRate: 44100,
      sampleSizeInBits: 16,
      channels: 0,
      isBigEndian: false,
      durationSeconds: 0,
      frameCount: 0,
      channelVariables: '',
      unavailableFields: ['channels', 'durationSeconds', 'frameCount'],
    }, 'partial.wav');

    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    const grid = container!.querySelector('[data-testid="audio-file-metadata-grid"]');
    expect(grid!.textContent).toContain('Unavailable');
    expect(grid!.textContent).not.toContain('0:00:00.000');
    act(() => {
      (container!.querySelector('[data-audio-file-tab="csound"]') as HTMLButtonElement).click();
    });
    expect(container!.querySelector('[data-testid="channel-variables-info"]')!.textContent)
      .toBe('Channel variables unavailable');
  });

  it('does not retain selected-file metadata after the stored path changes', async () => {
    const selectMock = vi.fn().mockResolvedValue({
      status: 'selected',
      storedPath: 'media/new_audio.wav',
      objectName: 'new_audio.wav',
      metadata: {
        formatType: 'WAV',
        byteLength: 176400,
        encodingType: 'PCM',
        sampleRate: 44100,
        sampleSizeInBits: 16,
        channels: 2,
        isBigEndian: false,
        durationSeconds: 2,
        frameCount: 88200,
        channelVariables: 'aChannel1, aChannel2',
        unavailableFields: [],
      },
      copiedToMedia: true,
    });
    window.blueAPI.selectScoreObjectAudioFile = selectMock;
    const onPatch = vi.fn();
    const original = createAudioDoc({ status: 'empty' }, 'old.wav');

    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={original} onPatch={onPatch} />);
    });
    await act(async () => {
      (container!.querySelector('button[aria-label="Browse Audio File"]') as HTMLButtonElement).click();
    });
    expect(container!.textContent).toContain('176400');

    const changed = createAudioDoc({
      status: 'missing',
      path: 'missing.wav',
      message: 'Could not find file: missing.wav',
    }, 'missing.wav');
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={changed} onPatch={onPatch} />);
    });

    expect(container!.textContent).toContain('Audio File Not Found');
    expect(container!.textContent).not.toContain('176400');
  });

  it('switches to Csound tab and shows channel variable mapping and code editor', () => {
    const onPatch = vi.fn();
    const doc = createAudioDoc(
      {
        status: 'available',
        path: 'stereo.wav',
        formatType: 'WAV',
        byteLength: 176400,
        encodingType: 'PCM',
        sampleRate: 44100,
        sampleSizeInBits: 16,
        channels: 2,
        isBigEndian: false,
        durationSeconds: 2.0,
        frameCount: 88200,
        channelVariables: 'aChannel1, aChannel2',
        unavailableFields: [],
      },
      'stereo.wav',
      'aChannel1 = aChannel1 * 0.5',
    );

    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const csoundTabBtn = container!.querySelector('[data-audio-file-tab="csound"]') as HTMLButtonElement;
    act(() => {
      csoundTabBtn.click();
    });

    expect(container!.querySelector('[data-testid="csound-tab-content"]')).not.toBeNull();
    const info = container!.querySelector('[data-testid="channel-variables-info"]');
    expect(info!.textContent).toBe('Channels mapped to: aChannel1, aChannel2');

    const textarea = container!.querySelector('textarea[aria-label="Csound Post Code Editor"]') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('aChannel1 = aChannel1 * 0.5');

    act(() => {
      textarea.value = 'aChannel1 = aChannel1 * 0.8';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      // Call onChange directly
      const changeEvent = { target: { value: 'aChannel1 = aChannel1 * 0.8' } } as any;
      textarea.onchange?.(changeEvent);
    });
  });
});

describe('FileBackedScoreObjectEditor — FrozenSoundObject', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const baseTarget = {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'FrozenSoundObject',
    editorObjectType: 'FrozenSoundObject',
    ownerKind: 'timeline' as const,
    displayContext: 'timeline' as const,
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: false,
  };

  const createFrozenDoc = (
    artifactStatus: 'available' | 'missing' | 'unreadable' | 'empty' = 'available',
    canSaveCopy = true,
  ): ScoreObjectEditorDocumentSnapshot => ({
    target: baseTarget,
    shared: {
      objectId: 'obj-2',
      name: 'Frozen Part',
      objectType: 'FrozenSoundObject',
      startBeats: 0,
      durationBeats: 8,
      layerLabel: 'Layer 1',
      layerIndex: 0,
      startTime: { value: 0, timeBase: 'BEATS' },
      subjectiveDuration: { value: 8, timeBase: 'BEATS' },
    },
    editor: {
      kind: 'frozenSoundObject',
      target: baseTarget,
      frozenWaveFileName: 'freeze0.wav',
      sourceName: 'Original Synth',
      sourceType: 'GenericScore',
      sourceDurationBeats: 8,
      numChannels: 2,
      artifactStatus,
      canSaveCopy,
    },
    timeContext: {
      sampleRate: 44100,
      tempo: 60,
    },
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    window.blueAPI = {
      ...window.blueAPI,
      saveFrozenSoundObjectCopy: vi.fn(),
    } as any;
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it('renders read-only inspector fields for FrozenSoundObject', () => {
    const doc = createFrozenDoc('available', true);
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    expect(container!.textContent).toContain('Original Synth');
    expect(container!.textContent).toContain('GenericScore');
    expect(container!.textContent).toContain('freeze0.wav');
    expect(container!.textContent).toContain('8 beats');
    expect(container!.textContent).toContain('Channels');
    expect(container!.textContent).toContain('2');

    const saveBtn = container!.querySelector('button[aria-label="Save Copy"]') as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.disabled).toBe(false);
  });

  it('calls saveFrozenSoundObjectCopy when clicking Save Copy without emitting project patch', async () => {
    const onPatch = vi.fn();
    const saveMock = vi.fn().mockResolvedValue({
      status: 'copied',
      destinationPath: '/path/to/my_export.wav',
      byteLength: 176400,
    });
    window.blueAPI.saveFrozenSoundObjectCopy = saveMock;

    const doc = createFrozenDoc('available', true);
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const saveBtn = container!.querySelector('button[aria-label="Save Copy"]') as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
    });

    expect(saveMock).toHaveBeenCalledWith({ frozenWaveFileName: 'freeze0.wav' });
    expect(container!.textContent).toContain('Saved copy to: /path/to/my_export.wav');
    // Pure file export must never dispatch patch or mutate project data
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('renders missing artifact warning when artifactStatus is missing and disables Save Copy', () => {
    const doc = createFrozenDoc('missing', false);
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    expect(container!.textContent).toContain('Frozen Audio Artifact Missing');
    const saveBtn = container!.querySelector('button[aria-label="Save Copy"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('renders unreadable artifact warning and disables Save Copy', () => {
    const doc = createFrozenDoc('unreadable', false);
    act(() => {
      root!.render(<FileBackedScoreObjectEditor document={doc} onPatch={vi.fn()} />);
    });

    expect(container!.textContent).toContain('Frozen Audio Artifact Unreadable');
    const saveBtn = container!.querySelector('button[aria-label="Save Copy"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });
});
