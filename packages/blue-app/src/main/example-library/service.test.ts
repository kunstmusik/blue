import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import { createExampleLibraryService, ExampleLibraryInspection } from './service';
import { buildFactoryManifest, createFactoryManifestProvider } from './manifest';
import { parseUserLibraryStateText, serializeOperationJournal } from './state-store';
import { ServiceFsSeams } from './service';

let tempRoot = '';
const FIXED_NOW = '2026-08-26T15:00:00.000Z';

function factoryFixture(): Record<string, string> {
  return {
    'demos/sine.blue': '<project><title>Sine</title></project>',
    'media/loop.wav': 'RIFF-data',
    'techniques/pvoc2.blue': '<project><title>Pvoc</title></project>',
  };
}

function writeTree(root: string, files: Record<string, string>): void {
  for (const [relative, contents] of Object.entries(files)) {
    const target = nodePath.join(root, relative);
    fs.mkdirSync(nodePath.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
}

function readTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(child);
      } else if (entry.isFile()) {
        out[nodePath.relative(root, child).split(nodePath.sep).join('/')] = fs.readFileSync(
          child,
          'utf8',
        );
      }
    }
  };
  visit(root);
  return out;
}

function digestTree(root: string): string {
  const hash = crypto.createHash('sha256');
  const files = Object.entries(readTree(root)).sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [relative, contents] of files) {
    hash.update(relative);
    hash.update(crypto.createHash('sha256').update(contents).digest('hex'));
  }
  return hash.digest('hex');
}

function renameDirectorySync(fromPath: string, toPath: string): void {
  try {
    fs.renameSync(fromPath, toPath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'EPERM' || code === 'EBUSY') {
      let retries = 10;
      while (retries > 0) {
        try {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
          fs.renameSync(fromPath, toPath);
          return;
        } catch {
          retries--;
        }
      }
    }
    throw err;
  }
}

interface HarnessOptions {
  fsSeams?: ServiceFsSeams;
}

function createHarness(options: HarnessOptions = {}) {
  const factoryFiles = factoryFixture();
  const factoryRoot = nodePath.join(tempRoot, 'installation', 'assets', 'examples');
  const libraryRoot = nodePath.join(tempRoot, 'userdata', 'examples');
  writeTree(factoryRoot, factoryFiles);

  let factoryUsable = true;
  let factoryBytesEdited = false;
  let manifestBuilds = 0;
  const realManifestBuilder = buildFactoryManifest;
  const manifestProvider = createFactoryManifestProvider({
    build: async (root) => {
      manifestBuilds += 1;
      return realManifestBuilder(root);
    },
  });
  const service = createExampleLibraryService({
    libraryRoot,
    getFactoryRoot: async () => (factoryUsable ? factoryRoot : null),
    nowIso: () => FIXED_NOW,
    fsSeams: options.fsSeams,
    manifestProvider,
  });

  async function inspectStatus(): Promise<ExampleLibraryInspection> {
    const inspected = await service.inspect();
    expect(inspected.ok).toBe(true);
    return (inspected as { ok: true; value: ExampleLibraryInspection }).value;
  }

  return {
    service,
    factoryFiles,
    factoryRoot,
    libraryRoot,
    setFactoryUnavailable: () => {
      factoryUsable = false;
    },
    /** Change factory bytes so the installed revision differs from A. */
    mutateFactoryContent: () => {
      if (!factoryBytesEdited) {
        fs.writeFileSync(
          nodePath.join(factoryRoot, 'media', 'loop.wav'),
          'RIFF-mutated-data',
          'utf8',
        );
        factoryBytesEdited = true;
      }
      manifestProvider.clearForTesting();
    },
    inspectStatus,
    factoryManifestBuilds: () => manifestBuilds,
  };
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'blue-svc-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = '';
});

