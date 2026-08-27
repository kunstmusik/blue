import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import {
  formatExampleConflictDetail,
  runOpenExampleProjectFlow,
  OpenExampleFlowDependencies,
  UpdateOfferChoice,
} from './open-example-project-flow';
import {
  createExampleLibraryService,
  ExampleLibraryInspection,
} from './example-library/service';
import { createFactoryManifestProvider } from './example-library/manifest';

let tempRoot = '';
const NOW = '2026-08-26T16:00:00.000Z';

interface HarnessConfig {
  firstUseCopyChoice?: boolean;
  updateOfferChoice?: UpdateOfferChoice;
  continueDespiteConflicts?: boolean;
  openCurrentWithoutUpdateCheck?: boolean;
  /** False simulates an unsaved active example blocking the library swap. */
  activeExampleSafe?: boolean;
  pickerSelection?:
    | string
    | null
    | ((defaultRoot: string) => string | null);
  pickerSelectionOutsideRoot?: boolean;
  loadProjectFails?: boolean;
  libraryDraftConfirms?: boolean;
  saveConfirms?: boolean;
  installThrows?: boolean;
  declineWriteFails?: boolean;
}

function createFlowHarness(config: HarnessConfig = {}) {
  let installThrowsActive = config.installThrows ?? false;
  const outsideSameFileTargets = new Set<string>();
  const factoryFiles: Record<string, string> = {
    'demos/sine.blue': '<project>Sine</project>',
    'media/loop.wav': 'RIFF',
  };
  const factoryRoot = nodePath.join(tempRoot, 'installation', 'examples');
  const libraryRoot = nodePath.join(tempRoot, 'userdata', 'examples');
  fs.mkdirSync(factoryRoot, { recursive: true });
  for (const [relative, contents] of Object.entries(factoryFiles)) {
    const target = nodePath.join(factoryRoot, relative);
    fs.mkdirSync(nodePath.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  const contentRoot = nodePath.join(libraryRoot, 'current', 'content');
  const outsideProject = nodePath.join(tempRoot, 'outside.dark');

  const provider = createFactoryManifestProvider();
  const service = createExampleLibraryService({
    libraryRoot,
    getFactoryRoot: async () => factoryRoot,
    nowIso: () => NOW,
    manifestProvider: provider,
  });

  const calls: string[] = [];
  let lastConflictReport: { total: number; samples: string[] } | null = null;
  let liveCandidate: unknown = null;

  let lastInspection: ExampleLibraryInspection;

  const deps: OpenExampleFlowDependencies<{ xml: string }> = {
    preflight: () => {
      calls.push('preflight');
      return true;
    },
    runRecoveryAndInspect: async () => {
      calls.push('recover-inspect');
      const outcome = await service.inspect();
      if (!outcome.ok || outcome.value.status === 'invalid-user-library' || outcome.value.status === 'unavailable') {
        return { ok: false as const, kind: 'inspection-blocked' as const, diagnostic: 'blocked' };
      }
      lastInspection = outcome.value;
      return { ok: true as const, inspection: outcome.value };
    },
    prepareFirstUseCopy: async () => {
      calls.push('prepare-copy');
      if (lastInspection.status !== 'needs-initialization') throw new Error('bad state');
      const prepared = await service.prepareInitialCopy(lastInspection.factory);
      if (!prepared.ok) {
        return { ok: false as const, code: prepared.code, message: prepared.message, retryable: prepared.retryable };
      }
      liveCandidate = prepared.value;
      return { ok: true as const, candidate: prepared.value };
    },
    prepareUpdateCandidate: async () => {
      const offered = await service.inspect();
      if (!offered.ok || offered.value.status !== 'update-available') {
        return {
          ok: false as const,
          code: 'conflict',
          message: 'no longer offering an update',
          retryable: false,
        };
      }
      const outcome = await service.prepareUpdate();
      if (!outcome.ok) {
        return { ok: false as const, code: outcome.code, message: outcome.message, retryable: outcome.retryable };
      }
      liveCandidate = outcome.value;
      return { ok: true as const, candidate: outcome.value };
    },
    recordKeepCurrentDecline: async () => {
      calls.push('record-keep-current');
      const offered = lastInspection;
      if (offered === undefined || offered.status !== 'update-available') {
        return { ok: false, message: 'No update is available.', retryable: false };
      }
      if (config.declineWriteFails) {
        return { ok: false, message: 'decline write failed', retryable: true };
      }
      const outcome = await service.recordDeclinedRevision(
        offered.current.state,
        offered.factory.revision,
      );
      return outcome.ok
        ? { ok: true }
        : { ok: false, message: outcome.message, retryable: outcome.retryable };
    },
    commitCandidateOrNull: async (candidate) => {
      calls.push(candidate !== null ? 'commit-candidate' : 'commit-nothing');
      liveCandidate = null;
      if (candidate === null) {
        return { ok: true };
      }
      const result = await service.commit(candidate);
      return result.ok ? { ok: true } : { ok: false, message: result.message, retryable: result.retryable };
    },
    discardCandidate: async (candidate) => {
      calls.push('discard');
      if (candidate !== null) {
        await service.abort(candidate);
        liveCandidate = null;
      }
    },
    chooseFirstUseCopy: () => {
      calls.push('choose-first-use');
      return Promise.resolve(config.firstUseCopyChoice ?? true);
    },
    chooseForUpdateOffer: () => {
      calls.push('choose-update-offer');
      return Promise.resolve(config.updateOfferChoice ?? 'cancel');
    },
    chooseContinueDespiteUpdateConflicts: (report) => {
      calls.push('choose-conflicts');
      lastConflictReport = report;
      return Promise.resolve(config.continueDespiteConflicts ?? false);
    },
    chooseOpenCurrentExamplesWithoutUpdateCheck: () => {
      calls.push('choose-open-current');
      return Promise.resolve(config.openCurrentWithoutUpdateCheck ?? true);
    },
    ensureActiveProjectSafeBeforeLibrarySwap: () => {
      calls.push('active-example-safety');
      return config.activeExampleSafe ?? true;
    },
    showProjectPicker: (defaultRoot) => {
      calls.push(`picker:${defaultRoot.includes(nodePath.join('examples', 'current')) ? 'current' : 'candidate'}`);
      if (config.pickerSelectionOutsideRoot) {
        return Promise.resolve(outsideProject);
      }
      if (typeof config.pickerSelection === 'function') {
        return Promise.resolve(config.pickerSelection(defaultRoot));
      }
      if (config.pickerSelection === undefined || config.pickerSelection === null) {
        return Promise.resolve(
          config.pickerSelection === null
            ? null
            : nodePath.join(defaultRoot, 'demos', 'sine.blue'),
        );
      }
      return Promise.resolve(config.pickerSelection);
    },
    resolvePickerSelection: (selectedPath, offeredRoot) => {
      calls.push('resolve-selection');
      if (!selectedPath.endsWith('.blue')) return null;
      for (const possibleRoot of [offeredRoot, contentRoot]) {
        try {
          const resolvedSelected = fs.realpathSync(selectedPath);
          const resolvedRoot = fs.realpathSync(possibleRoot);
          const relativePath = nodePath.relative(resolvedRoot, resolvedSelected);
          if (
            relativePath !== ''
            && !relativePath.startsWith('..')
            && !nodePath.isAbsolute(relativePath)
          ) {
            const filePath = nodePath.join(offeredRoot, relativePath);
            if (fs.statSync(filePath).isFile()) {
              return { filePath, relativePath };
            }
          }
        } catch {
          // Try the other Blue-owned content root.
        }
      }
      return null;
    },
    loadProjectFromFile: async (filePath) => {
      calls.push('load-project');
      if (config.loadProjectFails) {
        return { ok: false, message: `cannot parse ${filePath}` };
      }
      return { ok: true, project: { xml: fs.readFileSync(filePath, 'utf8') } };
    },
    isSameFileAsCurrent: (finalContentPath) => {
      calls.push('same-file-check');
      void finalContentPath;
      return false;
    },
    confirmLibraryDraftTransition: () => {
      calls.push('library-draft-gate');
      return config.libraryDraftConfirms ?? true;
    },
    confirmSaveBeforeReplace: () => {
      calls.push('save-gate');
      return config.saveConfirms ?? true;
    },
    getCurrentContentRoot: () => contentRoot,
    installParsedProject: (_project, finalContentPath) => {
      calls.push(`install:${nodePath.relative(contentRoot, finalContentPath).split(nodePath.sep).join('/')}`);
      if (installThrowsActive) {
        throw new Error('install pipeline exploded');
      }
    },
    reportBlockedLibrary: (diagnostic) => {
      calls.push(`blocked:${diagnostic}`);
    },
    reportRejectedSelection: (selectedPath) => {
      calls.push(`rejected-selection:${nodePath.basename(selectedPath)}`);
    },
    reportPreparationFailure: (message) => {
      calls.push(`prep-failure:${message}`);
      return false;
    },
    reportProjectLoadFailure: (message) => {
      calls.push(`load-failure:${message.slice(0, 20)}`);
    },
    reportPostCommitInstallFailure: (message) => {
      calls.push(`post-commit-install-failure:${message}`);
    },
  };

  function expectNoStagingLeft(): void {
    const leftovers = fs.existsSync(libraryRoot)
      ? fs.readdirSync(libraryRoot).filter((name) => name.startsWith('staging-'))
      : [];
    expect(leftovers).toEqual([]);
  }

  function factoryDigest(): string {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(nodePath.join(factoryRoot, 'demos', 'sine.blue')));
    hash.update(fs.readFileSync(nodePath.join(factoryRoot, 'media', 'loop.wav')));
    return hash.digest('hex');
  }

  return {
    deps,
    calls,
    factoryDigest,
    contentRoot,
    libraryRoot,
    outsideSelectionTarget: outsideProject,
    expectNoStagingLeft,
    setInstallThrows: (active: boolean) => {
      installThrowsActive = active;
    },
    /** Promote the installed factory content to a different revision. */
    mutateFactoryToRevisionB: () => {
      fs.writeFileSync(nodePath.join(factoryRoot, 'media', 'loop.wav'), 'RIFF-B2', 'utf8');
      fs.mkdirSync(nodePath.join(factoryRoot, 'brand-new'), { recursive: true });
      fs.writeFileSync(
        nodePath.join(factoryRoot, 'brand-new', 'welcome.blue'),
        '<project>WELCOME</project>',
        'utf8',
      );
      provider.clearForTesting();
    },
    /** Force the next picker to hand back this exact path. */
    setSelection: (selectedPath: string | null) => {
      config.pickerSelection = selectedPath;
      delete (config as { pickerSelectionOutsideRoot?: boolean }).pickerSelectionOutsideRoot;
    },
    /** Force the next picker to hand back a path derived from its root. */
    setDynamicSelection: (
      choose: (defaultRoot: string) => string | null,
    ): void => {
      config.pickerSelection = choose;
    },
    /** Register the same-file predicate used by the no-op check. */
    setSameFileAsCurrent: (
      predicate: (finalContentPath: string) => boolean,
    ): void => {
      deps.isSameFileAsCurrent = (finalContentPath) => {
        calls.push('same-file-check');
        return predicate(finalContentPath);
      };
    },
    getLiveCandidate: () => liveCandidate,
    getLastConflictReport: () => lastConflictReport,
    writeUserCopyEdit: () => {
      fs.writeFileSync(
        nodePath.join(contentRoot, 'demos', 'sine.blue'),
        '<project>edited-by-user</project>',
        'utf8',
      );
    },
  };
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'blue-flow-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = '';
});

