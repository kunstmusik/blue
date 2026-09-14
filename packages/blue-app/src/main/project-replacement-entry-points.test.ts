import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BlueData } from '@blue/data';
import {
  runCsdImportReplacement,
  runMidiImportReplacement,
  runNonInteractiveProjectLoad,
  runOrcScoImportReplacement,
} from './project-replacement-entry-points';
import { createProjectLifecycle } from './project-lifecycle';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { resolveProjectSaveDecision } from './project-replacement-flow';

describe('CSD replacement entry point', () => {
  it('runs the native chooser, mode choice, conversion, decisions, and commit in order', async () => {
    const calls: string[] = [];

    const outcome = await runCsdImportReplacement<{ source: string; mode: number }, number>({
      preflight: () => {
        calls.push('preflight');
        return true;
      },
      showSourceDialog: async () => {
        calls.push('source');
        return { canceled: false, filePaths: ['/work/import.csd'] };
      },
      showModeDialog: async () => {
        calls.push('mode');
        return { response: 1 };
      },
      cancelModeResponse: 3,
      readSource: (filePath) => {
        calls.push(`read:${filePath}`);
        return 'csd text';
      },
      convert: (source, mode) => {
        calls.push(`convert:${source}:${mode}`);
        return { source, mode };
      },
      confirmLibraryDraft: () => {
        calls.push('confirmLibraryDraft');
        return true;
      },
      confirmSave: () => {
        calls.push('confirmSave');
        return true;
      },
      commit: (project) => {
        calls.push(`commit:${project.mode}`);
      },
    });

    expect(outcome).toEqual({ status: 'committed' });
    expect(calls).toEqual([
      'preflight',
      'source',
      'mode',
      'read:/work/import.csd',
      'convert:csd text:1',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'commit:1',
    ]);
  });

  it('stops at source or mode cancellation before replacement decisions', async () => {
    const sourceCancelled: string[] = [];
    await runCsdImportReplacement({
      preflight: () => {
        sourceCancelled.push('preflight');
        return true;
      },
      showSourceDialog: async () => {
        sourceCancelled.push('source');
        return { canceled: true, filePaths: [] };
      },
      showModeDialog: async () => {
        sourceCancelled.push('mode');
        return { response: 0 };
      },
      cancelModeResponse: 3,
      readSource: () => {
        sourceCancelled.push('read');
        return '';
      },
      convert: () => {
        sourceCancelled.push('convert');
        return {};
      },
      confirmLibraryDraft: () => {
        sourceCancelled.push('confirmLibraryDraft');
        return true;
      },
      confirmSave: () => {
        sourceCancelled.push('confirmSave');
        return true;
      },
      commit: () => {
        sourceCancelled.push('commit');
      },
    });
    expect(sourceCancelled).toEqual(['preflight', 'source']);

    const modeCancelled: string[] = [];
    const modeOutcome = await runCsdImportReplacement({
      preflight: () => {
        modeCancelled.push('preflight');
        return true;
      },
      showSourceDialog: async () => {
        modeCancelled.push('source');
        return { canceled: false, filePaths: ['/work/import.csd'] };
      },
      showModeDialog: async () => {
        modeCancelled.push('mode');
        return { response: 3 };
      },
      cancelModeResponse: 3,
      readSource: () => {
        modeCancelled.push('read');
        return '';
      },
      convert: () => {
        modeCancelled.push('convert');
        return {};
      },
      confirmLibraryDraft: () => {
        modeCancelled.push('confirmLibraryDraft');
        return true;
      },
      confirmSave: () => {
        modeCancelled.push('confirmSave');
        return true;
      },
      commit: () => {
        modeCancelled.push('commit');
      },
    });

    expect(modeOutcome).toEqual({ status: 'cancelled' });
    expect(modeCancelled).toEqual(['preflight', 'source', 'mode']);
  });
});

