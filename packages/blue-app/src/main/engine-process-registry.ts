import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export type EngineSessionKind = 'realtime' | 'blue-live';

export interface EngineProcessManifestV1 {
  version: 1;
  kind: EngineSessionKind;
  pid: number;
  ownerPid: number;
  enginePath: string;
  spawnArgs: string[];
  controlEndpoint: string;
  pubEndpoint: string;
  shmName: string;
  startedAt: number;
}

export interface EngineProcessManifestV2 {
  version: 2;
  sessionId: string;
  kind: EngineSessionKind;
  pid: number;
  ownerPid: number;
  enginePath: string;
  spawnArgs: string[];
  controlEndpoint: string;
  pubEndpoint: string;
  shmName: string;
  startedAt: number;
  ownerStartToken?: string | null;
  engineStartToken?: string | null;
}

export type EngineProcessManifest = EngineProcessManifestV1 | EngineProcessManifestV2;

export interface EngineProcessSweepPlan {
  action: 'keep' | 'remove' | 'terminate';
  reason: string;
}

export interface EngineProcessSweepReport {
  inspected: number;
  removed: number;
  terminated: number;
  kept: number;
  retained: number;
}

const registryDir = path.join(os.tmpdir(), 'blue-electron', 'engine-processes');

function getManifestFileName(
  manifest: Pick<EngineProcessManifestV1, 'kind' | 'ownerPid' | 'pid' | 'startedAt'> & {
    sessionId?: string;
  },
): string {
  const identifier = manifest.sessionId ?? String(manifest.startedAt);
  return (
    [
      'blue-engine',
      manifest.kind,
      String(manifest.ownerPid),
      String(manifest.pid),
      identifier,
    ].join('-') + '.json'
  );
}

export function getEngineProcessRegistryDir(): string {
  return registryDir;
}

export function getEngineProcessManifestPath(
  manifest: Pick<EngineProcessManifestV1, 'kind' | 'ownerPid' | 'pid' | 'startedAt'> & {
    sessionId?: string;
  },
): string {
  return path.join(registryDir, getManifestFileName(manifest));
}

function normalizePathForComparison(p: string): string {
  return p.replace(/\\/g, '/').replace(/^"|"$/g, '').trim();
}

function getPlatformAgnosticBasename(p: string): string {
  const normalized = normalizePathForComparison(p);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

export function matchesTrackedEngineCommandLine(
  commandLine: string,
  manifest: Pick<EngineProcessManifest, 'enginePath' | 'spawnArgs' | 'shmName'>,
): boolean {
  const normalized = commandLine.trim();
  if (!normalized) {
    return false;
  }

  const normalizedCommandLine = normalizePathForComparison(normalized);
  const normalizedEnginePath = normalizePathForComparison(manifest.enginePath);
  const engineBaseName = getPlatformAgnosticBasename(manifest.enginePath);

  const expectedParts = new Set<string>([
    manifest.shmName,
    ...manifest.spawnArgs.filter((part) => part.trim().length > 0),
  ]);

  // Verify that the command line references the executable or its basename
  const hasEngineRef =
    normalizedCommandLine.includes(normalizedEnginePath) ||
    normalizedCommandLine.includes(engineBaseName) ||
    normalized.includes('blue-engine');

  if (!hasEngineRef) {
    return false;
  }

  for (const part of expectedParts) {
    if (!part) {
      continue;
    }
    const normalizedPart = normalizePathForComparison(part);
    if (!normalizedCommandLine.includes(normalizedPart) && !normalized.includes(part)) {
      return false;
    }
  }

  return true;
}

export function planEngineProcessSweep(
  manifest: EngineProcessManifest,
  state: {
    ownerAlive: boolean;
    engineAlive: boolean;
    commandLine: string | null;
    ownerIdentityMatch?: boolean;
    engineIdentityMatch?: boolean;
  },
): EngineProcessSweepPlan {
  if (!state.engineAlive) {
    return { action: 'remove', reason: 'engine process already exited' };
  }

  if (state.ownerAlive && state.ownerIdentityMatch !== false) {
    return { action: 'keep', reason: 'owner process still running' };
  }

  if (state.engineIdentityMatch === false) {
    return {
      action: 'remove',
      reason: 'engine process identity no longer matches tracked process',
    };
  }

  if (state.commandLine === null) {
    return { action: 'keep', reason: 'unverifiable command line; failing closed' };
  }

  if (!matchesTrackedEngineCommandLine(state.commandLine, manifest)) {
    return { action: 'remove', reason: 'process command line no longer matches tracked engine' };
  }

  if (state.engineIdentityMatch !== true) {
    return { action: 'keep', reason: 'unverifiable engine process identity; failing closed' };
  }

  return { action: 'terminate', reason: 'stale engine with dead owner process' };
}

export async function registerEngineProcess(manifest: EngineProcessManifest): Promise<string> {
  await fs.promises.mkdir(registryDir, { recursive: true });
  const record =
    manifest.version === 2
      ? {
          ...manifest,
          ownerStartToken:
            manifest.ownerStartToken ?? (await getProcessStartToken(manifest.ownerPid)),
          engineStartToken: manifest.engineStartToken ?? (await getProcessStartToken(manifest.pid)),
        }
      : manifest;
  const filePath = getEngineProcessManifestPath(record);
  const tempPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tempPath, JSON.stringify(record, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, filePath);
  return filePath;
}

export async function removeEngineProcessRecord(
  filePath: string | null | undefined,
): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Ignore missing or already-cleaned registry files.
  }
}