describe('open-example flow · first use', () => {
  it('copies, picks from the candidate, and commits through every replacement gate in order', async () => {
    const h = createFlowHarness({ libraryDraftConfirms: true, saveConfirms: true });

    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('committed');

    const relevantStages = h.calls.filter((call) =>
      [
        'recover-inspect',
        'choose-first-use',
        'prepare-copy',
        'commit-candidate',
        'picker:',
        'resolve-selection',
        'load-project',
        'library-draft-gate',
        'save-gate',
        'install:demos/sine.blue',
        'discard',
      ].some((marker) => call.startsWith(marker)),
    );
    expect(relevantStages).toEqual([
      'recover-inspect',
      'choose-first-use',
      'prepare-copy',
      'picker:candidate',
      'resolve-selection',
      'load-project',
      'library-draft-gate',
      'save-gate',
      'commit-candidate',
      'install:demos/sine.blue',
      'discard',
    ]);

    expect(
      fs.existsSync(nodePath.join(h.contentRoot, 'media', 'loop.wav')),
    ).toBe(true);
    h.expectNoStagingLeft();

    // The installed path mapping points into the user-owned content root.
    const installedCall = h.calls.find((call) => call.startsWith('install:'));
    expect(installedCall).toBe('install:demos/sine.blue');
  });

  it('cancels cleanly when the first-use copy is declined', async () => {
    const h = createFlowHarness({ firstUseCopyChoice: false });
    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('cancelled');
    expect(h.calls).not.toContain('prepare-copy');
    expect(h.calls.some((c) => c.startsWith('picker'))).toBe(false);
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    h.expectNoStagingLeft();
  });

  it('aborts the candidate when the picker is cancelled', async () => {
    const h = createFlowHarness({ pickerSelection: null });
    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('cancelled');
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    h.expectNoStagingLeft();
  });

  it.each([
    ['library-draft gate', { libraryDraftConfirms: false }, 'blocked'],
    ['save gate', { saveConfirms: false }, 'blocked'],
  ] as const)('blocks at the %s and aborts the uncommitted candidate', async (_label, overrides, expectedStatus) => {
    const h = createFlowHarness({ ...overrides });
    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe(expectedStatus);
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    h.expectNoStagingLeft();
  });

  it('guides, re-opens the picker after an out-of-root pick, and cancels cleanly', async () => {
    const h = createFlowHarness({ pickerSelectionOutsideRoot: true });
    fs.mkdirSync(nodePath.dirname(h.outsideSelectionTarget), { recursive: true });
    fs.writeFileSync(h.outsideSelectionTarget, '<project>not-an-example</project>', 'utf8');

    let visits = 0;
    const baseShowPicker = h.deps.showProjectPicker;
    h.deps.showProjectPicker = async (defaultRoot) => {
      visits += 1;
      return visits === 1 ? baseShowPicker(defaultRoot) : null;
    };

    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('cancelled');
    expect(h.calls.some((call) => call.startsWith('rejected-selection:outside.dark'))).toBe(true);
    expect(h.calls).not.toContain('load-project');
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    h.expectNoStagingLeft();
  });

  it('reports parse failures and leaves both library and workspace untouched', async () => {
    const h = createFlowHarness({ loadProjectFails: true });
    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('cancelled');
    expect(h.calls.some((call) => call.startsWith('load-failure:cannot parse'))).toBe(true);
    expect(fs.existsSync(nodePath.join(h.libraryRoot, 'current'))).toBe(false);
    h.expectNoStagingLeft();
  });

  it('keeps the committed library when installation unexpectedly fails afterwards', async () => {
    const h = createFlowHarness({ installThrows: true });
    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('cancelled');
    expect(
      h.calls.some((call) => call.startsWith('post-commit-install-failure:install pipeline exploded')),
    ).toBe(true);
    // The accepted example-library update stands and is recoverable.
    expect(fs.existsSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'))).toBe(true);
    h.expectNoStagingLeft();

    // Reopening now takes the silent ready path to the same project.
    h.writeUserCopyEdit();
    h.setInstallThrows(false);
    h.setSelection(nodePath.join(h.contentRoot, 'demos', 'sine.blue'));
    h.setSameFileAsCurrent((finalContentPath) =>
      finalContentPath === nodePath.join(h.contentRoot, 'demos', 'sine.blue'));
    const reopen = await runOpenExampleProjectFlow(h.deps);
    expect(reopen.status).toBe('no-op');
  });
});

describe('open-example flow · persistent user copy preference (US2)', () => {
  it('silently reopens from current content without any prompt or second copy', async () => {
    // Establish library first.
    const h = createFlowHarness({});
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    h.writeUserCopyEdit();
    h.setSelection(nodePath.join(h.contentRoot, 'demos', 'sine.blue'));
    h.setSameFileAsCurrent(
      (final) => final === nodePath.join(h.contentRoot, 'demos', 'sine.blue'),
    );

    // Clear stage log so assertions read only the REOPEN actions.
    h.calls.length = 0;
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'no-op' });

    expect(h.calls.some((call) => call.startsWith('choose-first-use'))).toBe(false);
    expect(h.calls.some((call) => call.startsWith('prepare-copy'))).toBe(false);
    expect(h.calls.filter((call) => call === 'picker:current')).toHaveLength(1);

    // Exactly one generation remains; the edited example is intact on disk.
    h.expectNoStagingLeft();
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'demos', 'sine.blue'), 'utf8'),
    ).toBe('<project>edited-by-user</project>');
  });

  it('keeps the packaged factory byte-identical through reopen, edit, and beside-project render work', async () => {
    const h = createFlowHarness({});
    const baselineDigest = h.factoryDigest();

    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');
    h.writeUserCopyEdit();

    // Simulate disk render: tempCsd placed BESIDE the copied project.
    fs.writeFileSync(
      nodePath.join(h.contentRoot, 'demos', 'tempCsd-rehearsal.csd'),
      '<CsoundSynthesizer/>',
      'utf8',
    );
    // And an unrelated save artifact created next to the media directory.
    fs.mkdirSync(nodePath.join(h.contentRoot, 'user-notes'), { recursive: true });
    fs.writeFileSync(nodePath.join(h.contentRoot, 'user-notes', 'notes.txt'), 'mine');

    h.setSelection(nodePath.join(h.contentRoot, 'demos', 'sine.blue'));
    h.setSameFileAsCurrent(() => true);
    h.calls.length = 0;
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'no-op' });

    expect(h.factoryDigest()).toBe(baselineDigest);

    // The installation tree contains ONLY the original two files — zero
    // application-created artifacts appeared there during any of this.
    const factoryBase = nodePath.join(tempRoot, 'installation', 'examples');
    function listInstallation(rootDir: string): string[] {
      return fs.readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? listInstallation(nodePath.join(rootDir, entry.name))
          : [
              nodePath
                .relative(factoryBase, nodePath.join(rootDir, entry.name))
                .split(nodePath.sep)
                .join('/'),
            ],
      );
    }
    expect(listInstallation(factoryBase).sort()).toEqual([
      'demos/sine.blue',
      'media/loop.wav',
    ]);
  });

  it('suppresses repeated update offers after declining once, still opening silently (SC-004 seed)', async () => {
    const h = createFlowHarness({ updateOfferChoice: 'cancel' });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');
    // revision unchanged → ready path; even with cancel-style offer config,
    // choose-update-offer must never fire when inspection says ready.
    h.setSelection(nodePath.join(h.contentRoot, 'demos', 'sine.blue'));
    h.setSameFileAsCurrent(() => true);
    h.calls.length = 0;
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'no-op' });
    expect(h.calls.some((call) => call.startsWith('choose-update-offer'))).toBe(false);
  });
});