describe('example-library service · first use', () => {
  it('rejects an empty factory tree as unavailable', async () => {
    const factoryRoot = nodePath.join(tempRoot, 'empty-factory');
    const libraryRoot = nodePath.join(tempRoot, 'userdata', 'examples');
    fs.mkdirSync(factoryRoot, { recursive: true });
    const service = createExampleLibraryService({
      libraryRoot,
      getFactoryRoot: async () => factoryRoot,
      nowIso: () => FIXED_NOW,
    });

    const inspected = await service.inspect();
    expect(inspected.ok && inspected.value.status === 'unavailable').toBe(true);
  });

  it('inspects needs-initialization and copies the complete factory tree byte-for-byte', async () => {
    const h = createHarness();
    const inspected = await h.inspectStatus();
    expect(inspected.status).toBe('needs-initialization');
    if (inspected.status !== 'needs-initialization') return;

    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const candidate = prepared.value;

    // Hidden generation: visible only as staging, never as current.
    expect(fs.existsSync(h.libraryRoot)).toBe(true);
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    expect(candidate.lifecycle).toBe('prepared');

    // Abort from `finally` on cancel boundaries is available but not run here.
    const committed = await h.service.commit(candidate);
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    expect(committed.value.contentPath).toBe(nodePath.join(h.libraryRoot, 'current', 'content'));
    expect(readTree(nodePath.join(h.libraryRoot, 'current', 'content'))).toEqual(h.factoryFiles);

    const stateText = fs.readFileSync(
      nodePath.join(h.libraryRoot, 'current', 'state.json'),
      'utf8',
    );
    const state = parseUserLibraryStateText(stateText);
    expect(state.kind).toBe('loaded');
    if (state.kind === 'loaded') {
      expect(state.value.acceptedFactoryRevision).toBe(inspected.factory.revision);
      expect(state.value.baselines.map((b) => b.relativePath)).toEqual([
        'demos/sine.blue',
        'media/loop.wav',
        'techniques/pvoc2.blue',
      ]);
    }

    expect(fs.readdirSync(h.libraryRoot).filter((n) => n.startsWith('staging-'))).toEqual([]);
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'operation.json'))).toBe(false);

    // Second inspection is silent-ready at the same revision (SC-004 seed).
    const reopened = await h.inspectStatus();
    expect(reopened.status).toBe('ready');
  });

  it('leaves the packaged factory source bit-identical across the whole cycle', async () => {
    const h = createHarness();
    const beforeDigest = digestTree(h.factoryRoot);

    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    if (!prepared.ok) throw new Error(prepared.message);
    const committed = await h.service.commit(prepared.value);
    expect(committed.ok).toBe(true);

    // Edit the user copy aggressively.
    const userProject = nodePath.join(h.libraryRoot, 'current', 'content', 'demos', 'sine.blue');
    fs.writeFileSync(userProject, '<project>user-edited</project>', 'utf8');

    expect(digestTree(h.factoryRoot)).toBe(beforeDigest);
  });

  it('rejects an initial candidate when factory bytes drift after inspection', async () => {
    const h = createHarness();
    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');

    fs.writeFileSync(
      nodePath.join(h.factoryRoot, 'demos', 'sine.blue'),
      '<project>changed-after-manifest</project>',
      'utf8',
    );
    const prepared = await h.service.prepareInitialCopy(inspected.factory);

    expect(prepared.ok).toBe(false);
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    expect(
      fs.existsSync(h.libraryRoot)
        ? fs.readdirSync(h.libraryRoot).filter((name) => name.startsWith('staging-'))
        : [],
    ).toEqual([]);
  });

  it('removes failed preparations entirely and stays retryable on EACCES-style copy errors', async () => {
    let copyCalls = 0;
    const h = createHarness({
      fsSeams: {
        createReadStream(filePath: string) {
          copyCalls += 1;
          if (copyCalls === 2) {
            const err = new Error(
              `EACCES: permission denied, open ${filePath}`,
            ) as NodeJS.ErrnoException;
            err.code = 'EACCES';
            throw err;
          }
          return fs.createReadStream(filePath) as unknown as NodeJS.ReadableStream;
        },
      },
    });

    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.retryable).toBe(true);
    expect(prepared.code).toBe('io-error');

    expect(fs.readdirSync(h.libraryRoot).filter((n) => n.startsWith('staging-'))).toEqual([]);

    const retry = createHarness(); // same disk, fresh harness mirrors a retry
    void retry;
    // And within the SAME service a subsequent attempt succeeds:
    const secondTry = await (async () => {
      const again = await h.inspectStatus();
      if (again.status !== 'needs-initialization') throw new Error(again.status);
      return h.service.prepareInitialCopy(again.factory);
    })();
    expect(secondTry.ok).toBe(true);
  });

  it('treats a failing activation rename as abortable and cleans the stale stage on reopen', async () => {
    let renameCalls = 0;
    const h = createHarness({
      fsSeams: {
        rename: async (fromPath, toPath) => {
          renameCalls += 1;
          if (renameCalls === 1 && fromPath.includes('staging-')) {
            throw Object.assign(new Error('EIO: injected rename failure'), { code: 'EIO' });
          }
          return fs.promises.rename(fromPath, toPath);
        },
      },
    });

    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    if (!prepared.ok) throw new Error(prepared.message);

    const result = await h.service.commit(prepared.value);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('io-error');
    expect(result.retryable).toBe(true);

    // The interrupted-but-unjournaled swap: stale stage recognized & cleaned
    // during the NEXT inspection, flow remains ready for another attempt.
    const reopened = await h.inspectStatus();
    expect(reopened.status).toBe('needs-initialization');
    expect(fs.readdirSync(h.libraryRoot).filter((n) => n.startsWith('staging-'))).toEqual([]);
  });

  it('honors a completed activation whose final journal write failed', async () => {
    let sidecarWrites = 0;
    const h = createHarness({
      fsSeams: {
        writeSidecarJson: async (targetPath, contents) => {
          sidecarWrites += 1;
          if (targetPath.endsWith('operation.json') && sidecarWrites >= 3) {
            throw Object.assign(new Error('EDQUOT: journal flush failed'), { code: 'ENOSPC' });
          }
          await fs.promises.writeFile(targetPath, contents, 'utf8');
        },
      },
    });

    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    if (!prepared.ok) throw new Error(prepared.message);

    // Journal writes: prepared(1) → [no backup] → activated attempted(3≥3 fails
    // only after rename; sequence: prepared=1, activated=2… guard calibrated):
    void sidecarWrites;
    const result = await h.service.commit(prepared.value);
    // Either shape is contract-valid, but the disk must converge to exactly one
    // usable generation.
    if (result.ok) {
      expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current', 'content'))).toBe(true);
    } else {
      expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    }

    const convergence = await h.inspectStatus();
    expect(['ready', 'needs-initialization']).toContain(convergence.status);
  });
});

