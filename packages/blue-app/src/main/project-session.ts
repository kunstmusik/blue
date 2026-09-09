import { randomUUID } from 'node:crypto';
import type { BlueData } from '@blue/data';
import type { ProjectDocumentCommitReceipt } from '../shared/project-editor';

export function createDocumentLifetimeId(): string {
  return `doc-${randomUUID()}`;
}

export function createHistoryStateId(): string {
  return `state-${randomUUID()}`;
}

export interface ProjectSessionSnapshot {
  readonly data: BlueData | null;
  readonly filePath: string | null;
  readonly revision: number;
  readonly sessionId: number;
  readonly documentId: string | null;
  readonly stateId: string | null;
}

export interface RecordProjectMutation {
  readonly changed: boolean;
  readonly invalidateSession?: boolean;
  readonly stateId?: string;
}

export interface ReplaceProjectOptions {
  readonly preserveFilePath?: boolean;
  readonly preserveDocumentId?: boolean;
  readonly documentId?: string;
  readonly stateId?: string;
  readonly initialRevision?: number;
}

export interface PublishCommittedDocumentOptions {
  readonly stateId?: string;
  readonly invalidateSession?: boolean;
}

export interface ProjectSession {
  read(): Readonly<ProjectSessionSnapshot>;
  replace(
    data: BlueData,
    filePath?: string | null,
    options?: ReplaceProjectOptions,
  ): Readonly<ProjectSessionSnapshot>;
  publishCommittedDocument(
    data: BlueData,
    options?: PublishCommittedDocumentOptions,
  ): Readonly<ProjectSessionSnapshot>;
  close(): Readonly<ProjectSessionSnapshot>;
  publishPath(filePath: string | null): Readonly<ProjectSessionSnapshot>;
  recordMutation(change: RecordProjectMutation): ProjectDocumentCommitReceipt;
  resetForShutdown(): void;
}

/**
 * Owns project identity and document lifetime only. Runtime managers, windows,
 * caches, and file operations remain outside this boundary and coordinate
 * through these semantic transitions.
 */
export class ProjectSession implements ProjectSession {
  private data: BlueData | null = null;
  private filePath: string | null = null;
  private revision = 0;
  private sessionId = 0;
  private documentId: string | null = null;
  private stateId: string | null = null;

  read(): Readonly<ProjectSessionSnapshot> {
    return {
      data: this.data,
      filePath: this.filePath,
      revision: this.revision,
      sessionId: this.sessionId,
      documentId: this.documentId,
      stateId: this.stateId,
    };
  }

  replace(
    data: BlueData,
    filePath?: string | null,
    options?: ReplaceProjectOptions,
  ): Readonly<ProjectSessionSnapshot> {
    if (!data) {
      throw new Error('A project session requires a project document.');
    }
    this.data = data;
    if (options?.preserveFilePath) {
      // Keep existing filePath
    } else {
      this.filePath = filePath ?? null;
    }
    if (options?.preserveDocumentId && this.documentId) {
      // Keep existing documentId
    } else {
      this.documentId = options?.documentId ?? createDocumentLifetimeId();
    }
    this.revision = options?.initialRevision ?? 0;
    this.stateId = options?.stateId ?? createHistoryStateId();
    this.sessionId += 1;
    return this.read();
  }

  publishCommittedDocument(
    data: BlueData,
    options?: PublishCommittedDocumentOptions,
  ): Readonly<ProjectSessionSnapshot> {
    if (!this.data) {
      throw new Error('Cannot publish a committed document without an active project.');
    }
    if (!data) {
      throw new Error('Cannot publish a null or undefined project document.');
    }
    this.data = data;
    // filePath and documentId are preserved across committed publication
    this.revision += 1;
    this.stateId = options?.stateId ?? createHistoryStateId();
    if (options?.invalidateSession) {
      this.sessionId += 1;
    }
    return this.read();
  }

  close(): Readonly<ProjectSessionSnapshot> {
    this.data = null;
    this.filePath = null;
    this.documentId = null;
    this.stateId = null;
    this.revision = 0;
    this.sessionId += 1;
    return this.read();
  }

  publishPath(filePath: string | null): Readonly<ProjectSessionSnapshot> {
    if (!this.data) {
      throw new Error('Cannot publish a project path without an active project.');
    }
    this.filePath = filePath;
    return this.read();
  }

  recordMutation(change: RecordProjectMutation): ProjectDocumentCommitReceipt {
    if (!this.data) {
      throw new Error('Cannot record a project mutation without an active project.');
    }
    if (!change.changed) {
      return {
        changed: false,
        revision: this.revision,
        sessionId: this.sessionId,
        ...(this.documentId ? { documentId: this.documentId } : {}),
        ...(this.stateId ? { stateId: this.stateId } : {}),
      };
    }

    this.revision += 1;
    this.stateId = change.stateId ?? createHistoryStateId();
    if (change.invalidateSession) {
      this.sessionId += 1;
    }
    return {
      changed: true,
      revision: this.revision,
      sessionId: this.sessionId,
      ...(this.documentId ? { documentId: this.documentId } : {}),
      ...(this.stateId ? { stateId: this.stateId } : {}),
    };
  }

  resetForShutdown(): void {
    if (this.data !== null || this.filePath !== null) {
      this.sessionId += 1;
    }
    this.data = null;
    this.filePath = null;
    this.documentId = null;
    this.stateId = null;
    this.revision = 0;
  }
}

export function createProjectSession(): ProjectSession {
  return new ProjectSession();
}
