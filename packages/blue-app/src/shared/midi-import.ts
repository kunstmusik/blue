import type {
  MidiImportDocument,
  MidiImportSettings,
  MidiImportWarning,
} from '@blue/data';
import type { ProjectEditorSnapshot } from './project-editor';

export type { MidiImportSettings } from '@blue/data';

export interface MidiImportStreamPreview {
  streamKey: string;
  trackIndex: number;
  trackName?: string;
  channel: number;
  noteCount: number;
  firstBeat: number;
  lastBeat: number;
  warnings: MidiImportWarning[];
  defaults: MidiImportSettings;
}

export interface MidiImportPreview {
  fileName: string;
  format: 0 | 1;
  ticksPerBeat: number;
  streams: MidiImportStreamPreview[];
}

export type MidiImportStartResult =
  | { status: 'cancelled' }
  | { status: 'ready'; token: string; preview: MidiImportPreview }
  | { status: 'error'; message: string };

export type MidiImportCommitResult =
  | { status: 'cancelled' }
  | { status: 'installed'; project: ProjectEditorSnapshot }
  | { status: 'error'; message: string };

export interface PendingMidiImport {
  token: string;
  document: MidiImportDocument;
  preview: MidiImportPreview;
  projectSessionId: number;
}

export function isMidiImportSettings(value: unknown): value is MidiImportSettings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MidiImportSettings>;
  return (
    typeof candidate.streamKey === 'string' &&
    typeof candidate.instrumentId === 'string' &&
    typeof candidate.noteTemplate === 'string' &&
    typeof candidate.trimTime === 'boolean'
  );
}

export function isMidiImportSettingsList(value: unknown): value is MidiImportSettings[] {
  return Array.isArray(value) && value.every(isMidiImportSettings);
}
