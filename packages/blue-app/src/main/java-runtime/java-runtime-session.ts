import path from 'node:path';
import type { BlueData } from '@blue/data';
import {
  type JavaRuntimeDependencySpec,
  type JavaRuntimeErrorEnvelope,
} from './java-runtime-protocol';
import { JavaRuntimeClient, type JavaRuntimeClientOptions } from './java-runtime-client';
import {
  createJavaRuntimeProcess,
  probeJavaExecutable,
  terminateJavaRuntimeProcess,
  type JavaExecutableProbe,
  type JavaRuntimeProcessHandle,
} from './java-runtime-process';
import {
  resolveJavaRuntimeArtifactPath,
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

function formatRuntimeProtocolError(action: string, error?: JavaRuntimeErrorEnvelope): string {
  if (!error) {
    return `${action} failed`;
  }

  const message = error.message?.trim().length ? error.message : `${action} failed`;
  if (error.line == null) {
    return message;
  }

  if (error.column == null) {
    return `${message} (line ${error.line})`;
  }

  return `${message} (line ${error.line}, column ${error.column})`;
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

  async ensureReady(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClient> {
    const projectDir = resolveProjectDirectory(currentFilePath);

    if (
      this.client &&
      this.processHandle &&
      this.activeProjectSessionId === projectSessionId &&
      this.activeProjectDir === projectDir
    ) {
      return this.client;
    }

    const client = await this.ensureProcess(projectDir);
    const response = await client.initSession({
      projectSessionId,
      projectDir,
      clojureDependencies: extractClojureDependencies(data),
    });

    if (!response.ok) {
      throw new Error(formatRuntimeProtocolError('Failed to initialize Java runtime session', response.error));
    }

    this.activeProjectSessionId = projectSessionId;
    this.activeProjectDir = projectDir;
    return client;
  }

  async reinitialize(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClient> {
    const client = await this.ensureReady(data, projectSessionId, currentFilePath);
    const response = await client.reinitializeClojure();
    if (!response.ok) {
      throw new Error(formatRuntimeProtocolError('Failed to reinitialize Clojure runtime', response.error));
    }
    return client;
  }

  async dispose(): Promise<void> {
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

  private async ensureProcess(projectDir: string | null): Promise<JavaRuntimeClient> {
    if (this.client && this.processHandle && this.activeProjectDir === projectDir) {
      return this.client;
    }

    await this.dispose();

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
    });

    await client.connect();

    const health = await client.health();
    if (!health.ok) {
      await client.disconnect();
      (this.dependencies.terminateProcess ?? terminateJavaRuntimeProcess)(processHandle);
      throw new Error(formatRuntimeProtocolError('Failed to health-check Java runtime', health.error));
    }

    this.processHandle = processHandle;
    this.client = client;
    this.activeProjectDir = projectDir;
    return client;
  }
}