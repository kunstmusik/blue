import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import {
  verifyPackagedMetadata,
  verifyPackagedProject,
  verifyPackagedRuntime,
} from './packaged-runtime-verification';
import { EngineSession } from './engine-session';
import {
  FakeChildProcess,
  FakeEngineClient,
  FakeProcessRegistry,
} from './engine-session.test-support';
import { sanitizeEngineDiagnostics } from './engine-recovery';

const RESOURCES = '/Applications/Blue.app/Contents/Resources';
const HOST_PLATFORM = process.platform;
const HOST_ARCH = process.arch;

function createEngineResources(
  platform: NodeJS.Platform = HOST_PLATFORM,
  arch = HOST_ARCH,
): string {
  const resources = mkdtempSync(path.join(tmpdir(), 'blue-packaged-runtime-'));
  const root = path.join(resources, 'assets', 'engine');
  mkdirSync(root, { recursive: true });
  const executableName = platform === 'win32' ? 'blue-engine.exe' : 'blue-engine';
  const bytes = Buffer.from('engine');
  writeFileSync(path.join(root, executableName), bytes);
  chmodSync(path.join(root, executableName), 0o755);
  writeFileSync(
    path.join(root, 'artifact.json'),
    JSON.stringify({
      schemaVersion: 1,
      protocolVersion: 2,
      platform,
      arch,
      executableName,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }),
  );
  return resources;
}

const recoverableMissingCsoundProbe = () => ({
  status: 2,
  stdout: JSON.stringify({
    schemaVersion: 1,
    ready: false,
    engine: { protocolVersion: 2 },
    csound: { status: 'not-found' },
  }),
  stderr: '',
});