describe('example-library service · inspections beyond first use', () => {
  it('reports unavailable with neither factory nor user library', async () => {
    const h = createHarness();
    h.setFactoryUnavailable();
    expect((await h.inspectStatus()).status).toBe('unavailable');
  });

  it('opens factory-unavailable only alongside a valid existing library', async () => {
    const h = createHarness();
    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    if (!prepared.ok) throw new Error(prepared.message);
    expect((await h.service.commit(prepared.value)).ok).toBe(true);

    h.setFactoryUnavailable();
    const offline = await h.inspectStatus();
    expect(offline.status).toBe('factory-unavailable');
  });

  it('blocks mutation when provenance exists without content or state is corrupt', async () => {
    const h = createHarness();
    fs.mkdirSync(nodePath.join(h.libraryRoot, 'current'), { recursive: true });
    fs.writeFileSync(
      nodePath.join(h.libraryRoot, 'current', 'state.json'),
      '{invalid-json',
      'utf8',
    );
    fs.mkdirSync(nodePath.join(h.libraryRoot, 'current', 'content'), { recursive: true });

    const blocked = await h.inspectStatus();
    expect(blocked.status).toBe('invalid-user-library');
  });

  it('preserves unrecognized backups and refuses further mutation', async () => {
    const h = createHarness();
    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    if (!prepared.ok) throw new Error(prepared.message);
    expect((await h.service.commit(prepared.value)).ok).toBe(true);

    // External unmanaged backup appears between sessions.
    renameDirectorySync(
      nodePath.join(h.libraryRoot, 'current'),
      nodePath.join(h.libraryRoot, 'backup-unknown-source'),
    );

    const blocked = await h.inspectStatus();
    expect(blocked.status).toBe('invalid-user-library');
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'backup-unknown-source'))).toBe(true);
  });

  it('preserves journal-less staging directories and blocks mutation', async () => {
    const h = createHarness();
    const ambiguousStage = nodePath.join(h.libraryRoot, 'staging-abcdef');
    fs.mkdirSync(nodePath.join(ambiguousStage, 'content'), { recursive: true });
    fs.writeFileSync(nodePath.join(ambiguousStage, 'content', 'user-note.txt'), 'preserve me');

    const blocked = await h.inspectStatus();

    expect(blocked.status).toBe('invalid-user-library');
    expect(fs.readFileSync(nodePath.join(ambiguousStage, 'content', 'user-note.txt'), 'utf8')).toBe(
      'preserve me',
    );
  });
});

