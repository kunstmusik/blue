import path from 'node:path';
import type { BlueData } from '@blue/data';
import {
  type JavaRuntimeDependencySpec,
  type JavaRuntimeHealthResult,
  type JavaRuntimeResponseEnvelope,
} from './java-runtime-protocol';
import { JavaRuntimeClient, type JavaRuntimeClientOptions } from './java-runtime-client';
import { formatJavaRuntimeProtocolError } from './java-runtime-errors';
import {
  createJavaRuntimeProcess,
  isJavaRuntimeProcessRunning,
  probeJavaExecutable,
  terminateJavaRuntimeProcess,
  type JavaExecutableProbe,
  type JavaProcessTerminationResult,
  type JavaRuntimeProcessDependencies,
  type JavaRuntimeProcessHandle,
} from './java-runtime-process';
import {
  resolveJavaRuntimeArtifactPath,
  resolveJavaRuntimePythonLibraryPaths,
  type JavaRuntimeArtifactResolution,
  type JavaRuntimePathContext,
} from './java-runtime-path';

interface JavaRuntimeSessionDependencies {
  resolveArtifactPath?: (context: JavaRuntimePathContext) => JavaRuntimeArtifactResolution;
  probeJavaExecutable?: (executable: string) => Promise<JavaExecutableProbe>;
  createJavaRuntimeProcess?: (
    artifactPath: string,
    projectDir: string | null,
    javaExecutable: string,
    dependencies?: JavaRuntimeProcessDependencies,
  ) => Promise<JavaRuntimeProcessHandle>;
  createClient?: (options: JavaRuntimeClientOptions) => JavaRuntimeClient;
  terminateProcess?: (handle: JavaRuntimeProcessHandle) => Promise<JavaProcessTerminationResult>;
}

export interface JavaRuntimeSessionManagerOptions extends JavaRuntimePathContext {
  javaExecutable?: string;
}

function resolveProjectDirectory(currentFilePath: string | null): string | null {
  if (!currentFilePath) {
    return null;
  }
  if (currentFilePath.includes('\\')) {
    return path.win32.dirname(currentFilePath);
  }
  return path.dirname(currentFilePath);
}

function extractClojureDependencies(data: BlueData): JavaRuntimeDependencySpec[] {
  const projectData = data.getClojureProjectData();
  if (!projectData) {
    return [];
  }

  return projectData
    .getLibraryEntries()
    .map((entry) => ({
      coordinates: entry.getDependencyCoordinates().trim(),
      version: entry.getVersion().trim(),
    }))
    .filter((entry) => entry.coordinates.length > 0 && entry.version.length > 0);
}

export class JavaRuntimeSessionManager {
  private readonly options: JavaRuntimeSessionManagerOptions;
  private readonly dependencies: JavaRuntimeSessionDependencies;
  private readonly javaExecutable: string;
  private processHandle: JavaRuntimeProcessHandle | null = null;
  private client: JavaRuntimeClient | null = null;
  private processProjectDir: string | null = null;
  private processRequestedDependencies: string | null = null;
  private readonly ownedHandles = new Set<JavaRuntimeProcessHandle>();
  private readonly inFlightTerminations = new Map<
    JavaRuntimeProcessHandle,
    Promise<JavaProcessTerminationResult>
  >();
  private activeProjectSessionId: number | null = null;
  private activeProjectDir: string | null = null;
  private activeClojureDependencies: string | null = null;
  private readinessTail: Promise<unknown> = Promise.resolve();
  private activeDisposalPromise: Promise<void> | null = null;
  private failedCleanupReason: string | null = null;
  private lifecycleEpoch = 0;
  private jythonStateRevision = 0;

  constructor(
    options: JavaRuntimeSessionManagerOptions,
    dependencies: JavaRuntimeSessionDependencies = {},
  ) {
    this.options = options;
    this.dependencies = dependencies;
    this.javaExecutable = options.javaExecutable ?? 'java';
  }

  getClient(): JavaRuntimeClient | null {
    if (this.activeProjectSessionId === null) {
      return null;
    }
    return this.client;
  }

  getJythonStateRevision(): number {
    return this.jythonStateRevision;
  }

