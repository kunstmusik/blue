import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import type {
  AppBuildChannel,
  AppMetadata,
  AppRuntimeVersions,
} from '../shared/app-metadata';

export const UNKNOWN_APP_METADATA_VALUE = 'unknown';

interface ReleaseMetadataDocument {
  appVersion?: unknown;
  sourceRevision?: unknown;
  generatedAt?: unknown;
  channel?: unknown;
}

export interface AppMetadataResolverOptions {
  appVersion?: string;
  appPath?: string;
  resourcesPath?: string;
  isPackaged?: boolean;
  releaseChannel?: string;
  processVersions?: Partial<AppRuntimeVersions>;
  readFile?: (filePath: string) => string;
  getSourceRevision?: () => string | null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function resolveChannel(value: unknown): AppBuildChannel {
  return value === 'development' || value === 'stable' ? value : 'unknown';
}

function resolveBuildDate(value: unknown): string {
  const text = nonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : UNKNOWN_APP_METADATA_VALUE;
}

function readReleaseMetadata(
  options: AppMetadataResolverOptions,
): ReleaseMetadataDocument | null {
  const readFile = options.readFile ?? ((filePath: string) => readFileSync(filePath, 'utf8'));
  const candidatePaths = [
    options.appPath && path.join(options.appPath, 'release-metadata.json'),
    options.resourcesPath && path.join(options.resourcesPath, 'release-metadata.json'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  for (const filePath of candidatePaths) {
    try {
      const parsed: unknown = JSON.parse(readFile(filePath));
      if (parsed && typeof parsed === 'object') {
        return parsed as ReleaseMetadataDocument;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function readGitRevision(): string | null {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return nonEmptyString(revision);
  } catch {
    return null;
  }
}

export function resolveAppMetadata(
  options: AppMetadataResolverOptions = {},
): AppMetadata {
  const isPackaged = options.isPackaged ?? false;
  const releaseMetadata = isPackaged ? readReleaseMetadata(options) : null;
  const processVersions = options.processVersions ?? {};
  const metadataVersion = nonEmptyString(releaseMetadata?.appVersion);
  const version = isPackaged
    ? metadataVersion ?? UNKNOWN_APP_METADATA_VALUE
    : nonEmptyString(options.appVersion) ?? metadataVersion ?? UNKNOWN_APP_METADATA_VALUE;
  const sourceRevision =
    nonEmptyString(releaseMetadata?.sourceRevision)
    ?? (!isPackaged ? (options.getSourceRevision ?? readGitRevision)() : null)
    ?? UNKNOWN_APP_METADATA_VALUE;
  const channel =
    resolveChannel(releaseMetadata?.channel) !== 'unknown'
      ? resolveChannel(releaseMetadata?.channel)
      : resolveChannel(options.releaseChannel) !== 'unknown'
        ? resolveChannel(options.releaseChannel)
        : isPackaged
          ? 'unknown'
          : 'development';

  return {
    version,
    sourceRevision,
    buildDate: resolveBuildDate(releaseMetadata?.generatedAt),
    channel,
    runtime: {
      electron: nonEmptyString(processVersions.electron) ?? UNKNOWN_APP_METADATA_VALUE,
      chromium: nonEmptyString(processVersions.chromium) ?? UNKNOWN_APP_METADATA_VALUE,
      node: nonEmptyString(processVersions.node) ?? UNKNOWN_APP_METADATA_VALUE,
    },
  } satisfies AppMetadata;
}