describe('ORC/SCO replacement entry point', () => {
  it('requires both sources before mode selection and commits the converted project once', async () => {
    const calls: string[] = [];
    const outcome = await runOrcScoImportReplacement<{ mode: number }, number>({
      preflight: () => {
        calls.push('preflight');
        return true;
      },
      showOrcDialog: async () => {
        calls.push('orc');
        return { canceled: false, filePaths: ['/work/source.orc'] };
      },
      showScoDialog: async () => {
        calls.push('sco');
        return { canceled: false, filePaths: ['/work/score.sco'] };
      },
      showModeDialog: async () => {
        calls.push('mode');
        return { response: 0 };
      },
      cancelModeResponse: 3,
      readSource: (filePath) => {
        calls.push(`read:${filePath}`);
        return filePath;
      },
      convert: (orc, sco, mode) => {
        calls.push(`convert:${orc}:${sco}:${mode}`);
        return { mode };
      },
      confirmLibraryDraft: () => {
        calls.push('confirmLibraryDraft');
        return true;
      },
      confirmSave: () => {
        calls.push('confirmSave');
        return true;
      },
      commit: () => {
        calls.push('commit');
      },
    });

    expect(outcome).toEqual({ status: 'committed' });
    expect(calls).toEqual([
      'preflight',
      'orc',
      'sco',
      'mode',
      'read:/work/source.orc',
      'read:/work/score.sco',
      'convert:/work/source.orc:/work/score.sco:0',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'commit',
    ]);
  });

  it('does not open the mode dialog when the SCO chooser is cancelled', async () => {
    const calls: string[] = [];
    const outcome = await runOrcScoImportReplacement({
      preflight: () => {
        calls.push('preflight');
        return true;
      },
      showOrcDialog: async () => {
        calls.push('orc');
        return { canceled: false, filePaths: ['/work/source.orc'] };
      },
      showScoDialog: async () => {
        calls.push('sco');
        return { canceled: true, filePaths: [] };
      },
      showModeDialog: async () => {
        calls.push('mode');
        return { response: 0 };
      },
      cancelModeResponse: 3,
      readSource: () => {
        calls.push('read');
        return '';
      },
      convert: () => {
        calls.push('convert');
        return {};
      },
      confirmLibraryDraft: () => {
        calls.push('confirmLibraryDraft');
        return true;
      },
      confirmSave: () => {
        calls.push('confirmSave');
        return true;
      },
      commit: () => {
        calls.push('commit');
      },
    });

    expect(outcome).toEqual({ status: 'cancelled' });
    expect(calls).toEqual(['preflight', 'orc', 'sco']);
  });
});

describe('MIDI replacement entry point', () => {
  it('revalidates immediately before commit after both replacement decisions', async () => {
    const calls: string[] = [];
    const outcome = await runMidiImportReplacement<{ built: true }>({
      preflight: () => {
        calls.push('preflight');
        return true;
      },
      prepare: () => {
        calls.push('prepare');
        return { built: true };
      },
      confirmLibraryDraft: () => {
        calls.push('confirmLibraryDraft');
        return true;
      },
      confirmSave: () => {
        calls.push('confirmSave');
        return true;
      },
      revalidate: () => {
        calls.push('revalidate');
      },
      commit: () => {
        calls.push('commit');
      },
    });

    expect(outcome).toEqual({ status: 'committed' });
    expect(calls).toEqual([
      'preflight',
      'prepare',
      'preflight',
      'confirmLibraryDraft',
      'confirmSave',
      'revalidate',
      'commit',
    ]);
  });

  it('keeps the pending session untouched when the library decision is cancelled', async () => {
    const calls: string[] = [];
    const outcome = await runMidiImportReplacement<{ built: true }>({
      preflight: () => true,
      prepare: () => {
        calls.push('prepare');
        return { built: true };
      },
      confirmLibraryDraft: () => {
        calls.push('confirmLibraryDraft');
        return false;
      },
      confirmSave: () => {
        calls.push('confirmSave');
        return true;
      },
      revalidate: () => {
        calls.push('revalidate');
      },
      commit: () => {
        calls.push('commit');
      },
    });

    expect(outcome).toEqual({ status: 'blocked' });
    expect(calls).toEqual(['prepare', 'confirmLibraryDraft']);
  });
});

