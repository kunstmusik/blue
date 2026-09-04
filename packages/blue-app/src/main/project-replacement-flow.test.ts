import { describe, expect, it, vi } from 'vitest';
import {
  runReplacementFlow,
  runProjectFileReplacement,
  resolveReplacementSaveDecision,
  runTransactionalSaveAs,
  type ReplacementFlowCallbacks,
  type ReplacementFlowOutcome,
} from './project-replacement-flow';
import { runMidiImportReplacement } from './project-replacement-entry-points';
import { isSameProjectPathIdentity } from './project-path';

interface StubTarget {
  kind: 'project-file' | 'import';
  name: string;
}

function createStubFlow(
  overrides: Partial<ReplacementFlowCallbacks<StubTarget>> = {},
): ReplacementFlowCallbacks<StubTarget> & { calls: string[] } {
  const calls: string[] = [];
  const flow: ReplacementFlowCallbacks<StubTarget> & { calls: string[] } = {
    calls,
    preflight: vi.fn(async () => {
      calls.push('preflight');
      return true;
    }),
    prepare: vi.fn(async (): Promise<StubTarget | null> => {
      calls.push('prepare');
      return { kind: 'project-file', name: 'prepared.blue' };
    }),
    confirmSave: vi.fn(async () => {
      calls.push('confirmSave');
      return true;
    }),
    confirmLibraryDraft: vi.fn(async () => {
      calls.push('confirmLibraryDraft');
      return true;
    }),
    commit: vi.fn(async () => {
      calls.push('commit');
    }),
    ...overrides,
  };
  return flow;
}

function expectOutcome(
  outcome: ReplacementFlowOutcome,
  status: ReplacementFlowOutcome['status'],
): void {
  expect(outcome).toEqual({ status });
}

describe('runReplacementFlow', () => {
  it('commits exactly once through the full ordered stage sequence', async () => {
    const flow = createStubFlow();
    const outcome = await runReplacementFlow(flow);

    expectOutcome(outcome, 'committed');
    expect(flow.calls).toEqual([
      'preflight',
      'prepare',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'commit',
    ]);
    expect(flow.commit).toHaveBeenCalledTimes(1);
  });

  it('returns cancelled before prepare when preflight fails', async () => {
    const flow = createStubFlow({ preflight: vi.fn(async () => false) });
    const outcome = await runReplacementFlow(flow);

    expectOutcome(outcome, 'cancelled');
    expect(flow.prepare).not.toHaveBeenCalled();
    expect(flow.confirmSave).not.toHaveBeenCalled();
    expect(flow.commit).not.toHaveBeenCalled();
  });

  it('returns cancelled without confirmation when prepare yields no target', async () => {
    const flow = createStubFlow({ prepare: vi.fn(async () => null) });
    const outcome = await runReplacementFlow(flow);

    expectOutcome(outcome, 'cancelled');
    expect(flow.confirmSave).not.toHaveBeenCalled();
    expect(flow.confirmLibraryDraft).not.toHaveBeenCalled();
    expect(flow.commit).not.toHaveBeenCalled();
  });

  it('propagates preparation errors without confirming or committing', async () => {
    const flow = createStubFlow({
      prepare: vi.fn(async () => {
        throw new Error('malformed project');
      }),
    });

    await expect(runReplacementFlow(flow)).rejects.toThrow('malformed project');
    expect(flow.confirmSave).not.toHaveBeenCalled();
    expect(flow.commit).not.toHaveBeenCalled();
  });

  it('treats a no-op target as terminal before commit re-check and prompts', async () => {
    const flow = createStubFlow({ isNoOp: () => true });
    const outcome = await runReplacementFlow(flow);

    expectOutcome(outcome, 'no-op');
    expect(flow.calls).toEqual(['preflight', 'prepare']);
    expect(flow.commit).not.toHaveBeenCalled();
  });

  it('skips the no-op stage when no detector is supplied', async () => {
    const flow = createStubFlow();
    delete (flow as Partial<ReplacementFlowCallbacks<StubTarget>>).isNoOp;

    const outcome = await runReplacementFlow(flow);
    expectOutcome(outcome, 'committed');
  });

  it('returns cancelled after preparation when the commit preflight fails', async () => {
    const flow = createStubFlow();
    let preflightCalls = 0;
    flow.preflight = vi.fn(async () => {
      preflightCalls += 1;
      flow.calls.push('preflight');
      return preflightCalls === 1;
    });
    const outcome = await runReplacementFlow(flow);

    expectOutcome(outcome, 'cancelled');
    expect(flow.calls).toEqual(['preflight', 'prepare', 'preflight']);
    expect(flow.confirmSave).not.toHaveBeenCalled();
    expect(flow.commit).not.toHaveBeenCalled();
  });

  it('blocks replacement when the save decision is declined', async () => {
    const flow = createStubFlow({ confirmSave: vi.fn(async () => false) });
    const outcome = await runReplacementFlow(flow);

    expectOutcome(outcome, 'blocked');
    expect(flow.confirmLibraryDraft).toHaveBeenCalledTimes(1);
    expect(flow.commit).not.toHaveBeenCalled();
  });

  it('blocks replacement when the library-draft decision is declined', async () => {
    const flow = createStubFlow({ confirmLibraryDraft: vi.fn(async () => false) });
    const outcome = await runReplacementFlow(flow);

    expectOutcome(outcome, 'blocked');
    expect(flow.commit).not.toHaveBeenCalled();
  });

  it('passes the prepared target to confirmation and commit untouched', async () => {
    const prepared: StubTarget = { kind: 'import', name: 'imported.csd' };
    const seen: StubTarget[] = [];
    const flow = createStubFlow({
      prepare: vi.fn(async () => prepared),
      confirmSave: vi.fn(async (target) => {
        seen.push(target);
        return true;
      }),
      commit: vi.fn(async (target) => {
        seen.push(target);
      }),
    });

    await runReplacementFlow(flow);
    expect(seen).toEqual([prepared, prepared]);
    expect(JSON.stringify(seen[0])).toBe(JSON.stringify(prepared));
  });
});