describe('open-example flow · updates and declines (US3)', () => {
  it('accepts the equivalent stable-library path returned by macOS during a staged update', async () => {
    const h = createFlowHarness({
      updateOfferChoice: 'update-and-open',
      continueDespiteConflicts: true,
    });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    h.mutateFactoryToRevisionB();
    h.calls.length = 0;
    h.setSelection(nodePath.join(h.contentRoot, 'demos', 'sine.blue'));

    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('committed');
    expect(h.calls).toContain('resolve-selection');
    expect(h.calls.some((call) => call.startsWith('rejected-selection:'))).toBe(false);
    expect(h.calls).toContain('install:demos/sine.blue');
    expect(h.calls.indexOf('commit-candidate')).toBeGreaterThan(
      h.calls.indexOf('load-project'),
    );
  }, 20000);

  it('Update and Open makes newly added examples selectable in the same session (SC-007)', async () => {
    const h = createFlowHarness({ updateOfferChoice: 'update-and-open', continueDespiteConflicts: true });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    // A user edit + changed factory bytes yields a preserved-conflict case.
    fs.writeFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'RIFF-MY-EDIT', 'utf8');
    h.mutateFactoryToRevisionB();

    // The picker reads the complete staged tree, then the accepted selection
    // commits to the stable current root (SC-007).
    h.calls.length = 0;
    h.setDynamicSelection(
      (defaultRoot) => nodePath.join(defaultRoot, 'brand-new', 'welcome.blue'),
    );
    h.setSameFileAsCurrent(() => false);
    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('committed');
    expect(h.calls).toContain('choose-update-offer');
    expect(h.calls.indexOf('commit-candidate')).toBeGreaterThan(-1);
    expect(h.calls.indexOf('commit-candidate')).toBeGreaterThan(
      h.calls.findIndex((call) => call.startsWith('picker:')),
    );
    expect(h.calls.some((call) => call.startsWith('picker:candidate'))).toBe(true);
    expect(h.calls).toContain('install:brand-new/welcome.blue');

    // User-modified media survives even though revision B changed it too
    // (SC-005); the newly added example arrives regardless (SC-007).
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'utf8'),
    ).toBe('RIFF-MY-EDIT');
    expect(
      fs.existsSync(nodePath.join(h.contentRoot, 'brand-new', 'welcome.blue')),
    ).toBe(true);

    // The accepted revision stops prompting afterwards.
    h.calls.length = 0;
    h.setSelection(nodePath.join(h.contentRoot, 'demos', 'sine.blue'));
    h.setSameFileAsCurrent(() => true);
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'no-op' });
    expect(h.calls.some((call) => call.startsWith('choose-update-offer'))).toBe(false);
  }, 20000);

  it('Keep Current records the decline, opens current content, and stops re-prompting', async () => {
    const h = createFlowHarness({ updateOfferChoice: 'keep-current-and-open' });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    h.mutateFactoryToRevisionB();
    h.setSelection(null); // decline then cancel at picker is allowed
    h.calls.length = 0;
    const declinedRun = await runOpenExampleProjectFlow(h.deps);
    expect(declinedRun.status).toBe('cancelled');
    expect(h.calls).toContain('record-keep-current');
    expect(h.calls.some((call) => call.startsWith('picker:current'))).toBe(true);
    // Existing generation untouched by Keep Current.
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'utf8'),
    ).toBe('RIFF');

    // Reopen at the SAME revision: silent fast path, no second offer.
    h.calls.length = 0;
    h.setSelection(nodePath.join(h.contentRoot, 'demos', 'sine.blue'));
    h.setSameFileAsCurrent(() => true);
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'no-op' });
    expect(h.calls.some((call) => call.startsWith('choose-update-offer'))).toBe(false);
  }, 20000);

  it('fails closed when Keep Current cannot persist the declined revision', async () => {
    const h = createFlowHarness({
      updateOfferChoice: 'keep-current-and-open',
      declineWriteFails: true,
    });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');
    h.mutateFactoryToRevisionB();
    h.calls.length = 0;

    const result = await runOpenExampleProjectFlow(h.deps);

    expect(result.status).toBe('cancelled');
    expect(h.calls).toContain('record-keep-current');
    expect(h.calls).toContain('prep-failure:decline write failed');
    expect(h.calls.some((call) => call.startsWith('picker:'))).toBe(false);
  }, 20000);

  it('cancelling the update offer neither mutates nor records anything', async () => {
    const h = createFlowHarness({ updateOfferChoice: 'cancel' });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    h.mutateFactoryToRevisionB();
    h.calls.length = 0;
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'cancelled' });

    expect(h.calls).toContain('choose-update-offer');
    expect(h.calls.some((call) => call.startsWith('prepare-copy'))).toBe(false);
    expect(h.calls).not.toContain('record-keep-current');
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'utf8'),
    ).toBe('RIFF');
    h.expectNoStagingLeft();
  }, 20000);

  it('declining to continue past preserved conflicts aborts the prepared candidate', async () => {
    const h = createFlowHarness({
      updateOfferChoice: 'update-and-open',
      continueDespiteConflicts: false,
    });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    fs.writeFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'RIFF-MY-EDIT', 'utf8');
    h.mutateFactoryToRevisionB();

    h.calls.length = 0;
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'cancelled' });

    expect(h.calls).toContain('choose-conflicts');
    expect(h.getLastConflictReport()).toEqual({
      total: 1,
      samples: ['media/loop.wav'],
    });
    expect(h.calls.filter((call) => call === 'discard').length).toBeGreaterThanOrEqual(1);
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'utf8'),
    ).toBe('RIFF-MY-EDIT');
    h.expectNoStagingLeft();
  }, 20000);

  it('blocks on an invalid library without offering destructive actions (quickstart §3B guard)', async () => {
    const h = createFlowHarness({});
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');
    h.writeUserCopyEdit();

    // Corrupt provenance beneath valid content — mutation must be blocked.
    fs.writeFileSync(
      nodePath.join(h.libraryRoot, 'current', 'state.json'),
      '{"schemaVersion":999}',
      'utf8',
    );
    h.calls.length = 0;
    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'blocked' });
    expect(h.calls.some((call) => call.startsWith('blocked:'))).toBe(true);
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'demos', 'sine.blue'), 'utf8'),
    ).toBe('<project>edited-by-user</project>');
  }, 20000);
});

