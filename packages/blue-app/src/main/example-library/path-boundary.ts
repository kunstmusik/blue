import * as path from 'path';

/**
 * Native ↔ portable path boundary for the example library (see
 * contracts/example-library-state.md, "Portable Path Boundary").
 *
 * Filesystem calls always receive native absolute paths. Manifest and state
 * identity uses a validated relative path with `/` separators. Conversion in
 * either direction happens only against a known native root, and realpath
 * containment is the security check behind picker selections.
 */

declare const portableBrand: unique symbol;
export type PortableExamplePath = string & { readonly [portableBrand]: true };

export type ExamplePathPlatform = 'win32' | 'posix';

export interface ExamplePathOptions {
  platform?: NodeJS.Platform;
}

export class ExamplePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExamplePathError';
  }
}

export function resolveExamplePathPlatform(options: ExamplePathOptions = {}): ExamplePathPlatform {
  const platform = options.platform ?? process.platform;
  return platform === 'win32' ? 'win32' : 'posix';
}

function pathApi(platform: ExamplePathPlatform): typeof path.posix {
  return platform === 'win32' ? path.win32 : path.posix;
}

const PORTABLE_SEGMENT_PATTERN = /^[^/\\]+$/;

function validatePortableText(value: string): PortableExamplePath {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ExamplePathError('Portable example paths must be non-empty text');
  }
  if (value.includes('\\')) {
    throw new ExamplePathError(`Portable example path contains a backslash: ${value}`);
  }
  if (value.includes('\0')) {
    throw new ExamplePathError('Portable example paths must not contain NUL characters');
  }
  if (value.startsWith('/') || value.endsWith('/')) {
    throw new ExamplePathError(`Portable example path must be relative without edge slashes: ${value}`);
  }
  if (path.posix.isAbsolute(value)) {
    throw new ExamplePathError(`Portable example path must be relative: ${value}`);
  }

  const segments = value.split('/');
  for (const segment of segments) {
    if (!PORTABLE_SEGMENT_PATTERN.test(segment)) {
      throw new ExamplePathError(`Invalid path segment in: ${value}`);
    }
    if (segment === '.' || segment === '..') {
      throw new ExamplePathError(`Dot segments are not allowed in: ${value}`);
    }
    if (/^[A-Za-z]:$/.test(segment)) {
      throw new ExamplePathError(`Drive-qualified fragments are not portable identity: ${value}`);
    }
  }

  return value as PortableExamplePath;
}

/**
 * Parse untrusted portable text (state files, manifests). Validation is
 * platform-independent. Throws {@link ExamplePathError} when the value is
 * not valid portable identity.
 */
export function parsePortableExamplePath(raw: unknown): PortableExamplePath {
  if (typeof raw !== 'string') {
    throw new ExamplePathError('Portable example paths must be strings');
  }
  return validatePortableText(raw);
}

/** Non-throwing variant of {@link parsePortableExamplePath}. */
export function tryParsePortableExamplePath(
  raw: unknown,
): PortableExamplePath | null {
  try {
    return parsePortableExamplePath(raw);
  } catch {
    return null;
  }
}

/**
 * Convert validated portable identity back to a native path below
 * `nativeRoot`. The root itself is not revalidated here; callers pass roots
 * they obtained from trusted configuration (`app.getPath`, resolver output).
 */
export function portableToNativePath(
  portable: PortableExamplePath,
  nativeRoot: string,
  options: ExamplePathOptions = {},
): string {
  const platform = resolveExamplePathPlatform(options);
  validatePortableText(portable);
  const segments = portable.split('/');
  for (const segment of segments) {
    if (segment.includes('\\') || segment.includes('\0')) {
      throw new ExamplePathError(`Segment cannot map to a native path: ${portable}`);
    }
  }
  return pathApi(platform).join(nativeRoot, ...segments);
}

/**
 * Convert a native child below `nativeRoot` into portable identity. Returns
 * null when the child is outside the root rather than throwing.
 */
export function tryRelativePortableFromNative(
  nativeRoot: string,
  nativeChild: string,
  options: ExamplePathOptions = {},
): PortableExamplePath | null {
  const platform = resolveExamplePathPlatform(options);
  const api = pathApi(platform);
  const relative = api.relative(nativeRoot, nativeChild);
  if (relative === '' || api.isAbsolute(relative)) {
    return null;
  }
  return tryParsePortableExamplePath(relative.replaceAll('\\', '/'));
}

/**
 * Host identity folding used exclusively for collision detection: Windows
 * filesystems fold case (and accept `/`/`\` equivalently), other platforms
 * compare exactly. Serialized spelling is never changed by this function.
 */
export function collisionIdentityForPortables(
  portableA: string,
  portableB: string,
  options: ExamplePathOptions = {},
): boolean {
  const platform = resolveExamplePathPlatform(options);
  const left = portableA.replaceAll('\\', '/');
  const right = portableB.replaceAll('\\', '/');
  return platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

export function hostCollisionKey(portableOrRelative: string, options: ExamplePathOptions = {}): string {
  const platform = resolveExamplePathPlatform(options);
  const normalized = portableOrRelative.replaceAll('\\', '/');
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/** Lexical containment of `candidate` inside `root` (no symlink resolution). */
export function lexicalNativeContains(
  root: string,
  candidate: string,
  options: ExamplePathOptions = {},
): boolean {
  const platform = resolveExamplePathPlatform(options);
  const api = pathApi(platform);
  const relative = api.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..') && !api.isAbsolute(relative);
}

/**
 * Realpath containment for picker selections: both arguments must already be
 * resolved with `fs.realpathSync` so a symlinked parent cannot escape the
 * content root lexically.
 */
export function realPathInsideRoot(
  contentRootRealPath: string,
  candidateRealPath: string,
  options: ExamplePathOptions = {},
): boolean {
  if (contentRootRealPath === candidateRealPath) {
    return false;
  }
  return lexicalNativeContains(contentRootRealPath, candidateRealPath, options);
}
