import { describe, expect, it } from 'vitest';
import {
  isEffectEditorRequest,
  isJsonSerializable,
  isNewerTrackInstrumentRuntimeStatus,
  isTrackInstrumentRuntimeStatus,
  isTrackInstrumentEditorPatchRequest,
  isTrackInstrumentEditorRequest,
} from './track-instrument-editor-contract';
import {
  createBsbRealtimeControlUpdate,
  isBsbRealtimeControlUpdate,
} from './project-editor';

describe('Track instrument editor request validation', () => {
  const valid = {
    track: {
      rootGroupId: 'group-1',
      trackId: 'track-1',
      projectSessionId: 4,
      projectRevision: 7,
    },
  };

  it('requires stable identity plus project session and revision fences', () => {
    expect(isTrackInstrumentEditorRequest(valid)).toBe(true);
    expect(isTrackInstrumentEditorRequest({
      track: { rootGroupId: 'group-1', trackId: 'track-1' },
    })).toBe(false);
    expect(isTrackInstrumentEditorRequest({
      track: { ...valid.track, projectSessionId: -1 },
    })).toBe(false);
    expect(isTrackInstrumentEditorRequest({
      track: { ...valid.track, projectRevision: 1.5 },
    })).toBe(false);
  });

  it('requires a patch payload after validating the fenced target', () => {
    expect(isTrackInstrumentEditorPatchRequest({ ...valid, patch: { name: 'Updated' } })).toBe(true);
    expect(isTrackInstrumentEditorPatchRequest({ ...valid, patch: null })).toBe(false);
    expect(isTrackInstrumentEditorPatchRequest({
      track: { rootGroupId: 'group-1', trackId: 'track-1' },
      patch: { name: 'Unfenced' },
    })).toBe(false);
  });
});

describe('Track instrument realtime control contract', () => {
  it('builds a session-fenced Track target without a document-revision fence', () => {
    const update = createBsbRealtimeControlUpdate(
      {
        track: {
          rootGroupId: 'group-1',
          trackId: 'track-1',
          projectSessionId: 4,
        },
      },
      {
        type: 'updateWidgetProperties',
        widgetId: 'gain-slider',
        properties: { value: 0.75 },
      },
    );

    expect(update).toEqual({
      track: {
        rootGroupId: 'group-1',
        trackId: 'track-1',
        projectSessionId: 4,
      },
      widgetId: 'gain-slider',
      kind: 'value',
      payload: { value: 0.75 },
    });
    expect(isBsbRealtimeControlUpdate(update)).toBe(true);
  });

  it('rejects ambiguous and malformed realtime targets', () => {
    const payload = {
      widgetId: 'gain-slider',
      kind: 'value',
      payload: { value: 0.75 },
    };
    expect(isBsbRealtimeControlUpdate({ ...payload, assignmentId: '1' })).toBe(true);
    expect(isBsbRealtimeControlUpdate({
      ...payload,
      assignmentId: '1',
      track: { rootGroupId: 'group-1', trackId: 'track-1', projectSessionId: 4 },
    })).toBe(false);
    expect(isBsbRealtimeControlUpdate({
      ...payload,
      assignmentId: 1,
      track: { rootGroupId: 'group-1', trackId: 'track-1', projectSessionId: 4 },
    })).toBe(false);
    expect(isBsbRealtimeControlUpdate({
      ...payload,
      track: { rootGroupId: 'group-1', trackId: 'track-1', projectSessionId: -1 },
    })).toBe(false);
  });
});

describe('Track instrument runtime status contract', () => {
  it('accepts only newer runtime status sequences', () => {
    const current = { sequence: 4, playbackRunning: false, blueLiveRunning: false };
    expect(isTrackInstrumentRuntimeStatus(current)).toBe(true);
    expect(isNewerTrackInstrumentRuntimeStatus({
      sequence: 5,
      playbackRunning: true,
      blueLiveRunning: false,
    }, current)).toBe(true);
    expect(isNewerTrackInstrumentRuntimeStatus(current, current)).toBe(false);
    expect(isTrackInstrumentRuntimeStatus({
      sequence: 5,
      playbackRunning: 'yes',
      blueLiveRunning: false,
    })).toBe(false);
  });
});

describe('Effect editor contract', () => {
  const projectRequest = {
    ownerType: 'project' as const,
    effectId: 'effect-1',
    projectRef: { channelId: 'channel-1', chain: 'pre' as const, entryId: 'effect-1' },
  };

  it('accepts complete project and library effect identities', () => {
    expect(isEffectEditorRequest(projectRequest)).toBe(true);
    expect(isEffectEditorRequest({
      ownerType: 'library',
      effectId: 'library-effect-1',
      libraryRef: { libraryEffectId: 'library-effect-1' },
    })).toBe(true);
  });

  it('rejects ambiguous identities', () => {
    expect(isEffectEditorRequest({
      ...projectRequest,
      libraryRef: { libraryEffectId: 'effect-1' },
    })).toBe(false);
  });
});
