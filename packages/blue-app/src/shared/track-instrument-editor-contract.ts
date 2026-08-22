import type {
  TrackInstrumentEditorPatchRequest,
  TrackInstrumentEditorRequest,
} from './project-editor';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isTrackInstrumentEditorRequest(
  value: unknown,
): value is TrackInstrumentEditorRequest {
  if (!value || typeof value !== 'object') return false;
  const track = (value as { track?: unknown }).track;
  if (!track || typeof track !== 'object') return false;
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

export function isTrackInstrumentEditorPatchRequest(
  value: unknown,
): value is TrackInstrumentEditorPatchRequest {
  return isTrackInstrumentEditorRequest(value)
    && typeof (value as { patch?: unknown }).patch === 'object'
    && (value as { patch?: unknown }).patch !== null;
}
