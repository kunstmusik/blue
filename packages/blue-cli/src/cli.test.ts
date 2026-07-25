import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

const dataMock = vi.hoisted(() => ({
  loadFromString: vi.fn(),
  initializeJavaScriptRuntime: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: fsMock,
}));

vi.mock('@blue/data', () => ({
  BlueData: {
    loadFromString: dataMock.loadFromString,
  },
  initializeJavaScriptRuntime: dataMock.initializeJavaScriptRuntime,
}));

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
    fsMock.readFile.mockReset();
    fsMock.mkdir.mockReset();
    fsMock.writeFile.mockReset();
    dataMock.loadFromString.mockReset();
    dataMock.initializeJavaScriptRuntime.mockReset();
  });

  it('uses toDiskCSD for the default compile mode', async () => {
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const toCSD = vi.fn(() => 'realtime-csd');
    const toBlueLiveCSD = vi.fn(() => ({ csdText: 'bluelive-csd' }));

    fsMock.readFile.mockResolvedValue('project xml');
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
    dataMock.initializeJavaScriptRuntime.mockResolvedValue(undefined);
    dataMock.loadFromString.mockReturnValue({
      toDiskCSD,
      toCSD,
      toBlueLiveCSD,
    });

    const result = await compileProject({
      projectPath: '/tmp/project.blue',
      outputPath: '/tmp/project.csd',
      mode: 'disk',
    });

    expect(dataMock.loadFromString).toHaveBeenCalledWith('project xml');
    expect(toDiskCSD).toHaveBeenCalledTimes(1);
    expect(toCSD).not.toHaveBeenCalled();
    expect(toBlueLiveCSD).not.toHaveBeenCalled();
    expect(fsMock.writeFile).toHaveBeenCalledWith(resolve('/tmp/project.csd'), 'disk-csd', 'utf8');
    expect(result.bytesWritten).toBe(Buffer.byteLength('disk-csd', 'utf8'));
  });

  it('uses toCSD for realtime mode and toBlueLiveCSD for Blue Live mode', async () => {
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const toCSD = vi.fn(() => 'realtime-csd');
    const toBlueLiveCSD = vi.fn(() => ({ csdText: 'bluelive-csd' }));

    fsMock.readFile.mockResolvedValue('project xml');
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
    dataMock.initializeJavaScriptRuntime.mockResolvedValue(undefined);
    dataMock.loadFromString.mockReturnValue({
      toDiskCSD,
      toCSD,
      toBlueLiveCSD,
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

    expect(toCSD).toHaveBeenCalledTimes(1);
    expect(toBlueLiveCSD).toHaveBeenCalledTimes(1);
    expect(toDiskCSD).not.toHaveBeenCalled();
  });
});
