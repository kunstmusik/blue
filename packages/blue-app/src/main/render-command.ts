import { unlink, writeFile } from 'fs/promises';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const tempCsdSnapshots = new Set<string>();

function quoteCommandPart(part: string): string {
  if (!part) {
    return '""';
  }
  if (/[\s"]/u.test(part)) {
    return `"${part.replaceAll('"', '\\"')}"`;
  }
  return part;
}

export async function writeTempCsdSnapshot(
  csdText: string,
  preferredDirectory?: string | null,
): Promise<string | null> {
  const tempName = `tempCsd${Date.now()}${Math.floor(Math.random() * 1_000_000)}.csd`;
  const candidateDirectories = [
    preferredDirectory && preferredDirectory.trim().length > 0 ? preferredDirectory : null,
    os.tmpdir(),
  ];

  for (const directory of candidateDirectories) {
    if (!directory) {
      continue;
    }

    try {
      if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
        continue;
      }

      const tempPath = path.join(directory, tempName);
      await writeFile(tempPath, csdText, 'utf-8');
      tempCsdSnapshots.add(tempPath);
      return tempPath;
    } catch {
      continue;
    }
  }

  return null;
}

export async function cleanupTempCsdSnapshots(): Promise<void> {
  const snapshotPaths = Array.from(tempCsdSnapshots);
  tempCsdSnapshots.clear();

  await Promise.all(
    snapshotPaths.map(async (snapshotPath) => {
      try {
        await unlink(snapshotPath);
      } catch {
        // Ignore cleanup failures for temp snapshots.
      }
    }),
  );
}

export function buildRenderCommandString(
  options: string[],
  csdPath: string | null,
  executablePath?: string | null,
): string {
  const normalizedOptions = options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);

  const hasExecutable = normalizedOptions.length > 0 && !normalizedOptions[0]!.startsWith('-');
  const commandParts = hasExecutable
    ? [...normalizedOptions]
    : [
        executablePath && executablePath.trim().length > 0 ? executablePath : 'csound',
        ...normalizedOptions,
      ];

  if (csdPath) {
    commandParts.push(csdPath);
  }

  return commandParts.map((part) => quoteCommandPart(part)).join(' ');
}

export function formatRenderCommandLine(
  options: string[],
  csdPath: string | null,
  executablePath?: string | null,
): string {
  return `Render Command ( ${buildRenderCommandString(options, csdPath, executablePath)} )\n`;
}
