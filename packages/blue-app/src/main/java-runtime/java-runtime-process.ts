import { execFile, spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as net from 'net';

const execFileAsync = promisify(execFile);

export interface JavaExecutableProbe {
  available: boolean;
  executable: string;
  versionMajor: number | null;
  rawOutput: string;
  error?: string;
}

export interface JavaRuntimeProcessHandle {
  process: ChildProcessWithoutNullStreams;
  javaExecutable: string;
  artifactPath: string;
  controlEndpoint: string;
  eventEndpoint: string;
  authToken: string;
  workingDirectory?: string;
  stdoutText: string;
  stderrText: string;
}

interface JavaRuntimeProcessDependencies {
  runCommand?: (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  spawnProcess?: typeof spawn;
  reservePort?: () => Promise<number>;
  createAuthToken?: () => string;
  existsSync?: typeof fs.existsSync;
  statSync?: typeof fs.statSync;
}

export function parseJavaVersion(rawOutput: string): number | null {
  const versionToken = rawOutput.match(/version\s+\"([^\"]+)\"/i)?.[1]
    ?? rawOutput.match(/\"([^\"]+)\"/)?.[1]
    ?? null;

  if (!versionToken) {
    return null;
  }

  const segments = versionToken.split(/[._-]/).filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return null;
  }

  if (segments[0] === '1' && segments.length > 1) {
    return Number.parseInt(segments[1], 10);
  }

  return Number.parseInt(segments[0], 10);
}

export async function probeJavaExecutable(
  executable = 'java',
  dependencies: JavaRuntimeProcessDependencies = {},
): Promise<JavaExecutableProbe> {
  const runCommand = dependencies.runCommand ?? defaultRunCommand;

  try {
    const { stdout, stderr } = await runCommand(executable, ['-version']);
    const rawOutput = [stdout, stderr].filter(Boolean).join('\n').trim();

    return {
      available: true,
      executable,
      versionMajor: parseJavaVersion(rawOutput),
      rawOutput,
    };
  } catch (error) {
    return {
      available: false,
      executable,
      versionMajor: null,
      rawOutput: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createJavaRuntimeProcess(
  artifactPath: string,
  projectDir: string | null,
  javaExecutable = 'java',
  dependencies: JavaRuntimeProcessDependencies = {},
): Promise<JavaRuntimeProcessHandle> {
  const reservePort = dependencies.reservePort ?? reserveFreePort;
  const createAuthToken = dependencies.createAuthToken ?? defaultCreateAuthToken;
  const spawnProcess = dependencies.spawnProcess ?? spawn;
  const existsSync = dependencies.existsSync ?? fs.existsSync;
  const statSync = dependencies.statSync ?? fs.statSync;
  const controlPort = await reservePort();
  const eventPort = await reservePort();
  const authToken = createAuthToken();
  const controlEndpoint = `tcp://127.0.0.1:${controlPort}`;
  const eventEndpoint = `tcp://127.0.0.1:${eventPort}`;
  const workingDirectory = resolveWorkingDirectory(projectDir, existsSync, statSync);

  const child = spawnProcess(
    javaExecutable,
    [
      '-jar',
      artifactPath,
      '--control-endpoint',
      controlEndpoint,
      '--event-endpoint',
      eventEndpoint,
      '--auth-token',
      authToken,
    ],
    {
      cwd: workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ) as unknown as ChildProcessWithoutNullStreams;

  const handle: JavaRuntimeProcessHandle = {
    process: child,
    javaExecutable,
    artifactPath,
    controlEndpoint,
    eventEndpoint,
    authToken,
    workingDirectory,
    stdoutText: '',
    stderrText: '',
  };

  child.stdout.on('data', (chunk: Buffer | string) => {
    handle.stdoutText += chunk.toString();
  });

  child.stderr.on('data', (chunk: Buffer | string) => {
    handle.stderrText += chunk.toString();
  });

  return handle;
}

export function terminateJavaRuntimeProcess(
  handle: JavaRuntimeProcessHandle,
  signal: NodeJS.Signals = 'SIGTERM',
): void {
  if (handle.process.exitCode === null && !handle.process.killed) {
    handle.process.kill(signal);
  }
}

function resolveWorkingDirectory(
  projectDir: string | null,
  existsSync: typeof fs.existsSync,
  statSync: typeof fs.statSync,
): string | undefined {
  if (!projectDir || !existsSync(projectDir)) {
    return undefined;
  }

  try {
    return statSync(projectDir).isDirectory() ? projectDir : undefined;
  } catch {
    return undefined;
  }
}

async function defaultRunCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(command, args, { windowsHide: true });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function defaultCreateAuthToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function reserveFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to reserve a TCP port')));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}