  async ensureReady(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClient> {
    const requestedSessionId = projectSessionId;
    const requestedProjectDir = resolveProjectDirectory(currentFilePath);
    const requestedDependencies = extractClojureDependencies(data);
    const requestedDependencyKey = JSON.stringify(requestedDependencies);
    const requestedEpoch = this.lifecycleEpoch;

    const priorTail = this.readinessTail;

    const run = async (): Promise<JavaRuntimeClient> => {
      await priorTail.catch(() => {});

      if (this.activeDisposalPromise) {
        await this.activeDisposalPromise.catch(() => {});
      }

      if (this.inFlightTerminations.size > 0) {
        await Promise.all(Array.from(this.inFlightTerminations.values())).catch(() => {});
      }

      if (this.failedCleanupReason) {
        throw new Error(
          `Cannot initialize Java runtime: previous helper termination failed: ${this.failedCleanupReason}`,
        );
      }

      if (this.lifecycleEpoch !== requestedEpoch) {
        throw new Error('Java runtime session was disposed during startup');
      }

      if (
        this.client &&
        this.processHandle &&
        isJavaRuntimeProcessRunning(this.processHandle) &&
        this.activeProjectSessionId === requestedSessionId &&
        this.activeProjectDir === requestedProjectDir &&
        this.activeClojureDependencies === requestedDependencyKey
      ) {
        return this.client;
      }

      const canReuseProcess =
        this.processHandle !== null &&
        this.client !== null &&
        isJavaRuntimeProcessRunning(this.processHandle) &&
        this.processProjectDir === requestedProjectDir &&
        (this.processRequestedDependencies === null ||
          this.processRequestedDependencies === requestedDependencyKey);

      let client: JavaRuntimeClient;
      if (canReuseProcess) {
        client = this.client!;
      } else {
        client = await this.ensureProcess(requestedProjectDir, requestedEpoch);
      }

      if (this.lifecycleEpoch !== requestedEpoch) {
        throw new Error('Java runtime session was disposed during startup');
      }

      this.activeProjectSessionId = null;
      this.activeProjectDir = null;
      this.activeClojureDependencies = null;
      this.processRequestedDependencies = requestedDependencyKey;

      const pythonLibraryPaths = resolveJavaRuntimePythonLibraryPaths(this.options);
      const response = await client.initSession({
        projectSessionId: requestedSessionId,
        projectDir: requestedProjectDir,
        clojureDependencies: requestedDependencies,
        jythonPythonLibRoot: pythonLibraryPaths.packagedLibraryRoot,
        jythonUserPythonLibRoot: pythonLibraryPaths.userLibraryRoot,
      });

      if (this.lifecycleEpoch !== requestedEpoch) {
        throw new Error('Java runtime session was disposed during startup');
      }

      if (!response.ok) {
        throw new Error(
          formatJavaRuntimeProtocolError(
            'Failed to initialize Java runtime session',
            response.error,
          ),
        );
      }

      if (this.lifecycleEpoch !== requestedEpoch || this.client !== client) {
        throw new Error('Java runtime session was disposed during startup');
      }

      this.jythonStateRevision += 1;
      this.activeProjectSessionId = requestedSessionId;
      this.activeProjectDir = requestedProjectDir;
      this.activeClojureDependencies = requestedDependencyKey;
      return client;
    };

    const execution = run();
    this.readinessTail = execution.then(
      () => undefined,
      () => undefined,
    );
    return await execution;
  }

  async reinitialize(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClient> {
    return this.reinitializeClojure(data, projectSessionId, currentFilePath);
  }

  async reinitializeClojure(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClient> {
    const epoch = this.lifecycleEpoch;
    const client = await this.ensureReady(data, projectSessionId, currentFilePath);

    if (this.lifecycleEpoch !== epoch || this.client !== client) {
      throw new Error('Java runtime session was disposed during reinitialization');
    }

    const response = await client.reinitializeClojure();

    if (this.lifecycleEpoch !== epoch || this.client !== client) {
      throw new Error('Java runtime session was disposed during reinitialization');
    }

    if (!response.ok) {
      throw new Error(
        formatJavaRuntimeProtocolError('Failed to reinitialize Clojure runtime', response.error),
      );
    }
    return client;
  }

  async reinitializeJython(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClient> {
    const epoch = this.lifecycleEpoch;
    const client = await this.ensureReady(data, projectSessionId, currentFilePath);

    if (this.lifecycleEpoch !== epoch || this.client !== client) {
      throw new Error('Java runtime session was disposed during reinitialization');
    }

    const response = await client.reinitializeJython();

    if (this.lifecycleEpoch !== epoch || this.client !== client) {
      throw new Error('Java runtime session was disposed during reinitialization');
    }

    if (!response.ok) {
      throw new Error(
        formatJavaRuntimeProtocolError('Failed to reinitialize Jython runtime', response.error),
      );
    }

    this.jythonStateRevision += 1;
    return client;
  }

  async dispose(): Promise<void> {
    if (this.activeDisposalPromise) {
      return this.activeDisposalPromise;
    }

    this.lifecycleEpoch += 1;

    const client = this.client;
    this.client = null;
    this.processHandle = null;
    this.activeProjectSessionId = null;
    this.activeProjectDir = null;
    this.activeClojureDependencies = null;
    this.processProjectDir = null;
    this.processRequestedDependencies = null;

    if (client) {
      void client.disconnect().catch(() => undefined);
    }

    const handlesToTerminate = new Set<JavaRuntimeProcessHandle>([
      ...this.ownedHandles,
      ...this.inFlightTerminations.keys(),
    ]);

    if (handlesToTerminate.size === 0) {
      if (this.failedCleanupReason !== null) {
        throw new Error(`Failed to clean up Java runtime process: ${this.failedCleanupReason}`);
      }
      return;
    }

    const cleanupPromise = (async () => {
      const terminationPromises = Array.from(handlesToTerminate).map(async (handle) => {
        const result = await this.terminateHandle(handle);
        return { handle, result };
      });

      const outcomes = await Promise.all(terminationPromises);
      const failures = outcomes.filter((o) => o.result.status === 'failed');

      if (failures.length > 0) {
        const reasons = failures
          .map((f) => (f.result.status === 'failed' ? f.result.reason : 'unknown'))
          .join(', ');
        this.failedCleanupReason = reasons;
        throw new Error(`Failed to clean up Java runtime process: ${reasons}`);
      }

      if (this.ownedHandles.size === 0) {
        this.failedCleanupReason = null;
      } else {
        const reasons = this.failedCleanupReason ?? 'unconfirmed exit';
        throw new Error(`Failed to clean up Java runtime process: ${reasons}`);
      }
    })();

    this.activeDisposalPromise = cleanupPromise;

    try {
      await cleanupPromise;
    } finally {
      this.activeDisposalPromise = null;
    }
  }

  private async ensureProcess(
    projectDir: string | null,
    epoch: number,
  ): Promise<JavaRuntimeClient> {
    if (this.client) {
      const oldClient = this.client;
      this.client = null;
      await oldClient.disconnect().catch(() => undefined);
    }

    if (this.processHandle) {
      const handleToTerminate = this.processHandle;
      this.processHandle = null;
      const result = await this.terminateHandle(handleToTerminate);
      if (this.lifecycleEpoch !== epoch) {
        throw new Error('Java runtime session was disposed during startup');
      }
      if (result.status === 'failed') {
        throw new Error(`Failed to terminate Java runtime process: ${result.reason}`);
      }
    }

    if (this.lifecycleEpoch !== epoch) {
      throw new Error('Java runtime session was disposed during startup');
    }

    const artifactResolution = (
      this.dependencies.resolveArtifactPath ?? resolveJavaRuntimeArtifactPath
    )(this.options);
    if (!artifactResolution.exists) {
      throw new Error(`Java runtime helper not found at ${artifactResolution.artifactPath}`);
    }

    const javaProbe = await (this.dependencies.probeJavaExecutable ?? probeJavaExecutable)(
      this.javaExecutable,
    );

    if (this.lifecycleEpoch !== epoch) {
      throw new Error('Java runtime session was disposed during startup');
    }

    if (!javaProbe.available) {
      throw new Error(javaProbe.error ?? 'Java runtime is unavailable');
    }

    if (javaProbe.versionMajor !== null && javaProbe.versionMajor < 17) {
      throw new Error(`Java 17 or newer is required, found ${javaProbe.versionMajor}`);
    }

    const createProcessFn = this.dependencies.createJavaRuntimeProcess ?? createJavaRuntimeProcess;
    let capturedHandle: JavaRuntimeProcessHandle | null = null;

    let processHandle: JavaRuntimeProcessHandle;
    try {
      processHandle = await createProcessFn(
        artifactResolution.artifactPath,
        projectDir,
        this.javaExecutable,
        {
          isCancelled: () => this.lifecycleEpoch !== epoch,
          onSpawned: (handle: JavaRuntimeProcessHandle) => {
            capturedHandle = handle;
            this.ownedHandles.add(handle);
          },
        },
      );
    } catch (error) {
      if (capturedHandle) {
        await this.terminateHandle(capturedHandle).catch(() => undefined);
      }
      throw error;
    }

    this.ownedHandles.add(processHandle);

    if (this.lifecycleEpoch !== epoch) {
      await this.terminateHandle(processHandle);
      throw new Error('Java runtime session was disposed during startup');
    }

    let client: JavaRuntimeClient;
    try {
      client = (this.dependencies.createClient ?? ((options) => new JavaRuntimeClient(options)))({
        endpoint: processHandle.controlEndpoint,
        eventEndpoint: processHandle.eventEndpoint,
        authToken: processHandle.authToken,
        onTransportFailure: () => {
          this.markProcessSuspect(processHandle);
        },
      });
    } catch (error) {
      await this.terminateHandle(processHandle);
      throw error;
    }

    try {
      await client.connect();
    } catch (error) {
      await client.disconnect().catch(() => undefined);
      await this.terminateHandle(processHandle);
      throw error;
    }

    if (this.lifecycleEpoch !== epoch) {
      await client.disconnect().catch(() => undefined);
      await this.terminateHandle(processHandle);
      throw new Error('Java runtime session was disposed during startup');
    }

    let health: JavaRuntimeResponseEnvelope<JavaRuntimeHealthResult>;
    try {
      health = await client.health();
    } catch (error) {
      await client.disconnect().catch(() => undefined);
      await this.terminateHandle(processHandle);
      throw error;
    }

    if (!health.ok) {
      await client.disconnect().catch(() => undefined);
      await this.terminateHandle(processHandle);
      throw new Error(
        formatJavaRuntimeProtocolError('Failed to health-check Java runtime', health.error),
      );
    }

    if (this.lifecycleEpoch !== epoch) {
      await client.disconnect().catch(() => undefined);
      await this.terminateHandle(processHandle);
      throw new Error('Java runtime session was disposed during startup');
    }

    this.processHandle = processHandle;
    this.client = client;
    this.processProjectDir = projectDir;
    this.processRequestedDependencies = null;
    return client;
  }

  private terminateHandle(handle: JavaRuntimeProcessHandle): Promise<JavaProcessTerminationResult> {
    const inFlight = this.inFlightTerminations.get(handle);
    if (inFlight) {
      return inFlight;
    }

    const terminateFn = this.dependencies.terminateProcess ?? terminateJavaRuntimeProcess;
    const promise = (async (): Promise<JavaProcessTerminationResult> => {
      try {
        const result = await terminateFn(handle);
        if (result.status === 'failed') {
          this.failedCleanupReason = result.reason;
        } else {
          this.ownedHandles.delete(handle);
          if (this.processHandle === handle) {
            this.processHandle = null;
          }
          if (this.ownedHandles.size === 0) {
            this.failedCleanupReason = null;
          }
        }
        return result;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.failedCleanupReason = reason;
        return { status: 'failed', reason };
      } finally {
        this.inFlightTerminations.delete(handle);
      }
    })();

    this.inFlightTerminations.set(handle, promise);
    return promise;
  }

  private markProcessSuspect(handle: JavaRuntimeProcessHandle): void {
    if (this.processHandle !== handle && !this.ownedHandles.has(handle)) {
      return;
    }

    const client = this.client;
    this.client = null;
    if (this.processHandle === handle) {
      this.processHandle = null;
    }
    this.activeProjectSessionId = null;
    this.activeProjectDir = null;
    this.activeClojureDependencies = null;
    this.processProjectDir = null;
    this.processRequestedDependencies = null;
    void client?.disconnect().catch(() => undefined);
    void this.terminateHandle(handle).catch(() => undefined);
  }
}
