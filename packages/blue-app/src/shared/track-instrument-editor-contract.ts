import type {
  EffectEditorRequest,
  TrackInstrumentEditorPatchRequest,
  TrackInstrumentEditorRequest,
} from './project-editor';

export const TRACK_INSTRUMENT_RUNTIME_STATUS_QUERY_CHANNEL =
  'track-instrument-editor:runtime-status:get';
export const TRACK_INSTRUMENT_RUNTIME_STATUS_SUBSCRIBE_CHANNEL =
  'track-instrument-editor:runtime-status:subscribe';
export const TRACK_INSTRUMENT_RUNTIME_STATUS_UNSUBSCRIBE_CHANNEL =
  'track-instrument-editor:runtime-status:unsubscribe';
export const TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL =
  'track-instrument-editor:runtime-status:changed';
export const TRACK_INSTRUMENT_EDITOR_DIAGNOSTIC_MILESTONE_CHANNEL =
  'track-instrument-editor:diagnostic-milestone';
export const EFFECT_EDITOR_DIAGNOSTIC_MILESTONE_CHANNEL =
  'effect-editor:diagnostic-milestone';

export const EDITOR_OPEN_DIAGNOSTIC_MAX_ATTEMPTS = 100;
export const EDITOR_OPEN_DIAGNOSTIC_MAX_MILESTONES = 100;
export const EDITOR_OPEN_DIAGNOSTIC_MAX_FRAME_OBSERVATIONS = 100;

export type DiagnosticTimestamp = number | `${number}`;
export type EditorAppMode = 'development' | 'packaged';
export type EditorInstrumentKind = 'generic' | 'blue-synth-builder' | 'blue-x7';
export type DiagnosticCondition =
  | 'no-open'
  | 'focus-existing'
  | 'minimal-shell'
  | 'shell-with-snapshot'
  | 'editor-mount'
  | 'library-init'
  | 'bluex7-readback'
  | 'effect-interface';

export type EditorMilestoneName =
  | 'request-received'
  | 'existing-focused'
  | 'target-validated'
  | 'snapshot-start'
  | 'snapshot-end'
  | 'window-constructed'
  | 'navigation-started'
  | 'renderer-mounted'
  | 'document-accepted'
  | 'editor-import-start'
  | 'editor-import-end'
  | 'editor-usable'
  | 'library-init-start'
  | 'library-init-end'
  | 'live-observation-start'
  | 'live-observation-first-result'
  | 'ready-to-show'
  | 'shown'
  | 'failed'
  | 'cancelled'
  | 'closed';

export interface TrackEditorDiagnosticTarget {
  readonly kind: 'track-instrument';
  readonly projectSessionId: string;
  readonly layerGroupId: string;
  readonly trackId: string;
  readonly instrumentKind: EditorInstrumentKind;
}

export interface EffectEditorDiagnosticTarget {
  readonly kind: 'effect-interface' | 'effect-editor';
  readonly projectSessionId: string;
  readonly effectOwnerId: string;
  readonly effectId: string;
}

export type EditorTargetIdentity =
  | TrackEditorDiagnosticTarget
  | EffectEditorDiagnosticTarget;

export interface DiagnosticEnvironment {
  readonly platform: string;
  readonly appBuild: string;
  readonly engineBuild: string;
  readonly device: string;
  readonly sampleRate: number;
  readonly ksmps: number;
  readonly diagnosticsEnabled: true;
}

export interface QualifyingPlaybackWorkload {
  readonly fixtureId: string;
  readonly sampleRate: number;
  readonly ksmps: number;
  readonly controlDurationSeconds: number;
  readonly baselineInterruptionCount: number;
  readonly headroomEvidence: Readonly<Record<string, string | number | boolean | null>>;
  readonly outputMode: 'audible' | 'loopback' | 'both';
}

export interface EditorMilestone {
  readonly name: EditorMilestoneName;
  readonly monotonicNs: DiagnosticTimestamp;
  readonly durationNs?: DiagnosticTimestamp;
  readonly count?: number;
}

export interface TrackInstrumentEditorDiagnosticMilestoneRequest {
  readonly request: TrackInstrumentEditorRequest;
  readonly milestone: EditorMilestoneName;
}

