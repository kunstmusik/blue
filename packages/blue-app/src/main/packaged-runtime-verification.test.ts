import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import {
  verifyPackagedProject,
  verifyPackagedRuntime,
} from './packaged-runtime-verification';

const RESOURCES = '/Applications/Blue.app/Contents/Resources';

describe('packaged-runtime-verification', () => {
  it('reports ok=true when every dependency resolves', () => {
    const report = verifyPackagedRuntime({
      isPackaged: true,
      mainModuleDir: __dirname,
      resourcesPath: RESOURCES,
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: (candidate) =>
        candidate.endsWith(path.join('assets', 'java', 'blue-java.jar'))
        || candidate.endsWith(path.join('assets', 'java', 'pythonLib')),
      resolveExternalModule: (name) => `/resolved/${name}/index.js`,
      resolveZeromqNative: () => '/resolved/zeromq/lib/index.js',
      resolveNodeSqlite: () => '/resolved/node:sqlite',
    });

    expect(report.ok).toBe(true);
    expect(report.results.length).toBe(6);
    expect(report.results.every((r) => r.ok)).toBe(true);
    const aspects = report.results.map((r) => r.aspect);
    expect(aspects).toEqual([
      'java-helper',
      'python-library',
      'zeromq-native',
      'node-sqlite',
      'workspace-data',
      'workspace-engine-client',
    ]);
  });

  it('reports ok=false and codes for missing Java helper and Python library', () => {
    const report = verifyPackagedRuntime({
      isPackaged: true,
      mainModuleDir: __dirname,
      resourcesPath: RESOURCES,
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: () => false,
      resolveExternalModule: (name) => `/resolved/${name}/index.js`,
      resolveZeromqNative: () => '/resolved/zeromq/lib/index.js',
      resolveNodeSqlite: () => '/resolved/node:sqlite',
    });

    expect(report.ok).toBe(false);
    const codes = report.results.map((r) => r.code);
    expect(codes).toContain('JAVA_HELPER_MISSING');
    expect(codes).toContain('PYTHON_LIBRARY_MISSING');
  });

  it('reports ok=false when zeromq, node:sqlite, or external modules are missing', () => {
    const report = verifyPackagedRuntime({
      isPackaged: true,
      mainModuleDir: __dirname,
      resourcesPath: RESOURCES,
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: (candidate) =>
        candidate.endsWith(path.join('assets', 'java', 'blue-java.jar'))
        || candidate.endsWith(path.join('assets', 'java', 'pythonLib')),
      resolveExternalModule: () => null,
      resolveZeromqNative: () => null,
      resolveNodeSqlite: () => null,
    });

    expect(report.ok).toBe(false);
    const codes = report.results.map((r) => r.code);
    expect(codes).toContain('ZEROMQ_NATIVE_MISSING');
    expect(codes).toContain('NODE_SQLITE_MISSING');
    expect(codes).toContain('WORKSPACE_DATA_MISSING');
    expect(codes).toContain('WORKSPACE_ENGINE_CLIENT_MISSING');
  });

  it('uses the preferred packaged candidate for the Java helper when present', () => {
    const expectedJar = path.join(RESOURCES, 'assets', 'java', 'blue-java.jar');
    const expectedLib = path.join(RESOURCES, 'assets', 'java', 'pythonLib');
    const report = verifyPackagedRuntime({
      isPackaged: true,
      mainModuleDir: __dirname,
      resourcesPath: RESOURCES,
      existsSync: (candidate) => candidate === expectedJar || candidate === expectedLib,
      resolveExternalModule: (name) => `/resolved/${name}/index.js`,
      resolveZeromqNative: () => '/resolved/zeromq/lib/index.js',
      resolveNodeSqlite: () => '/resolved/node:sqlite',
    });

    const java = report.results.find((r) => r.aspect === 'java-helper');
    expect(java?.ok).toBe(true);
    expect(java?.message).toContain(expectedJar);
  });

  it('verifies that the requested project becomes the current document', async () => {
    const projectPath = path.resolve('/fixtures/smoke-test.blue');
    const result = await verifyPackagedProject({
      isPackaged: true,
      projectPath,
      loadProject: async () => true,
      getLoadedProject: () => ({
        filePath: projectPath,
        title: 'Smoke Test',
      }),
    });

    expect(result).toEqual({
      ok: true,
      code: 'OK',
      message: `Project loaded: Smoke Test (${projectPath})`,
    });
  });

  it('rejects missing, failed, and mismatched packaged project loads', async () => {
    const projectPath = path.resolve('/fixtures/smoke-test.blue');

    await expect(verifyPackagedProject({
      isPackaged: true,
      projectPath: null,
      loadProject: async () => true,
      getLoadedProject: () => null,
    })).resolves.toMatchObject({ ok: false, code: 'PROJECT_PATH_MISSING' });

    await expect(verifyPackagedProject({
      isPackaged: true,
      projectPath,
      loadProject: async () => false,
      getLoadedProject: () => null,
    })).resolves.toMatchObject({ ok: false, code: 'PROJECT_LOAD_FAILED' });

    await expect(verifyPackagedProject({
      isPackaged: true,
      projectPath,
      loadProject: async () => true,
      getLoadedProject: () => ({
        filePath: path.resolve('/fixtures/other.blue'),
        title: 'Other',
      }),
    })).resolves.toMatchObject({ ok: false, code: 'PROJECT_PATH_MISMATCH' });
  });
});
