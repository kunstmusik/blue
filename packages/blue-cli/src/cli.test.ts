import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

const dataMock = vi.hoisted(() => ({
  readProjectXml: vi.fn(),
  initializeJavaScriptRuntime: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: fsMock,
}));

vi.mock('@blue/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@blue/data')>()),
  JavaScriptSession: class {
    dispose() {}
  },
  readProjectXml: dataMock.readProjectXml,
  initializeJavaScriptRuntime: dataMock.initializeJavaScriptRuntime,
}));

vi.mock('./tuning-scales', () => ({ resolveCliTuningScales: vi.fn() }));
vi.mock('./audio-layout', () => ({ prepareCliAudioLayout: vi.fn() }));

import { compileProject, resolveCompileMode } from './cli';

describe('resolveCompileMode', () => {
  it('defaults to disk mode', () => {
    expect(resolveCompileMode({ realtime: false, bluelive: false })).toBe('disk');
  });

  it('rejects mutually exclusive mode flags', () => {
    expect(() => resolveCompileMode({ realtime: true, bluelive: true })).toThrow(
      /mutually exclusive/,
    );
  });
});

describe('compileProject', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fsMock.readFile.mockReset();
    fsMock.mkdir.mockReset();
    fsMock.writeFile.mockReset();
    dataMock.readProjectXml.mockReset();
    dataMock.initializeJavaScriptRuntime.mockReset();
  });

  it('uses toDiskCSDAsync for the default compile mode', async () => {
    const toDiskCSDAsync = vi.fn(() => 'disk-csd');
    const toCSDAsync = vi.fn(() => 'realtime-csd');
    const toBlueLiveCSDAsync = vi.fn(() => ({ csdText: 'bluelive-csd' }));

    fsMock.readFile.mockResolvedValue('project xml');
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
    dataMock.initializeJavaScriptRuntime.mockResolvedValue(undefined);
    dataMock.readProjectXml.mockReturnValue({
      ok: true,
      diagnostics: [],
      value: {
        processOnLoadAsync: vi.fn(),
        toDiskCSDAsync,
        toCSDAsync,
        toBlueLiveCSDAsync,
      },
    });

    const result = await compileProject({
      projectPath: '/tmp/project.blue',
      outputPath: '/tmp/project.csd',
      mode: 'disk',
    });

    expect(dataMock.readProjectXml).toHaveBeenCalledWith('project xml', {
      kind: 'project',
      label: resolve('/tmp/project.blue'),
      nativePath: resolve('/tmp/project.blue'),
    });
    expect(toDiskCSDAsync).toHaveBeenCalledTimes(1);
    expect(toCSDAsync).not.toHaveBeenCalled();
    expect(toBlueLiveCSDAsync).not.toHaveBeenCalled();
    expect(fsMock.writeFile).toHaveBeenCalledWith(resolve('/tmp/project.csd'), 'disk-csd', 'utf8');
    expect(result.bytesWritten).toBe(Buffer.byteLength('disk-csd', 'utf8'));
  });

  it('uses toCSDAsync for realtime mode and toBlueLiveCSDAsync for Blue Live mode', async () => {
    const toDiskCSDAsync = vi.fn(() => 'disk-csd');
    const toCSDAsync = vi.fn(() => 'realtime-csd');
    const toBlueLiveCSDAsync = vi.fn(() => ({ csdText: 'bluelive-csd' }));

    fsMock.readFile.mockResolvedValue('project xml');
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
    dataMock.initializeJavaScriptRuntime.mockResolvedValue(undefined);
    dataMock.readProjectXml.mockReturnValue({
      ok: true,
      diagnostics: [],
      value: {
        processOnLoadAsync: vi.fn(),
        toDiskCSDAsync,
        toCSDAsync,
        toBlueLiveCSDAsync,
      },
    });

    await compileProject({
      projectPath: '/tmp/project.blue',
      outputPath: '/tmp/realtime.csd',
      mode: 'realtime',
    });

    await compileProject({
      projectPath: '/tmp/project.blue',
      outputPath: '/tmp/bluelive.csd',
      mode: 'bluelive',
    });

    expect(toCSDAsync).toHaveBeenCalledTimes(1);
    expect(toBlueLiveCSDAsync).toHaveBeenCalledTimes(1);
    expect(toDiskCSDAsync).not.toHaveBeenCalled();
  });

  it('reports rejected XML before runtime initialization or output creation', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    fsMock.readFile.mockResolvedValue('<blueData><future/></blueData>');
    dataMock.readProjectXml.mockReturnValue({
      ok: false,
      diagnostics: [
        {
          code: 'member',
          severity: 'error',
          source: { kind: 'project', label: 'C:\\Users\\Composer\\bad.blue' },
          path: '/blueData/future[1]',
          member: 'future',
          message: 'Unexpected element future.',
          recovery: 'Convert it in a compatible editor.',
        },
      ],
    });
    await expect(
      compileProject({ projectPath: 'bad.blue', outputPath: 'out/project.csd', mode: 'disk' }),
    ).rejects.toThrow('Unexpected element future');
    expect(write).toHaveBeenCalledWith(expect.stringContaining('C:\\Users\\Composer\\bad.blue'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('/blueData/future[1]'));
    expect(dataMock.initializeJavaScriptRuntime).not.toHaveBeenCalled();
    expect(fsMock.mkdir).not.toHaveBeenCalled();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it('reports accepted warnings before runtime initialization and compilation', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const compile = vi.fn(() => 'canonical-csd');
    fsMock.readFile.mockResolvedValue('<blueData/>');
    dataMock.readProjectXml.mockReturnValue({
      ok: true,
      value: { toDiskCSDAsync: compile, processOnLoadAsync: vi.fn() },
      diagnostics: [
        {
          code: 'P-PPQ',
          severity: 'warning',
          source: { kind: 'project', label: 'old.blue' },
          path: '/blueData/score[1]/timeContext[1]/ppq[1]',
          value: '960',
          message: 'Redundant fixed PPQ.',
          recovery: 'Canonical save omits the redundant field.',
        },
      ],
    });
    await compileProject({ projectPath: 'old.blue', outputPath: 'out/project.csd', mode: 'disk' });
    expect(write).toHaveBeenCalledWith(expect.stringContaining('P-PPQ'));
    expect(write.mock.invocationCallOrder[0]).toBeLessThan(
      dataMock.initializeJavaScriptRuntime.mock.invocationCallOrder[0],
    );
    expect(dataMock.initializeJavaScriptRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      compile.mock.invocationCallOrder[0],
    );
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      resolve('out/project.csd'),
      'canonical-csd',
      'utf8',
    );
  });
});