export interface EffectEditorDiagnosticMilestoneRequest {
  readonly request: EffectEditorRequest;
  readonly mode: 'interface' | 'edit';
  readonly milestone: EditorMilestoneName;
}

export interface EngineFrameBracket {
  readonly milestone: EditorMilestoneName;
  readonly requestBeforeMonotonicNs: DiagnosticTimestamp;
  readonly sampleFrame: DiagnosticTimestamp;
  readonly sampleRate: number;
  readonly ksmps: number;
  readonly responseAfterMonotonicNs: DiagnosticTimestamp;
}

export interface AudioObservation {
  readonly method: 'audible' | 'loopback' | 'both' | 'unavailable';
  readonly interruptionCount: number;
  readonly evidenceRef?: string;
  readonly notes?: string;
}

/** Channel protocol traffic issued while one editor-open attempt was active. */
export interface EngineControlTrafficObservation {
  readonly readCommands: number;
  readonly readEntries: number;
  readonly writeCommands: number;
  readonly writeEntries: number;
}

export interface EditorOpenAttempt {
  readonly attemptId: string;
  readonly target: EditorTargetIdentity;
  readonly classification: 'cold' | 'reused' | 'reopened';
  readonly appMode: EditorAppMode;
  readonly startedMonotonicNs: DiagnosticTimestamp;
  readonly milestones: readonly EditorMilestone[];
  readonly frameObservations: readonly EngineFrameBracket[];
  readonly controlTraffic?: EngineControlTrafficObservation;
  readonly audioObservation: AudioObservation;
  readonly outcome: 'usable' | 'failed' | 'cancelled' | 'closed-before-usable';
  readonly errorCode?: string;
}

export interface NativeGapObservation {
  readonly sampleFrame: DiagnosticTimestamp;
  readonly gapNanoseconds: DiagnosticTimestamp;
  readonly budgetNanoseconds: DiagnosticTimestamp;
}

export interface NativePerformanceSummary {
  readonly thresholdBudgetMultiple: number;
  readonly gapCount: number;
  readonly largestGaps: readonly NativeGapObservation[];
}

export interface DiagnosticRun {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly candidateId: string;
  readonly condition: DiagnosticCondition;
  readonly environment: DiagnosticEnvironment;
  readonly workload: QualifyingPlaybackWorkload;
  readonly attempts: readonly EditorOpenAttempt[];
  readonly nativePerformance?: NativePerformanceSummary;
  readonly disposition: 'incomplete' | 'rejected' | 'accepted';
  readonly notes?: readonly string[];
}

export interface TrackInstrumentRuntimeStatus {
  readonly sequence: number;
  readonly playbackRunning: boolean;
  readonly blueLiveRunning: boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isTimestamp(value: unknown): value is DiagnosticTimestamp {
  return isNonNegativeInteger(value)
    || (typeof value === 'string' && /^[0-9]+$/.test(value));
}

function timestampToNumber(value: DiagnosticTimestamp): number {
  return typeof value === 'number' ? value : Number(value);
}

function isBoundedString(value: unknown, maxLength = 1000): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

export function isDiagnosticCondition(value: unknown): value is DiagnosticCondition {
  return value === 'no-open'
    || value === 'focus-existing'
    || value === 'minimal-shell'
    || value === 'shell-with-snapshot'
    || value === 'editor-mount'
    || value === 'library-init'
    || value === 'bluex7-readback'
    || value === 'effect-interface';
}

export function isEditorMilestoneName(value: unknown): value is EditorMilestoneName {
  return value === 'request-received'
    || value === 'existing-focused'
    || value === 'target-validated'
    || value === 'snapshot-start'
    || value === 'snapshot-end'
    || value === 'window-constructed'
    || value === 'navigation-started'
    || value === 'renderer-mounted'
    || value === 'document-accepted'
    || value === 'editor-import-start'
    || value === 'editor-import-end'
    || value === 'editor-usable'
    || value === 'library-init-start'
    || value === 'library-init-end'
    || value === 'live-observation-start'
    || value === 'live-observation-first-result'
    || value === 'ready-to-show'
    || value === 'shown'
    || value === 'failed'
    || value === 'cancelled'
    || value === 'closed';
}

export function isTrackEditorDiagnosticTarget(
  value: unknown,
): value is TrackEditorDiagnosticTarget {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'kind',
    'projectSessionId',
    'layerGroupId',
    'trackId',
    'instrumentKind',
  ])) return false;
  return value.kind === 'track-instrument'
    && isNonEmptyString(value.projectSessionId)
    && isNonEmptyString(value.layerGroupId)
    && isNonEmptyString(value.trackId)
    && (value.instrumentKind === 'generic'
      || value.instrumentKind === 'blue-synth-builder'
      || value.instrumentKind === 'blue-x7');
}

