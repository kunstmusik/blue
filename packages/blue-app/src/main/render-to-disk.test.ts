import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlueData, type JavaRuntimeClientContract, type JavaScriptSession } from '@blue/data';

import type { DiskRenderSettingsSnapshot } from '../shared/program-settings';
import type { RenderOperationStatus } from '../shared/render-freeze-contract';
import {
  executeRenderToDisk,
  estimateTotalScoreDuration,
  generateDiskCsd,
  parseCsoundProgressLine,
  resolveOutputFilePath,
  resolveRenderWorkingDirectory,
} from './render-to-disk';

function diskRenderSettings(): DiskRenderSettingsSnapshot {
  return {
    csoundExecutable: 'csound',
    defaultSr: '44100',
    defaultKsmps: '1',
    defaultNchnls: '2',
    useZeroDbfs: true,
    zeroDbfs: '1',
    fileFormatEnabled: true,
    fileFormat: 'WAV',
    sampleFormatEnabled: true,
    sampleFormat: 'SHORT',
    savePeakInformation: true,
    ditherOutput: false,
    rewriteHeader: true,
    noteAmpsEnabled: true,
    outOfRangeEnabled: true,
    warningsEnabled: true,
    benchmarkEnabled: true,
    displaysDisabled: true,
    advancedSettings: '',
    renderMethod: '',
    externalPlayCommandEnabled: false,
    externalPlayCommand: 'command $outfile',
    externalOpenCommand: 'command $outfile',
  };
}

describe('executeRenderToDisk', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('allows unsaved projects to render from the application temp directory', () => {
    expect(resolveRenderWorkingDirectory(null, '/application/temp')).toBe('/application/temp');
    expect(resolveRenderWorkingDirectory('/projects/example.blue', '/application/temp')).toBe(
      path.dirname('/projects/example.blue'),
    );
  });

  it('uses the active shared JavaScript session for synchronous disk CSD generation', async () => {
    const session = {} as JavaScriptSession;
    const toDiskCSD = vi.fn(() => 'javascript-csd');
    const toDiskCSDAsync = vi.fn(async () => 'async-csd');

    await expect(generateDiskCsd({ toDiskCSD, toDiskCSDAsync }, session, null)).resolves.toBe(
      'javascript-csd',
    );
    expect(toDiskCSD).toHaveBeenCalledWith(session);
    expect(toDiskCSDAsync).not.toHaveBeenCalled();
  });

  it('uses the active shared Java runtime for Python and Clojure disk CSD generation', async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const toDiskCSD = vi.fn(() => 'sync-csd');
    const toDiskCSDAsync = vi.fn(async () => 'java-runtime-csd');

    await expect(
      generateDiskCsd({ toDiskCSD, toDiskCSDAsync }, session, runtimeClient),
    ).resolves.toBe('java-runtime-csd');
    expect(toDiskCSDAsync).toHaveBeenCalledWith(session, runtimeClient);
    expect(toDiskCSD).not.toHaveBeenCalled();
  });

  it('uses a complete-override output relative to the project, without a dialog output path', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-render-'));
    temporaryDirectories.push(projectDirectory);
    const data = new BlueData();
    data.getProjectProperties().diskCompleteOverride = true;
    data.getProjectProperties().diskAdvancedSettings = '-o "final mix.wav" -d';
    const statuses: RenderOperationStatus[] = [];
    const expectedOutput = path.join(projectDirectory, 'final mix.wav');

    const result = await executeRenderToDisk(
      {
        data,
        projectDirectory,
        diskRender: diskRenderSettings(),
        general: { messageColorsEnabled: true },
        outputFile: null,
      },
      'render',
      'disk-test',
      (status) => statuses.push(status),
      {
        runCsound: async () => {
          fs.writeFileSync(expectedOutput, 'audio');
          return { exitCode: 0, stderr: '' };
        },
      },
    );

    expect(result).toMatchObject({ ok: true, outputPath: expectedOutput });
    expect(statuses.at(-1)).toMatchObject({ phase: 'completed', outputPath: expectedOutput });
  });

  it('reports a failed status when Csound exits successfully without producing the planned output', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-render-'));
    temporaryDirectories.push(projectDirectory);
    const data = new BlueData();
    const output = path.join(projectDirectory, 'missing.wav');
    const statuses: RenderOperationStatus[] = [];

    const result = await executeRenderToDisk(
      {
        data,
        projectDirectory,
        diskRender: diskRenderSettings(),
        general: { messageColorsEnabled: true },
        outputFile: output,
      },
      'render',
      'disk-missing-output',
      (status) => statuses.push(status),
      { runCsound: async () => ({ exitCode: 0, stderr: '' }) },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/output file not found/i);
    expect(statuses.at(-1)).toMatchObject({ phase: 'failed' });
  });

  it('reports a non-zero Csound exit without mutating the project and cleans the temporary CSD', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-render-'));
    temporaryDirectories.push(projectDirectory);
    const data = new BlueData();
    const before = data.saveToString();
    const output = path.join(projectDirectory, 'failed.wav');
    const statuses: RenderOperationStatus[] = [];

    const result = await executeRenderToDisk(
      {
        data,
        projectDirectory,
        diskRender: diskRenderSettings(),
        general: { messageColorsEnabled: true },
        outputFile: output,
      },
      'render',
      'disk-nonzero',
      (status) => statuses.push(status),
      { runCsound: async () => ({ exitCode: 1, stderr: 'render failed' }) },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exited with code 1.*render failed/i);
    expect(data.saveToString()).toBe(before);
    expect(statuses.at(-1)).toMatchObject({ phase: 'failed' });
    expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('tempCsd'))).toEqual(
      [],
    );
  });

  it('reports spawn failures without mutating the project', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-render-'));
    temporaryDirectories.push(projectDirectory);
    const data = new BlueData();
    const before = data.saveToString();

    const result = await executeRenderToDisk(
      {
        data,
        projectDirectory,
        diskRender: diskRenderSettings(),
        general: { messageColorsEnabled: true },
        outputFile: path.join(projectDirectory, 'never-created.wav'),
      },
      'render',
      'disk-spawn-failure',
      vi.fn(),
      {
        runCsound: async () => {
          throw new Error('ENOENT');
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not start Csound.*ENOENT/i);
    expect(data.saveToString()).toBe(before);
  });

  it('reports cancellation after process termination without mutating the project', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-render-'));
    temporaryDirectories.push(projectDirectory);
    const data = new BlueData();
    const before = data.saveToString();
    let cancelled = false;

    const result = await executeRenderToDisk(
      {
        data,
        projectDirectory,
        diskRender: diskRenderSettings(),
        general: { messageColorsEnabled: true },
        outputFile: path.join(projectDirectory, 'cancelled.wav'),
        isCancelled: () => cancelled,
      },
      'render',
      'disk-cancelled',
      vi.fn(),
      {
        runCsound: async () => {
          cancelled = true;
          return { exitCode: -1, stderr: 'Operation cancelled.' };
        },
      },
    );

    expect(result).toMatchObject({ ok: false, cancelled: true, error: null });
    expect(data.saveToString()).toBe(before);
    expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('tempCsd'))).toEqual(
      [],
    );
  });

  it('forwards determinate Csound progress while rendering', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-render-'));
    temporaryDirectories.push(projectDirectory);
    const data = new BlueData();
    const output = path.join(projectDirectory, 'progress.wav');
    const statuses: RenderOperationStatus[] = [];

    const result = await executeRenderToDisk(
      {
        data,
        projectDirectory,
        diskRender: diskRenderSettings(),
        general: { messageColorsEnabled: true },
        outputFile: output,
      },
      'render',
      'disk-progress',
      (status) => statuses.push(status),
      {
        runCsound: async (_args, _cwd, onProgress) => {
          onProgress?.(42);
          fs.writeFileSync(output, 'audio');
          return { exitCode: 0, stderr: '' };
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(statuses).toContainEqual(expect.objectContaining({ phase: 'rendering', progress: 42 }));
  });
});