export async function sweepStaleBlueEngineProcesses(): Promise<EngineProcessSweepReport> {
  const report: EngineProcessSweepReport = {
    inspected: 0,
    removed: 0,
    terminated: 0,
    kept: 0,
    retained: 0,
  };

  try {
    await fs.promises.mkdir(registryDir, { recursive: true });
  } catch {
    return report;
  }

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(registryDir, { withFileTypes: true });
  } catch {
    return report;
  }

  const terminationByEnginePid = new Map<number, boolean>();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const manifestPath = path.join(registryDir, entry.name);
    if (entry.name.endsWith('.tmp')) {
      await removeEngineProcessRecord(manifestPath);
      continue;
    }

    if (!entry.name.endsWith('.json')) {
      continue;
    }

    report.inspected += 1;

    let manifest: EngineProcessManifest | null = null;
    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        (parsed.version !== 1 && parsed.version !== 2) ||
        (parsed.kind !== 'realtime' && parsed.kind !== 'blue-live') ||
        typeof parsed.pid !== 'number' ||
        typeof parsed.ownerPid !== 'number' ||
        typeof parsed.enginePath !== 'string' ||
        !Array.isArray(parsed.spawnArgs) ||
        !parsed.spawnArgs.every((arg) => typeof arg === 'string') ||
        typeof parsed.controlEndpoint !== 'string' ||
        typeof parsed.pubEndpoint !== 'string' ||
        typeof parsed.shmName !== 'string' ||
        typeof parsed.startedAt !== 'number' ||
        (parsed.version === 2 && typeof parsed.sessionId !== 'string') ||
        (parsed.version === 2 &&
          parsed.ownerStartToken !== undefined &&
          parsed.ownerStartToken !== null &&
          typeof parsed.ownerStartToken !== 'string') ||
        (parsed.version === 2 &&
          parsed.engineStartToken !== undefined &&
          parsed.engineStartToken !== null &&
          typeof parsed.engineStartToken !== 'string')
      ) {
        throw new Error('invalid manifest');
      }

      manifest = parsed as unknown as EngineProcessManifest;
    } catch {
      await removeEngineProcessRecord(manifestPath);
      report.removed += 1;
      continue;
    }

    const ownerAlive = isProcessAlive(manifest.ownerPid);
    const engineAlive = isProcessAlive(manifest.pid);
    const ownerStartToken = ownerAlive ? await getProcessStartToken(manifest.ownerPid) : null;
    const engineStartToken = engineAlive ? await getProcessStartToken(manifest.pid) : null;
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive,
      engineAlive,
      commandLine: await readProcessCommandLine(manifest.pid),
      ownerIdentityMatch:
        manifest.version === 2 && manifest.ownerStartToken && ownerStartToken
          ? manifest.ownerStartToken === ownerStartToken
          : undefined,
      engineIdentityMatch:
        manifest.version === 2 && manifest.engineStartToken && engineStartToken
          ? manifest.engineStartToken === engineStartToken
          : undefined,
    });

    switch (plan.action) {
      case 'keep':
        report.kept += 1;
        break;
      case 'remove':
        await removeEngineProcessRecord(manifestPath);
        report.removed += 1;
        break;
      case 'terminate':
        let terminated = terminationByEnginePid.get(manifest.pid);
        if (terminated === undefined) {
          terminated = await terminateEngineProcess(manifest.pid);
          terminationByEnginePid.set(manifest.pid, terminated);
        }
        if (terminated) {
          await removeEngineProcessRecord(manifestPath);
          report.terminated += 1;
        } else {
          report.kept += 1;
          report.retained += 1;
        }
        break;
    }
  }

  return report;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function readProcessCommandLine(pid: number): Promise<string | null> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
        ],
        { windowsHide: true },
      );

      const commandLine = stdout.trim();
      return commandLine.length > 0 ? commandLine : null;
    }

    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'command='], {
      windowsHide: true,
    });
    const commandLine = stdout.trim();
    return commandLine.length > 0 ? commandLine : null;
  } catch {
    return null;
  }
}

async function getProcessStartToken(pid: number): Promise<string | null> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CreationDate`,
        ],
        { windowsHide: true },
      );
      const token = stdout.trim();
      return token.length > 0 ? `windows:${token}` : null;
    }

    if (process.platform === 'linux') {
      const stat = await fs.promises.readFile(`/proc/${pid}/stat`, 'utf-8');
      const commandEnd = stat.lastIndexOf(')');
      if (commandEnd < 0) return null;
      const fields = stat
        .slice(commandEnd + 2)
        .trim()
        .split(/\s+/);
      const startTime = fields[19];
      return startTime ? `linux:${startTime}` : null;
    }

    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'lstart='], {
      windowsHide: true,
    });
    const token = stdout.trim();
    return token.length > 0 ? `posix:${token}` : null;
  } catch {
    return null;
  }
}

async function terminateEngineProcess(pid: number): Promise<boolean> {
  if (!isProcessAlive(pid)) {
    return true;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return !isProcessAlive(pid);
  }

  for (const delayMs of [100, 200, 400]) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (!isProcessAlive(pid)) {
      return true;
    }
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    return !isProcessAlive(pid);
  }

  for (const delayMs of [100, 200, 400]) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (!isProcessAlive(pid)) {
      return true;
    }
  }

  return false;
}