export function isEffectEditorDiagnosticTarget(
  value: unknown,
): value is EffectEditorDiagnosticTarget {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'kind',
    'projectSessionId',
    'effectOwnerId',
    'effectId',
  ])) return false;
  return (value.kind === 'effect-interface' || value.kind === 'effect-editor')
    && isNonEmptyString(value.projectSessionId)
    && isNonEmptyString(value.effectOwnerId)
    && isNonEmptyString(value.effectId);
}

export function isEditorTargetIdentity(value: unknown): value is EditorTargetIdentity {
  return isTrackEditorDiagnosticTarget(value) || isEffectEditorDiagnosticTarget(value);
}

export function isDiagnosticEnvironment(value: unknown): value is DiagnosticEnvironment {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'platform',
    'appBuild',
    'engineBuild',
    'device',
    'sampleRate',
    'ksmps',
    'diagnosticsEnabled',
  ])) return false;
  return isNonEmptyString(value.platform)
    && isNonEmptyString(value.appBuild)
    && isNonEmptyString(value.engineBuild)
    && isNonEmptyString(value.device)
    && isPositiveNumber(value.sampleRate)
    && isPositiveInteger(value.ksmps)
    && value.diagnosticsEnabled === true;
}

export function isQualifyingPlaybackWorkload(
  value: unknown,
): value is QualifyingPlaybackWorkload {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'fixtureId',
    'sampleRate',
    'ksmps',
    'controlDurationSeconds',
    'baselineInterruptionCount',
    'headroomEvidence',
    'outputMode',
  ])) return false;
  if (!isNonEmptyString(value.fixtureId)
    || !isPositiveNumber(value.sampleRate)
    || !isPositiveInteger(value.ksmps)
    || typeof value.controlDurationSeconds !== 'number'
    || !Number.isFinite(value.controlDurationSeconds)
    || value.controlDurationSeconds < 0
    || !isNonNegativeInteger(value.baselineInterruptionCount)
    || !isObject(value.headroomEvidence)
    || !(
      value.outputMode === 'audible'
      || value.outputMode === 'loopback'
      || value.outputMode === 'both'
    )) return false;
  return Object.values(value.headroomEvidence).every((entry) =>
    entry === null
    || typeof entry === 'string'
    || typeof entry === 'number' && Number.isFinite(entry)
    || typeof entry === 'boolean');
}

export function isEditorMilestone(value: unknown): value is EditorMilestone {
  if (!isObject(value) || !hasOnlyKeys(value, ['name', 'monotonicNs', 'durationNs', 'count'])) {
    return false;
  }
  return isEditorMilestoneName(value.name)
    && isTimestamp(value.monotonicNs)
    && (value.durationNs === undefined || isTimestamp(value.durationNs))
    && (value.count === undefined || isNonNegativeInteger(value.count));
}

export function isEngineFrameBracket(value: unknown): value is EngineFrameBracket {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'milestone',
    'requestBeforeMonotonicNs',
    'sampleFrame',
    'sampleRate',
    'ksmps',
    'responseAfterMonotonicNs',
  ])) return false;
  return isEditorMilestoneName(value.milestone)
    && isTimestamp(value.requestBeforeMonotonicNs)
    && isTimestamp(value.sampleFrame)
    && isPositiveNumber(value.sampleRate)
    && isPositiveInteger(value.ksmps)
    && isTimestamp(value.responseAfterMonotonicNs)
    && timestampToNumber(value.requestBeforeMonotonicNs)
      <= timestampToNumber(value.responseAfterMonotonicNs);
}

