import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import {
  runCsdImportReplacement,
  runMidiImportReplacement,
  runNonInteractiveProjectLoad,
  runOrcScoImportReplacement,
} from './project-replacement-entry-points';
import { createProjectLifecycle } from './project-lifecycle';
import { ProjectSession } from './project-session';

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
});
