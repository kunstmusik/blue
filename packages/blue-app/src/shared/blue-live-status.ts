import { isAudioLayoutDiagnostic, type AudioLayoutDiagnostic } from './audio-layout';

export type BlueLiveStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface BlueLiveStatusSnapshot {
  status: BlueLiveStatus;
  running: boolean;
  message?: string;
  sessionId: number;
  projectRevision?: number | null;
  layoutDiagnostic?: AudioLayoutDiagnostic | null;
}

export function isBlueLiveStatusSnapshot(value: unknown): value is BlueLiveStatusSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !['idle', 'starting', 'running', 'stopping', 'stopped', 'error'].includes(
      candidate.status as string,
    ) ||
    typeof candidate.running !== 'boolean' ||
    typeof candidate.sessionId !== 'number' ||
    !Number.isFinite(candidate.sessionId)
  ) {
    return false;
  }
  if (candidate.message !== undefined && typeof candidate.message !== 'string') return false;
  if (
    candidate.projectRevision !== undefined &&
    candidate.projectRevision !== null &&
    (typeof candidate.projectRevision !== 'number' || !Number.isFinite(candidate.projectRevision))
  ) {
    return false;
  }
  return (
    candidate.layoutDiagnostic === undefined ||
    candidate.layoutDiagnostic === null ||
    isAudioLayoutDiagnostic(candidate.layoutDiagnostic)
  );
}