describe('open-example flow · bounded recovery retries', () => {
  it('restarts recovery and inspection after a retryable preparation failure', async () => {
    const h = createFlowHarness({});
    const prepare = h.deps.prepareFirstUseCopy;
    let attempts = 0;
    h.deps.prepareFirstUseCopy = async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, code: 'io-error', message: 'temporary failure', retryable: true };
      }
      return prepare();
    };
    h.deps.reportPreparationFailure = () => true;

    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'committed' });
    expect(attempts).toBe(2);
    expect(h.calls.filter((call) => call === 'recover-inspect')).toHaveLength(2);
  });

  it('stops after the bounded retry when the failure repeats', async () => {
    const h = createFlowHarness({});
    let attempts = 0;
    h.deps.prepareFirstUseCopy = async () => {
      attempts += 1;
      return { ok: false, code: 'io-error', message: 'still failing', retryable: true };
    };
    h.deps.reportPreparationFailure = () => true;

    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'failed' });
    expect(attempts).toBe(2);
    expect(h.calls.filter((call) => call === 'recover-inspect')).toHaveLength(2);
  });
});

describe('open-example flow · conflict detail', () => {
  it('formats a deterministic bounded path list and total', () => {
    expect(formatExampleConflictDetail({
      total: 11,
      samples: ['a/example.blue', 'b/media.wav'],
    })).toBe('11 files need attention.\n\na/example.blue\nb/media.wav\n…and 9 more.');
  });

  it('wires the formatted report into the native confirmation detail', () => {
    const mainSource = fs.readFileSync(nodePath.join(__dirname, 'main.ts'), 'utf8');
    expect(mainSource).toContain('chooseContinueDespiteUpdateConflicts: async (report)');
    expect(mainSource).toContain('detail: formatExampleConflictDetail(report)');
  });
});

