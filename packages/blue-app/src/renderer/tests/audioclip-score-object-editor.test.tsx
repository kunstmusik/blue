// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  TrackLayerGroup,
  TrackLayer,
  AudioClip,
  TimeBase,
  TimeContext,
  TimeDuration,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  type TimeConversionContext,
  type ScoreObjectEditorDocumentSnapshot,
} from '../../shared/project-editor';
import AudioClipScoreObjectEditor from '../components/workbench/panels/score-object/editors/AudioClipScoreObjectEditor';
import { applyPatchToDocument } from '../components/workbench/panels/score-object/score-object-document-reducer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function triggerBlur(input: HTMLInputElement) {
  input.dispatchEvent(new Event('focusout', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: false }));
}

describe('AudioClipScoreObjectEditor — Component UI and Parity', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const baseTarget = {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'AudioClip',
    editorObjectType: 'AudioClip',
    ownerKind: 'timeline' as const,
    displayContext: 'timeline' as const,
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: false,
  };

  type AudioClipEditorOverrides = Partial<Extract<ScoreObjectEditorDocumentSnapshot['editor'], { kind: 'audioClip' }>> & {
    durationBeats?: number;
  };

  const defaultTimeContext: TimeConversionContext = {
    meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
    tempoEnabled: false,
    initialTempo: 60,
    sampleRate: 44100,
  };

  const tempo120Context: TimeConversionContext = {
    ...defaultTimeContext,
    tempoEnabled: true,
    initialTempo: 120,
  };

  const createDoc = (
    overrides: AudioClipEditorOverrides = {},
    timeContext: TimeConversionContext = defaultTimeContext,
  ): ScoreObjectEditorDocumentSnapshot => {
    const { durationBeats = 4, ...editorOverrides } = overrides;
    return {
      target: baseTarget,
      shared: {
        target: baseTarget,
        name: 'My Audio Clip',
        startTime: { value: 0, timeBase: 'BEATS', displayText: '0.0000' },
        subjectiveDuration: {
          value: durationBeats,
          timeBase: 'BEATS',
          displayText: `${durationBeats.toFixed(4)}`,
        },
        endTimeDisplay: `${durationBeats.toFixed(4)}`,
        backgroundColor: 0x404040,
      },
      editor: {
        kind: 'audioClip',
        target: baseTarget,
        audioFile: 'samples/kick.wav',
        numChannels: 2,
        audioDuration: 10,
        fileStartTime: 1.5,
        fadeIn: 0.5,
        fadeInType: 'LINEAR',
        fadeOut: 0.75,
        fadeOutType: 'CONSTANT_POWER',
        looping: true,
        ...editorOverrides,
      },
      timeContext,
    };
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  it('renders all fields with proper timecode formats and tooltips, without extraneous bottom rows', () => {
    const doc = createDoc();
    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={() => {}} />);
    });

    const inputs = container!.querySelectorAll('input[type="text"]');
    const inputValues = Array.from(inputs).map((input) => (input as HTMLInputElement).value);

    // Audio File
    expect(inputValues).toContain('samples/kick.wav');

    // File Start: 1.5s -> 0:00:01.500
    const fileStartInput = container!.querySelector('input[title="File start offset (H:MM:SS.mmm)"]') as HTMLInputElement;
    expect(fileStartInput).not.toBeNull();
    expect(fileStartInput.value).toBe('0:00:01.500');

    // File Duration: 10s -> 0:00:10.000
    const durationInput = container!.querySelector('input[title="Total audio file duration"]') as HTMLInputElement;
    expect(durationInput).not.toBeNull();
    expect(durationInput.value).toBe('0:00:10.000');
    expect(durationInput.disabled).toBe(true);

    // Fade In: 0.5s -> 0:00:00.500
    const fadeInInput = container!.querySelector('input[title="Fade in time in seconds"]') as HTMLInputElement;
    expect(fadeInInput).not.toBeNull();
    expect(fadeInInput.value).toBe('0:00:00.500');

    // Fade Out: 0.75s -> 0:00:00.750
    const fadeOutInput = container!.querySelector('input[title="Fade out time in seconds"]') as HTMLInputElement;
    expect(fadeOutInput).not.toBeNull();
    expect(fadeOutInput.value).toBe('0:00:00.750');

    // Looping checkbox
    const loopingInput = container!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(loopingInput).not.toBeNull();
    expect(loopingInput.checked).toBe(true);

    // Fade Types selects
    const selects = container!.querySelectorAll('[role="combobox"]');
    expect(selects.length).toBeGreaterThanOrEqual(2);

    // Parity: Extraneous "Channels" and "Audio Duration" bottom rows should NOT exist
    const textContent = container!.textContent ?? '';
    expect(textContent).not.toContain('Channels');
  });

  it('handles Fade In text commit, parsing timecode and clamping against duration - fadeOut', () => {
    const onPatch = vi.fn();
    const doc = createDoc({ durationBeats: 4, fadeOut: 1.0 }); // max fadeIn = 4 - 1 = 3.0

    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const fadeInInput = container!.querySelector('input[title="Fade in time in seconds"]') as HTMLInputElement;

    // Enter valid plain seconds "2.25"
    act(() => {
      setInputValue(fadeInInput, '2.25');
    });
    act(() => {
      fadeInInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateTypeSpecificEditor',
      target: baseTarget,
      patch: { fadeIn: 2.25 },
    });
    expect(fadeInInput.value).toBe('0:00:02.250');

    onPatch.mockClear();

    // Enter value exceeding limit (5.0 > 3.0) -> clamped to 3.0 via Enter or Blur
    act(() => {
      setInputValue(fadeInInput, '5.0');
    });
    act(() => {
      triggerBlur(fadeInInput);
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateTypeSpecificEditor',
      target: baseTarget,
      patch: { fadeIn: 3.0 },
    });
    expect(fadeInInput.value).toBe('0:00:03.000');
  });

  it('handles Fade Out text commit, parsing timecode and clamping against duration - fadeIn', () => {
    const onPatch = vi.fn();
    const doc = createDoc({ durationBeats: 5, fadeIn: 1.5 }); // max fadeOut = 5 - 1.5 = 3.5

    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const fadeOutInput = container!.querySelector('input[title="Fade out time in seconds"]') as HTMLInputElement;

    // Enter timecode "0:00:02.000"
    act(() => {
      setInputValue(fadeOutInput, '0:00:02.000');
    });
    act(() => {
      fadeOutInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateTypeSpecificEditor',
      target: baseTarget,
      patch: { fadeOut: 2.0 },
    });
    expect(fadeOutInput.value).toBe('0:00:02.000');

    onPatch.mockClear();

    // Enter value exceeding limit (10.0 > 3.5) -> clamped to 3.5
    act(() => {
      setInputValue(fadeOutInput, '10.0');
    });
    act(() => {
      triggerBlur(fadeOutInput);
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateTypeSpecificEditor',
      target: baseTarget,
      patch: { fadeOut: 3.5 },
    });
    expect(fadeOutInput.value).toBe('0:00:03.500');
  });

  it('clamps seconds-based fades against beat durations at the active tempo', () => {
    const onPatch = vi.fn();
    const doc = createDoc({ durationBeats: 20, fadeOut: 0 }, tempo120Context);

    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const fadeInInput = container!.querySelector('input[title="Fade in time in seconds"]') as HTMLInputElement;
    act(() => {
      setInputValue(fadeInInput, '15');
      fadeInInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    // 20 beats at 120 BPM is 10 seconds, not 20 seconds.
    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateTypeSpecificEditor',
      target: baseTarget,
      patch: { fadeIn: 10 },
    });
    expect(fadeInInput.value).toBe('0:00:10.000');
  });

  it('clamps the duration editor in canonical beats at the active tempo', () => {
    const onPatch = vi.fn();
    const doc = createDoc({
      durationBeats: 30,
      audioDuration: 10,
      fileStartTime: 0,
      looping: false,
    }, tempo120Context);

    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const durationLabel = Array.from(container!.querySelectorAll('label'))
      .find((label) => label.textContent === 'Duration');
    const durationInput = durationLabel?.parentElement?.querySelector<HTMLInputElement>('input[type="text"]');
    expect(durationInput).toBeDefined();

    act(() => {
      setInputValue(durationInput!, '40');
      durationInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateSharedProperties',
      target: baseTarget,
      patch: { subjectiveDuration: { value: 20, timeBase: 'BEATS' } },
    });
  });

  it('optimistically clamps duration in beats when tempo is enabled', () => {
    const doc = createDoc({
      durationBeats: 30,
      audioDuration: 10,
      fileStartTime: 0,
    }, tempo120Context);

    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: baseTarget,
      patch: { looping: false },
    });

    // 10 seconds at 120 BPM is 20 beats.
    expect(next.shared.subjectiveDuration.value).toBe(20);
  });

  it('rejects malformed time text instead of committing a partial number', () => {
    const onPatch = vi.fn();
    const doc = createDoc({ fadeIn: 0.5 });

    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const fadeInInput = container!.querySelector('input[title="Fade in time in seconds"]') as HTMLInputElement;
    act(() => {
      setInputValue(fadeInInput, '1.5s');
      triggerBlur(fadeInInput);
    });

    expect(onPatch).not.toHaveBeenCalled();
    expect(fadeInInput.value).toBe('0:00:00.500');

    act(() => {
      setInputValue(fadeInInput, '0:00:02oops');
      triggerBlur(fadeInInput);
    });

    expect(onPatch).not.toHaveBeenCalled();
    expect(fadeInInput.value).toBe('0:00:00.500');
  });

  it('reverts Fade In and Fade Out drafts on Escape key without patching', () => {
    const onPatch = vi.fn();
    const doc = createDoc({ fadeIn: 0.5, fadeOut: 0.75 });

    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const fadeInInput = container!.querySelector('input[title="Fade in time in seconds"]') as HTMLInputElement;
    const fadeOutInput = container!.querySelector('input[title="Fade out time in seconds"]') as HTMLInputElement;

    act(() => {
      setInputValue(fadeInInput, '99.9');
      fadeInInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(fadeInInput.value).toBe('0:00:00.500');
    expect(onPatch).not.toHaveBeenCalled();

    act(() => {
      setInputValue(fadeOutInput, 'invalid');
      fadeOutInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(fadeOutInput.value).toBe('0:00:00.750');
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('clamps File Start offset to audioDuration on commit', () => {
    const onPatch = vi.fn();
    const doc = createDoc({ audioDuration: 8.0, fileStartTime: 1.0 });

    act(() => {
      root!.render(<AudioClipScoreObjectEditor document={doc} onPatch={onPatch} />);
    });

    const fileStartInput = container!.querySelector('input[title="File start offset (H:MM:SS.mmm)"]') as HTMLInputElement;

    // Enter value exceeding audioDuration (12.0 > 8.0) -> clamped to 8.0
    act(() => {
      setInputValue(fileStartInput, '12.0');
      fileStartInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'updateTypeSpecificEditor',
      target: baseTarget,
      patch: { fileStartTime: 8.0 },
    });
    expect(fileStartInput.value).toBe('0:00:08.000');
  });
});

describe('AudioClip Patch Application with TimeContext parity', () => {
  it('automatically clamps subjective duration when looping is toggled off and duration exceeds available file duration', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const alg = new TrackLayerGroup();
    const layer = new TrackLayer();
    const clip = new AudioClip();
    clip.setName('Test Clip');
    clip.setAudioFile('sound.wav');
    clip.setAudioDuration(5.0); // 5 seconds audio file
    clip.setFileStartTime(1.0); // starts at 1.0s -> remaining is 4.0s
    clip.setSubjectiveDuration(TimeDuration.beats(10.0)); // 10 beats duration
    clip.setLooping(null, true);
    layer.push(clip);
    alg.push(layer);
    data.getScore().push(alg);

    const target = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'AudioClip',
      editorObjectType: 'AudioClip',
      ownerKind: 'timeline' as const,
      displayContext: 'timeline' as const,
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    };

    expect(clip.isLooping()).toBe(true);
    expect(clip.getSubjectiveDuration().toBeats(data.getScore().getTimeContext())).toBe(10.0);

    // Toggle looping off via patch
    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: { looping: false },
      },
    });

    expect(clip.isLooping()).toBe(false);
    // Subjective duration should now be clamped to audioDuration - fileStartTime = 5.0 - 1.0 = 4.0 beats!
    expect(clip.getSubjectiveDuration().toBeats(data.getScore().getTimeContext())).toBe(4.0);
  });

  it('converts the loop-off limit from seconds and preserves the duration time base', () => {
    const context = new TimeContext();
    context.getTempoMap().setTempo(120);
    context.getTempoMap().setEnabled(true);

    const clip = new AudioClip();
    clip.setAudioDuration(5.0);
    clip.setFileStartTime(1.0);
    clip.setSubjectiveDuration(TimeDuration.seconds(8.0));
    clip.setLooping(context, true);
    clip.setLooping(context, false);

    expect(clip.getSubjectiveDuration().getTimeBase()).toBe(TimeBase.SECONDS);
    expect(clip.getSubjectiveDuration().toSeconds(context)).toBe(4.0);
  });
});
