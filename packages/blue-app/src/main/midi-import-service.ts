import { randomUUID } from 'node:crypto';
import { validateMidiImportSettings, type MidiImportSettings } from '@blue/data';
import type {
  MidiImportStartResult,
  PendingMidiImport,
} from '../shared/midi-import';
import { isMidiImportSettingsList } from '../shared/midi-import';
import type { ParsedMidiImport } from './midi-import-parser';

export interface MidiImportServiceDependencies {
  chooseFile: () => Promise<string | null>;
  readFile: (filePath: string) => ArrayLike<number>;
  parseFile: (bytes: ArrayLike<number>, fileName: string) => ParsedMidiImport;
  getProjectSessionId: () => number;
}

export type MidiImportCommitValidation =
  | { ok: true; pending: PendingMidiImport; settings: MidiImportSettings[] }
  | { ok: false; message: string };

export class MidiImportService {
  private pending: PendingMidiImport | null = null;

  constructor(private readonly dependencies: MidiImportServiceDependencies) {}

  async start(): Promise<MidiImportStartResult> {
    this.pending = null;
    try {
      const filePath = await this.dependencies.chooseFile();
      if (!filePath) {
        return { status: 'cancelled' };
      }
      const parsed = this.dependencies.parseFile(
        this.dependencies.readFile(filePath),
        filePath.split(/[\\/]/).pop() ?? filePath,
      );
      const pending: PendingMidiImport = {
        token: randomUUID(),
        document: parsed.document,
        preview: parsed.preview,
        projectSessionId: this.dependencies.getProjectSessionId(),
      };
      this.pending = pending;
      return { status: 'ready', token: pending.token, preview: pending.preview };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  validateCommit(token: string, settings: unknown): MidiImportCommitValidation {
    const pending = this.pending;
    if (!pending || pending.token !== token) {
      return { ok: false, message: 'The MIDI import session has expired.' };
    }
    if (pending.projectSessionId !== this.dependencies.getProjectSessionId()) {
      this.pending = null;
      return { ok: false, message: 'The project changed while the MIDI file was being configured.' };
    }
    if (!isMidiImportSettingsList(settings)) {
      return { ok: false, message: 'Invalid MIDI import settings.' };
    }

    try {
      validateMidiImportSettings(pending.document, settings);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    return { ok: true, pending, settings };
  }

  clear(token: string): void {
    if (this.pending?.token === token) {
      this.pending = null;
    }
  }

  clearAll(): void {
    this.pending = null;
  }
}