describe('runProjectFileReplacement', () => {
  interface ProjectFileHarness {
    calls: string[];
    currentPath: string | null;
    currentProject: object | null;
    readProject: (filePath: string) => string;
  }

  function createHarness(
    options: {
      selectedPath?: string | null;
      currentPath?: string | null;
      confirmSave?: () => Promise<boolean> | boolean;
      confirmLibraryDraft?: () => Promise<boolean> | boolean;
      renderActive?: () => boolean;
    } = {},
  ) {
    const harness: ProjectFileHarness = {
      calls: [],
      currentPath: options.currentPath ?? null,
      currentProject: options.currentPath ? { existing: true } : null,
      readProject: (filePath: string) => `<blue data for ${filePath}>`,
    };

    let renderChecks = 0;
    const renderActive = options.renderActive ?? (() => true);

    const outcome = runProjectFileReplacement({
      selectFile: async () => {
        harness.calls.push('chooser');
        return options.selectedPath === undefined ? '/work/selected.blue' : options.selectedPath;
      },
      readFile: (filePath) => {
        harness.calls.push(`read:${filePath}`);
        return harness.readProject(filePath);
      },
      parseProject: async (xml) => {
        harness.calls.push('parse');
        return { parsed: xml } as unknown as never;
      },
      isSameFile: (filePath) => {
        harness.calls.push('same-file-check');
        return (
          harness.currentPath !== null && isSameProjectPathIdentity(filePath, harness.currentPath)
        );
      },
      preflight: async () => {
        renderChecks += 1;
        harness.calls.push(`preflight:${renderChecks}`);
        return renderActive();
      },
      confirmSave: async () => {
        harness.calls.push('confirmSave');
        return options.confirmSave ? await options.confirmSave() : true;
      },
      confirmLibraryDraft: async () => {
        harness.calls.push('confirmLibraryDraft');
        return options.confirmLibraryDraft ? await options.confirmLibraryDraft() : true;
      },
      commit: async () => {
        harness.calls.push('commit');
      },
    });

    return { harness, run: () => outcome };
  }

  it('runs chooser, read, parse, and prompts in order before a single commit', async () => {
    const { harness, run } = createHarness({ currentPath: '/work/current.blue' });
    const outcome = await run();

    expectOutcome(outcome, 'committed');
    expect(harness.calls).toEqual([
      'preflight:1',
      'chooser',
      'read:/work/selected.blue',
      'parse',
      'same-file-check',
      'preflight:2',
      'confirmLibraryDraft',
      'confirmSave',
      'commit',
    ]);
  });

  it('returns cancelled after chooser cancellation without replacement prompts', async () => {
    const { harness, run } = createHarness({
      selectedPath: null,
      currentPath: '/work/current.blue',
    });
    const outcome = await run();

    expectOutcome(outcome, 'cancelled');
    expect(harness.calls).toEqual(['preflight:1', 'chooser']);
  });

  it('propagates malformed-target failures before any replacement prompt', async () => {
    const { harness, run } = createHarness({ currentPath: '/work/current.blue' });
    harness.readProject = () => {
      throw new Error('ENOENT');
    };

    await expect(run()).rejects.toThrow('ENOENT');
    expect(harness.calls).toEqual(['preflight:1', 'chooser', 'read:/work/selected.blue']);
  });

  it('treats a canonically identical current-project path as a no-op', async () => {
    const { harness, run } = createHarness({
      currentPath: '/work/current.blue',
      selectedPath: '/work/./sub/../current.blue',
    });
    const outcome = await run();

    expectOutcome(outcome, 'no-op');
    expect(harness.calls).toEqual([
      'preflight:1',
      'chooser',
      'read:/work/./sub/../current.blue',
      'parse',
      'same-file-check',
    ]);
    expect(harness.currentProject).toEqual({ existing: true });
  });

  it('does not treat a merely similar path as the current project', async () => {
    const { harness, run } = createHarness({
      currentPath: '/work/current.blue',
      selectedPath: '/work/current-copy.blue',
    });
    const outcome = await run();

    expectOutcome(outcome, 'committed');
  });

  it('blocks on render-active preflight before the chooser', async () => {
    const { harness, run } = createHarness({
      currentPath: '/work/current.blue',
      renderActive: () => false,
    });
    const outcome = await run();

    expectOutcome(outcome, 'cancelled');
    expect(harness.calls).toEqual(['preflight:1']);
  });

  it('blocks on the commit-point render re-check without prompting', async () => {
    let renderChecks = 0;
    const { harness, run } = createHarness({
      currentPath: '/work/current.blue',
      renderActive: () => {
        renderChecks += 1;
        return renderChecks === 1;
      },
    });
    const outcome = await run();

    expectOutcome(outcome, 'cancelled');
    expect(harness.calls).toEqual([
      'preflight:1',
      'chooser',
      'read:/work/selected.blue',
      'parse',
      'same-file-check',
      'preflight:2',
    ]);
  });

  it('covers recent and preload paths by selecting a fixed path without a chooser cancel route', async () => {
    const { harness, run } = createHarness({ currentPath: '/work/current.blue' });
    await run();

    expect(harness.calls).toContain('confirmSave');
    expect(harness.calls).toContain('commit');
  });
});