describe('non-interactive project load entry point', () => {
  it('reads and installs without a replacement decision callback', async () => {
    const calls: string[] = [];
    const loaded = await runNonInteractiveProjectLoad({
      filePath: '/work/project.blue',
      preflight: () => {
        calls.push('preflight');
        return true;
      },
      readProject: (filePath) => {
        calls.push(`read:${filePath}`);
        return { filePath };
      },
      installProject: (project, filePath) => {
        calls.push(`install:${project.filePath}:${filePath}`);
      },
      reportError: () => {
        calls.push('reportError');
      },
    });

    expect(loaded).toBe(true);
    expect(calls).toEqual([
      'preflight',
      'read:/work/project.blue',
      'install:/work/project.blue:/work/project.blue',
    ]);
  });

  it('does not read or install when the render safety gate blocks the load', async () => {
    const calls: string[] = [];
    const loaded = await runNonInteractiveProjectLoad({
      filePath: '/work/project.blue',
      preflight: () => {
        calls.push('preflight');
        return false;
      },
      readProject: () => {
        calls.push('read');
        return {};
      },
      installProject: () => {
        calls.push('install');
      },
      reportError: () => {
        calls.push('reportError');
      },
    });

    expect(loaded).toBe(false);
    expect(calls).toEqual(['preflight']);
  });

  it('reports load failures without installing a partial project', async () => {
    const calls: string[] = [];
    const loaded = await runNonInteractiveProjectLoad({
      filePath: '/work/project.blue',
      preflight: () => true,
      readProject: () => {
        calls.push('read');
        throw new Error('malformed project');
      },
      installProject: () => {
        calls.push('install');
      },
      reportError: (filePath, error) => {
        calls.push(`report:${filePath}:${error instanceof Error ? error.message : String(error)}`);
      },
    });

    expect(loaded).toBe(false);
    expect(calls).toEqual(['read', 'report:/work/project.blue:malformed project']);
  });
});

