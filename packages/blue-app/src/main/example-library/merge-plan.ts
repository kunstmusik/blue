import { createHash } from 'crypto';
import { FactoryBaselineRecord, deriveRevisionFromBaselines } from './state-store';
import type { FactoryManifest } from './manifest';

/**
 * Pure, non-destructive update classification for one accepted update
 * (contracts/example-update-merge.md). All inputs/outputs use portable
 * relative paths; this module never touches the filesystem.
 */

export interface UserEntrySnapshot {
  relativePath: string;
  kind: 'regular' | 'directory' | 'symlink' | 'other';
  sha256: string | null;
  size: number | null;
}

export type ExampleMergeActionKind =
  | 'add-factory'
  | 'replace-untouched'
  | 'keep-unchanged'
  | 'preserve-user-modified'
  | 'preserve-user-deleted'
  | 'preserve-collision'
  | 'preserve-factory-removed'
  | 'preserve-user-only';

export interface ExampleMergeAction {
  kind: ExampleMergeActionKind;
  relativePath: string;
  conflict: boolean;
}

export interface UpdateConflictSummary {
  totalConflicts: number;
  totalCollisions: number;
  /** Bounded sample of conflicting paths. */
  conflicts: string[];
  /** Bounded sample of collision paths. */
  collisions: string[];
}

export interface ExampleUpdatePlan {
  installedFactoryRevision: string;
  actions: ExampleMergeAction[];
  nextState: {
    acceptedFactoryRevision: string;
    baselines: FactoryBaselineRecord[];
  };
  summary: UpdateConflictSummary;
  /** Paths whose candidate bytes must equal the installed factory. */
  appliedFactoryPaths: string[];
}

export class MergePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MergePlanError';
  }
}

/** Canonical source-snapshot revision hash (sorted tuples). */
export function deriveSourceUserRevision(entries: readonly UserEntrySnapshot[]): string {
  const sorted = [...entries].sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );
  const canonical = JSON.stringify(
    sorted.map((entry) => [entry.relativePath, entry.kind, entry.sha256 ?? '', entry.size ?? -1]),
  );
  // Inline stable digest keeps this module dependency-light and pure.
  return `sha256:${sha256Hex(canonical)}`;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

interface PlannerInputs {
  baselines: readonly FactoryBaselineRecord[];
  userEntries: readonly UserEntrySnapshot[];
  installed: FactoryManifest;
}

const SAMPLE_LIMIT = 8;

function pushBounded(list: string[], pathText: string): void {
  if (!list.includes(pathText)) {
    list.push(pathText);
  }
}

/**
 * Classify every relevant path and produce the full action list, next
 * baselines, conflict summary, and the subset of paths to overlay with
 * factory bytes.
 */
