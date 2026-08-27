import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves the bundled `examples/` directory (Java Blue's "Open Example
 * Project" source). Mirrors the candidate strategy in {@link
 * java-runtime-path.ts} so dev and packaged builds resolve the same way.
 *
 * - **Dev (not packaged):** the bundled examples live alongside the other
 *   `assets/` in the package source. `mainModuleDir` is the compiled
 *   `dist/main` output, so the package root is two levels up (`../../`).
 * - **Packaged:** `electron-builder` `extraResources` copies `assets/examples`
 *   to `resources/assets/examples`. The `app.asar.unpacked` candidates cover
 *   any future ASAR-unpacking of the tree.
 */
export interface ExampleProjectPathContext {
  isPackaged: boolean;
  mainModuleDir: string;
  resourcesPath?: string;
  existsSync?: (filePath: string) => boolean;
  isDirectorySync?: (filePath: string) => boolean;
}

export interface ExampleProjectPathResolution {
  examplesPath: string;
  candidatePaths: string[];
  exists: boolean;
}

export function getExampleProjectCandidates(context: ExampleProjectPathContext): string[] {
  if (!context.isPackaged) {
    return [path.resolve(context.mainModuleDir, '../../assets/examples')];
  }

  const resourcesPath = context.resourcesPath ?? '';
  return [
    path.join(resourcesPath, 'assets', 'examples'),
    path.join(resourcesPath, 'app.asar.unpacked', 'assets', 'examples'),
    path.join(resourcesPath, 'app.asar.unpacked', 'packages', 'blue-app', 'assets', 'examples'),
  ];
}

export function resolveExampleProjectPath(
  context: ExampleProjectPathContext,
): ExampleProjectPathResolution {
  const existsSync = context.existsSync ?? fs.existsSync;
  const isDirectorySync = context.isDirectorySync ?? ((candidate: string) => {
    if (context.existsSync !== undefined) {
      return true;
    }
    try {
      return fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  });
  const candidatePaths = getExampleProjectCandidates(context);
  const usableCandidate = candidatePaths.find(
    (candidate) => existsSync(candidate) && isDirectorySync(candidate),
  );
  const examplesPath = usableCandidate ?? candidatePaths[0];

  return {
    examplesPath,
    candidatePaths,
    exists: usableCandidate !== undefined,
  };
}

function isContainedRelativePath(relativePath: string): boolean {
  return relativePath !== ''
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath);
}

/**
 * Resolve an existing path relative to a root, including case-preserving
 * aliases on case-insensitive macOS volumes.
 */
export function tryRelativeExistingExamplePath(
  rootPath: string,
  candidatePath: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  try {
    const realRoot = fs.realpathSync(rootPath);
    const realCandidate = fs.realpathSync(candidatePath);
    const directRelative = path.relative(realRoot, realCandidate);
    if (isContainedRelativePath(directRelative)) {
      return directRelative;
    }

    if (platform !== 'darwin') {
      return null;
    }

    const rootStat = fs.statSync(realRoot);
    const relativeSegments: string[] = [];
    let cursor = realCandidate;
    while (true) {
      const cursorStat = fs.statSync(cursor);
      if (cursorStat.dev === rootStat.dev && cursorStat.ino === rootStat.ino) {
        return relativeSegments.length > 0
          ? relativeSegments.reverse().join(path.sep)
          : null;
      }

      const parent = path.dirname(cursor);
      if (parent === cursor) {
        return null;
      }
      relativeSegments.push(path.basename(cursor));
      cursor = parent;
    }
  } catch {
    return null;
  }
}

/**
 * Resolve a native picker result into the generation currently being offered.
 * macOS can return the equivalent file in the stable `current` tree while an
 * update picker is rooted at a temporary staging tree. That Blue-owned alias
 * is safe to map; packaged and genuinely external selections remain invalid.
 */
export function resolveExampleLibraryPickerSelection(
  selectedPath: string,
  offeredContentRoot: string,
  currentContentRoot: string,
): { filePath: string; relativePath: string } | null {
  if (!selectedPath.toLowerCase().endsWith('.blue')) return null;
  try {
    if (!fs.statSync(selectedPath).isFile()) return null;
  } catch {
    return null;
  }

  const relativePath = tryRelativeExistingExamplePath(
    offeredContentRoot,
    selectedPath,
  ) ?? tryRelativeExistingExamplePath(currentContentRoot, selectedPath);
  if (relativePath === null) return null;

  const offeredFilePath = path.join(offeredContentRoot, relativePath);
  try {
    if (!fs.statSync(offeredFilePath).isFile()) return null;
  } catch {
    return null;
  }
  return { filePath: offeredFilePath, relativePath };
}
