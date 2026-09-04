import { describe, expect, it } from 'vitest';
import {
  deriveSourceUserRevision,
  MergePlanError,
  planExampleUpdate,
  UserEntrySnapshot,
} from './merge-plan';
import { FactoryManifest, FactoryFileManifestRecord, deriveFactoryRevision } from './manifest';
import { parsePortableExamplePath } from './path-boundary';
import { FactoryBaselineRecord, deriveRevisionFromBaselines } from './state-store';

function sha(seed: string): string {
  return seed.length === 64 ? seed : `sha-${seed}-`.padEnd(63, 'x') + '!';
}

function manifestOf(files: Array<[string, string, number]>): FactoryManifest {
  const records: FactoryFileManifestRecord[] = files
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([relativePath, contentSeed, size]) => ({
      relativePath: parsePortableExamplePath(relativePath),
      sha256: sha(contentSeed),
      size,
    }));
  return {
    schemaVersion: 1,
    revision: deriveFactoryRevision(records),
    files: records,
  };
}

function baseline(
  relativePath: string,
  contentSeed: string,
  size: number,
  present = true,
): FactoryBaselineRecord {
  return {
    relativePath,
    factorySha256: sha(contentSeed),
    factorySize: size,
    factoryPresent: present,
  };
}

function regular(
  relativePath: string,
  contentSeed: string,
  size = contentSeed.length,
): UserEntrySnapshot {
  return { relativePath, kind: 'regular', sha256: sha(contentSeed), size };
}

function ofKind(relativePath: string, kind: UserEntrySnapshot['kind']): UserEntrySnapshot {
  return { relativePath, kind, sha256: null, size: null };
}

// Shared scenario vocabulary (matches contracts/example-update-merge.md).
const A_FILE = ['old-app/blue1.blue', 'A', 10] as const;
const A_TOMBSTONE_PATH = 'legacy/removed.blue';

function planning(
  baselines: FactoryBaselineRecord[],
  userEntries: UserEntrySnapshot[],
  installedFiles: Array<[string, string, number]>,
) {
  const installed = manifestOf(installedFiles);
  const plan = planExampleUpdate({
    baselines,
    userEntries,
    installed,
  });
  return plan;
}