describe('Open Project entry-path matrix (US1: spec FR-003/FR-004/FR-005)', () => {
  type EntryPath = 'native-menu' | 'keyboard-preload' | 'recent-project' | 'open-example';

  interface MatrixCase {
    name: string;
    entry: EntryPath;
    selectedPath: string | null;
    currentPath: string | null;
    confirmSave?: () => Promise<boolean> | boolean;
    renderActive?: () => boolean;
    expectedStatus: 'committed' | 'cancelled' | 'no-op' | 'blocked';
    expectedPrompts: number;
    expectedCommits: number;
    expectRead?: boolean;
    rejects?: RegExp;
  }

  const CASES: MatrixCase[] = [
    {
      name: 'native-menu chooser cancellation shows no replacement prompt',
      entry: 'native-menu',
      selectedPath: null,
      currentPath: '/work/current.blue',
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'keyboard/preload chooser cancellation shows no replacement prompt',
      entry: 'keyboard-preload',
      selectedPath: null,
      currentPath: '/work/current.blue',
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'accepted selection on native-menu prompts exactly once before commit',
      entry: 'native-menu',
      selectedPath: '/work/other.blue',
      currentPath: '/work/current.blue',
      expectedStatus: 'committed',
      expectedPrompts: 1,
      expectedCommits: 1,
      expectRead: true,
    },
    {
      name: 'accepted selection on keyboard/preload follows the same policy',
      entry: 'keyboard-preload',
      selectedPath: '/work/other.blue',
      currentPath: '/work/current.blue',
      expectedStatus: 'committed',
      expectedPrompts: 1,
      expectedCommits: 1,
      expectRead: true,
    },
    {
      name: 'recent project with a canonically identical path is a no-op',
      entry: 'recent-project',
      selectedPath: '/work/sub/../current.blue',
      currentPath: '/work/current.blue',
      expectedStatus: 'no-op',
      expectedPrompts: 0,
      expectedCommits: 0,
      expectRead: true,
    },
    {
      name: 'example project with a different file prompts after preparation',
      entry: 'open-example',
      selectedPath: '/examples/demo.blue',
      currentPath: '/work/current.blue',
      expectedStatus: 'committed',
      expectedPrompts: 1,
      expectedCommits: 1,
      expectRead: true,
    },
    {
      name: 'save-decision cancellation blocks an accepted recent project',
      entry: 'recent-project',
      selectedPath: '/work/other.blue',
      currentPath: '/work/current.blue',
      confirmSave: () => false,
      expectedStatus: 'blocked',
      expectedPrompts: 1,
      expectedCommits: 0,
      expectRead: true,
    },
    {
      name: 'render-active preflight blocks before the chooser',
      entry: 'native-menu',
      selectedPath: '/work/other.blue',
      currentPath: '/work/current.blue',
      renderActive: () => false,
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
  ];

  for (const testCase of CASES) {
    it(`${testCase.entry}: ${testCase.name}`, async () => {
      const calls: string[] = [];
      let chooserOpens = 0;
      let renderChecks = 0;
      const renderActive = testCase.renderActive ?? (() => true);

      const outcome = await runProjectFileReplacement({
        selectFile: async () => {
          chooserOpens += 1;
          calls.push('chooser');
          return testCase.selectedPath;
        },
        readFile: (filePath) => {
          calls.push('read');
          if (filePath === '/work/malformed.blue') {
            throw new Error('cannot parse project');
          }
          return `<blue>${filePath}</blue>`;
        },
        parseProject: async (xml) => {
          calls.push('parse');
          return { xml } as unknown as never;
        },
        isSameFile: (filePath) =>
          testCase.currentPath !== null &&
          isSameProjectPathIdentity(filePath, testCase.currentPath),
        preflight: async () => {
          renderChecks += 1;
          return renderActive();
        },
        confirmSave: async () => {
          calls.push('confirmSave');
          return testCase.confirmSave ? await testCase.confirmSave() : true;
        },
        confirmLibraryDraft: async () => {
          calls.push('confirmLibraryDraft');
          return true;
        },
        commit: async () => {
          calls.push('commit');
        },
      });

      expect(outcome).toEqual({ status: testCase.expectedStatus });
      expect(calls.filter((c) => c === 'confirmSave')).toHaveLength(testCase.expectedPrompts);
      expect(calls.filter((c) => c === 'commit')).toHaveLength(testCase.expectedCommits);
      if (testCase.expectRead !== undefined) {
        expect(calls.includes('read')).toBe(testCase.expectRead);
      }
    });
  }

  it.each([
    ['native-menu', '/work/malformed.blue'],
    ['recent-project', '/work/malformed.blue'],
  ] as const)(
    '%s: malformed target fails before any replacement prompt',
    async (_entry, selectedPath) => {
      const calls: string[] = [];
      await expect(
        runProjectFileReplacement<{ xml: string }>({
          selectFile: () => selectedPath,
          readFile: () => {
            calls.push('read');
            throw new Error('cannot parse project');
          },
          parseProject: (xml) => ({ xml }),
          isSameFile: () => false,
          preflight: () => true,
          confirmSave: () => {
            calls.push('confirmSave');
            return true;
          },
          confirmLibraryDraft: () => true,
          commit: () => {
            calls.push('commit');
          },
        }),
      ).rejects.toThrow('cannot parse project');

      expect(calls).toEqual(['read']);
    },
  );

  it.each([['native-menu'], ['keyboard-preload'], ['recent-project'], ['open-example']] as const)(
    '%s: render becoming active during choosing blocks at the commit re-check',
    async (entry) => {
      void entry;
      let renderChecks = 0;
      const outcome = await runProjectFileReplacement({
        selectFile: () => '/work/other.blue',
        readFile: () => '<blue/>',
        parseProject: (xml) => ({ xml }) as unknown as never,
        isSameFile: () => false,
        preflight: () => {
          renderChecks += 1;
          return renderChecks === 1;
        },
        confirmSave: () => true,
        confirmLibraryDraft: () => true,
        commit: () => undefined,
      });

      expect(outcome).toEqual({ status: 'cancelled' });
      expect(renderChecks).toBe(2);
    },
  );
});

describe('resolveReplacementSaveDecision', () => {
  function createSaveHarness(options: {
    choice?: 'save' | 'discard' | 'cancel';
    hasProject?: boolean;
    hasPath?: boolean;
    saveCurrent?: boolean;
    saveAs?: boolean;
  }) {
    const calls: string[] = [];
    const deps = {
      choose: vi.fn(async () => {
        calls.push('choose');
        return options.choice ?? 'cancel';
      }),
      hasCurrentProject: () => {
        calls.push('hasCurrentProject');
        return options.hasProject ?? true;
      },
      hasCurrentPath: () => options.hasPath ?? true,
      saveCurrent: vi.fn((): boolean => {
        calls.push('saveCurrent');
        return options.saveCurrent ?? true;
      }),
      saveAs: vi.fn(async (): Promise<boolean> => {
        calls.push('saveAs');
        return options.saveAs ?? true;
      }),
    };
    return { deps, calls };
  }

  it('proceeds after a durable save to the current path', async () => {
    const { deps, calls } = createSaveHarness({
      choice: 'save',
      hasProject: true,
      saveCurrent: true,
    });
    await expect(resolveReplacementSaveDecision(deps)).resolves.toBe('saved');
    expect(calls).toEqual(['hasCurrentProject', 'choose', 'saveCurrent']);
    expect(deps.saveAs).not.toHaveBeenCalled();
  });

  it('proceeds without saving when the user discards', async () => {
    const { deps, calls } = createSaveHarness({ choice: 'discard' });
    await expect(resolveReplacementSaveDecision(deps)).resolves.toBe('discarded');
    expect(calls).toEqual(['hasCurrentProject', 'choose']);
  });

  it('returns cancelled when the user cancels the decision', async () => {
    const { deps, calls } = createSaveHarness({ choice: 'cancel' });
    await expect(resolveReplacementSaveDecision(deps)).resolves.toBe('cancelled');
    expect(calls).toEqual(['hasCurrentProject', 'choose']);
  });

  it('requires Save As to succeed for an unsaved current project', async () => {
    const { deps, calls } = createSaveHarness({ choice: 'save', hasProject: true, saveAs: true });
    const unsaved = {
      ...deps,
      hasCurrentPath: () => false,
      saveCurrent: (): boolean => {
        throw new Error('saveCurrent must not be called without a current path');
      },
    };
    await expect(resolveReplacementSaveDecision(unsaved)).resolves.toBe('saved');
    expect(calls).toEqual(['hasCurrentProject', 'choose', 'saveAs']);
  });

  it('blocks when Save As is cancelled or declined', async () => {
    const { deps } = createSaveHarness({ choice: 'save', saveAs: false });
    const withNoPath = { ...deps, hasCurrentPath: () => false };
    await expect(resolveReplacementSaveDecision(withNoPath)).resolves.toBe('blocked');
  });

  it('blocks when the durable write fails', async () => {
    const { deps } = createSaveHarness({ choice: 'save', saveCurrent: false });
    await expect(resolveReplacementSaveDecision(deps)).resolves.toBe('blocked');
  });

  it('skips the decision entirely when no project is open', async () => {
    const { deps, calls } = createSaveHarness({ hasProject: false });
    await expect(resolveReplacementSaveDecision(deps)).resolves.toBe('discarded');
    expect(calls).toEqual(['hasCurrentProject']);
    expect(deps.choose).not.toHaveBeenCalled();
  });
});

describe('runTransactionalSaveAs', () => {
  function createSaveAsHarness(options: { destination?: string | null; writeSucceeds?: boolean }) {
    const calls: string[] = [];
    let publishedPath: string | null = null;
    const deps = {
      chooseDestination: vi.fn(async (): Promise<string | null> => {
        calls.push('chooseDestination');
        return options.destination === undefined ? '/work/new.blue' : options.destination;
      }),
      writeProject: vi.fn((): boolean => {
        calls.push('write');
        return options.writeSucceeds ?? true;
      }),
      publishPath: vi.fn((filePath: string) => {
        calls.push(`publish:${filePath}`);
        publishedPath = filePath;
      }),
    };
    return { deps, calls, getPublishedPath: () => publishedPath };
  }

  it('publishes the new path only after a successful write', async () => {
    const { deps, calls, getPublishedPath } = createSaveAsHarness({
      destination: '/work/new.blue',
    });
    await expect(runTransactionalSaveAs(deps)).resolves.toBe(true);
    expect(calls).toEqual(['chooseDestination', 'write', 'publish:/work/new.blue']);
    expect(getPublishedPath()).toBe('/work/new.blue');
  });

  it('returns false without writing when the save dialog is cancelled or an overwrite is declined', async () => {
    const { deps, calls } = createSaveAsHarness({ destination: null });
    await expect(runTransactionalSaveAs(deps)).resolves.toBe(false);
    expect(calls).toEqual(['chooseDestination']);
  });

  it('keeps the current path stable when the write fails', async () => {
    const { deps, calls, getPublishedPath } = createSaveAsHarness({ writeSucceeds: false });
    await expect(runTransactionalSaveAs(deps)).resolves.toBe(false);
    expect(calls).toEqual(['chooseDestination', 'write']);
    expect(getPublishedPath()).toBeNull();
  });
});

describe('CSD and ORC/SCO import matrix (US2: spec FR-006/FR-007)', () => {
  interface ImportMatrixCase {
    name: string;
    source: 'csd' | 'orc-sco';
    cancelAt: 'chooser' | 'second-chooser' | 'mode' | 'none';
    convertFails?: boolean;
    confirmLibraryDraft?: () => Promise<boolean> | boolean;
    expectedStatus: 'committed' | 'cancelled' | 'blocked';
    expectedPrompts: number;
    expectedCommits: number;
  }

  const CASES: ImportMatrixCase[] = [
    {
      name: 'CSD chooser cancellation shows no replacement prompt',
      source: 'csd',
      cancelAt: 'chooser',
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'CSD mode cancellation shows no replacement prompt',
      source: 'csd',
      cancelAt: 'mode',
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'CSD conversion failure propagates without a replacement prompt',
      source: 'csd',
      cancelAt: 'none',
      convertFails: true,
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'accepted CSD prompts once and commits once',
      source: 'csd',
      cancelAt: 'none',
      expectedStatus: 'committed',
      expectedPrompts: 1,
      expectedCommits: 1,
    },
    {
      name: 'accepted CSD with a declined library draft blocks before commit',
      source: 'csd',
      cancelAt: 'none',
      confirmLibraryDraft: () => false,
      expectedStatus: 'blocked',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'ORC chooser cancellation shows no replacement prompt',
      source: 'orc-sco',
      cancelAt: 'chooser',
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'SCO chooser cancellation shows no replacement prompt',
      source: 'orc-sco',
      cancelAt: 'second-chooser',
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'ORC/SCO mode cancellation shows no replacement prompt',
      source: 'orc-sco',
      cancelAt: 'mode',
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'ORC/SCO conversion failure propagates without a replacement prompt',
      source: 'orc-sco',
      cancelAt: 'none',
      convertFails: true,
      expectedStatus: 'cancelled',
      expectedPrompts: 0,
      expectedCommits: 0,
    },
    {
      name: 'accepted ORC/SCO prompts once and commits once',
      source: 'orc-sco',
      cancelAt: 'none',
      expectedStatus: 'committed',
      expectedPrompts: 1,
      expectedCommits: 1,
    },
  ];

  for (const testCase of CASES) {
    it(testCase.name, async () => {
      const calls: string[] = [];

      const prepare = async (): Promise<{ converted: boolean } | null> => {
        calls.push(`${testCase.source}-chooser`);
        if (testCase.cancelAt === 'chooser') return null;
        if (testCase.source === 'orc-sco') {
          calls.push('sco-chooser');
          if (testCase.cancelAt === 'second-chooser') return null;
        }
        calls.push('mode');
        if (testCase.cancelAt === 'mode') return null;
        calls.push('convert');
        if (testCase.convertFails) {
          throw new Error('invalid CSD content');
        }
        return { converted: true };
      };

      const outcome = await runReplacementFlow({
        preflight: () => true,
        prepare,
        confirmSave: async () => {
          calls.push('confirmSave');
          return true;
        },
        confirmLibraryDraft: async () => {
          calls.push('confirmLibraryDraft');
          return testCase.confirmLibraryDraft ? await testCase.confirmLibraryDraft() : true;
        },
        commit: async () => {
          calls.push('commit');
        },
      }).catch((err: unknown) => {
        if (!testCase.convertFails) {
          throw err;
        }
        expect(err instanceof Error ? err.message : String(err)).toBe('invalid CSD content');
        return { status: 'cancelled' } as const;
      });

      expect(outcome).toEqual({ status: testCase.expectedStatus });
      expect(calls.filter((c) => c === 'confirmSave')).toHaveLength(testCase.expectedPrompts);
      expect(calls.filter((c) => c === 'commit')).toHaveLength(testCase.expectedCommits);
      if (testCase.expectedPrompts > 0) {
        expect(calls.indexOf('confirmSave')).toBeGreaterThan(calls.indexOf('convert'));
      } else {
        expect(calls).not.toContain('confirmSave');
      }
    });
  }

  it('orders the library-draft decision before the save decision', async () => {
    const calls: string[] = [];
    await runReplacementFlow({
      preflight: () => true,
      prepare: () => ({ converted: true }),
      confirmSave: async () => {
        calls.push('confirmSave');
        return true;
      },
      confirmLibraryDraft: async () => {
        calls.push('confirmLibraryDraft');
        return true;
      },
      commit: () => {
        calls.push('commit');
      },
    });

    expect(calls.indexOf('confirmLibraryDraft')).toBeLessThan(calls.indexOf('confirmSave'));
    expect(calls.indexOf('confirmLibraryDraft')).toBeLessThan(calls.indexOf('commit'));
  });
});

describe('MIDI replacement matrix (US3: spec FR-008)', () => {
  interface MidiSession {
    token: string;
    valid: boolean;
  }

  function createMidiFlow(
    session: MidiSession,
    options: {
      confirmSave?: () => Promise<boolean> | boolean;
      confirmLibraryDraft?: () => Promise<boolean> | boolean;
    } = {},
  ) {
    const calls: string[] = [];
    const commitTarget: unknown[] = [];
    const run = () =>
      runMidiImportReplacement<{ built: true }>({
        preflight: () => {
          calls.push('preflight');
          return true;
        },
        prepare: () => {
          calls.push('build');
          return { built: true };
        },
        confirmSave: async () => {
          calls.push('confirmSave');
          return options.confirmSave ? await options.confirmSave() : true;
        },
        confirmLibraryDraft: async () => {
          calls.push('confirmLibraryDraft');
          return options.confirmLibraryDraft ? await options.confirmLibraryDraft() : true;
        },
        revalidate: () => {
          calls.push('revalidate');
          if (!session.valid) {
            throw new Error('The MIDI import session has expired.');
          }
        },
        commit: () => {
          calls.push('commit');
          commitTarget.push(session);
        },
      });
    return { calls, run };
  }

  it('prompts exactly once after preparation and commits the built project', async () => {
    const { calls, run } = createMidiFlow({ token: 't1', valid: true });
    const outcome = await run();

    expect(outcome).toEqual({ status: 'committed' });
    expect(calls).toEqual([
      'preflight',
      'build',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'revalidate',
      'commit',
    ]);
  });

  it('leaves the pending mapping session available when the save decision is cancelled', async () => {
    const session = { token: 't1', valid: true };
    const { calls, run } = createMidiFlow(session, { confirmSave: () => false });
    const outcome = await run();

    expect(outcome).toEqual({ status: 'blocked' });
    expect(calls).toEqual([
      'preflight',
      'build',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
    ]);
    expect(session.valid).toBe(true);
  });

  it('leaves the pending mapping session available when the library decision is cancelled', async () => {
    const session = { token: 't1', valid: true };
    const { calls, run } = createMidiFlow(session, { confirmLibraryDraft: () => false });
    const outcome = await run();

    expect(outcome).toEqual({ status: 'blocked' });
    expect(calls).toEqual(['preflight', 'build', 'preflight', 'confirmLibraryDraft']);
  });

  it('rejects a stale token revalidated after the prompts without committing', async () => {
    const { calls, run } = createMidiFlow({ token: 't1', valid: false });
    await expect(run()).rejects.toThrow('The MIDI import session has expired.');

    expect(calls).toEqual([
      'preflight',
      'build',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'revalidate',
    ]);
  });

  it('never commits twice across retries of the same session', async () => {
    let commitCalls = 0;
    await runReplacementFlow({
      preflight: () => true,
      prepare: () => ({ built: true }),
      confirmSave: () => true,
      confirmLibraryDraft: () => true,
      commit: () => {
        commitCalls += 1;
      },
    });

    expect(commitCalls).toBe(1);
  });
});

describe('Replacement transaction safety (US4: spec FR-010/FR-011/FR-015)', () => {
  interface TransactionHarness {
    calls: string[];
    currentPath: string | null;
    currentDirty: boolean;
    run: () => Promise<ReplacementFlowOutcome>;
  }

  function createTransactionHarness(options: {
    choice: 'save' | 'discard' | 'cancel';
    hasCurrentPath: boolean;
    saveDestination?: string | null;
    writeSucceeds?: boolean;
    confirmLibraryDraft?: () => Promise<boolean> | boolean;
  }): TransactionHarness {
    const calls: string[] = [];
    const harness: TransactionHarness = {
      calls,
      currentPath: options.hasCurrentPath ? '/work/current.blue' : null,
      currentDirty: true,
      run: () =>
        runReplacementFlow<{ prepared: true }>({
          preflight: () => {
            calls.push('preflight');
            return true;
          },
          prepare: () => {
            calls.push('prepare');
            return { prepared: true };
          },
          confirmSave: async () => {
            calls.push('confirmSave');
            const outcome = await resolveReplacementSaveDecision({
              choose: () => options.choice,
              hasCurrentProject: () => true,
              hasCurrentPath: () => options.hasCurrentPath,
              saveCurrent: () => {
                calls.push('saveCurrent');
                const succeeds = options.writeSucceeds ?? true;
                if (succeeds) harness.currentDirty = false;
                return succeeds;
              },
              saveAs: () => {
                calls.push('saveAs');
                return runTransactionalSaveAs({
                  chooseDestination: () => {
                    calls.push('chooseDestination');
                    return options.saveDestination === undefined
                      ? '/work/chosen.blue'
                      : options.saveDestination;
                  },
                  writeProject: () => {
                    calls.push('write');
                    return options.writeSucceeds ?? true;
                  },
                  publishPath: (filePath) => {
                    calls.push(`publish:${filePath}`);
                    harness.currentPath = filePath;
                    harness.currentDirty = false;
                  },
                });
              },
            });
            return outcome === 'saved' || outcome === 'discarded';
          },
          confirmLibraryDraft: () => {
            calls.push('confirmLibraryDraft');
            return options.confirmLibraryDraft ? options.confirmLibraryDraft() : true;
          },
          commit: () => {
            calls.push('commit');
          },
        }),
    };
    return harness;
  }

  it('commits after Save writes the current project durably', async () => {
    const harness = createTransactionHarness({ choice: 'save', hasCurrentPath: true });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'committed' });
    expect(harness.calls).toContain('saveCurrent');
    expect(harness.currentPath).toBe('/work/current.blue');
    expect(harness.currentDirty).toBe(false);
  });

  it('commits after a successful Save As publishes the new path', async () => {
    const harness = createTransactionHarness({
      choice: 'save',
      hasCurrentPath: false,
      saveDestination: '/work/new.blue',
    });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'committed' });
    expect(harness.calls).toEqual([
      'preflight',
      'prepare',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'saveAs',
      'chooseDestination',
      'write',
      'publish:/work/new.blue',
      'commit',
    ]);
    expect(harness.currentPath).toBe('/work/new.blue');
    expect(harness.currentDirty).toBe(false);
  });

  it('blocks and keeps the current path stable when Save As is cancelled', async () => {
    const harness = createTransactionHarness({
      choice: 'save',
      hasCurrentPath: false,
      saveDestination: null,
    });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'blocked' });
    expect(harness.calls).toEqual([
      'preflight',
      'prepare',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'saveAs',
      'chooseDestination',
    ]);
    expect(harness.currentPath).toBeNull();
  });

  it('blocks when the Save As overwrite is declined', async () => {
    const harness = createTransactionHarness({
      choice: 'save',
      hasCurrentPath: false,
      saveDestination: null,
    });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'blocked' });
    expect(harness.calls).not.toContain('commit');
  });

  it('blocks and preserves the current path when the durable write fails', async () => {
    const harness = createTransactionHarness({
      choice: 'save',
      hasCurrentPath: true,
      writeSucceeds: false,
    });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'blocked' });
    expect(harness.calls).toEqual([
      'preflight',
      'prepare',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'saveCurrent',
    ]);
    expect(harness.currentPath).toBe('/work/current.blue');
    expect(harness.currentDirty).toBe(true);
  });

  it('blocks without writing when the decision is cancelled', async () => {
    const harness = createTransactionHarness({ choice: 'cancel', hasCurrentPath: true });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'blocked' });
    expect(harness.calls).toEqual([
      'preflight',
      'prepare',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
    ]);
    expect(harness.currentPath).toBe('/work/current.blue');
  });

  it('commits without writing when the user discards', async () => {
    const harness = createTransactionHarness({ choice: 'discard', hasCurrentPath: true });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'committed' });
    expect(harness.calls).not.toContain('saveCurrent');
    expect(harness.calls).not.toContain('saveAs');
  });

  it('does not save or clear dirty state when the library decision is cancelled', async () => {
    const harness = createTransactionHarness({
      choice: 'save',
      hasCurrentPath: true,
      confirmLibraryDraft: () => false,
    });
    const outcome = await harness.run();

    expect(outcome).toEqual({ status: 'blocked' });
    expect(harness.calls).toEqual(['preflight', 'prepare', 'preflight', 'confirmLibraryDraft']);
    expect(harness.calls).not.toContain('confirmSave');
    expect(harness.calls).not.toContain('saveCurrent');
    expect(harness.currentPath).toBe('/work/current.blue');
    expect(harness.currentDirty).toBe(true);
  });
});