describe('resolveOutputFilePath', () => {
  it('preserves absolute project output paths and resolves relative paths from the project directory', () => {
    const data = new BlueData();
    const props = data.getProjectProperties();
    props.askOnRender = false;
    props.fileName = 'renders/final mix.wav';

    expect(resolveOutputFilePath(data, '/projects/example')).toBe(
      path.resolve('/projects/example', 'renders/final mix.wav'),
    );

    props.fileName = '/exports/exact.wav';
    const absoluteExpected = path.isAbsolute('/exports/exact.wav')
      ? '/exports/exact.wav'
      : path.resolve('/projects/example', '/exports/exact.wav');
    expect(resolveOutputFilePath(data, '/projects/example')).toBe(absoluteExpected);
  });

  it('requests a destination when askOnRender is enabled or the saved filename is empty', () => {
    const data = new BlueData();
    const props = data.getProjectProperties();
    props.fileName = 'saved.wav';
    props.askOnRender = true;
    expect(resolveOutputFilePath(data, '/projects/example')).toBeNull();

    props.askOnRender = false;
    props.fileName = '   ';
    expect(resolveOutputFilePath(data, '/projects/example')).toBeNull();
  });
});

describe('estimateTotalScoreDuration', () => {
  it('returns the maximum p2+p3 from i-statements in the CSD score', () => {
    const csd = [
      '<CsoundSynthesizer>',
      '<CsScore>',
      'f1 0 8192 10 1',
      'i1\t0.000\t10.000\t0.5',
      'i1\t10.000\t5.000\t0.3',
      'i2\t15.000\t30.000\t0.7',
      'e',
      '</CsScore>',
      '</CsoundSynthesizer>',
    ].join('\n');

    expect(estimateTotalScoreDuration(csd)).toBe(45);
  });

  it('returns 0 for an empty or missing score section', () => {
    expect(estimateTotalScoreDuration('<CsoundSynthesizer></CsoundSynthesizer>')).toBe(0);
    expect(estimateTotalScoreDuration('')).toBe(0);
  });
});

describe('parseCsoundProgressLine', () => {
  it('computes progress from a B-line using known total duration', () => {
    const line = 'B  0.000 ..  5.000 T  5.000 TT  5.000 M:  0.50000  0.00000';
    expect(parseCsoundProgressLine(line, 20)).toBe(25);
  });

  it('computes 100% when cumulative time equals total duration', () => {
    const line = 'B  0.000 ..600.000 T600.000 TT600.000 M:  0.50000  0.00000';
    expect(parseCsoundProgressLine(line, 600)).toBe(100);
  });

  it('returns 100 for a B-line without a known total duration', () => {
    const line = 'B  0.000 ..  5.000 T  5.000 TT  5.000 M:  0.50000  0.00000';
    expect(parseCsoundProgressLine(line, 0)).toBe(100);
  });

  it('returns null for non-B lines', () => {
    expect(parseCsoundProgressLine('SECTION 1:', 100)).toBeNull();
    expect(parseCsoundProgressLine('new alloc for instr 1:', 100)).toBeNull();
    expect(parseCsoundProgressLine('', 100)).toBeNull();
  });
});
