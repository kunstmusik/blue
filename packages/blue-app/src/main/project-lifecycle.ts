import type { BlueData } from '@blue/data';
import { type ProjectDocumentCommitReceipt } from '../shared/project-editor';
import { type ProjectSession, type ProjectSessionSnapshot } from './project-session';

export interface ProjectLifecycleDependencies {
  readonly session: ProjectSession;
  readonly stopProjectRuntimes?: () => void | Promise<void>;
  readonly closeProjectEditors?: () => void | Promise<void>;
  readonly clearProjectServices?: () => void | Promise<void>;
  readonly publishProjectLoaded?: (snapshot: ProjectSessionSnapshot) => void | Promise<void>;
  readonly publishProjectClosed?: (snapshot: ProjectSessionSnapshot) => void | Promise<void>;
  readonly publishProjectChanged?: (snapshot: ProjectSessionSnapshot) => void | Promise<void>;
}

export interface ProjectLifecycleCandidate {
  readonly data: BlueData;
  readonly filePath: string | null;
}

export interface ProjectLifecycle {
  replace(candidate: ProjectLifecycleCandidate): Promise<Readonly<ProjectSessionSnapshot>>;
  open(
    load: () => ProjectLifecycleCandidate | Promise<ProjectLifecycleCandidate>,
  ): Promise<boolean>;
  save(write: (data: BlueData, filePath: string) => void | Promise<void>): Promise<boolean>;
  saveAs(
    filePath: string,
    write: (data: BlueData, filePath: string) => void | Promise<void>,
  ): Promise<boolean>;
  revert(
    load: () => ProjectLifecycleCandidate | Promise<ProjectLifecycleCandidate>,
  ): Promise<boolean>;
  close(): Promise<Readonly<ProjectSessionSnapshot>>;
  recordMutation(change: {
    changed: boolean;
    invalidateSession?: boolean;
  }): ProjectDocumentCommitReceipt;
}

const noop = async (): Promise<void> => {};

/**
 * Coordinates project transitions around the one identity owner. Candidate
 * loading happens before cleanup or replacement, so parse/read failures leave
 * the prior session active.
 */
export function createProjectLifecycle(
  dependencies: ProjectLifecycleDependencies,
): ProjectLifecycle {
  const stopProjectRuntimes = dependencies.stopProjectRuntimes ?? noop;
  const closeProjectEditors = dependencies.closeProjectEditors ?? noop;
  const clearProjectServices = dependencies.clearProjectServices ?? noop;

  return {
    async replace(candidate) {
      await stopProjectRuntimes();
      await closeProjectEditors();
      const snapshot = dependencies.session.replace(candidate.data, candidate.filePath);
      await clearProjectServices();
      await dependencies.publishProjectChanged?.(snapshot);
      await dependencies.publishProjectLoaded?.(snapshot);
      return snapshot;
    },

    async open(load) {
      const candidate = await load();
      await this.replace(candidate);
      return true;
    },

    async save(write) {
      const snapshot = dependencies.session.read();
      if (!snapshot.data || !snapshot.filePath) return false;
      await write(snapshot.data, snapshot.filePath);
      await dependencies.publishProjectChanged?.(snapshot);
      return true;
    },

    async saveAs(filePath, write) {
      const snapshot = dependencies.session.read();
      if (!snapshot.data) return false;
      await write(snapshot.data, filePath);
      const next = dependencies.session.publishPath(filePath);
      await dependencies.publishProjectChanged?.(next);
      return true;
    },

    async revert(load) {
      const candidate = await load();
      await this.replace(candidate);
      return true;
    },

    async close() {
      await stopProjectRuntimes();
      await closeProjectEditors();
      const snapshot = dependencies.session.close();
      await clearProjectServices();
      await dependencies.publishProjectClosed?.(snapshot);
      return snapshot;
    },

    recordMutation(change) {
      const receipt = dependencies.session.recordMutation(change);
      if (receipt.changed) {
        void dependencies.publishProjectChanged?.(dependencies.session.read());
      }
      return receipt;
    },
  };
}
