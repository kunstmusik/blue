import { describe, expect, it } from 'vitest';
import {
  isDiagnosticRun,
  isEffectEditorDiagnosticMilestoneRequest,
  isEffectEditorRequest,
  isEditorMilestone,
  isEngineControlTrafficObservation,
  isEditorOpenAttempt,
  isEditorTargetIdentity,
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

describe('Track instrument editor diagnostic contract', () => {
  const target = {
    kind: 'track-instrument' as const,
    projectSessionId: '4',
    layerGroupId: 'group-1',
    trackId: 'track-1',
    instrumentKind: 'blue-x7' as const,
  };

  const attempt = {
    attemptId: 'attempt-1',
    target,
    classification: 'cold' as const,
    appMode: 'development' as const,
    startedMonotonicNs: '100',
    milestones: [
      { name: 'request-received' as const, monotonicNs: '100' },
      { name: 'editor-usable' as const, monotonicNs: '200' },
    ],
    frameObservations: [],
    audioObservation: { method: 'unavailable' as const, interruptionCount: 0 },
    outcome: 'usable' as const,
  };

  const run = {
    schemaVersion: 1 as const,
    runId: 'run-1',
    candidateId: 'baseline',
    condition: 'editor-mount' as const,
    environment: {
      platform: 'darwin-arm64',
      appBuild: 'test',
      engineBuild: 'test',
      device: 'test-device',
      sampleRate: 48000,
      ksmps: 32,
      diagnosticsEnabled: true as const,
    },
    workload: {
      fixtureId: 'fixture-1',
      sampleRate: 48000,
      ksmps: 32,
      controlDurationSeconds: 60,
      baselineInterruptionCount: 0,
      headroomEvidence: { clean: true, cpuPercent: 40 },
      outputMode: 'audible' as const,
    },
    attempts: [attempt],
    disposition: 'incomplete' as const,
  };

  it('accepts complete targets, attempts, and runs', () => {
    expect(isEditorTargetIdentity(target)).toBe(true);
    expect(isEditorOpenAttempt(attempt)).toBe(true);
    expect(isDiagnosticRun(run)).toBe(true);
    expect(isJsonSerializable(run)).toBe(true);
    expect(isEngineControlTrafficObservation({
      readCommands: 1,
      readEntries: 32,
      writeCommands: 0,
      writeEntries: 0,
    })).toBe(true);
  });

  it('rejects malformed payloads and out-of-order milestones', () => {
    expect(isEditorTargetIdentity({ ...target, projectSessionId: 4 })).toBe(false);
    expect(isEditorMilestone({ name: 'unknown', monotonicNs: 1 })).toBe(false);
    expect(isEditorOpenAttempt({
      ...attempt,
      milestones: [
        { name: 'editor-usable', monotonicNs: 200 },
        { name: 'request-received', monotonicNs: 100 },
      ],
    })).toBe(false);
    expect(isDiagnosticRun({
      ...run,
      environment: { ...run.environment, diagnosticsEnabled: false },
    })).toBe(false);
  });

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

describe('Effect editor diagnostic contract', () => {
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

  it('rejects ambiguous identities and invalid diagnostic milestones', () => {
    expect(isEffectEditorRequest({
      ...projectRequest,
      libraryRef: { libraryEffectId: 'effect-1' },
    })).toBe(false);
    expect(isEffectEditorDiagnosticMilestoneRequest({
      request: projectRequest,
      mode: 'interface',
      milestone: 'editor-usable',
    })).toBe(true);
    expect(isEffectEditorDiagnosticMilestoneRequest({
      request: projectRequest,
      mode: 'preview',
      milestone: 'editor-usable',
    })).toBe(false);
  });
});