export function isAudioObservation(value: unknown): value is AudioObservation {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'method',
    'interruptionCount',
    'evidenceRef',
    'notes',
  ])) return false;
  return (
    value.method === 'audible'
    || value.method === 'loopback'
    || value.method === 'both'
    || value.method === 'unavailable'
  )
    && isNonNegativeInteger(value.interruptionCount)
    && (value.evidenceRef === undefined || isBoundedString(value.evidenceRef))
    && (value.notes === undefined || isBoundedString(value.notes));
}

function isOrderedMilestoneList(value: unknown): value is readonly EditorMilestone[] {
  if (!Array.isArray(value) || value.length > EDITOR_OPEN_DIAGNOSTIC_MAX_MILESTONES) {
    return false;
  }
  let previousTimestamp = 0;
  const names = new Set<EditorMilestoneName>();
  for (const milestone of value) {
    if (!isEditorMilestone(milestone) || names.has(milestone.name)) return false;
    const timestamp = timestampToNumber(milestone.monotonicNs);
    if (timestamp < previousTimestamp) return false;
    previousTimestamp = timestamp;
    names.add(milestone.name);
  }
  return true;
}

export function isEditorOpenAttempt(value: unknown): value is EditorOpenAttempt {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'attemptId',
    'target',
    'classification',
    'appMode',
    'startedMonotonicNs',
    'milestones',
    'frameObservations',
    'controlTraffic',
    'audioObservation',
    'outcome',
    'errorCode',
  ])) return false;
  return isNonEmptyString(value.attemptId)
    && isEditorTargetIdentity(value.target)
    && (value.classification === 'cold'
      || value.classification === 'reused'
      || value.classification === 'reopened')
    && (value.appMode === 'development' || value.appMode === 'packaged')
    && isTimestamp(value.startedMonotonicNs)
    && isOrderedMilestoneList(value.milestones)
    && Array.isArray(value.frameObservations)
    && value.frameObservations.length <= EDITOR_OPEN_DIAGNOSTIC_MAX_FRAME_OBSERVATIONS
    && value.frameObservations.every(isEngineFrameBracket)
    && (value.controlTraffic === undefined || isEngineControlTrafficObservation(value.controlTraffic))
    && isAudioObservation(value.audioObservation)
    && (value.outcome === 'usable'
      || value.outcome === 'failed'
      || value.outcome === 'cancelled'
      || value.outcome === 'closed-before-usable')
    && (value.errorCode === undefined || isBoundedString(value.errorCode, 200));
}

export function isEngineControlTrafficObservation(
  value: unknown,
): value is EngineControlTrafficObservation {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'readCommands',
    'readEntries',
    'writeCommands',
    'writeEntries',
  ])) return false;
  return isNonNegativeInteger(value.readCommands)
    && isNonNegativeInteger(value.readEntries)
    && isNonNegativeInteger(value.writeCommands)
    && isNonNegativeInteger(value.writeEntries);
}

export function isNativeGapObservation(value: unknown): value is NativeGapObservation {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'sampleFrame',
    'gapNanoseconds',
    'budgetNanoseconds',
  ])) return false;
  return isTimestamp(value.sampleFrame)
    && isTimestamp(value.gapNanoseconds)
    && isTimestamp(value.budgetNanoseconds);
}

export function isNativePerformanceSummary(value: unknown): value is NativePerformanceSummary {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'thresholdBudgetMultiple',
    'gapCount',
    'largestGaps',
  ])) return false;
  return isPositiveNumber(value.thresholdBudgetMultiple)
    && isNonNegativeInteger(value.gapCount)
    && Array.isArray(value.largestGaps)
    && value.largestGaps.length <= 100
    && value.largestGaps.every(isNativeGapObservation);
}

