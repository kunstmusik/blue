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
  const candidatePaths = getExampleProjectCandidates(context);
  const examplesPath = candidatePaths.find((candidate) => existsSync(candidate)) ?? candidatePaths[0];

  return {
    examplesPath,
    candidatePaths,
    exists: existsSync(examplesPath),
  };
}