describe('project lifecycle compatibility workflow', () => {
  it('preserves identity, XML, cleanup, and publications across open/new/save/save-as/revert/close', async () => {
    const sourceXml = `<blueData version="5.0.0">
      <projectProperties><title>Compatibility Project</title></projectProperties>
      <pluginData><futurePlugin mode="unknown"><payload>keep-me</payload></futurePlugin></pluginData>
    </blueData>`;
    const events: string[] = [];
    const writes = new Map<string, string>();
    const session = new ProjectSession();
    const lifecycle = createProjectLifecycle({
      session,
      stopProjectRuntimes: () => {
        events.push('stop');
      },
      closeProjectEditors: () => {
        events.push('editors');
      },
      clearProjectServices: () => {
        events.push('clear');
      },
      publishProjectChanged: (snapshot) => {
        events.push(`changed:${snapshot.filePath}:${snapshot.sessionId}`);
      },
      publishProjectLoaded: (snapshot) => {
        events.push(`loaded:${snapshot.filePath}:${snapshot.sessionId}`);
      },
      publishProjectClosed: (snapshot) => {
        events.push(`closed:${snapshot.filePath}:${snapshot.sessionId}`);
      },
    });

    await lifecycle.open(() => ({
      data: BlueData.loadFromString(sourceXml),
      filePath: '/native/opened.blue',
    }));
    expect(session.read().filePath).toBe('/native/opened.blue');
    expect(session.read().data?.getProjectProperties().title).toBe('Compatibility Project');

    const openedSessionId = session.read().sessionId;
    await expect(
      lifecycle.open(() => {
        throw new Error('candidate parse failed');
      }),
    ).rejects.toThrow('candidate parse failed');
    expect(session.read().sessionId).toBe(openedSessionId);
    expect(session.read().filePath).toBe('/native/opened.blue');

    await lifecycle.replace({ data: new BlueData(), filePath: null });
    expect(
      await lifecycle.save(() => {
        throw new Error('unreachable');
      }),
    ).toBe(false);

    await lifecycle.open(() => ({
      data: BlueData.loadFromString(sourceXml),
      filePath: '/native/opened.blue',
    }));
    const preSaveAsSessionId = session.read().sessionId;
    const write = (data: BlueData, filePath: string): void => {
      events.push(`write:${filePath}`);
      writes.set(filePath, data.saveToString());
    };
    expect(await lifecycle.saveAs('C:\\Users\\Blue\\saved-as.blue', write)).toBe(true);
    expect(session.read().filePath).toBe('C:\\Users\\Blue\\saved-as.blue');
    expect(session.read().sessionId).toBe(preSaveAsSessionId);
    expect(await lifecycle.save(write)).toBe(true);

    const savedXml = writes.get('C:\\Users\\Blue\\saved-as.blue')!;
    expect(savedXml).toContain('<futurePlugin mode="unknown">');
    expect(savedXml).toContain('<payload>keep-me</payload>');

    const staleSessionId = session.read().sessionId;
    await lifecycle.revert(() => ({
      data: BlueData.loadFromString(savedXml),
      filePath: 'C:\\Users\\Blue\\saved-as.blue',
    }));
    expect(session.read().sessionId).toBeGreaterThan(staleSessionId);
    expect(session.read().data?.getProjectProperties().title).toBe('Compatibility Project');
    expect(session.read().data?.saveToString()).toContain('<futurePlugin mode="unknown">');

    await lifecycle.close();
    expect(session.read().data).toBeNull();
    expect(session.read().filePath).toBeNull();
    expect(events).toEqual([
      'stop',
      'editors',
      'clear',
      'changed:/native/opened.blue:1',
      'loaded:/native/opened.blue:1',
      'stop',
      'editors',
      'clear',
      'changed:null:2',
      'loaded:null:2',
      'stop',
      'editors',
      'clear',
      'changed:/native/opened.blue:3',
      'loaded:/native/opened.blue:3',
      'write:C:\\Users\\Blue\\saved-as.blue',
      'changed:C:\\Users\\Blue\\saved-as.blue:3',
      'write:C:\\Users\\Blue\\saved-as.blue',
      'changed:C:\\Users\\Blue\\saved-as.blue:3',
      'stop',
      'editors',
      'clear',
      'changed:C:\\Users\\Blue\\saved-as.blue:4',
      'loaded:C:\\Users\\Blue\\saved-as.blue:4',
      'stop',
      'editors',
      'clear',
      'closed:null:5',
    ]);
  });

  it('derives save state without serializing it into .blue XML (spec 109)', async () => {
    const sourceXml = `<blueData version="5.0.0">
      <projectProperties><title>Save State Project</title></projectProperties>
      <pluginData><futurePlugin mode="unknown"><payload>keep-me</payload></futurePlugin></pluginData>
    </blueData>`;
    const writes: string[] = [];
    const session = new ProjectSession();
    const history = new ProjectHistory({ session });
    const lifecycle = createProjectLifecycle({
      session,
      history,
      stopProjectRuntimes: () => {},
      closeProjectEditors: () => {},
      clearProjectServices: () => {},
    });
    const write = (data: BlueData): void => {
      writes.push(data.saveToString());
    };

    await lifecycle.open(() => ({
      data: BlueData.loadFromString(sourceXml),
      filePath: '/native/opened.blue',
    }));
    expect(history.getSaveState()).toBe('saved');

    // Save As of the opened document writes the loaded content unchanged.
    expect(await lifecycle.saveAs('/native/copy.blue', write)).toBe(true);
    expect(history.getSaveState()).toBe('saved');

    await lifecycle.replace({ data: new BlueData(), filePath: null });
    expect(history.getSaveState()).toBe('unsaved');
    expect(history.isDirty()).toBe(false);

    expect(await lifecycle.saveAs('/native/created.blue', write)).toBe(true);
    expect(history.getSaveState()).toBe('saved');
    session.recordMutation({ changed: true });
    expect(history.getSaveState()).toBe('modified');
    expect(await lifecycle.save(write)).toBe(true);
    expect(history.getSaveState()).toBe('saved');

    await lifecycle.close();
    expect(history.getSaveState()).toBe('none');

    expect(writes).toHaveLength(3);
    const copiedXml = writes[0]!;
    expect(copiedXml).toContain('<futurePlugin mode="unknown">');
    expect(copiedXml).toContain('<payload>keep-me</payload>');
    for (const xml of writes) {
      expect(xml).not.toContain('saveState');
      expect(xml).not.toContain('savedStateId');
      expect(xml).not.toContain('UNSAVED');
      expect(xml).not.toContain('[modified]');
      // Re-parsing the written document must reproduce identical serialization,
      // proving identities, ordering, and references round-trip unchanged.
      expect(BlueData.loadFromString(xml).saveToString()).toBe(xml);
    }
  });
});

