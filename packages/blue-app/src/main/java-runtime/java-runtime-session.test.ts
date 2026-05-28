import { describe, expect, it, vi } from 'vitest';
import { JavaRuntimeSessionManager } from './java-runtime-session';

vi.mock('zeromq', () => ({
  Request: class MockRequest {},
  Subscriber: class MockSubscriber {},
}));

function createDataWithDependencies() {
  return {
    getClojureProjectData: () => ({
      getLibraryEntries: () => [{
        getDependencyCoordinates: () => 'org.clojure/data.json',
        getVersion: () => '2.5.1',
      }],
    }),
  } as any;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('java-runtime-session', () => {
  it('starts the helper and initializes a project session with dependencies', async () => {
    const data = createDataWithDependencies();
    const initSession = vi.fn(async () => ({
      ok: true,
      result: { projectSessionId: 7, clojureNamespace: 'user0', dependenciesLoaded: [] },
    }));
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project', methods: ['runtime.health'] } })),
      initSession,
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const createClient = vi.fn(() => client);
    const createProcess = vi.fn(async () => ({
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
    } as any));

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({ artifactPath: '/assets/blue-java.jar', candidatePaths: ['/assets/blue-java.jar'], exists: true }),
        probeJavaExecutable: async () => ({ available: true, executable: 'java', versionMajor: 21, rawOutput: 'openjdk version "21.0.2"' }),
        createJavaRuntimeProcess: createProcess,
        createClient,
      },
    );

    const readyClient = await manager.ensureReady(data, 7, '/tmp/project/demo.blue');

    expect(readyClient).toBe(client);
    expect(manager.getJythonStateRevision()).toBe(1);
    expect(createProcess).toHaveBeenCalledWith('/assets/blue-java.jar', '/tmp/project', 'java');
    expect(initSession).toHaveBeenCalledWith({
      projectSessionId: 7,
      projectDir: '/tmp/project',
      clojureDependencies: [{ coordinates: 'org.clojure/data.json', version: '2.5.1' }],
      jythonPythonLibRoot: '/repo/packages/blue-app/assets/java/pythonLib',
      jythonUserPythonLibRoot: '/Users/test/Library/Application Support/Blue/pythonLib',
    });
  });

  it('reuses the active helper for the same project session and directory', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project', methods: ['runtime.health'] } })),
      initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 2, clojureNamespace: 'user0', dependenciesLoaded: [] } })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const createProcess = vi.fn(async () => ({
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
    } as any));

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({ artifactPath: '/assets/blue-java.jar', candidatePaths: ['/assets/blue-java.jar'], exists: true }),
        probeJavaExecutable: async () => ({ available: true, executable: 'java', versionMajor: 21, rawOutput: 'openjdk version "21.0.2"' }),
        createJavaRuntimeProcess: createProcess,
        createClient: () => client,
      },
    );

    await manager.ensureReady(data, 2, '/tmp/project/demo.blue');
    await manager.ensureReady(data, 2, '/tmp/project/demo.blue');

    expect(manager.getJythonStateRevision()).toBe(1);
    expect(createProcess).toHaveBeenCalledTimes(1);
    expect(client.initSession).toHaveBeenCalledTimes(1);
  });

  it('disposes the helper when the project directory changes', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn();
    const firstClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project-a', methods: ['runtime.health'] } })),
      initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] } })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const secondClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project-b', methods: ['runtime.health'] } })),
      initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 2, clojureNamespace: 'user2', dependenciesLoaded: [] } })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user3' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const firstHandle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret-a',
      workingDirectory: '/tmp/project-a',
      stdoutText: '',
      stderrText: '',
    } as any;
    const secondHandle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:6555',
      eventEndpoint: 'tcp://127.0.0.1:6556',
      authToken: 'secret-b',
      workingDirectory: '/tmp/project-b',
      stdoutText: '',
      stderrText: '',
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({ artifactPath: '/assets/blue-java.jar', candidatePaths: ['/assets/blue-java.jar'], exists: true }),
        probeJavaExecutable: async () => ({ available: true, executable: 'java', versionMajor: 21, rawOutput: 'openjdk version "21.0.2"' }),
        createJavaRuntimeProcess: vi.fn()
          .mockResolvedValueOnce(firstHandle)
          .mockResolvedValueOnce(secondHandle),
        createClient: vi.fn()
          .mockReturnValueOnce(firstClient)
          .mockReturnValueOnce(secondClient),
        terminateProcess,
      },
    );

    await manager.ensureReady(data, 1, '/tmp/project-a/demo.blue');
    await manager.ensureReady(data, 2, '/tmp/project-b/demo.blue');

    expect(firstClient.shutdown).toHaveBeenCalledTimes(1);
    expect(firstClient.disconnect).toHaveBeenCalledTimes(1);
    expect(terminateProcess).toHaveBeenCalledWith(firstHandle);
    expect(secondClient.initSession).toHaveBeenCalledWith({
      projectSessionId: 2,
      projectDir: '/tmp/project-b',
      clojureDependencies: [],
      jythonPythonLibRoot: '/repo/packages/blue-app/assets/java/pythonLib',
      jythonUserPythonLibRoot: '/Users/test/Library/Application Support/Blue/pythonLib',
    });
  });

  it('shares one startup when ensureReady is called concurrently for the same project', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const startup = deferred<any>();
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project', methods: ['runtime.health'] } })),
      initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 4, clojureNamespace: 'user0', dependenciesLoaded: [] } })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const createProcess = vi.fn(() => startup.promise);

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({ artifactPath: '/assets/blue-java.jar', candidatePaths: ['/assets/blue-java.jar'], exists: true }),
        probeJavaExecutable: async () => ({ available: true, executable: 'java', versionMajor: 21, rawOutput: 'openjdk version "21.0.2"' }),
        createJavaRuntimeProcess: createProcess,
        createClient: () => client,
      },
    );

    const first = manager.ensureReady(data, 4, '/tmp/project/demo.blue');
    const second = manager.ensureReady(data, 4, '/tmp/project/demo.blue');

    startup.resolve({
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
    });

    await expect(first).resolves.toBe(client);
    await expect(second).resolves.toBe(client);
    expect(createProcess).toHaveBeenCalledTimes(1);
    expect(client.initSession).toHaveBeenCalledTimes(1);
  });

  it('reinitializes Jython independently of Clojure reinitialization', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', capabilities: ['clojure', 'jython'], cwd: '/tmp/project', methods: ['runtime.health'] } })),
      initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 9, clojureNamespace: 'user0', dependenciesLoaded: [], jythonReady: true, jythonLibraryPaths: ['/tmp/pythonLib'] } })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      reinitializeJython: vi.fn(async () => ({ ok: true, result: { libraryPaths: ['/tmp/pythonLib'] } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({ artifactPath: '/assets/blue-java.jar', candidatePaths: ['/assets/blue-java.jar'], exists: true }),
        probeJavaExecutable: async () => ({ available: true, executable: 'java', versionMajor: 21, rawOutput: 'openjdk version "21.0.2"' }),
        createJavaRuntimeProcess: async () => ({
          process: { exitCode: null, killed: false, kill: vi.fn() },
          javaExecutable: 'java',
          artifactPath: '/assets/blue-java.jar',
          controlEndpoint: 'tcp://127.0.0.1:5555',
          eventEndpoint: 'tcp://127.0.0.1:5556',
          authToken: 'secret',
          workingDirectory: '/tmp/project',
          stdoutText: '',
          stderrText: '',
        } as any),
        createClient: () => client,
      },
    );

    const readyClient = await manager.reinitializeJython(data, 9, '/tmp/project/demo.blue');

    expect(readyClient).toBe(client);
    expect(manager.getJythonStateRevision()).toBe(2);
    expect(client.reinitializeJython).toHaveBeenCalledTimes(1);
    expect(client.reinitializeClojure).not.toHaveBeenCalled();
  });

  it('formats mapped Jython errors when reinitialization fails', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', capabilities: ['clojure', 'jython'], cwd: '/tmp/project', methods: ['runtime.health'] } })),
      initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 9, clojureNamespace: 'user0', dependenciesLoaded: [], jythonReady: true, jythonLibraryPaths: ['/tmp/pythonLib'] } })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      reinitializeJython: vi.fn(async () => ({
        ok: false,
        error: {
          code: 'JYTHON_IMPORT_ERROR',
          message: 'ImportError: No module named orchestra',
          line: 2,
          column: 4,
        },
      })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({ artifactPath: '/assets/blue-java.jar', candidatePaths: ['/assets/blue-java.jar'], exists: true }),
        probeJavaExecutable: async () => ({ available: true, executable: 'java', versionMajor: 21, rawOutput: 'openjdk version "21.0.2"' }),
        createJavaRuntimeProcess: async () => ({
          process: { exitCode: null, killed: false, kill: vi.fn() },
          javaExecutable: 'java',
          artifactPath: '/assets/blue-java.jar',
          controlEndpoint: 'tcp://127.0.0.1:5555',
          eventEndpoint: 'tcp://127.0.0.1:5556',
          authToken: 'secret',
          workingDirectory: '/tmp/project',
          stdoutText: '',
          stderrText: '',
        } as any),
        createClient: () => client,
      },
    );

    await expect(manager.reinitializeJython(data, 9, '/tmp/project/demo.blue')).rejects.toThrow(
      'Unable to import Jython modules: ImportError: No module named orchestra (line 2, column 4)',
    );
  });
});
