import { describe, expect, it } from 'vitest';
import {
  runCsdImportReplacement,
  runMidiImportReplacement,
  runNonInteractiveProjectLoad,
  runOrcScoImportReplacement,
} from './project-replacement-entry-points';

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
      'preflight', 'prepare', 'preflight', 'confirmLibraryDraft', 'confirmSave',
      'revalidate', 'commit',
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
