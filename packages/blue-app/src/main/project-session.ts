import type { BlueData } from '@blue/data';
import type {
  ProjectDocumentCommitReceipt,
} from '../shared/project-editor';

export interface ProjectSessionSnapshot {
  readonly data: BlueData | null;
  readonly filePath: string | null;
  readonly revision: number;
  readonly sessionId: number;
}

export interface RecordProjectMutation {
  readonly changed: boolean;
  readonly invalidateSession?: boolean;
}

export interface ProjectSession {
  read(): Readonly<ProjectSessionSnapshot>;
  replace(data: BlueData, filePath: string | null): Readonly<ProjectSessionSnapshot>;
  close(): Readonly<ProjectSessionSnapshot>;
  publishPath(filePath: string | null): Readonly<ProjectSessionSnapshot>;
  recordMutation(change: RecordProjectMutation): ProjectDocumentCommitReceipt;
  resetForShutdown(): void;
}

/**
 * Owns project identity only. Runtime managers, windows, caches, and file
 * operations remain outside this boundary and coordinate through these
 * semantic transitions.
 */
export class ProjectSession implements ProjectSession {
  private data: BlueData | null = null;
  private filePath: string | null = null;
  private revision = 0;
  private sessionId = 0;

  read(): Readonly<ProjectSessionSnapshot> {
    return {
      data: this.data,
      filePath: this.filePath,
      revision: this.revision,
      sessionId: this.sessionId,
    };
  }

  replace(data: BlueData, filePath: string | null): Readonly<ProjectSessionSnapshot> {
    if (!data) {
      throw new Error('A project session requires a project document.');
    }
    this.data = data;
    this.filePath = filePath;
    this.revision = 0;
    this.sessionId += 1;
    return this.read();
  }

  close(): Readonly<ProjectSessionSnapshot> {
    this.data = null;
    this.filePath = null;
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
      };
    }

    this.revision += 1;
    if (change.invalidateSession) {
      this.sessionId += 1;
    }
    return {
      changed: true,
      revision: this.revision,
      sessionId: this.sessionId,
    };
  }

  resetForShutdown(): void {
    if (this.data !== null || this.filePath !== null) {
      this.sessionId += 1;
    }
    this.data = null;
    this.filePath = null;
    this.revision = 0;
  }
}

export function createProjectSession(): ProjectSession {
  return new ProjectSession();
}
