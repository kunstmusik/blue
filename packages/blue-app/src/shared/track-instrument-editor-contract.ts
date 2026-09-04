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

export function isTrackInstrumentRuntimeStatus(
  value: unknown,
): value is TrackInstrumentRuntimeStatus {
  if (!isObject(value) || !hasOnlyKeys(value, ['sequence', 'playbackRunning', 'blueLiveRunning']))
    return false;
  return (
    isNonNegativeInteger(value.sequence) &&
    typeof value.playbackRunning === 'boolean' &&
    typeof value.blueLiveRunning === 'boolean'
  );
}

export function isNewerTrackInstrumentRuntimeStatus(
  next: unknown,
  previous: TrackInstrumentRuntimeStatus | null,
): next is TrackInstrumentRuntimeStatus {
  return (
    isTrackInstrumentRuntimeStatus(next) && (previous === null || next.sequence > previous.sequence)
  );
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
  return (
    isNonEmptyString(candidate.rootGroupId) &&
    isNonEmptyString(candidate.trackId) &&
    isNonNegativeInteger(candidate.projectSessionId) &&
    isNonNegativeInteger(candidate.projectRevision)
  );
}

export function isEffectEditorRequest(value: unknown): value is EffectEditorRequest {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ['effectId', 'ownerType', 'projectRef', 'libraryRef']) ||
    !isNonEmptyString(value.effectId)
  )
    return false;

  if (value.ownerType === 'project') {
    if (
      !isObject(value.projectRef) ||
      !hasOnlyKeys(value.projectRef, ['channelId', 'chain', 'entryId'])
    )
      return false;
    return (
      isNonEmptyString(value.projectRef.channelId) &&
      (value.projectRef.chain === 'pre' || value.projectRef.chain === 'post') &&
      isNonEmptyString(value.projectRef.entryId) &&
      value.libraryRef === undefined
    );
  }

  if (value.ownerType === 'library') {
    if (!isObject(value.libraryRef) || !hasOnlyKeys(value.libraryRef, ['libraryEffectId']))
      return false;
    return isNonEmptyString(value.libraryRef.libraryEffectId) && value.projectRef === undefined;
  }

  return false;
}

export function isTrackInstrumentEditorPatchRequest(
  value: unknown,
): value is TrackInstrumentEditorPatchRequest {
  return (
    isTrackInstrumentEditorRequest(value) &&
    typeof (value as { patch?: unknown }).patch === 'object' &&
    (value as { patch?: unknown }).patch !== null
  );
}
