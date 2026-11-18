import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { hostCollisionKey, parsePortableExamplePath, PortableExamplePath } from './path-boundary';

/**
 * Deterministic runtime manifest of an installed factory example tree
 * (data-model.md "FactoryManifest"). The revision is content-derived so
 * upgrades, repackaging, and downgrades are recognized without timestamps or
 * app-version ordering.
 */

export const FACTORY_MANIFEST_SCHEMA_VERSION = 1;

export interface FactoryFileManifestRecord {
  relativePath: PortableExamplePath;
  sha256: string;
  size: number;
}

export interface FactoryManifest {
  schemaVersion: typeof FACTORY_MANIFEST_SCHEMA_VERSION;
  /** `sha256:<64 lowercase hex>` over the canonical sorted payload. */
  revision: string;
  files: FactoryFileManifestRecord[];
}

export class FactorySourceError extends Error {
  readonly code:
    | 'symlink-entry'
    | 'non-regular-entry'
    | 'path-collision'
    | 'unreadable-factory-source';

  constructor(code: FactorySourceError['code'], detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'FactorySourceError';
    this.code = code;
  }
}

export interface ManifestDirentLike {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface ManifestFsSeams {
  readdirWithTypes?(dirPath: string): Promise<ManifestDirentLike[]>;
  readFileStream?(filePath: string): Readable;
}

type MinimalDirent = ManifestDirentLike;

function defaultSeams(seams: ManifestFsSeams | undefined): Required<ManifestFsSeams> {
  return {
    readdirWithTypes:
      seams?.readdirWithTypes ??
      ((dirPath) => fs.promises.readdir(dirPath, { withFileTypes: true })),
    readFileStream: seams?.readFileStream ?? ((filePath) => fs.createReadStream(filePath)),
  };
}

const HEX_64 = /^[0-9a-f]{64}$/;

async function hashSingleFile(
  filePath: string,
  readFileStream: (target: string) => Readable,
): Promise<{ sha256: string; size: number }> {
  const hash = createHash('sha256');
  let size = 0;

  const stream = readFileStream(filePath);
  stream.on('data', (chunk: Buffer | string) => {
    hash.update(chunk);
    size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
  });
  await finished(stream);

  return { sha256: hash.digest('hex'), size };
}

interface WalkAccumulator {
  records: Array<Omit<FactoryFileManifestRecord, 'relativePath'> & { relativePathText: string }>;
  seenIdentities: Map<string, 'file' | 'dir'>;
}

async function walkDirectory(
  absoluteDir: string,
  prefix: string,
  platform: NodeJS.Platform,
  fsImpl: Required<ManifestFsSeams>,
  accumulator: WalkAccumulator,
): Promise<void> {
  let entries: MinimalDirent[];
  try {
    entries = await fsImpl.readdirWithTypes(absoluteDir);
  } catch (err) {
    throw new FactorySourceError(
      'unreadable-factory-source',
      `${absoluteDir}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const entry of entries) {
    const childNative = path.join(absoluteDir, entry.name);
    const portableText = prefix === '' ? entry.name : `${prefix}/${entry.name}`;

    if (entry.isSymbolicLink()) {
      throw new FactorySourceError('symlink-entry', portableText);
    }

    if (entry.isDirectory()) {
      const identityKey = hostCollisionKey(portableText, { platform });
      const existing = accumulator.seenIdentities.get(identityKey);
      if (existing !== undefined) {
        throw new FactorySourceError('path-collision', portableText);
      }
      accumulator.seenIdentities.set(identityKey, 'dir');
      await walkDirectory(childNative, portableText, platform, fsImpl, accumulator);
      continue;
    }

    if (!entry.isFile()) {
      throw new FactorySourceError('non-regular-entry', portableText);
    }

    const identityKey = hostCollisionKey(portableText, { platform });
    const existing = accumulator.seenIdentities.get(identityKey);
    if (existing !== undefined) {
      // A directory and a file occupy equivalent host identities, or two
      // files collide case-insensitively on Windows-form hosts.
      throw new FactorySourceError('path-collision', portableText);
    }
    accumulator.seenIdentities.set(identityKey, 'file');

    const { sha256, size } = await hashSingleFile(childNative, fsImpl.readFileStream);
    accumulator.records.push({ relativePathText: portableText, sha256, size });
  }
}

/**
 * Build the immutable manifest for one factory tree. Records are sorted by
 * serialized path; the derived revision covers only content identity, never
 * mtimes or installation roots.
 */
export async function buildFactoryManifest(
  factoryRoot: string,
  options: { platform?: NodeJS.Platform; fsSeams?: ManifestFsSeams } = {},
): Promise<FactoryManifest> {
  const platform = options.platform ?? process.platform;
  const fsImpl = defaultSeams(options.fsSeams);
  const accumulator: WalkAccumulator = { records: [], seenIdentities: new Map() };

  await walkDirectory(factoryRoot, '', platform, fsImpl, accumulator);

  accumulator.records.sort((a, b) =>
    a.relativePathText < b.relativePathText ? -1 : a.relativePathText > b.relativePathText ? 1 : 0,
  );

  const files: FactoryFileManifestRecord[] = accumulator.records.map((record) => ({
    relativePath: parsePortableExamplePath(record.relativePathText),
    sha256: record.sha256,
    size: record.size,
  }));

  return {
    schemaVersion: FACTORY_MANIFEST_SCHEMA_VERSION,
    revision: deriveFactoryRevision(files),
    files,
  };
}

/** Canonical manifest payload → `<revision>`, stable across platforms. */
export function deriveFactoryRevision(files: readonly FactoryFileManifestRecord[]): string {
  const canonical = JSON.stringify(
    files.map((file) => [file.relativePath, file.sha256, file.size]),
  );
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export function isValidFactoryRevision(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('sha256:') &&
    HEX_64.test(value.slice('sha256:'.length))
  );
}

/**
 * Per-session cache hook. The installed tree cannot change while the app
 * runs, so inspection happens once per session per resolved root.
 */
export interface FactoryManifestProvider {
  get(factoryRoot: string): Promise<FactoryManifest>;
  clearForTesting(): void;
}

export function createFactoryManifestProvider(
  options: { build?: typeof buildFactoryManifest } = {},
): FactoryManifestProvider {
  const build = options.build ?? buildFactoryManifest;
  const cacheByRoot = new Map<string, FactoryManifest>();

  return {
    async get(factoryRoot: string): Promise<FactoryManifest> {
      const cached = cacheByRoot.get(factoryRoot);
      if (cached) {
        return cached;
      }
      const manifest = await build(factoryRoot);
      cacheByRoot.set(factoryRoot, manifest);
      return manifest;
    },
    clearForTesting(): void {
      cacheByRoot.clear();
    },
  };
}