describe('close and quit protection workflow (spec 109 US1)', () => {
  interface ProtectionHarness {
    session: ProjectSession;
    history: ProjectHistory;
    chooseCalls: () => number;
    writes: () => string[];
    setWriteSucceeds(value: boolean): void;
    setChoice(choice: 'save' | 'discard' | 'cancel'): void;
    setSaveAsDestination(destination: string | null): void;
    /** Mirrors main.ts closeProject: proceed only when the decision allows. */
    runClose(): Promise<boolean>;
    /** Mirrors main.ts requestQuit: the quit owner performs the one shutdown. */
    runQuit(): Promise<{ quitCalled: boolean }>;
  }

  function createProtectionHarness(initial: {
    filePath: string | null;
    modifyBefore?: boolean;
  }): ProtectionHarness {
    const session = new ProjectSession();
    const data = new BlueData();
    data.getProjectProperties().title = 'Protection Project';
    session.replace(data, initial.filePath);
    const history = new ProjectHistory({ session });
    const lifecycle = createProjectLifecycle({
      session,
      history,
      stopProjectRuntimes: () => {},
      closeProjectEditors: () => {},
      clearProjectServices: () => {},
    });

    let choice: 'save' | 'discard' | 'cancel' = 'discard';
    let writeSucceeds = true;
    let saveAsDestination: string | null = '/work/chosen.blue';
    let chooseCalls = 0;
    const writes: string[] = [];

    const decision = () =>
      resolveProjectSaveDecision({
        runSettlementBarrier: (action) => history.runSettlementBarrier('replacement', action),
        getSaveState: () => history.getSaveState(),
        choose: () => {
          chooseCalls += 1;
          return choice;
        },
        hasCurrentPath: () => Boolean(session.read().filePath),
        saveCurrent: () => {
          // Internal-save shape from main.ts doSave: write, then checkpoint
          // only on success; no barrier and no shutdown of its own.
          const dataToWrite = session.read().data;
          if (!dataToWrite || !session.read().filePath) return false;
          if (!writeSucceeds) return false;
          writes.push(session.read().filePath!);
          history.checkpointSave();
          return true;
        },
        saveAs: () => {
          if (!saveAsDestination) return false;
          if (!writeSucceeds) return false;
          writes.push(saveAsDestination);
          session.publishPath(saveAsDestination);
          history.checkpointSave();
          return true;
        },
      });

    if (initial.modifyBefore) {
      session.recordMutation({ changed: true });
    } else {
      history.checkpointSave();
    }

    return {
      session,
      history,
      chooseCalls: () => chooseCalls,
      writes: () => writes,
      setWriteSucceeds: (value) => {
        writeSucceeds = value;
      },
      setChoice: (next) => {
        choice = next;
      },
      setSaveAsDestination: (destination) => {
        saveAsDestination = destination;
      },
      runClose: async () => {
        const outcome = await decision();
        if (outcome !== 'saved' && outcome !== 'discarded') return false;
        await lifecycle.close();
        return true;
      },
      runQuit: async () => {
        const outcome = await decision();
        if (outcome !== 'saved' && outcome !== 'discarded') return { quitCalled: false };
        return { quitCalled: true };
      },
    };
  }

  it('prompts for an untouched new project even with clean history', async () => {
    const harness = createProtectionHarness({ filePath: null });
    expect(harness.history.isDirty()).toBe(false);
    harness.setChoice('discard');
    expect(await harness.runClose()).toBe(true);
    expect(harness.chooseCalls()).toBe(1);
    expect(harness.history.getSaveState()).toBe('none');
  });

  it('closes a clean opened project without any prompt', async () => {
    const harness = createProtectionHarness({ filePath: '/work/opened.blue' });
    expect(await harness.runClose()).toBe(true);
    expect(harness.chooseCalls()).toBe(0);
    expect(harness.writes()).toEqual([]);
    expect(harness.history.getSaveState()).toBe('none');
  });

  it('prompts a modified project and proceeds after a successful save', async () => {
    const harness = createProtectionHarness({
      filePath: '/work/modified.blue',
      modifyBefore: true,
    });
    harness.setChoice('save');
    expect(await harness.runClose()).toBe(true);
    expect(harness.chooseCalls()).toBe(1);
    expect(harness.writes()).toEqual(['/work/modified.blue']);
    expect(harness.history.getSaveState()).toBe('none');
  });

  it('blocks a quit on write failure, then completes after a successful retry', async () => {
    const harness = createProtectionHarness({
      filePath: '/work/flaky.blue',
      modifyBefore: true,
    });
    harness.setChoice('save');
    harness.setWriteSucceeds(false);

    const first = await harness.runQuit();
    expect(first.quitCalled).toBe(false);
    expect(harness.history.getSaveState()).toBe('modified');
    expect(harness.session.read().documentId).not.toBeNull();

    harness.setWriteSucceeds(true);
    const retry = await harness.runQuit();
    expect(retry.quitCalled).toBe(true);
    expect(harness.writes()).toEqual(['/work/flaky.blue']);
  });

  it('blocks and stays open when Save As is cancelled for a new project', async () => {
    const harness = createProtectionHarness({ filePath: null });
    harness.setChoice('save');
    harness.setSaveAsDestination(null);

    const result = await harness.runQuit();
    expect(result.quitCalled).toBe(false);
    expect(harness.chooseCalls()).toBe(1);
    expect(harness.session.read().filePath).toBeNull();
    expect(harness.history.getSaveState()).toBe('unsaved');
  });

  it('blocks a quit when the user cancels and preserves identity and history', async () => {
    const harness = createProtectionHarness({
      filePath: '/work/cancel.blue',
      modifyBefore: true,
    });
    harness.setChoice('cancel');
    const docIdBefore = harness.session.read().documentId;
    const projectionBefore = harness.history.read();

    const result = await harness.runQuit();
    expect(result.quitCalled).toBe(false);
    expect(harness.session.read().documentId).toBe(docIdBefore);
    expect(harness.history.read()).toEqual(projectionBefore);
    expect(harness.history.getSaveState()).toBe('modified');
  });

  it('quits a project closed earlier in the session without a prompt', async () => {
    const harness = createProtectionHarness({ filePath: '/work/session.blue' });
    harness.setChoice('discard');
    expect(await harness.runClose()).toBe(true);

    const result = await harness.runQuit();
    expect(result.quitCalled).toBe(true);
    expect(harness.chooseCalls()).toBe(0);
  });

  it('serializes a replacement request behind the in-flight close decision', async () => {
    const harness = createProtectionHarness({
      filePath: '/work/order.blue',
      modifyBefore: true,
    });
    const order: string[] = [];
    let resolveChoice!: () => void;
    const choiceGate = new Promise<void>((resolve) => {
      resolveChoice = resolve;
    });

    const closeDecision = resolveProjectSaveDecision({
      runSettlementBarrier: (action) => harness.history.runSettlementBarrier('replacement', action),
      getSaveState: () => harness.history.getSaveState(),
      choose: async (): Promise<'discard'> => {
        order.push('choose');
        await choiceGate;
        order.push('choice-resolved');
        return 'discard';
      },
      hasCurrentPath: () => Boolean(harness.session.read().filePath),
      saveCurrent: () => true,
      saveAs: () => false,
    }).then((outcome) => {
      order.push(`close:${outcome}`);
      return outcome;
    });

    // A replacement request arrives while the close decision is open. It
    // queues behind the boundary and only runs once the decision settles.
    const replacement = harness.history
      .runSettlementBarrier('replacement', async () => {
        order.push('replacement-ran');
        harness.session.replace(new BlueData(), '/work/next.blue');
        harness.history.clear();
        harness.history.checkpointSave();
      })
      .then(() => order.push('replacement-done'));

    await new Promise((r) => setTimeout(r, 10));
    resolveChoice();

    expect(await closeDecision).toBe('discarded');
    await replacement;
    // The replacement ran strictly after the open decision resolved, and the
    // close decision settled before the replacement completed.
    expect(order.indexOf('choice-resolved')).toBeLessThan(order.indexOf('replacement-ran'));
    expect(order.indexOf('close:discarded')).toBeLessThan(order.indexOf('replacement-done'));
    expect(harness.session.read().filePath).toBe('/work/next.blue');
    expect(harness.history.getSaveState()).toBe('saved');
  });
});

