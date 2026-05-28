import path from 'node:path';
import type { BlueData } from '@blue/data';
import { type JavaRuntimeDependencySpec } from './java-runtime-protocol';
import { JavaRuntimeClient, type JavaRuntimeClientOptions } from './java-runtime-client';
import { formatJavaRuntimeProtocolError } from './java-runtime-errors';
import {
  createJavaRuntimeProcess,
  isJavaRuntimeProcessRunning,
  probeJavaExecutable,
  terminateJavaRuntimeProcess,
  type JavaExecutableProbe,
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
  ) => Promise<JavaRuntimeProcessHandle>;
  createClient?: (options: JavaRuntimeClientOptions) => JavaRuntimeClient;
  terminateProcess?: (handle: JavaRuntimeProcessHandle) => void;
}

export interface JavaRuntimeSessionManagerOptions extends JavaRuntimePathContext {
  javaExecutable?: string;
}

function resolveProjectDirectory(currentFilePath: string | null): string | null {
  return currentFilePath ? path.dirname(currentFilePath) : null;
}

function extractClojureDependencies(data: BlueData): JavaRuntimeDependencySpec[] {
  const projectData = data.getClojureProjectData();
  if (!projectData) {
    return [];
  }

  return projectData.getLibraryEntries()
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
  private activeProjectSessionId: number | null = null;
  private activeProjectDir: string | null = null;
  private pendingReady: Promise<JavaRuntimeClient> | null = null;
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
    const projectDir = resolveProjectDirectory(currentFilePath);

    const cachedClient = this.getCachedReadyClient(projectSessionId, projectDir);
    if (cachedClient) {
      return cachedClient;
    }

    if (this.pendingReady) {
      try {
        await this.pendingReady;
      } catch {
        // The caller below will retry and surface the current failure if it repeats.
      }

      const readyClient = this.getCachedReadyClient(projectSessionId, projectDir);
      if (readyClient) {
        return readyClient;
      }
    }

    const epoch = this.lifecycleEpoch;
    const initialization = this.initializeReady(data, projectSessionId, projectDir, epoch);
    this.pendingReady = initialization;

    try {
      return await initialization;
    } finally {
      if (this.pendingReady === initialization) {
        this.pendingReady = null;
      }
    }
  }

  private async initializeReady(
    data: BlueData,
    projectSessionId: number,
    projectDir: string | null,
    epoch: number,
  ): Promise<JavaRuntimeClient> {
    const client = await this.ensureProcess(projectDir, epoch);
    const pythonLibraryPaths = resolveJavaRuntimePythonLibraryPaths(this.options);
    const response = await client.initSession({
      projectSessionId,
      projectDir,
      clojureDependencies: extractClojureDependencies(data),
      jythonPythonLibRoot: pythonLibraryPaths.packagedLibraryRoot,
      jythonUserPythonLibRoot: pythonLibraryPaths.userLibraryRoot,
    });

    if (!response.ok) {
      throw new Error(formatJavaRuntimeProtocolError('Failed to initialize Java runtime session', response.error));
    }

    if (this.lifecycleEpoch !== epoch) {
      throw new Error('Java runtime session was disposed during startup');
    }

    this.jythonStateRevision += 1;
    this.activeProjectSessionId = projectSessionId;
    this.activeProjectDir = projectDir;
    return client;
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
    const client = await this.ensureReady(data, projectSessionId, currentFilePath);
    const response = await client.reinitializeClojure();
    if (!response.ok) {
      throw new Error(formatJavaRuntimeProtocolError('Failed to reinitialize Clojure runtime', response.error));
    }
    return client;
  }

  async reinitializeJython(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClient> {
    const client = await this.ensureReady(data, projectSessionId, currentFilePath);
    const response = await client.reinitializeJython();
    if (!response.ok) {
      throw new Error(formatJavaRuntimeProtocolError('Failed to reinitialize Jython runtime', response.error));
    }
    this.jythonStateRevision += 1;
    return client;
  }

  async dispose(): Promise<void> {
    this.lifecycleEpoch += 1;
    await this.disposeCurrent();
  }

  private async disposeCurrent(): Promise<void> {
    const client = this.client;
    const processHandle = this.processHandle;

    this.client = null;
    this.processHandle = null;
    this.activeProjectSessionId = null;
    this.activeProjectDir = null;

    if (client) {
      try {
        await client.shutdown();
      } catch {
        // Ignore helper shutdown failures during cleanup.
      }

      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect failures during cleanup.
      }
    }

    if (processHandle) {
      (this.dependencies.terminateProcess ?? terminateJavaRuntimeProcess)(processHandle);
    }
  }

  private getCachedReadyClient(
    projectSessionId: number,
    projectDir: string | null,
  ): JavaRuntimeClient | null {
    if (
      this.client &&
      this.processHandle &&
      isJavaRuntimeProcessRunning(this.processHandle) &&
      this.activeProjectSessionId === projectSessionId &&
      this.activeProjectDir === projectDir
    ) {
      return this.client;
    }

    return null;
  }

  private async ensureProcess(projectDir: string | null, epoch: number): Promise<JavaRuntimeClient> {
    if (
      this.client &&
      this.processHandle &&
      isJavaRuntimeProcessRunning(this.processHandle) &&
      this.activeProjectDir === projectDir
    ) {
      return this.client;
    }

    await this.disposeCurrent();

    const artifactResolution = (this.dependencies.resolveArtifactPath ?? resolveJavaRuntimeArtifactPath)(this.options);
    if (!artifactResolution.exists) {
      throw new Error(`Java runtime helper not found at ${artifactResolution.artifactPath}`);
    }

    const javaProbe = await (this.dependencies.probeJavaExecutable ?? probeJavaExecutable)(this.javaExecutable);
    if (!javaProbe.available) {
      throw new Error(javaProbe.error ?? 'Java runtime is unavailable');
    }

    if (javaProbe.versionMajor !== null && javaProbe.versionMajor < 17) {
      throw new Error(`Java 17 or newer is required, found ${javaProbe.versionMajor}`);
    }

    const processHandle = await (this.dependencies.createJavaRuntimeProcess ?? createJavaRuntimeProcess)(
      artifactResolution.artifactPath,
      projectDir,
      this.javaExecutable,
    );
    const client = (this.dependencies.createClient ?? ((options) => new JavaRuntimeClient(options)))({
      endpoint: processHandle.controlEndpoint,
      eventEndpoint: processHandle.eventEndpoint,
      authToken: processHandle.authToken,
      onTransportFailure: () => {
        this.markProcessSuspect(processHandle);
      },
    });

    await client.connect();

    const health = await client.health();
    if (!health.ok) {
      await client.disconnect();
      (this.dependencies.terminateProcess ?? terminateJavaRuntimeProcess)(processHandle);
      throw new Error(formatJavaRuntimeProtocolError('Failed to health-check Java runtime', health.error));
    }

    if (this.lifecycleEpoch !== epoch) {
      await client.disconnect();
      (this.dependencies.terminateProcess ?? terminateJavaRuntimeProcess)(processHandle);
      throw new Error('Java runtime session was disposed during startup');
    }

    this.processHandle = processHandle;
    this.client = client;
    this.activeProjectDir = projectDir;
    return client;
  }

  private markProcessSuspect(handle: JavaRuntimeProcessHandle): void {
    if (this.processHandle !== handle) {
      return;
    }

    const client = this.client;
    this.client = null;
    this.processHandle = null;
    this.activeProjectSessionId = null;
    this.activeProjectDir = null;
    void client?.disconnect().catch(() => undefined);
    (this.dependencies.terminateProcess ?? terminateJavaRuntimeProcess)(handle);
  }
}