export function isDiagnosticRun(value: unknown): value is DiagnosticRun {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'schemaVersion',
    'runId',
    'candidateId',
    'condition',
    'environment',
    'workload',
    'attempts',
    'nativePerformance',
    'disposition',
    'notes',
  ])) return false;
  return value.schemaVersion === 1
    && isNonEmptyString(value.runId)
    && isNonEmptyString(value.candidateId)
    && isDiagnosticCondition(value.condition)
    && isDiagnosticEnvironment(value.environment)
    && isQualifyingPlaybackWorkload(value.workload)
    && Array.isArray(value.attempts)
    && value.attempts.length <= EDITOR_OPEN_DIAGNOSTIC_MAX_ATTEMPTS
    && value.attempts.every(isEditorOpenAttempt)
    && (value.nativePerformance === undefined || isNativePerformanceSummary(value.nativePerformance))
    && (value.disposition === 'incomplete'
      || value.disposition === 'rejected'
      || value.disposition === 'accepted')
    && (value.notes === undefined
      || Array.isArray(value.notes) && value.notes.length <= 100
      && value.notes.every((note) => isBoundedString(note)));
}

export function isTrackInstrumentRuntimeStatus(
  value: unknown,
): value is TrackInstrumentRuntimeStatus {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'sequence',
    'playbackRunning',
    'blueLiveRunning',
  ])) return false;
  return isNonNegativeInteger(value.sequence)
    && typeof value.playbackRunning === 'boolean'
    && typeof value.blueLiveRunning === 'boolean';
}

export function isNewerTrackInstrumentRuntimeStatus(
  next: unknown,
  previous: TrackInstrumentRuntimeStatus | null,
): next is TrackInstrumentRuntimeStatus {
  return isTrackInstrumentRuntimeStatus(next)
    && (previous === null || next.sequence > previous.sequence);
}

export function isJsonSerializable(value: unknown): boolean {
  try {
    return JSON.stringify(value) !== undefined;
  } catch {
    return false;
  }
}

export function isTrackInstrumentEditorRequest(
  value: unknown,
): value is TrackInstrumentEditorRequest {
  if (!isObject(value)) return false;
  const track = (value as { track?: unknown }).track;
  if (!isObject(track)) return false;
  const candidate = track as {
    rootGroupId?: unknown;
    trackId?: unknown;
    projectSessionId?: unknown;
    projectRevision?: unknown;
  };
  return isNonEmptyString(candidate.rootGroupId)
    && isNonEmptyString(candidate.trackId)
    && isNonNegativeInteger(candidate.projectSessionId)
    && isNonNegativeInteger(candidate.projectRevision);
}

export function isTrackInstrumentEditorDiagnosticMilestoneRequest(
  value: unknown,
): value is TrackInstrumentEditorDiagnosticMilestoneRequest {
  if (!isObject(value) || !hasOnlyKeys(value, ['request', 'milestone'])) return false;
  return isTrackInstrumentEditorRequest(value.request)
    && isEditorMilestoneName(value.milestone);
}

export function isEffectEditorRequest(value: unknown): value is EffectEditorRequest {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'effectId',
    'ownerType',
    'projectRef',
    'libraryRef',
  ]) || !isNonEmptyString(value.effectId)) return false;

  if (value.ownerType === 'project') {
    if (!isObject(value.projectRef) || !hasOnlyKeys(value.projectRef, [
      'channelId',
      'chain',
      'entryId',
    ])) return false;
    return isNonEmptyString(value.projectRef.channelId)
      && (value.projectRef.chain === 'pre' || value.projectRef.chain === 'post')
      && isNonEmptyString(value.projectRef.entryId)
      && value.libraryRef === undefined;
  }

  if (value.ownerType === 'library') {
    if (!isObject(value.libraryRef) || !hasOnlyKeys(value.libraryRef, [
      'libraryEffectId',
    ])) return false;
    return isNonEmptyString(value.libraryRef.libraryEffectId)
      && value.projectRef === undefined;
  }

  return false;
}

export function isEffectEditorDiagnosticMilestoneRequest(
  value: unknown,
): value is EffectEditorDiagnosticMilestoneRequest {
  if (!isObject(value) || !hasOnlyKeys(value, ['request', 'mode', 'milestone'])) {
    return false;
  }
  return isEffectEditorRequest(value.request)
    && (value.mode === 'interface' || value.mode === 'edit')
    && isEditorMilestoneName(value.milestone);
}

export function isTrackInstrumentEditorPatchRequest(
  value: unknown,
): value is TrackInstrumentEditorPatchRequest {
  return isTrackInstrumentEditorRequest(value)
    && typeof (value as { patch?: unknown }).patch === 'object'
    && (value as { patch?: unknown }).patch !== null;
}
