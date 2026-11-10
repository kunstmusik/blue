import { EventEmitter } from 'node:events';
import { createJavaRuntimeProcess } from './java-runtime-process';
import { describe, expect, it, vi } from 'vitest';
import * as path from 'node:path';
import { JavaRuntimeSessionManager } from './java-runtime-session';

vi.mock('zeromq', () => ({
  Request: class MockRequest {},
  Subscriber: class MockSubscriber {},
}));

function createDataWithDependencies() {
  return {
    getClojureProjectData: () => ({
      getLibraryEntries: () => [
        {
          getDependencyCoordinates: () => 'org.clojure/data.json',
          getVersion: () => '2.5.1',
        },
      ],
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
  it('retains an event-emitting child after signal errors until exit is confirmed (T051)', async () => {
    vi.useFakeTimers();
    try {
      const child = Object.assign(new EventEmitter(), {
        pid: 12345,
        exitCode: null,
        signalCode: null,
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        killed: false,
        kill: vi.fn(() => {
          queueMicrotask(() => child.emit('error', new Error('EPERM')));
          return true;
        }),
      });
      const handle = await createJavaRuntimeProcess('/helper.jar', null, 'java', {
        spawnProcess: (() => child as any) as any,
        reservePort: vi.fn().mockResolvedValueOnce(5555).mockResolvedValueOnce(5556),
        createAuthToken: () => 'secret',
      });
      const createProcess = vi.fn(async () => handle);
      const client = {
        connect: vi.fn(async () => {}),
        disconnect: vi.fn(async () => {}),
        health: vi.fn(async () => ({
          ok: true,
          result: { version: '0.0.1', capabilities: [], cwd: null, methods: [] },
        })),
        initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 1 } })),
        shutdown: vi.fn(async () => ({ ok: true })),
      } as any;
      const manager = new JavaRuntimeSessionManager(
        { isPackaged: false, mainModuleDir: '/repo/dist', userDataPath: '/tmp/user' },
        {
          resolveArtifactPath: () => ({
            artifactPath: '/helper.jar',
            candidatePaths: ['/helper.jar'],
            exists: true,
          }),
          probeJavaExecutable: async () => ({
            available: true,
            executable: 'java',
            versionMajor: 21,
            rawOutput: '21',
          }),
          createJavaRuntimeProcess: createProcess,
          createClient: () => client,
        },
      );
      const data = { getClojureProjectData: () => null } as any;
      await manager.ensureReady(data, 1, '/tmp/project.blue');
      const failed = expect(manager.dispose()).rejects.toThrow('Failed to clean up');
      await vi.advanceTimersByTimeAsync(3000);
      await failed;
      await expect(manager.ensureReady(data, 2, '/tmp/project.blue')).rejects.toThrow(
        'previous helper termination failed',
      );
      expect(createProcess).toHaveBeenCalledTimes(1);
      child.emit('exit', 0, null);
      await manager.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts the helper and initializes a project session with dependencies', async () => {
    const data = createDataWithDependencies();
    const initSession = vi.fn(async () => ({
      ok: true,
      result: { projectSessionId: 7, clojureNamespace: 'user0', dependenciesLoaded: [] },
    }));
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
      })),
      initSession,
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const createClient = vi.fn(() => client);
    const createProcess = vi.fn(
      async () =>
        ({
          process: { exitCode: null, killed: false, kill: vi.fn() },
          javaExecutable: 'java',
          artifactPath: '/assets/blue-java.jar',
          controlEndpoint: 'tcp://127.0.0.1:5555',
          eventEndpoint: 'tcp://127.0.0.1:5556',
          authToken: 'secret',
          workingDirectory: '/tmp/project',
          stdoutText: '',
          stderrText: '',
        }) as any,
    );

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: createProcess,
        createClient,
      },
    );

    const readyClient = await manager.ensureReady(data, 7, '/tmp/project/demo.blue');

    expect(readyClient).toBe(client);
    expect(manager.getJythonStateRevision()).toBe(1);
    expect(createProcess).toHaveBeenCalledWith(
      '/assets/blue-java.jar',
      '/tmp/project',
      'java',
      expect.any(Object),
    );
    expect(initSession).toHaveBeenCalledWith({
      projectSessionId: 7,
      projectDir: '/tmp/project',
      clojureDependencies: [{ coordinates: 'org.clojure/data.json', version: '2.5.1' }],
      jythonPythonLibRoot: path.resolve(
        '/repo/packages/blue-app/dist/main',
        '../../assets/java/pythonLib',
      ),
      jythonUserPythonLibRoot: path.join(
        '/Users/test/Library/Application Support/Blue',
        'pythonLib',
      ),
    });
  });

  it('reuses unchanged sessions and refreshes the helper after dependency edits or removal', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 2, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const createProcess = vi.fn(
      async () =>
        ({
          process: { exitCode: null, killed: false, kill: vi.fn() },
          javaExecutable: 'java',
          artifactPath: '/assets/blue-java.jar',
          controlEndpoint: 'tcp://127.0.0.1:5555',
          eventEndpoint: 'tcp://127.0.0.1:5556',
          authToken: 'secret',
          workingDirectory: '/tmp/project',
          stdoutText: '',
          stderrText: '',
        }) as any,
    );

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: createProcess,
        createClient: () => client,
      },
    );

    await manager.ensureReady(data, 2, '/tmp/project/demo.blue');
    await manager.ensureReady(data, 2, '/tmp/project/demo.blue');

    expect(manager.getJythonStateRevision()).toBe(1);
    expect(createProcess).toHaveBeenCalledTimes(1);
    expect(client.initSession).toHaveBeenCalledTimes(1);

    const withDependencies = createDataWithDependencies();
    await manager.ensureReady(withDependencies, 2, '/tmp/project/demo.blue');
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(createProcess).toHaveBeenCalledTimes(2);
    expect(client.initSession.mock.lastCall?.[0].clojureDependencies).toEqual([
      { coordinates: 'org.clojure/data.json', version: '2.5.1' },
    ]);

    // Removing the library (including by Undo) must discard the old JVM's
    // dynamically loaded classes, rather than reusing its classpath.
    await manager.ensureReady(data, 2, '/tmp/project/demo.blue');
    expect(client.disconnect).toHaveBeenCalledTimes(2);
    expect(createProcess).toHaveBeenCalledTimes(3);
    expect(client.initSession.mock.lastCall?.[0].clojureDependencies).toEqual([]);
  });

  it('disposes the helper when the project directory changes', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn(async () => ({ status: 'exited' as const }));
    const firstClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project-a',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      evaluateClojure: vi.fn(),
      evaluateClojureScoreObject: vi.fn(),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;
    const secondClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project-b',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 2, clojureNamespace: 'user2', dependenciesLoaded: [] },
      })),
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
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi
          .fn()
          .mockResolvedValueOnce(firstHandle)
          .mockResolvedValueOnce(secondHandle),
        createClient: vi.fn().mockReturnValueOnce(firstClient).mockReturnValueOnce(secondClient),
        terminateProcess,
      },
    );

    await manager.ensureReady(data, 1, '/tmp/project-a/demo.blue');
    await manager.ensureReady(data, 2, '/tmp/project-b/demo.blue');

    expect(firstClient.disconnect).toHaveBeenCalledTimes(1);
    expect(terminateProcess).toHaveBeenCalledWith(firstHandle);
    expect(secondClient.initSession).toHaveBeenCalledWith({
      projectSessionId: 2,
      projectDir: '/tmp/project-b',
      clojureDependencies: [],
      jythonPythonLibRoot: path.resolve(
        '/repo/packages/blue-app/dist/main',
        '../../assets/java/pythonLib',
      ),
      jythonUserPythonLibRoot: path.join(
        '/Users/test/Library/Application Support/Blue',
        'pythonLib',
      ),
    });
  });

  it('shares one startup when ensureReady is called concurrently for the same project', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const startup = deferred<any>();
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 4, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
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
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
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
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure', 'jython'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: {
          projectSessionId: 9,
          clojureNamespace: 'user0',
          dependenciesLoaded: [],
          jythonReady: true,
          jythonLibraryPaths: ['/tmp/pythonLib'],
        },
      })),
      reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
      reinitializeJython: vi.fn(async () => ({
        ok: true,
        result: { libraryPaths: ['/tmp/pythonLib'] },
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
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: async () =>
          ({
            process: { exitCode: null, killed: false, kill: vi.fn() },
            javaExecutable: 'java',
            artifactPath: '/assets/blue-java.jar',
            controlEndpoint: 'tcp://127.0.0.1:5555',
            eventEndpoint: 'tcp://127.0.0.1:5556',
            authToken: 'secret',
            workingDirectory: '/tmp/project',
            stdoutText: '',
            stderrText: '',
          }) as any,
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
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure', 'jython'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: {
          projectSessionId: 9,
          clojureNamespace: 'user0',
          dependenciesLoaded: [],
          jythonReady: true,
          jythonLibraryPaths: ['/tmp/pythonLib'],
        },
      })),
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
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: async () =>
          ({
            process: { exitCode: null, killed: false, kill: vi.fn() },
            javaExecutable: 'java',
            artifactPath: '/assets/blue-java.jar',
            controlEndpoint: 'tcp://127.0.0.1:5555',
            eventEndpoint: 'tcp://127.0.0.1:5556',
            authToken: 'secret',
            workingDirectory: '/tmp/project',
            stdoutText: '',
            stderrText: '',
          }) as any,
        createClient: () => client,
      },
    );

    await expect(manager.reinitializeJython(data, 9, '/tmp/project/demo.blue')).rejects.toThrow(
      'Unable to import Jython modules: ImportError: No module named orchestra (line 2, column 4)',
    );
  });

  it('aborts during deferred probe and never launches helper if disposed', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const probeDeferred = deferred<any>();
    const createProcess = vi.fn();

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: () => probeDeferred.promise,
        createJavaRuntimeProcess: createProcess,
      },
    );

    const readyPromise = manager.ensureReady(data, 1, '/tmp/project/demo.blue');
    await manager.dispose();

    probeDeferred.resolve({
      available: true,
      executable: 'java',
      versionMajor: 21,
      rawOutput: 'openjdk version "21.0.2"',
    });

    await expect(readyPromise).rejects.toThrow('Java runtime session was disposed');
    expect(createProcess).not.toHaveBeenCalled();
  });

  it('aborts during deferred reservation before spawn and terminates injected late handles', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn(async () => ({ status: 'exited' as const }));
    const createClient = vi.fn();

    const lateHandle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    const processDeferred = deferred<any>();

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(async (_art, _dir, _java, deps) => {
          await processDeferred.promise;
          if (deps?.isCancelled?.()) {
            throw new Error('Cancelled');
          }
          return lateHandle;
        }),
        createClient,
        terminateProcess,
      },
    );

    const readyPromise = manager.ensureReady(data, 1, '/tmp/project/demo.blue');

    await manager.dispose();
    processDeferred.resolve(null);

    await expect(readyPromise).rejects.toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('terminates late handle returned after disposal before any client work is performed', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn(async () => ({ status: 'exited' as const }));
    const createClient = vi.fn();
    const createProcessDeferred = deferred<any>();

    const lateHandle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(async () => {
          await createProcessDeferred.promise;
          return lateHandle;
        }),
        createClient,
        terminateProcess,
      },
    );

    const readyPromise = manager.ensureReady(data, 1, '/tmp/project/demo.blue');
    await new Promise((r) => setTimeout(r, 10));
    await manager.dispose();
    createProcessDeferred.resolve(null);

    await expect(readyPromise).rejects.toThrow('Java runtime session was disposed during startup');
    expect(terminateProcess).toHaveBeenCalledWith(lateHandle);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('observes spawned handle through onSpawned and awaits bounded cleanup when disposed during await continuation', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateDeferred = deferred<any>();
    const terminateProcess = vi.fn(async () => {
      await terminateDeferred.promise;
      return { status: 'exited' as const };
    });

    const spawnedHandle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    const pauseContinuation = deferred<any>();

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(async (_art, _dir, _java, deps) => {
          deps?.onSpawned?.(spawnedHandle);
          await pauseContinuation.promise;
          return spawnedHandle;
        }),
        terminateProcess,
      },
    );

    const readyPromise = manager.ensureReady(data, 1, '/tmp/project/demo.blue');

    await new Promise((r) => setTimeout(r, 10));

    let disposeSettled = false;
    const disposePromise = manager.dispose().then(() => {
      disposeSettled = true;
    });

    expect(terminateProcess).toHaveBeenCalledWith(spawnedHandle);
    expect(disposeSettled).toBe(false);

    terminateDeferred.resolve(null);
    pauseContinuation.resolve(null);

    await disposePromise;
    expect(disposeSettled).toBe(true);
    await expect(readyPromise).rejects.toThrow('Java runtime session was disposed during startup');
  });

  it('cleans up process and allows retry when client constructor, connect, or health fails', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn(async () => ({ status: 'exited' as const }));

    const handle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    const failingClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: false,
        error: { code: 'HEALTH_CHECK_FAILED', message: 'Helper process unresponsive' },
      })),
    } as any;

    const healthyClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(async () => ({ ...handle })),
        createClient: vi.fn().mockReturnValueOnce(failingClient).mockReturnValueOnce(healthyClient),
        terminateProcess,
      },
    );

    await expect(manager.ensureReady(data, 1, '/tmp/project/demo.blue')).rejects.toThrow(
      'Helper process unresponsive',
    );
    expect(terminateProcess).toHaveBeenCalledTimes(1);
    expect(failingClient.disconnect).toHaveBeenCalledTimes(1);

    const readyClient = await manager.ensureReady(data, 1, '/tmp/project/demo.blue');
    expect(readyClient).toBe(healthyClient);
    expect(healthyClient.initSession).toHaveBeenCalledTimes(1);
  });

  it('disposes during init without waiting for queued shutdown or updating jython revision', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn(async () => ({ status: 'exited' as const }));

    const handle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret',
      workingDirectory: '/tmp/project',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    const initDeferred = deferred<any>();
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
      })),
      initSession: vi.fn(() => initDeferred.promise),
      shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(async () => handle),
        createClient: () => client,
        terminateProcess,
      },
    );

    const readyPromise = manager.ensureReady(data, 1, '/tmp/project/demo.blue');

    await new Promise((r) => setTimeout(r, 10));

    await manager.dispose();

    expect(terminateProcess).toHaveBeenCalledWith(handle);
    expect(client.shutdown).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();

    initDeferred.resolve({
      ok: true,
      result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
    });

    await expect(readyPromise).rejects.toThrow('Java runtime session was disposed during startup');
    expect(manager.getJythonStateRevision()).toBe(0);
    expect(manager.getClient()).toBeNull();
  });

  it('orders three distinct readiness requests sequentially and recovers after intermediate failure', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn(async () => ({ status: 'exited' as const }));

    const executionLog: string[] = [];

    const makeClient = (id: number, failInit = false) => {
      return {
        connect: vi.fn(async () => undefined),
        disconnect: vi.fn(async () => undefined),
        health: vi.fn(async () => ({
          ok: true,
          result: { version: '0.0.1', capabilities: ['clojure'], cwd: `/tmp/p-${id}`, methods: [] },
        })),
        initSession: vi.fn(async () => {
          executionLog.push(`init-${id}`);
          if (failInit) {
            return {
              ok: false,
              error: { code: 'INIT_ERROR', message: `Init failed for ${id}` },
            };
          }
          return {
            ok: true,
            result: { projectSessionId: id, clojureNamespace: `user${id}`, dependenciesLoaded: [] },
          };
        }),
        shutdown: vi.fn(async () => ({ ok: true, result: { accepted: true } })),
      } as any;
    };

    const client1 = makeClient(1, false);
    const client2 = makeClient(2, true);
    const client3 = makeClient(3, false);

    const clients = [client1, client2, client3];

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(async (_art, dir) => {
          executionLog.push(`spawn-${dir}`);
          return {
            process: { exitCode: null, killed: false, kill: vi.fn() },
            javaExecutable: 'java',
            artifactPath: '/assets/blue-java.jar',
            controlEndpoint: 'tcp://127.0.0.1:5555',
            eventEndpoint: 'tcp://127.0.0.1:5556',
            authToken: 'secret',
            workingDirectory: dir,
            stdoutText: '',
            stderrText: '',
            exited: false,
            exitCode: null,
            exitSignal: null,
          } as any;
        }),
        createClient: vi.fn(() => clients.shift()),
        terminateProcess,
      },
    );

    const p1 = manager.ensureReady(data, 1, '/tmp/p-1/demo.blue');
    const p2 = manager.ensureReady(data, 2, '/tmp/p-2/demo.blue');
    const p3 = manager.ensureReady(data, 3, '/tmp/p-3/demo.blue');

    const res1 = await p1;
    expect(res1).toBe(client1);

    await expect(p2).rejects.toThrow('Init failed for 2');

    const res3 = await p3;
    expect(res3).toBe(client3);

    expect(executionLog).toEqual([
      'spawn-/tmp/p-1',
      'init-1',
      'spawn-/tmp/p-2',
      'init-2',
      'spawn-/tmp/p-3',
      'init-3',
    ]);
    expect(manager.getClient()).toBe(client3);
  });

  it('preserves dependency knowledge after init failure and enforces fresh process when dependencies change', async () => {
    const dataWithA = {
      getClojureProjectData: () => ({
        getLibraryEntries: () => [
          { getDependencyCoordinates: () => 'lib-a', getVersion: () => '1.0.0' },
        ],
      }),
    } as any;

    const dataWithB = {
      getClojureProjectData: () => ({
        getLibraryEntries: () => [
          { getDependencyCoordinates: () => 'lib-b', getVersion: () => '2.0.0' },
        ],
      }),
    } as any;

    const terminateProcess = vi.fn(async () => ({ status: 'exited' as const }));
    let spawnCount = 0;

    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project', methods: [] },
      })),
      initSession: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          error: { code: 'LOAD_ERROR', message: 'Failed to download lib-a' },
        })
        .mockResolvedValueOnce({
          ok: true,
          result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
        }),
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(async () => {
          spawnCount++;
          return {
            process: { exitCode: null, killed: false, kill: vi.fn() },
            javaExecutable: 'java',
            artifactPath: '/assets/blue-java.jar',
            controlEndpoint: 'tcp://127.0.0.1:5555',
            eventEndpoint: 'tcp://127.0.0.1:5556',
            authToken: 'secret',
            workingDirectory: '/tmp/project',
            stdoutText: '',
            stderrText: '',
            exited: false,
            exitCode: null,
            exitSignal: null,
          } as any;
        }),
        createClient: () => client,
        terminateProcess,
      },
    );

    await expect(manager.ensureReady(dataWithA, 1, '/tmp/project/demo.blue')).rejects.toThrow(
      'Failed to download lib-a',
    );
    expect(spawnCount).toBe(1);
    expect(manager.getClient()).toBeNull();

    await manager.ensureReady(dataWithB, 1, '/tmp/project/demo.blue');
    expect(spawnCount).toBe(2);
    expect(terminateProcess).toHaveBeenCalledTimes(1);
  });

  it('rejects disposal when process termination fails and prevents conflicting replacement over it', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const terminateProcess = vi.fn(async () => ({
      status: 'failed' as const,
      reason: 'Process refused SIGKILL',
    }));

    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project', methods: [] },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn(
          async () =>
            ({
              process: { exitCode: null, killed: false, kill: vi.fn() },
              javaExecutable: 'java',
              artifactPath: '/assets/blue-java.jar',
              controlEndpoint: 'tcp://127.0.0.1:5555',
              eventEndpoint: 'tcp://127.0.0.1:5556',
              authToken: 'secret',
              workingDirectory: '/tmp/project',
              stdoutText: '',
              stderrText: '',
              exited: false,
              exitCode: null,
              exitSignal: null,
            }) as any,
        ),
        createClient: () => client,
        terminateProcess,
      },
    );

    await manager.ensureReady(data, 1, '/tmp/project/demo.blue');

    await expect(manager.dispose()).rejects.toThrow('Failed to clean up Java runtime process');

    await expect(manager.ensureReady(data, 2, '/tmp/project/demo.blue')).rejects.toThrow(
      'previous helper termination failed',
    );
  });

  it('handles synthetic Windows project directory and dependencies without separator corruption', async () => {
    const data = createDataWithDependencies();
    const initSession = vi.fn(async () => ({
      ok: true,
      result: { projectSessionId: 42, clojureNamespace: 'user0', dependenciesLoaded: [] },
    }));
    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: 'C:\\Users\\test\\project',
          methods: ['runtime.health'],
        },
      })),
      initSession,
    } as any;

    const createProcess = vi.fn(
      async (_art, dir) =>
        ({
          process: { exitCode: null, killed: false, kill: vi.fn() },
          javaExecutable: 'java',
          artifactPath: '/assets/blue-java.jar',
          controlEndpoint: 'tcp://127.0.0.1:5555',
          eventEndpoint: 'tcp://127.0.0.1:5556',
          authToken: 'secret',
          workingDirectory: dir,
          stdoutText: '',
          stderrText: '',
          exited: false,
          exitCode: null,
          exitSignal: null,
        }) as any,
    );

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: 'C:\\Users\\test\\AppData\\Roaming\\Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: createProcess,
        createClient: () => client,
      },
    );

    const winPath = 'C:\\Users\\test\\project\\demo.blue';
    const readyClient = await manager.ensureReady(data, 42, winPath);

    expect(readyClient).toBe(client);
    expect(createProcess).toHaveBeenCalledWith(
      '/assets/blue-java.jar',
      'C:\\Users\\test\\project',
      'java',
      expect.any(Object),
    );
    expect(initSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectSessionId: 42,
        projectDir: 'C:\\Users\\test\\project',
      }),
    );
  });

  it('awaits in-flight replacement termination when disposed and prevents premature disposal resolution', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const replacementDeferred = deferred<any>();

    const handle1 = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret-1',
      workingDirectory: '/tmp/project-1',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    const handle2 = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5557',
      eventEndpoint: 'tcp://127.0.0.1:5558',
      authToken: 'secret-2',
      workingDirectory: '/tmp/project-2',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    const terminateProcess = vi.fn(async (handle) => {
      if (handle === handle1) {
        await replacementDeferred.promise;
        return { status: 'exited' as const };
      }
      return { status: 'exited' as const };
    });

    const client1 = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project-1', methods: [] },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
    } as any;

    const createProcess = vi.fn().mockResolvedValueOnce(handle1).mockResolvedValueOnce(handle2);

    const createClient = vi.fn().mockReturnValue(client1);

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: createProcess,
        createClient,
        terminateProcess,
      },
    );

    // 1. Start first session
    await manager.ensureReady(data, 1, '/tmp/project-1/demo.blue');
    expect(createProcess).toHaveBeenCalledTimes(1);

    // 2. Request different directory to trigger replacement cleanup
    const replacementPromise = manager.ensureReady(data, 2, '/tmp/project-2/demo.blue');

    // Wait a tick for ensureProcess to reach terminateHandle(handle1)
    await new Promise((r) => setTimeout(r, 10));
    expect(terminateProcess).toHaveBeenCalledWith(handle1);

    // 3. Trigger dispose while replacement termination is in-flight
    let disposeSettled = false;
    const disposePromise = manager.dispose().then(() => {
      disposeSettled = true;
    });

    // dispose() must NOT settle while replacement cleanup is in flight
    await new Promise((r) => setTimeout(r, 10));
    expect(disposeSettled).toBe(false);

    // 4. Resolve the replacement termination
    replacementDeferred.resolve(null);

    // 5. Now dispose must complete cleanly
    await disposePromise;
    expect(disposeSettled).toBe(true);

    // Replacement startup was aborted
    await expect(replacementPromise).rejects.toThrow(
      'Java runtime session was disposed during startup',
    );
    // Ensure project-2 was never spawned
    expect(createProcess).toHaveBeenCalledTimes(1);
  });

  it('retains failed replacement handle across disposal and blocks new helpers until retry succeeds', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const replacementDeferred = deferred<any>();

    const handle1 = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret-1',
      workingDirectory: '/tmp/project-1',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    let terminateAttempts = 0;
    let shouldFail = true;

    const terminateProcess = vi.fn(async () => {
      terminateAttempts++;
      if (terminateAttempts === 1) {
        await replacementDeferred.promise;
      }
      if (shouldFail) {
        return { status: 'failed' as const, reason: 'replacement SIGKILL timeout' };
      }
      return { status: 'exited' as const };
    });

    const client1 = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project-1', methods: [] },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
    } as any;

    const createProcess = vi.fn().mockResolvedValue(handle1);
    const createClient = vi.fn().mockReturnValue(client1);

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: createProcess,
        createClient,
        terminateProcess,
      },
    );

    // 1. Initialize first project
    await manager.ensureReady(data, 1, '/tmp/project-1/demo.blue');

    // 2. Start replacement
    const replacementPromise = manager.ensureReady(data, 2, '/tmp/project-2/demo.blue');
    await new Promise((r) => setTimeout(r, 10));

    // 3. Dispose during replacement termination
    const disposePromise = manager.dispose();

    // 4. Fail the in-flight replacement termination
    replacementDeferred.resolve(null);

    // Both replacement and disposal reject due to failed termination
    await expect(disposePromise).rejects.toThrow(
      'Failed to clean up Java runtime process: replacement SIGKILL timeout',
    );
    await expect(replacementPromise).rejects.toThrow();

    // 5. Subsequent ensureReady must be rejected because helper termination failed
    await expect(manager.ensureReady(data, 3, '/tmp/project-3/demo.blue')).rejects.toThrow(
      'previous helper termination failed: replacement SIGKILL timeout',
    );

    // 6. Calling empty/failed dispose without exit still fails and cannot clear the failure
    await expect(manager.dispose()).rejects.toThrow(
      'Failed to clean up Java runtime process: replacement SIGKILL timeout',
    );
    await expect(manager.ensureReady(data, 3, '/tmp/project-3/demo.blue')).rejects.toThrow(
      'previous helper termination failed: replacement SIGKILL timeout',
    );

    // 7. Retry cleanup with confirmed exit
    shouldFail = false;
    await manager.dispose(); // Retry termination succeeds

    // 8. Now that previous failed handle has confirmed exited, a new helper can launch
    const client2 = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project-3', methods: [] },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 3, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
    } as any;
    createClient.mockReturnValue(client2);

    const freshClient = await manager.ensureReady(data, 3, '/tmp/project-3/demo.blue');
    expect(freshClient).toBe(client2);
  });

  it('awaits transport-failure cleanup when disposed and retries failed handle', async () => {
    const data = { getClojureProjectData: () => null } as any;
    const transportDeferred = deferred<any>();

    const handle = {
      process: { exitCode: null, killed: false, kill: vi.fn() },
      javaExecutable: 'java',
      artifactPath: '/assets/blue-java.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'secret-1',
      workingDirectory: '/tmp/project-1',
      stdoutText: '',
      stderrText: '',
      exited: false,
      exitCode: null,
      exitSignal: null,
    } as any;

    let terminateCalls = 0;
    let terminationShouldFail = true;

    const terminateProcess = vi.fn(async (_h) => {
      terminateCalls++;
      if (terminateCalls === 1) {
        await transportDeferred.promise;
      }
      if (terminationShouldFail) {
        return { status: 'failed' as const, reason: 'transport SIGTERM failed' };
      }
      return { status: 'exited' as const };
    });

    let transportFailureCallback: (() => void) | undefined;

    const client = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      health: vi.fn(async () => ({
        ok: true,
        result: { version: '0.0.1', capabilities: ['clojure'], cwd: '/tmp/project-1', methods: [] },
      })),
      initSession: vi.fn(async () => ({
        ok: true,
        result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
      })),
    } as any;

    const manager = new JavaRuntimeSessionManager(
      {
        isPackaged: false,
        mainModuleDir: '/repo/packages/blue-app/dist/main',
        userDataPath: '/Users/test/Library/Application Support/Blue',
      },
      {
        resolveArtifactPath: () => ({
          artifactPath: '/assets/blue-java.jar',
          candidatePaths: ['/assets/blue-java.jar'],
          exists: true,
        }),
        probeJavaExecutable: async () => ({
          available: true,
          executable: 'java',
          versionMajor: 21,
          rawOutput: 'openjdk version "21.0.2"',
        }),
        createJavaRuntimeProcess: vi.fn().mockResolvedValue(handle),
        createClient: (options) => {
          transportFailureCallback = options.onTransportFailure;
          return client;
        },
        terminateProcess,
      },
    );

    await manager.ensureReady(data, 1, '/tmp/project-1/demo.blue');
    expect(transportFailureCallback).toBeDefined();

    // Trigger transport failure
    transportFailureCallback!();
    expect(terminateProcess).toHaveBeenCalledWith(handle);

    // Call dispose while transport cleanup is in flight
    let disposeSettled = false;
    const disposePromise = manager.dispose().catch((e) => {
      disposeSettled = true;
      throw e;
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(disposeSettled).toBe(false);

    // Fail the transport termination
    transportDeferred.resolve(null);

    await expect(disposePromise).rejects.toThrow(
      'Failed to clean up Java runtime process: transport SIGTERM failed',
    );
    expect(disposeSettled).toBe(true);

    // Failed handle is retained; empty disposal cannot clear it
    await expect(manager.ensureReady(data, 2, '/tmp/project-1/demo.blue')).rejects.toThrow(
      'previous helper termination failed: transport SIGTERM failed',
    );

    // Successful retry
    terminationShouldFail = false;
    await manager.dispose();

    // Now cleanup is confirmed and fresh ready can proceed
    const freshClient = await manager.ensureReady(data, 2, '/tmp/project-1/demo.blue');
    expect(freshClient).toBe(client);
  });
});