describe('Library-draft timing and state integrity (FR-012/FR-017/FR-019)', () => {
  it('never reaches the save decision after a cancelled library decision', async () => {
    const calls: string[] = [];
    await runReplacementFlow({
      preflight: () => true,
      prepare: () => ({ prepared: true }),
      confirmSave: () => {
        calls.push('confirmSave');
        return true;
      },
      confirmLibraryDraft: () => {
        calls.push('confirmLibraryDraft');
        return false;
      },
      commit: () => {
        calls.push('commit');
      },
    });

    expect(calls).toEqual(['confirmLibraryDraft']);
  });

  it('shows each replacement decision exactly once per accepted target', async () => {
    const saveCalls: number[] = [];
    const libraryCalls: number[] = [];
    await runReplacementFlow({
      preflight: () => true,
      prepare: () => ({ prepared: true }),
      confirmSave: () => {
        saveCalls.push(1);
        return true;
      },
      confirmLibraryDraft: () => {
        libraryCalls.push(1);
        return true;
      },
      commit: () => undefined,
    });

    expect(saveCalls).toHaveLength(1);
    expect(libraryCalls).toHaveLength(1);
  });

  it('keeps the prepared target snapshot unchanged when replacement is blocked', async () => {
    const prepared = { project: '<blue data/>' };
    const frozen = JSON.stringify(prepared);
    await runReplacementFlow({
      preflight: () => true,
      prepare: () => prepared,
      confirmSave: () => false,
      confirmLibraryDraft: () => true,
      commit: () => {
        throw new Error('commit must not run');
      },
    });

    expect(JSON.stringify(prepared)).toBe(frozen);
  });

  it('passes only the parsed project to commit, with no flow or prompt state attached', async () => {
    const parsed = { version: 2, layers: [] };
    let committed: unknown = null;
    await runReplacementFlow({
      preflight: () => true,
      prepare: () => parsed,
      confirmSave: () => true,
      confirmLibraryDraft: () => true,
      commit: (target) => {
        committed = target;
      },
    });

    expect(committed).toBe(parsed);
    expect(Object.keys(committed as object).sort()).toEqual(['layers', 'version']);
  });
});