describe('terminal decision boundary pass-through (spec 109 T029)', () => {
  function recordingBoundary(order: string[]) {
    return async <T>(action: () => Promise<T>): Promise<T> => {
      order.push('boundary-enter');
      try {
        return await action();
      } finally {
        order.push('boundary-exit');
      }
    };
  }

  it('CSD adapter holds the boundary around decisions and commit', async () => {
    const order: string[] = [];
    const outcome = await runCsdImportReplacement<{ converted: true }, number>({
      preflight: () => true,
      showSourceDialog: async () => ({ canceled: false, filePaths: ['/work/src.csd'] }),
      showModeDialog: async () => ({ response: 0 }),
      cancelModeResponse: 3,
      readSource: () => {
        order.push('read');
        return 'csd';
      },
      convert: () => {
        order.push('convert');
        return { converted: true } as const;
      },
      confirmLibraryDraft: () => {
        order.push('library');
        return true;
      },
      confirmSave: () => {
        order.push('save');
        return true;
      },
      commit: () => {
        order.push('commit');
      },
      runDecisionBoundary: recordingBoundary(order),
    });

    expect(outcome).toEqual({ status: 'committed' });
    expect(order).toEqual([
      'read',
      'convert',
      'boundary-enter',
      'library',
      'save',
      'commit',
      'boundary-exit',
    ]);
  });

  it('ORC/SCO adapter holds the boundary around decisions and commit', async () => {
    const order: string[] = [];
    const outcome = await runOrcScoImportReplacement<{ converted: true }, number>({
      preflight: () => true,
      showOrcDialog: async () => ({ canceled: false, filePaths: ['/work/a.orc'] }),
      showScoDialog: async () => ({ canceled: false, filePaths: ['/work/b.sco'] }),
      showModeDialog: async () => ({ response: 0 }),
      cancelModeResponse: 3,
      readSource: () => 'text',
      convert: () => ({ converted: true }) as const,
      confirmLibraryDraft: () => true,
      confirmSave: () => true,
      commit: () => {
        order.push('commit');
      },
      runDecisionBoundary: recordingBoundary(order),
    });

    expect(outcome).toEqual({ status: 'committed' });
    expect(order).toEqual(['boundary-enter', 'commit', 'boundary-exit']);
  });

  it('MIDI adapter holds the boundary around decisions, revalidation, and commit', async () => {
    const order: string[] = [];
    const outcome = await runMidiImportReplacement<{ converted: true }>({
      preflight: () => true,
      prepare: () => ({ converted: true }) as const,
      confirmLibraryDraft: () => true,
      confirmSave: () => true,
      revalidate: () => {
        order.push('revalidate');
      },
      commit: () => {
        order.push('commit');
      },
      runDecisionBoundary: recordingBoundary(order),
    });

    expect(outcome).toEqual({ status: 'committed' });
    expect(order).toEqual(['boundary-enter', 'revalidate', 'commit', 'boundary-exit']);
  });

  it('main.ts wires every terminal transition through the shared boundary', () => {
    const source = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    function bodyOf(marker: string, endMarker: string): string {
      const start = source.indexOf(marker);
      expect(start, `main.ts must define ${marker}`).toBeGreaterThan(-1);
      const end = source.indexOf(endMarker, start);
      return source.slice(start, end);
    }

    // Direct orchestrations: boundary wraps the save confirm, library guard,
    // and terminal action (requestQuit, closeProject, revertProject, newFile).
    const requestQuit = bodyOf('async function requestQuit()', 'async function doQuit()');
    expect(requestQuit).toContain('runTerminalProjectTransition');
    expect(requestQuit).toContain('confirmSaveBeforeReplaceInsideBoundary');
    expect(requestQuit).toContain('await doQuit()');

    const closeProject = bodyOf('async function closeProject()', 'async function revertProject()');
    expect(closeProject).toContain('runTerminalProjectTransition');
    expect(closeProject).toContain('confirmSaveBeforeReplaceInsideBoundary');
    expect(closeProject).toContain('projectLifecycle.close()');

    const revertProject = bodyOf(
      'async function revertProject()',
      'async function openRecentProject',
    );
    expect(revertProject).toContain('runTerminalProjectTransition');
    expect(revertProject).toContain('confirmSaveBeforeReplaceInsideBoundary');

    const newFile = bodyOf('async function newFile()', 'async function closeProject()');
    expect(newFile).toContain('runTerminalProjectTransition');
    expect(newFile).toContain('confirmSaveBeforeReplaceInsideBoundary');

    // Flow-framework entry points pass the boundary through and use the
    // settled save confirm inside it.
    for (const marker of [
      'runCsdImportReplacement<',
      'runOrcScoImportReplacement<',
      'runMidiImportReplacement<',
      'runProjectFileReplacement<',
    ]) {
      const start = source.indexOf(marker);
      expect(start, `main.ts must wire ${marker}`).toBeGreaterThan(-1);
      const boundaryLine = 'runDecisionBoundary: runTerminalProjectTransition';
      const boundaryAt = source.indexOf(boundaryLine, start);
      expect(boundaryAt, `main.ts wiring for ${marker} must pass the boundary`).toBeGreaterThan(-1);
      const wiring = source.slice(start, boundaryAt + boundaryLine.length);
      expect(wiring).toContain('confirmSaveBeforeReplaceInsideBoundary');
      expect(wiring).toContain(boundaryLine);
    }
  });
});