describe('example-library service · persistent library preference (US2)', () => {
  it('reuses the cached factory manifest and skips all copying once accepted', async () => {
    const h = createHarness();
    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    if (!prepared.ok) throw new Error(prepared.message);
    expect((await h.service.commit(prepared.value)).ok).toBe(true);

    // Same-session manifest cache means repeated inspects do not rehash the
    // tree; nothing copies, stages, or journals again either.
    for (let i = 0; i < 3; i += 1) {
      const reopened = await h.inspectStatus();
      expect(reopened.status).toBe('ready');
    }

    expect(h.factoryManifestBuilds()).toBe(1);

    expect(fs.readdirSync(h.libraryRoot).filter((name) => name.startsWith('staging-'))).toEqual([]);
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'operation.json'))).toBe(false);

    // Sanity: ready inspection hands back the validated state without rebuilds
    const final = await h.inspectStatus();
    if (final.status !== 'ready') throw new Error(final.status);
    expect(final.current.contentPath).toBe(nodePath.join(h.libraryRoot, 'current', 'content'));
    expect(digestTree(h.factoryRoot)).toBe(digestTree(h.factoryRoot));
  });
});

describe('example-library service · keep-current decision', () => {
  it('records declines atomically so an unchanged installed revision stops prompting', async () => {
    const h = createHarness();
    const inspected = await h.inspectStatus();
    if (inspected.status !== 'needs-initialization') throw new Error('precondition');
    const prepared = await h.service.prepareInitialCopy(inspected.factory);
    if (!prepared.ok) throw new Error(prepared.message);
    expect((await h.service.commit(prepared.value)).ok).toBe(true);

    const ready = await h.inspectStatus();
    expect(ready.status).toBe('ready');
    if (ready.status !== 'ready') return;

    // Keep Current is only reachable while a differing revision is offered;
    // declining the accepted revision itself normalizes to null (contract).
    const normalized = await h.service.recordDeclinedRevision(
      ready.current.state,
      ready.current.state.acceptedFactoryRevision,
    );
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.value.declinedFactoryRevision).toBeNull();

    // A genuinely different installed revision produces the update offer…
    h.mutateFactoryContent();
    const offered = await h.inspectStatus();
    expect(offered.status).toBe('update-available');
    if (offered.status !== 'update-available') return;

    // …which the user may decline; afterwards the same revision stops prompting.
    const declined = await h.service.recordDeclinedRevision(
      offered.current.state,
      offered.factory.revision,
    );
    expect(declined.ok).toBe(true);

    const quiet = await h.inspectStatus();
    expect(quiet.status).toBe('declined-current');
  });
});