export function planExampleUpdate(inputs: PlannerInputs): ExampleUpdatePlan {
  const { baselines, userEntries, installed } = inputs;

  const baselineByPath = new Map(baselines.map((b) => [b.relativePath, b]));
  const userByPath = new Map(userEntries.map((u) => [u.relativePath, u]));
  const installedByPath = new Map(installed.files.map((f) => [f.relativePath as string, f]));

  const summary = {
    totalConflicts: 0,
    totalCollisions: 0,
    conflicts: [] as string[],
    collisions: [] as string[],
  };
  const actions: ExampleMergeAction[] = [];
  const nextBaselineMap = new Map<string, FactoryBaselineRecord>();
  const appliedFactoryPaths = new Set<string>();

  // --- Ancestor blocking -------------------------------------------------
  // A user file/symlink occupying an implied factory directory blocks all of
  // that directory's descendants from being added/replaced (never replace a
  // tree shape by force).
  const userEntriesAtDirectoryAncestors = new Set<string>();
  for (const installedPath of installedByPath.keys()) {
    const segments = installedPath.split('/');
    let ancestor = '';
    for (let i = 0; i < segments.length - 1; i += 1) {
      ancestor = ancestor === '' ? segments[i] : `${ancestor}/${segments[i]}`;
      const occupant = userByPath.get(ancestor);
      if (occupant !== undefined && occupant.kind !== 'directory') {
        if (!installedByPath.has(ancestor)) {
          userEntriesAtDirectoryAncestors.add(ancestor);
        }
      }
    }
  }

  const ancestorBlocks = (pathText: string): boolean => {
    const segments = pathText.split('/');
    let ancestor = '';
    for (let i = 0; i < segments.length - 1; i += 1) {
      ancestor = ancestor === '' ? segments[i] : `${ancestor}/${segments[i]}`;
      if (userEntriesAtDirectoryAncestors.has(ancestor)) {
        return true;
      }
    }
    return false;
  };

  const emit = (kind: ExampleMergeActionKind, relativePath: string, conflict: boolean): void => {
    actions.push({ kind, relativePath, conflict });
    if (conflict) {
      if (kind === 'preserve-collision' || kind === 'preserve-user-only') {
        summary.totalCollisions += 1;
        pushBounded(summary.collisions, relativePath);
      } else {
        summary.totalConflicts += 1;
        pushBounded(summary.conflicts, relativePath);
      }
    }
  };

  // Pass 1: every INSTALLED factory path.
  for (const [relativePath, record] of [...installedByPath.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const baseline = baselineByPath.get(relativePath) ?? null;
    const userEntry = userByPath.get(relativePath) ?? null;

    if (ancestorBlocks(relativePath)) {
      emit('preserve-collision', relativePath, true);
      nextBaselineMap.set(relativePath, {
        relativePath,
        factorySha256: record.sha256,
        factorySize: record.size,
        factoryPresent: true,
      });
      continue;
    }

    const matchesOldBytes =
      baseline !== null &&
      userEntry !== null &&
      userEntry.kind === 'regular' &&
      userEntry.sha256 !== null &&
      userEntry.sha256 === baseline.factorySha256;

    const factoryChangedFromBaseline =
      baseline !== null &&
      (baseline.factorySha256 !== record.sha256 || baseline.factorySize !== record.size);

    if (baseline === null || !baseline.factoryPresent) {
      if (userEntry === null && baseline === null) {
        // Brand-new factory file with nothing in the way.
        emit('add-factory', relativePath, false);
        appliedFactoryPaths.add(relativePath);
        nextBaselineMap.set(relativePath, {
          relativePath,
          factorySha256: record.sha256,
          factorySize: record.size,
          factoryPresent: true,
        });
        continue;
      }

      if (baseline !== null && !baseline.factoryPresent && userEntry === null) {
        // Reintroduced after a removal while the user still deletes it:
        // tombstone row — deletion is intentional, keep it absent.
        emit('preserve-user-deleted', relativePath, true);
        nextBaselineMap.set(relativePath, {
          relativePath,
          factorySha256: record.sha256,
          factorySize: record.size,
          factoryPresent: true,
        });
        continue;
      }

      if (matchesOldBytes) {
        // Tombstone + retained old bytes, reintroduced file changed → replace.
        emit('add-factory', relativePath, false);
        appliedFactoryPaths.add(relativePath);
        nextBaselineMap.set(relativePath, {
          relativePath,
          factorySha256: record.sha256,
          factorySize: record.size,
          factoryPresent: true,
        });
        continue;
      }

      if (userEntry !== null || baseline !== null) {
        // Tombstone/user content occupies a "new" path (or was modified):
        // preserve the occupier; collision rows treat absent-baseline-with-
        // occupant as created-by-user.
        emit(
          baseline === null ? 'preserve-collision' : 'preserve-user-modified',
          relativePath,
          true,
        );
        nextBaselineMap.set(relativePath, {
          relativePath,
          factorySha256: record.sha256,
          factorySize: record.size,
          factoryPresent: true,
        });
        continue;
      }
      continue;
    }

    const baselineBytes = { sha: baseline.factorySha256, size: baseline.factorySize };

    if (userEntry === null) {
      // Deleted by the user — never restored automatically.
      emit('preserve-user-deleted', relativePath, factoryChangedFromBaseline);
      nextBaselineMap.set(relativePath, {
        relativePath,
        factorySha256: record.sha256,
        factorySize: record.size,
        factoryPresent: true,
      });
      continue;
    }

    if (userEntry.kind !== 'regular' || userEntry.sha256 === null) {
      // Path-type collision (dir/symlink where a file belongs).
      emit('preserve-collision', relativePath, true);
      nextBaselineMap.set(relativePath, {
        relativePath,
        factorySha256: record.sha256,
        factorySize: record.size,
        factoryPresent: true,
      });
      continue;
    }

    if (matchesOldBytes) {
      if (
        userEntry.sha256 === baselineBytes.sha &&
        userEntry.size === baselineBytes.size &&
        !factoryChangedFromBaseline
      ) {
        emit('keep-unchanged', relativePath, false);
      } else {
        emit('replace-untouched', relativePath, false);
        appliedFactoryPaths.add(relativePath);
      }
      nextBaselineMap.set(relativePath, {
        relativePath,
        factorySha256: record.sha256,
        factorySize: record.size,
        factoryPresent: true,
      });
      continue;
    }

    // User-modified live content wins over any change below it.
    emit('preserve-user-modified', relativePath, factoryChangedFromBaseline);
    nextBaselineMap.set(relativePath, {
      relativePath,
      factorySha256: record.sha256,
      factorySize: record.size,
      factoryPresent: true,
    });
  }

  // Pass 2: factory-removed paths and surviving user-only entries.
  for (const [relativePath, baseline] of baselineByPath) {
    if (installedByPath.has(relativePath)) continue;

    if (baseline.factoryPresent) {
      // Removed upstream: preserve whatever exists (entry or deletion).
      emit('preserve-factory-removed', relativePath, false);
      nextBaselineMap.set(relativePath, {
        relativePath,
        factorySha256: baseline.factorySha256,
        factorySize: baseline.factorySize,
        factoryPresent: false,
      });
      continue;
    }

    // Pre-existing tombstone with no installed counterpart: keep tombstone,
    // no action, no new classification needed.
    emit('preserve-factory-removed', relativePath, false);
  }

  // Occupiers of implied factory directories get their own explicit action.
  for (const ancestorPath of [...userEntriesAtDirectoryAncestors].sort()) {
    emit('preserve-collision', ancestorPath, true);
  }

  // User-created trees at brand-new locations are preserved wholesale.
  for (const entry of userEntries) {
    if (installedByPath.has(entry.relativePath)) continue;
    if (baselineByPath.has(entry.relativePath)) continue;
    if (userEntriesAtDirectoryAncestors.has(entry.relativePath)) continue;
    if (ancestorBlocks(entry.relativePath)) {
      // Occupies blocked ancestry reported through the descendants above.
      continue;
    }
    emit('preserve-user-only', entry.relativePath, false);
  }

  actions.sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );

  const nextStateBaselines = [...nextBaselineMap.values()].sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );

  const recomputed = deriveRevisionFromBaselines(nextStateBaselines);
  if (recomputed !== installed.revision) {
    throw new MergePlanError('Planned baselines do not reproduce the installed factory revision.');
  }

  // Bound reported lists deterministically.
  return {
    installedFactoryRevision: installed.revision,
    actions,
    nextState: {
      acceptedFactoryRevision: installed.revision,
      baselines: nextStateBaselines,
    },
    summary: {
      totalConflicts: summary.totalConflicts,
      totalCollisions: summary.totalCollisions,
      conflicts: summary.conflicts.slice(0, SAMPLE_LIMIT),
      collisions: summary.collisions.slice(0, SAMPLE_LIMIT),
    },
    appliedFactoryPaths: [...appliedFactoryPaths].sort(),
  };
}