describe('packaged-runtime-verification', () => {
  it('accepts complete packaged release metadata and runtime versions', () => {
    const result = verifyPackagedMetadata({
      isPackaged: true,
      appVersion: '2.10.0',
      appPath: '/app',
      releaseChannel: 'stable',
      processVersions: {
        electron: '35.7.5',
        chromium: '134.0.6998.179',
        node: '22.14.0',
      },
      readFile: () =>
        JSON.stringify({
          appVersion: '2.10.0',
          sourceRevision: 'a'.repeat(40),
          generatedAt: '2026-05-04T12:00:00.000Z',
          channel: 'stable',
        }),
    });

    expect(result).toEqual({
      ok: true,
      code: 'OK',
      message: `Packaged release metadata: 2.10.0, stable, ${'a'.repeat(40)}`,
    });
  });

  it('rejects incomplete packaged release metadata', () => {
    const result = verifyPackagedMetadata({
      isPackaged: true,
      appVersion: '2.10.0',
      appPath: '/app',
      processVersions: {
        electron: '35.7.5',
        chromium: '134.0.6998.179',
        node: '22.14.0',
      },
      readFile: () =>
        JSON.stringify({
          appVersion: '2.10.0',
          sourceRevision: 'abc1234',
          generatedAt: '2026-05-04T12:00:00.000Z',
          channel: 'development',
        }),
    });

    expect(result).toEqual({
      ok: false,
      code: 'APP_METADATA_INVALID',
      message: 'Packaged release metadata is missing or incomplete.',
    });
  });

  it('rejects release metadata for a different application version', () => {
    const result = verifyPackagedMetadata({
      isPackaged: true,
      appVersion: '2.10.0',
      appPath: '/app',
      processVersions: {
        electron: '35.7.5',
        chromium: '134.0.6998.179',
        node: '22.14.0',
      },
      readFile: () =>
        JSON.stringify({
          appVersion: '2.9.0',
          sourceRevision: 'a'.repeat(40),
          generatedAt: '2026-05-04T12:00:00.000Z',
          channel: 'stable',
        }),
    });

    expect(result).toEqual({
      ok: false,
      code: 'APP_METADATA_VERSION_MISMATCH',
      message: 'Packaged release metadata version 2.9.0 does not match 2.10.0.',
    });
  });

  it('reports ok=true when every dependency resolves', () => {
    const resources = createEngineResources();
    const report = verifyPackagedRuntime({
      isPackaged: true,
      mainModuleDir: __dirname,
      resourcesPath: resources,
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: (candidate) =>
        candidate.endsWith(path.join('assets', 'java', 'blue-java.jar')) ||
        candidate.endsWith(path.join('assets', 'java', 'pythonLib')),
      resolveExternalModule: (name) => `/resolved/${name}/index.js`,
      resolveZeromqNative: () => '/resolved/zeromq/lib/index.js',
      resolveNodeSqlite: () => '/resolved/node:sqlite',
      platform: HOST_PLATFORM,
      arch: HOST_ARCH,
      runBlueEngineProbe: recoverableMissingCsoundProbe,
    });

    expect(report.ok).toBe(true);
    expect(report.results.length).toBe(7);
    expect(report.results.every((r) => r.ok)).toBe(true);
    const aspects = report.results.map((r) => r.aspect);
    expect(aspects).toEqual([
      'java-helper',
      'python-library',
      'zeromq-native',
      'node-sqlite',
      'workspace-data',
      'workspace-engine-client',
      'bundled-engine',
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
      runBlueEngineProbe: recoverableMissingCsoundProbe,
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
        candidate.endsWith(path.join('assets', 'java', 'blue-java.jar')) ||
        candidate.endsWith(path.join('assets', 'java', 'pythonLib')),
      resolveExternalModule: () => null,
      resolveZeromqNative: () => null,
      resolveNodeSqlite: () => null,
      runBlueEngineProbe: recoverableMissingCsoundProbe,
    });

    expect(report.ok).toBe(false);
    const codes = report.results.map((r) => r.code);
    expect(codes).toContain('ZEROMQ_NATIVE_MISSING');
    expect(codes).toContain('NODE_SQLITE_MISSING');
    expect(codes).toContain('WORKSPACE_DATA_MISSING');
    expect(codes).toContain('WORKSPACE_ENGINE_CLIENT_MISSING');
  });

  it('uses the preferred packaged candidate for the Java helper when present', () => {
    const resources = createEngineResources();
    const expectedJar = path.join(resources, 'assets', 'java', 'blue-java.jar');
    const expectedLib = path.join(resources, 'assets', 'java', 'pythonLib');
    const report = verifyPackagedRuntime({
      isPackaged: true,
      mainModuleDir: __dirname,
      resourcesPath: resources,
      existsSync: (candidate) => candidate === expectedJar || candidate === expectedLib,
      resolveExternalModule: (name) => `/resolved/${name}/index.js`,
      resolveZeromqNative: () => '/resolved/zeromq/lib/index.js',
      resolveNodeSqlite: () => '/resolved/node:sqlite',
      platform: HOST_PLATFORM,
      arch: HOST_ARCH,
      runBlueEngineProbe: recoverableMissingCsoundProbe,
    });

    const java = report.results.find((r) => r.aspect === 'java-helper');
    expect(java?.ok).toBe(true);
    expect(java?.message).toContain(expectedJar);
  });

  it('rejects a missing, cross-architecture, or failed no-Csound engine resource', () => {
    const resources = createEngineResources();
    const base = {
      isPackaged: true,
      mainModuleDir: __dirname,
      resourcesPath: resources,
      platform: HOST_PLATFORM,
      arch: HOST_ARCH,
      existsSync: () => true,
      resolveExternalModule: (name: string) => `/resolved/${name}/index.js`,
      resolveZeromqNative: () => '/resolved/zeromq/lib/index.js',
      resolveNodeSqlite: () => '/resolved/node:sqlite',
    };
    expect(
      verifyPackagedRuntime({
        ...base,
        arch: HOST_ARCH === 'arm64' ? 'x64' : 'arm64',
        runBlueEngineProbe: recoverableMissingCsoundProbe,
      }).results.at(-1)?.code,
    ).toBe('BLUE_ENGINE_RESOURCE_MISMATCH');

    expect(
      verifyPackagedRuntime({
        ...base,
        runBlueEngineProbe: () => ({ status: 1, stdout: '{}', stderr: 'failed' }),
      }).results.at(-1)?.code,
    ).toBe('BLUE_ENGINE_NO_CSOUND_PROBE_FAILED');
  });

  it('passes --owner-pid only when owner-liveness is requested (bridge negotiates the flag; legacy engines never receive it)', async () => {
    let capturedArgs: string[] = [];
    const child = new FakeChildProcess(5001);
    const registry = new FakeProcessRegistry();

    // Supporting engine
    const sessionWithLiveness = new EngineSession(
      {
        kind: 'realtime',
        enginePath: '/bin/blue-engine',
        ownerLivenessCapability: true,
      },
      {
        spawn: (_path, args) => {
          capturedArgs = args;
          return child as any;
        },
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
      },
    );
    await sessionWithLiveness.spawn();
    expect(capturedArgs).toContain('--owner-pid');
    expect(capturedArgs).toContain(String(process.pid));

    // Legacy external engine without liveness
    capturedArgs = [];
    const legacySession = new EngineSession(
      {
        kind: 'realtime',
        enginePath: '/bin/legacy-blue-engine',
        ownerLivenessCapability: false,
      },
      {
        spawn: (_path, args) => {
          capturedArgs = args;
          return child as any;
        },
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
      },
    );
    await legacySession.spawn();
    expect(capturedArgs).not.toContain('--owner-pid');
  });

  it('sanitizes diagnostic strings in packaged execution reports', () => {
    const errorReport =
      'Csound error in /Users/username/Library/Blue/project.csd: table not found\nTOKEN=secret_12345';
    const sanitized = sanitizeEngineDiagnostics(errorReport);

    expect(sanitized).not.toContain('/Users/username');
    expect(sanitized).not.toContain('TOKEN=secret_12345');
    expect(sanitized).toContain('/Users/[user]');
    expect(sanitized).toContain('table not found');
  });

  it('verifies that the requested project becomes the current document', async () => {
    const projectPath = path.resolve('/fixtures/smoke-test.blue');
    const projectSavePath = path.resolve('/tmp/smoke-roundtrip.blue');
    const result = await verifyPackagedProject({
      isPackaged: true,
      projectPath,
      projectSavePath,
      loadProject: async () => true,
      getLoadedProject: () => ({
        filePath: projectPath,
        title: 'Smoke Test',
      }),
      saveProjectCopy: async (savePath) => savePath === projectSavePath,
    });

    expect(result).toEqual({
      ok: true,
      code: 'OK',
      message: `Project loaded and saved: Smoke Test (${projectSavePath})`,
    });
  });

  it('rejects missing, failed, and mismatched packaged project loads', async () => {
    const projectPath = path.resolve('/fixtures/smoke-test.blue');

    await expect(
      verifyPackagedProject({
        isPackaged: true,
        projectPath: null,
        loadProject: async () => true,
        getLoadedProject: () => null,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'PROJECT_PATH_MISSING' });

    await expect(
      verifyPackagedProject({
        isPackaged: true,
        projectPath,
        loadProject: async () => false,
        getLoadedProject: () => null,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'PROJECT_LOAD_FAILED' });

    await expect(
      verifyPackagedProject({
        isPackaged: true,
        projectPath,
        loadProject: async () => true,
        getLoadedProject: () => ({
          filePath: path.resolve('/fixtures/other.blue'),
          title: 'Other',
        }),
      }),
    ).resolves.toMatchObject({ ok: false, code: 'PROJECT_PATH_MISMATCH' });

    await expect(
      verifyPackagedProject({
        isPackaged: true,
        projectPath,
        projectSavePath: path.resolve('/tmp/save.blue'),
        loadProject: async () => true,
        getLoadedProject: () => ({ filePath: projectPath, title: 'Smoke Test' }),
        saveProjectCopy: async () => false,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'PROJECT_SAVE_FAILED' });
  });
});