describe('open-example flow · active-example safety before library swaps (spec edge case)', () => {
  it('runs save/discard protection before an update swap and aborts on cancel', async () => {
    const h = createFlowHarness({
      updateOfferChoice: 'update-and-open',
      continueDespiteConflicts: true,
      activeExampleSafe: false, // user cancels the safety decision
    });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    h.mutateFactoryToRevisionB();
    h.calls.length = 0;

    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'cancelled' });

    expect(h.calls).toContain('active-example-safety');
    expect(h.calls).not.toContain('commit-candidate');
    // Library untouched by the aborted swap.
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'utf8'),
    ).toBe('RIFF');
    h.expectNoStagingLeft();
  }, 20000);

  it('proceeds with the swap when the safety decision is confirmed', async () => {
    const h = createFlowHarness({
      updateOfferChoice: 'update-and-open',
      continueDespiteConflicts: true,
      activeExampleSafe: true,
    });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    h.mutateFactoryToRevisionB();
    h.setDynamicSelection((root) => nodePath.join(root, 'demos', 'sine.blue'));
    h.setSameFileAsCurrent(() => true);
    h.calls.length = 0;

    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'committed' });

    expect(h.calls).toContain('active-example-safety');
    expect(h.calls).toContain('commit-candidate');
    // Factory revision B landed in the user library.
    expect(
      fs.readFileSync(nodePath.join(h.contentRoot, 'media', 'loop.wav'), 'utf8'),
    ).toBe('RIFF-B2');
  }, 20000);
});