describe('merge planner · contract matrix rows', () => {
  it('row 1: absent baseline + absent user + installed file → add-factory', () => {
    const plan = planning([], [], [['fresh/new.blue', 'N1', 3]]);
    expect(plan.actions).toEqual([
      { kind: 'add-factory', relativePath: 'fresh/new.blue', conflict: false },
    ]);
    expect(plan.appliedFactoryPaths).toEqual(['fresh/new.blue']);
    expect(plan.summary).toEqual({
      totalConflicts: 0,
      totalCollisions: 0,
      conflicts: [],
      collisions: [],
    });
  });

  it('row 2: new factory path occupied by any user entry → preserve-collision and report', () => {
    for (const occupant of [
      regular('user-made/x.blue', 'U1'),
      ofKind('user-made/x.blue', 'directory'),
      ofKind('user-made/x.blue', 'symlink'),
    ]) {
      const plan = planning([], [occupant], [['user-made/x.blue', 'N2', 5]]);
      expect(plan.actions).toEqual([
        { kind: 'preserve-collision', relativePath: 'user-made/x.blue', conflict: true },
      ]);
      expect(plan.appliedFactoryPaths).toEqual([]);
      expect(plan.summary.collisions).toContain('user-made/x.blue');
      // Baselines still advance to describe the installed copy.
      expect(plan.nextState.baselines[0].factoryPresent).toBe(true);
      expect(plan.nextState.acceptedFactoryRevision).toBe(
        manifestOf([['user-made/x.blue', 'N2', 5]]).revision,
      );
    }
  });

  it('rows 3–4: untouched file kept or replaced with fresh bytes; no conflicts', () => {
    const baselines = [baseline(A_FILE[0], 'A', 10)];

    const unchanged = planning(baselines, [regular(A_FILE[0], 'A', 10)], [[A_FILE[0], 'A', 10]]);
    expect(unchanged.actions).toEqual([
      { kind: 'keep-unchanged', relativePath: A_FILE[0], conflict: false },
    ]);
    expect(unchanged.appliedFactoryPaths).toEqual([]);

    const replaced = planning(baselines, [regular(A_FILE[0], 'A', 10)], [[A_FILE[0], 'B9', 12]]);
    expect(replaced.actions).toEqual([
      { kind: 'replace-untouched', relativePath: A_FILE[0], conflict: false },
    ]);
    expect(replaced.appliedFactoryPaths).toEqual([A_FILE[0]]);
    expect(replaced.nextState.baselines[0].factorySha256).toBe(sha('B9'));
  });

  it('row 5: user-modified file preserved; reported only when factory also changed', () => {
    const baselines = [baseline('doc/readme.md', 'ORIG', 4)];

    const silentKeep = planning(
      baselines,
      [regular('doc/readme.md', 'MINE')],
      [['doc/readme.md', 'ORIG', 4]],
    );
    expect(silentKeep.actions).toEqual([
      { kind: 'preserve-user-modified', relativePath: 'doc/readme.md', conflict: false },
    ]);

    const loudKeep = planning(
      baselines,
      [regular('doc/readme.md', 'MINE')],
      [['doc/readme.md', 'THEIRS', 6]],
    );
    expect(loudKeep.actions).toEqual([
      { kind: 'preserve-user-modified', relativePath: 'doc/readme.md', conflict: true },
    ]);
    expect(loudKeep.summary.conflicts).toContain('doc/readme.md');

    // Non-regular entries take the path-type collision row instead.
    const symlinkOccupied = planning(
      baselines,
      [ofKind('doc/readme.md', 'symlink')],
      [['doc/readme.md', 'ANY', 1]],
    );
    expect(symlinkOccupied.actions).toEqual([
      { kind: 'preserve-collision', relativePath: 'doc/readme.md', conflict: true },
    ]);
  });

  it('row 6: deleted baseline stays deleted and reports while the factory still ships it', () => {
    const baselines = [baseline('removed/by-user.blue', 'GONE', 8)];
    const plan = planning(baselines, [], [['removed/by-user.blue', 'NEWER', 9]]);
    expect(plan.actions).toEqual([
      { kind: 'preserve-user-deleted', relativePath: 'removed/by-user.blue', conflict: true },
    ]);
    // Identical bytes restored upstream: deletion persists WITHOUT a conflict.
    const quietRestoration = planning(baselines, [], [['removed/by-user.blue', 'GONE', 8]]);
    expect(quietRestoration.actions).toEqual([
      { kind: 'preserve-user-deleted', relativePath: 'removed/by-user.blue', conflict: false },
    ]);
  });

  it('row 7: directory/symlink occupying the file path is a reported collision', () => {
    const baselines = [baseline('shape/target.blue', 'SHAPE', 2)];
    for (const kind of ['directory', 'symlink', 'other'] as const) {
      const plan = planning(
        baselines,
        [ofKind('shape/target.blue', kind)],
        [['shape/target.blue', 'NEXT', 4]],
      );
      expect(plan.actions).toEqual([
        { kind: 'preserve-collision', relativePath: 'shape/target.blue', conflict: true },
      ]);
    }
  });

  it('row 8: factory removal preserves user entry or deletion, tombstoning the baseline', () => {
    const baselines = [baseline('gone/example.blue', 'REMOVED', 7)];

    const entryRemains = planning(baselines, [regular('gone/example.blue', 'MYEDIT')], []);
    expect(entryRemains.actions).toEqual([
      { kind: 'preserve-factory-removed', relativePath: 'gone/example.blue', conflict: false },
    ]);
    expect(entryRemains.nextState.baselines).toEqual([
      baseline('gone/example.blue', 'REMOVED', 7, false),
    ]);

    const alreadyDeleted = planning(baselines, [], []);
    expect(alreadyDeleted.actions).toEqual([
      { kind: 'preserve-factory-removed', relativePath: 'gone/example.blue', conflict: false },
    ]);
    expect(alreadyDeleted.nextState.baselines[0].factoryPresent).toBe(false);
    // Nothing is applied to candidates from pure removals.
    expect(alreadyDeleted.appliedFactoryPaths).toEqual([]);
  });

  it('rows 9–11: reintroduced factory paths after tombstones classify by live user state', () => {
    const tombstone = baseline(A_TOMBSTONE_PATH, 'OLDBYTES', 21, false);

    const retainedUntouched = planning(
      tombstone && [tombstone],
      [regular(A_TOMBSTONE_PATH, 'OLDBYTES', 21)],
      [[A_TOMBSTONE_PATH, 'RETURNS-DIFFERENT', 30]],
    );
    expect(retainedUntouched.actions).toEqual([
      { kind: 'add-factory', relativePath: A_TOMBSTONE_PATH, conflict: false },
    ]);
    expect(retainedUntouched.appliedFactoryPaths).toEqual([A_TOMBSTONE_PATH]);

    const retainedModified = planning(
      [tombstone],
      [regular(A_TOMBSTONE_PATH, 'MYPAGE', 55)],
      [[A_TOMBSTONE_PATH, 'RETURN', 10]],
    );
    expect(retainedModified.actions).toEqual([
      { kind: 'preserve-user-modified', relativePath: A_TOMBSTONE_PATH, conflict: true },
    ]);

    const stillMissing = planning([tombstone], [], [[A_TOMBSTONE_PATH, 'RETURN', 10]]);
    expect(stillMissing.actions).toEqual([
      { kind: 'preserve-user-deleted', relativePath: A_TOMBSTONE_PATH, conflict: true },
    ]);
  });

  it('row 12: user-only trees at brand-new locations are preserved without baselines', () => {
    const plan = planning(
      [],
      [regular('my-sandbox/idea.csd', 'USERCS'), regular('notes.txt', 'NOTE')],
      [],
    );
    expect(plan.actions.sort((a, b) => (a.relativePath < b.relativePath ? -1 : 1))).toEqual([
      { kind: 'preserve-user-only', relativePath: 'my-sandbox/idea.csd', conflict: false },
      { kind: 'preserve-user-only', relativePath: 'notes.txt', conflict: false },
    ]);
    expect(plan.nextState.baselines).toEqual([]);
  });

  it('blocks every descendant beneath an ancestor occupied by a user non-directory entry', () => {
    const userEntries = [regular('docs.pdf', 'IMPOSTERFILE')];
    const installedFiles: Array<[string, string, number]> = [
      ['docs.pdf/media/clip.wav', 'CLIP', 20],
      ['docs.pdf/index.txt', 'INDEX', 6],
    ];
    const plan = planning([], userEntries, installedFiles);

    // Ancestor itself collides; descendants inherit blocked-collision status.
    expect(plan.actions.map((action) => action.kind)).toEqual([
      'preserve-collision',
      'preserve-collision',
      'preserve-collision',
    ]);
    expect(plan.appliedFactoryPaths).toEqual([]);
    expect(plan.summary.collisions).toContain('docs.pdf');
    void installedFiles;
  });
});

