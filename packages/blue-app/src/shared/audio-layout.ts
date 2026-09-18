/**
 * Shared audio layout types and IPC diagnostics (browser-safe, host-neutral).
 * Conforms to Spec 112 contracts.
 */

export type AudioLayoutDiagnosticCode =
  | 'MISSING_AUDIO_LAYOUT'
  | 'UNREADABLE_AUDIO_FILE'
  | 'UNSUPPORTED_SOURCE_CHANNELS'
  | 'UNSUPPORTED_OUTPUT_CHANNELS';

export interface AudioLayoutDiagnostic {
  readonly code: AudioLayoutDiagnosticCode;
  readonly message: string;
  readonly filePath?: string;
  readonly observedChannels?: number;
  readonly outputChannels?: number;
}

/** A validated, serializable error payload used by non-operation IPC events. */
export interface AudioLayoutErrorPayload {
  readonly message: string;
  readonly layoutDiagnostic: AudioLayoutDiagnostic;
}

const DIAGNOSTIC_CODES: readonly AudioLayoutDiagnosticCode[] = [
  'MISSING_AUDIO_LAYOUT',
  'UNREADABLE_AUDIO_FILE',
  'UNSUPPORTED_SOURCE_CHANNELS',
  'UNSUPPORTED_OUTPUT_CHANNELS',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAudioLayoutDiagnostic(value: unknown): value is AudioLayoutDiagnostic {
  if (!isRecord(value)) return false;
  if (
    typeof value.code !== 'string' ||
    !DIAGNOSTIC_CODES.includes(value.code as AudioLayoutDiagnosticCode)
  ) {
    return false;
  }
  if (typeof value.message !== 'string') return false;
  if (value.filePath !== undefined && typeof value.filePath !== 'string') return false;
  if (
    value.observedChannels !== undefined &&
    (typeof value.observedChannels !== 'number' || !Number.isFinite(value.observedChannels))
  )
    return false;
  if (
    value.outputChannels !== undefined &&
    (typeof value.outputChannels !== 'number' || !Number.isFinite(value.outputChannels))
  )
    return false;
  return true;
}

export function isAudioLayoutErrorPayload(value: unknown): value is AudioLayoutErrorPayload {
  if (!isRecord(value) || typeof value.message !== 'string') return false;
  return isAudioLayoutDiagnostic(value.layoutDiagnostic);
}

export function formatAudioLayoutDiagnostic(diagnostic: AudioLayoutDiagnostic): string {
  const details = [
    diagnostic.code,
    diagnostic.filePath ? `file: ${diagnostic.filePath}` : null,
    diagnostic.observedChannels !== undefined
      ? `channels: ${diagnostic.observedChannels}`
      : diagnostic.outputChannels !== undefined
        ? `output channels: ${diagnostic.outputChannels}`
        : null,
  ].filter((part): part is string => part !== null);
  return details.length > 0 ? `${diagnostic.message} [${details.join('; ')}]` : diagnostic.message;
}