describe('open-example flow · picker containment', () => {
  it('rejects a factory-tree pick and reopens with Open Project guidance', async () => {
    const h = createFlowHarness({});
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    // Simulate the library-committed reopen where the user's panel is still
    // showing a factory/stale location and they pick there.
    const staleRoot = nodePath.join(tempRoot, 'installation', 'examples');
    const stalePick = nodePath.join(staleRoot, 'demos', 'sine.blue');
    const inLibraryPick = nodePath.join(h.contentRoot, 'demos', 'sine.blue');
    let pickerVisits = 0;
    h.deps.showProjectPicker = async () => {
      pickerVisits += 1;
      return pickerVisits === 1 ? stalePick : inLibraryPick;
    };
    h.setSameFileAsCurrent(() => false);
    h.calls.length = 0;

    const result = await runOpenExampleProjectFlow(h.deps);
    expect(result.status).toBe('committed');
    expect(h.calls).toContain('install:demos/sine.blue');
    expect(h.calls).toContain('rejected-selection:sine.blue');
    expect(pickerVisits).toBe(2);
  }, 20000);

  it('shows guidance and re-opens the picker when a pick cannot be mapped', async () => {
    const h = createFlowHarness({ libraryDraftConfirms: true, saveConfirms: true });
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    const foreignPick = nodePath.join(tempRoot, 'unrelated', 'thing.blue');
    fs.mkdirSync(nodePath.dirname(foreignPick), { recursive: true });
    fs.writeFileSync(foreignPick, '<project>elsewhere</project>', 'utf8');

    let pickerVisits = 0;
    h.setSelection(foreignPick);
    // Second visit hands back a legitimate in-library example.
    const inLibraryPick = nodePath.join(h.contentRoot, 'demos', 'sine.blue');
    h.deps.showProjectPicker = async () => {
      pickerVisits += 1;
      return pickerVisits === 1 ? foreignPick : inLibraryPick;
    };
    h.setSameFileAsCurrent(() => false);
    h.calls.length = 0;

    const result = await runOpenExampleProjectFlow(h.deps);
    expect(result.status).toBe('committed');
    expect(h.calls.filter((call) => call.startsWith('rejected-selection:')).length).toBe(1);
    expect(pickerVisits).toBe(2);
    expect(h.calls).toContain('install:demos/sine.blue');
  }, 20000);

  it('ends cancelled when the user walks away after guidance', async () => {
    const h = createFlowHarness({});
    expect((await runOpenExampleProjectFlow(h.deps)).status).toBe('committed');

    const foreignPick = nodePath.join(tempRoot, 'unrelated2', 'thing.blue');
    fs.mkdirSync(nodePath.dirname(foreignPick), { recursive: true });
    fs.writeFileSync(foreignPick, '<project>x</project>', 'utf8');

    let visits = 0;
    h.setSelection(null);
    const baseShowPicker = h.deps.showProjectPicker;
    h.deps.showProjectPicker = async (defaultRoot) => {
      visits += 1;
      if (visits === 1) return foreignPick;
      return baseShowPicker(defaultRoot); // null on second visit → cancel
    };
    h.calls.length = 0;

    expect(await runOpenExampleProjectFlow(h.deps)).toMatchObject({ status: 'cancelled' });
    expect(h.calls.filter((call) => call.startsWith('rejected-selection:')).length).toBe(1);
  }, 20000);
});