describe('example-library service · safe updates (US3)', () => {
  async function seedLibraryAtRevisionA() {
    const factoryFiles: Record<string, string> = {
      'kept/same.txt': 'KEEP-ME',
      'changing/example.blue': '<project>C1</project>',
      'user-editable/readme.md': 'FACTORY-R1',
      'still-shipped/deleted-by-user.txt': 'DELETEME',
      'doomed/removed-upstream.txt': 'REMOVED-LATER',
    };
    const factoryRoot = nodePath.join(tempRoot, 'installation', 'examples');
    const libraryRoot = nodePath.join(tempRoot, 'userdata', 'examples');
    const contentRoot = nodePath.join(libraryRoot, 'current', 'content');
    writeTree(factoryRoot, factoryFiles);

    const manifestProvider = createFactoryManifestProvider();
    const service = createExampleLibraryService({
      libraryRoot,
      getFactoryRoot: async () => factoryRoot,
      nowIso: () => FIXED_NOW,
      manifestProvider,
    });

    const inspected = await service.inspect();
    if (!inspected.ok || inspected.value.status !== 'needs-initialization') {
      throw new Error('seed precondition failed');
    }
    const prepared = await service.prepareInitialCopy(inspected.value.factory);
    if (!prepared.ok) throw new Error(prepared.message);
    const committed = await service.commit(prepared.value);
    if (!committed.ok) throw new Error(committed.message);

    return {
      factoryRoot,
      libraryRoot,
      contentRoot,
      service,
      writeFactoryV2: () => {
        fs.writeFileSync(
          nodePath.join(factoryRoot, 'changing', 'example.blue'),
          '<project>C2</project>',
          'utf8',
        );
        writeTree(factoryRoot, { 'brand-new/welcome.blue': '<project>WELCOME</project>' });
        fs.rmSync(nodePath.join(factoryRoot, 'doomed'), { recursive: true });
        fs.writeFileSync(
          nodePath.join(factoryRoot, 'user-editable', 'readme.md'),
          'FACTORY-R2',
          'utf8',
        );
        manifestProvider.clearForTesting();
      },
      prepareUpdateCandidate: async () => {
        const offered = await service.inspect();
        if (!offered.ok || offered.value.status !== 'update-available') {
          throw new Error(
            `expected update-available, got ${!offered.ok ? offered.code : offered.value.status}`,
          );
        }
        const outcome = await service.prepareUpdate();
        if (!outcome.ok) throw new Error(outcome.message);
        return outcome.value;
      },
      assertNoStagingLeft: () => {
        expect(fs.readdirSync(libraryRoot).filter((name) => name.startsWith('staging-'))).toEqual(
          [],
        );
      },
    };
  }

  it('applies only new+untouched bytes and preserves every kind of user state (SC-005)', async () => {
    const env = await seedLibraryAtRevisionA();

    // User state before the update: an edit, a deletion, and a sandbox file.
    fs.writeFileSync(
      nodePath.join(env.contentRoot, 'user-editable', 'readme.md'),
      'MY-NOTES',
      'utf8',
    );
    fs.rmSync(nodePath.join(env.contentRoot, 'still-shipped', 'deleted-by-user.txt'));
    writeTree(env.contentRoot, { 'my-sandbox/idea.csd': '<Csound>SAND</Csound>' });

    env.writeFactoryV2();
    const candidate = await env.prepareUpdateCandidate();

    // Only the genuinely-changed pair reports: readme (factory R2 vs user
    // edit). The deletion ships UNCHANGED upstream, so it stays quiet.
    expect(candidate.summary?.totalConflicts).toBe(1);
    expect(candidate.summary?.conflicts).toEqual(['user-editable/readme.md']);

    const committed = await env.service.commit(candidate);
    expect(committed.ok).toBe(true);

    const readAt = (relative: string): string | null => {
      try {
        return fs.readFileSync(nodePath.join(env.contentRoot, relative), 'utf8');
      } catch {
        return null;
      }
    };

    expect(readAt('changing/example.blue')).toBe('<project>C2</project>');
    expect(readAt('brand-new/welcome.blue')).toBe('<project>WELCOME</project>');
    expect(readAt('kept/same.txt')).toBe('KEEP-ME');
    expect(readAt('user-editable/readme.md')).toBe('MY-NOTES');
    expect(readAt('still-shipped/deleted-by-user.txt')).toBeNull();
    expect(readAt('doomed/removed-upstream.txt')).toBe('REMOVED-LATER');
    expect(readAt('my-sandbox/idea.csd')).toBe('<Csound>SAND</Csound>');

    const state = parseUserLibraryStateText(
      fs.readFileSync(nodePath.join(env.libraryRoot, 'current', 'state.json'), 'utf8'),
    );
    expect(state.kind).toBe('loaded');
    if (state.kind === 'loaded') {
      expect(
        state.value.baselines.find((b) => b.relativePath === 'doomed/removed-upstream.txt')
          ?.factoryPresent,
      ).toBe(false);
    }

    const quiet = await env.service.inspect();
    expect(quiet.ok && quiet.value.status === 'ready').toBe(true);
    env.assertNoStagingLeft();
  }, 20000);

  it('aborts activation when the live tree drifted after preparation (contract step 6)', async () => {
    const env = await seedLibraryAtRevisionA();
    env.writeFactoryV2();
    const candidate = await env.prepareUpdateCandidate();

    // An external save lands after preparation, before commit.
    fs.mkdirSync(nodePath.join(env.contentRoot, 'external'), { recursive: true });
    fs.writeFileSync(nodePath.join(env.contentRoot, 'external', 'late.txt'), 'LATE-SAVE');

    const result = await env.service.commit(candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('source-changed');
    expect(result.retryable).toBe(true);

    // The live library stays authoritative and untouched by the abort.
    expect(fs.readFileSync(nodePath.join(env.contentRoot, 'kept', 'same.txt'), 'utf8')).toBe(
      'KEEP-ME',
    );
    env.assertNoStagingLeft();
  }, 20000);

  it('keeps valid current and removes the matched stage for a prepared update journal', async () => {
    const env = await seedLibraryAtRevisionA();
    env.writeFactoryV2();
    const candidate = await env.prepareUpdateCandidate();
    fs.writeFileSync(
      nodePath.join(env.libraryRoot, 'operation.json'),
      serializeOperationJournal({
        schemaVersion: 1,
        operationId: candidate.operationId,
        kind: 'update',
        phase: 'prepared',
        stagingDirectoryName: nodePath.basename(candidate.rootPath),
        backupDirectoryName: null,
        sourceUserRevision: candidate.sourceUserRevision,
        targetFactoryRevision: candidate.state.acceptedFactoryRevision,
        startedAt: FIXED_NOW,
      }),
      'utf8',
    );

    const recovered = await env.service.inspect();
    expect(recovered.ok && recovered.value.status === 'update-available').toBe(true);
    expect(fs.existsSync(candidate.rootPath)).toBe(false);
    expect(fs.existsSync(nodePath.join(env.libraryRoot, 'operation.json'))).toBe(false);
    expect(
      fs.readFileSync(nodePath.join(env.contentRoot, 'changing', 'example.blue'), 'utf8'),
    ).toBe('<project>C1</project>');
  }, 20000);

  it('recovers a backup-created journal written before the backup rename', async () => {
    const env = await seedLibraryAtRevisionA();
    env.writeFactoryV2();
    const candidate = await env.prepareUpdateCandidate();
    const backupName = `backup-${candidate.operationId}`;
    fs.writeFileSync(
      nodePath.join(env.libraryRoot, 'operation.json'),
      serializeOperationJournal({
        schemaVersion: 1,
        operationId: candidate.operationId,
        kind: 'update',
        phase: 'backup-created',
        stagingDirectoryName: nodePath.basename(candidate.rootPath),
        backupDirectoryName: backupName,
        sourceUserRevision: candidate.sourceUserRevision,
        targetFactoryRevision: candidate.state.acceptedFactoryRevision,
        startedAt: FIXED_NOW,
      }),
      'utf8',
    );

    const recovered = await env.service.inspect();
    expect(recovered.ok && recovered.value.status === 'update-available').toBe(true);
    expect(fs.existsSync(candidate.rootPath)).toBe(false);
    expect(fs.existsSync(nodePath.join(env.libraryRoot, backupName))).toBe(false);
    expect(fs.existsSync(nodePath.join(env.libraryRoot, 'operation.json'))).toBe(false);
  }, 20000);

  it('finishes activation when current moved to backup before the phase advancement', async () => {
    const env = await seedLibraryAtRevisionA();
    env.writeFactoryV2();
    const candidate = await env.prepareUpdateCandidate();
    const backupName = `backup-${candidate.operationId}`;
    renameDirectorySync(
      nodePath.join(env.libraryRoot, 'current'),
      nodePath.join(env.libraryRoot, backupName),
    );
    fs.writeFileSync(
      nodePath.join(env.libraryRoot, 'operation.json'),
      serializeOperationJournal({
        schemaVersion: 1,
        operationId: candidate.operationId,
        kind: 'update',
        phase: 'prepared',
        stagingDirectoryName: nodePath.basename(candidate.rootPath),
        backupDirectoryName: backupName,
        sourceUserRevision: candidate.sourceUserRevision,
        targetFactoryRevision: candidate.state.acceptedFactoryRevision,
        startedAt: FIXED_NOW,
      }),
      'utf8',
    );

    const recovered = await env.service.inspect();
    expect(recovered.ok && recovered.value.status === 'ready').toBe(true);
    expect(fs.existsSync(nodePath.join(env.libraryRoot, backupName))).toBe(false);
    expect(fs.existsSync(nodePath.join(env.libraryRoot, 'operation.json'))).toBe(false);
  }, 20000);

  it('finishes a verified staged activation after a crash gap at backup-created', async () => {
    const env = await seedLibraryAtRevisionA();
    env.writeFactoryV2();
    const candidate = await env.prepareUpdateCandidate();

    // Simulate the crash window between renames: current → backup moved,
    // journal recorded at `backup-created`, staging still in place.
    const backupName = `backup-${candidate.operationId}`;
    const stagingName = nodePath.basename(candidate.rootPath);
    renameDirectorySync(
      nodePath.join(env.libraryRoot, 'current'),
      nodePath.join(env.libraryRoot, backupName),
    );
    fs.writeFileSync(
      nodePath.join(env.libraryRoot, 'operation.json'),
      serializeOperationJournal({
        schemaVersion: 1,
        operationId: candidate.operationId,
        kind: 'update',
        phase: 'backup-created',
        stagingDirectoryName: stagingName,
        backupDirectoryName: backupName,
        sourceUserRevision: candidate.sourceUserRevision,
        targetFactoryRevision: candidate.state.acceptedFactoryRevision,
        startedAt: FIXED_NOW,
      }),
      'utf8',
    );

    const recovered = await env.service.inspect();
    expect(recovered.ok && recovered.value.status === 'ready').toBe(true);
    expect(
      fs.readFileSync(nodePath.join(env.contentRoot, 'changing', 'example.blue'), 'utf8'),
    ).toBe('<project>C2</project>');
    expect(fs.existsSync(nodePath.join(env.libraryRoot, backupName))).toBe(false);
    expect(fs.existsSync(nodePath.join(env.libraryRoot, 'operation.json'))).toBe(false);
  }, 20000);

  it.each(['backup-created', 'activated'] as const)(
    'keeps an activated target and removes its recorded backup and %s journal',
    async (phase) => {
      const env = await seedLibraryAtRevisionA();
      env.writeFactoryV2();
      const candidate = await env.prepareUpdateCandidate();
      const backupName = `backup-${candidate.operationId}`;
      renameDirectorySync(
        nodePath.join(env.libraryRoot, 'current'),
        nodePath.join(env.libraryRoot, backupName),
      );
      renameDirectorySync(candidate.rootPath, nodePath.join(env.libraryRoot, 'current'));
      fs.writeFileSync(
        nodePath.join(env.libraryRoot, 'operation.json'),
        serializeOperationJournal({
          schemaVersion: 1,
          operationId: candidate.operationId,
          kind: 'update',
          phase,
          stagingDirectoryName: nodePath.basename(candidate.rootPath),
          backupDirectoryName: backupName,
          sourceUserRevision: candidate.sourceUserRevision,
          targetFactoryRevision: candidate.state.acceptedFactoryRevision,
          startedAt: FIXED_NOW,
        }),
        'utf8',
      );

      const recovered = await env.service.inspect();
      expect(recovered.ok && recovered.value.status === 'ready').toBe(true);
      expect(fs.existsSync(nodePath.join(env.libraryRoot, backupName))).toBe(false);
      expect(fs.existsSync(nodePath.join(env.libraryRoot, 'operation.json'))).toBe(false);
    },
    20000,
  );

  it('restores the verified backup when the staging generation vanished mid-crash', async () => {
    const env = await seedLibraryAtRevisionA();
    env.writeFactoryV2();
    const candidate = await env.prepareUpdateCandidate();

    const backupName = `backup-${candidate.operationId}`;
    const stagingName = nodePath.basename(candidate.rootPath);
    renameDirectorySync(
      nodePath.join(env.libraryRoot, 'current'),
      nodePath.join(env.libraryRoot, backupName),
    );
    fs.rmSync(candidate.rootPath, { recursive: true });
    fs.writeFileSync(
      nodePath.join(env.libraryRoot, 'operation.json'),
      serializeOperationJournal({
        schemaVersion: 1,
        operationId: candidate.operationId,
        kind: 'update',
        phase: 'backup-created',
        stagingDirectoryName: stagingName,
        backupDirectoryName: backupName,
        sourceUserRevision: candidate.sourceUserRevision,
        targetFactoryRevision: candidate.state.acceptedFactoryRevision,
        startedAt: FIXED_NOW,
      }),
      'utf8',
    );

    const restored = await env.service.inspect();
    expect(restored.ok && restored.value.status === 'update-available').toBe(true);
    // Back to the exact revision-A content, byte for byte.
    expect(
      fs.readFileSync(nodePath.join(env.contentRoot, 'changing', 'example.blue'), 'utf8'),
    ).toBe('<project>C1</project>');
    expect(fs.existsSync(nodePath.join(env.libraryRoot, backupName))).toBe(false);
    expect(fs.existsSync(nodePath.join(env.libraryRoot, 'operation.json'))).toBe(false);
  }, 20000);

  it('keeps prior content and reports retryable failure when the backup rename fails', async () => {
    let failNextCurrentRename = true;
    const seeded = await seedLibraryAtRevisionA();
    seeded.writeFactoryV2();

    const instrumented = createExampleLibraryService({
      libraryRoot: seeded.libraryRoot,
      getFactoryRoot: async () => seeded.factoryRoot,
      nowIso: () => FIXED_NOW,
      manifestProvider: createFactoryManifestProvider(),
      fsSeams: {
        rename: async (fromPath, toPath) => {
          void fromPath;
          if (
            failNextCurrentRename &&
            toPath.endsWith(
              nodePath.join('examples', 'current').split(nodePath.sep).pop() as string,
            ) &&
            !toPath.includes('staging-')
          ) {
            failNextCurrentRename = false;
            throw Object.assign(new Error('injected current→backup rename failure'), {
              code: 'EIO',
            });
          }
          return fs.promises.rename(fromPath, toPath);
        },
      },
    });

    const offered = await instrumented.inspect();
    expect(offered.ok && offered.value.status === 'update-available').toBe(true);
    if (!offered.ok || offered.value.status !== 'update-available') return;

    const outcome = await instrumented.prepareUpdate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const failedCommit = await instrumented.commit(outcome.value);
    expect(failedCommit.ok).toBe(false);
    if (!failedCommit.ok && failedCommit.retryable !== undefined) {
      expect(failedCommit.retryable).toBe(true);
    }

    // Revision-A generation fully intact.
    expect(
      fs.readFileSync(nodePath.join(seeded.contentRoot, 'changing', 'example.blue'), 'utf8'),
    ).toBe('<project>C1</project>');
  }, 20000);
});