describe('merge planner · invariants and outputs', () => {
  it('produces next-state baselines whose derived revision equals the installed revision', () => {
    const installedFiles: Array<[string, string, number]> = [
      ['kept/same.txt', 'SAME', 4],
      ['changed/file.blue', 'CHANGED', 33],
      ['added/later.wav', 'ADD', 44],
    ];
    const baselines = [
      baseline('kept/same.txt', 'SAME', 4),
      baseline('changed/file.blue', 'CHANGED-OLD', 31),
      baseline('dropped/legacy.csd', 'DROPPED', 5),
    ];
    const plan = planning(
      baselines,
      [regular('changed/file.blue', 'CHANGED-OLD', 31)],
      installedFiles,
    );

    expect(plan.nextState.acceptedFactoryRevision).toBe(manifestOf(installedFiles).revision);
    expect(deriveRevisionFromBaselines(plan.nextState.baselines)).toBe(
      plan.installedFactoryRevision,
    );

    const droppedTombstone = plan.nextState.baselines.find(
      (b) => b.relativePath === 'dropped/legacy.csd',
    );
    expect(droppedTombstone?.factoryPresent).toBe(false);
  });

  it('bounds summary samples while counting everything through actions', () => {
    const manyUserEdits: UserEntrySnapshot[] = [];
    const baselines: FactoryBaselineRecord[] = [];
    const installedFiles: Array<[string, string, number]> = [];
    for (let i = 0; i < 15; i += 1) {
      const pathText = `bulk/sample${String(i).padStart(2, '0')}.blue`;
      baselines.push(baseline(pathText, `OLD${i}`, i));
      manyUserEdits.push(regular(pathText, `MINE${i}`, i));
      installedFiles.push([pathText, `NEW${i}`, i]);
    }
    const plan = planning(baselines, manyUserEdits, installedFiles);

    const conflictingActions = plan.actions.filter((action) => action.conflict);
    expect(conflictingActions).toHaveLength(15);
    expect(plan.summary.conflicts.length).toBeLessThanOrEqual(8);
    expect(plan.summary.conflicts.every((pathText) => pathText.startsWith('bulk/sample'))).toBe(
      true,
    );
  });

  it('rejects installed manifests whose own revision contradicts their records', () => {
    const brokenManifest: FactoryManifest = {
      schemaVersion: 1,
      revision: 'sha256:' + 'z'.repeat(63) + '!',
      files: [
        { relativePath: parsePortableExamplePath('a/blue.blue'), sha256: sha('AAA'), size: 3 },
      ],
    };
    expect(() =>
      planExampleUpdate({ baselines: [], userEntries: [], installed: brokenManifest }),
    ).toThrow(MergePlanError);
  });

  it('derives a stable source-user revision across snapshot ordering', () => {
    const entries = [regular('b/second.blue', 'S'), regular('a/first.blue', 'F')];
    const reordered = [...entries].reverse();
    expect(deriveSourceUserRevision(entries)).toBe(deriveSourceUserRevision(reordered));
    expect(deriveSourceUserRevision(entries)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(deriveSourceUserRevision([regular('only.txt', 'X')])).not.toBe(
      deriveSourceUserRevision([regular('only.txt', 'Y')]),
    );
  });
});
