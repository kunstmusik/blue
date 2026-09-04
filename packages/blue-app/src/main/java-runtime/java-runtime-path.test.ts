import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import {
  getJavaRuntimeArtifactCandidates,
  getJavaRuntimePythonLibraryCandidates,
  resolveJavaRuntimeArtifactPath,
  resolveJavaRuntimePythonLibraryPaths,
} from './java-runtime-path';

const RESOURCES = '/Applications/Blue.app/Contents/Resources';

describe('java-runtime-path', () => {
  it('resolves the development helper location next to the app assets', () => {
    const candidates = getJavaRuntimeArtifactCandidates({
      isPackaged: false,
      mainModuleDir: '/repo/packages/blue-app/dist/main',
    });

    expect(candidates).toEqual([
      path.resolve('/repo/packages/blue-app/dist/main', '../../assets/java/blue-java.jar'),
    ]);
  });

  it('prefers packaged resources candidates when packaged', () => {
    const resolution = resolveJavaRuntimeArtifactPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      existsSync: (candidate) =>
        candidate === path.join(RESOURCES, 'app.asar.unpacked', 'assets', 'java', 'blue-java.jar'),
    });

    expect(resolution.artifactPath).toBe(
      path.join(RESOURCES, 'app.asar.unpacked', 'assets', 'java', 'blue-java.jar'),
    );
    expect(resolution.exists).toBe(true);
  });

  it('prefers resources/assets/java/blue-java.jar for electron-builder extraResources layout', () => {
    const expected = path.join(RESOURCES, 'assets', 'java', 'blue-java.jar');
    const resolution = resolveJavaRuntimeArtifactPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      existsSync: (candidate) => candidate === expected,
    });

    expect(resolution.candidatePaths[0]).toBe(expected);
    expect(resolution.artifactPath).toBe(expected);
    expect(resolution.exists).toBe(true);
  });

  it('lists resources/assets/java/blue-java.jar as the first packaged candidate', () => {
    const candidates = getJavaRuntimeArtifactCandidates({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
    });

    expect(candidates[0]).toBe(path.join(RESOURCES, 'assets', 'java', 'blue-java.jar'));
    expect(candidates).toContain(
      path.join(RESOURCES, 'app.asar.unpacked', 'assets', 'java', 'blue-java.jar'),
    );
    expect(candidates).toContain(
      path.join(
        RESOURCES,
        'app.asar.unpacked',
        'packages',
        'blue-app',
        'assets',
        'java',
        'blue-java.jar',
      ),
    );
  });

  it('resolves the development python library location next to the app assets', () => {
    const candidates = getJavaRuntimePythonLibraryCandidates({
      isPackaged: false,
      mainModuleDir: '/repo/packages/blue-app/dist/main',
    });

    expect(candidates).toEqual([
      path.resolve('/repo/packages/blue-app/dist/main', '../../assets/java/pythonLib'),
    ]);
  });

  it('returns packaged and user python library roots', () => {
    const expected = path.join(RESOURCES, 'app.asar.unpacked', 'assets', 'java', 'pythonLib');
    const resolution = resolveJavaRuntimePythonLibraryPaths({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: (candidate) => candidate === expected,
    });

    expect(resolution.packagedLibraryRoot).toBe(expected);
    expect(resolution.userLibraryRoot).toBe(
      path.join('/Users/test/Library/Application Support/Blue', 'pythonLib'),
    );
    expect(resolution.exists).toBe(true);
  });

  it('prefers resources/assets/java/pythonLib for electron-builder extraResources layout', () => {
    const candidates = getJavaRuntimePythonLibraryCandidates({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
    });

    expect(candidates[0]).toBe(path.join(RESOURCES, 'assets', 'java', 'pythonLib'));
    expect(candidates).toContain(
      path.join(RESOURCES, 'app.asar.unpacked', 'assets', 'java', 'pythonLib'),
    );
  });

  it('resolves resources/assets/java/pythonLib as the packaged Python library root when present', () => {
    const expected = path.join(RESOURCES, 'assets', 'java', 'pythonLib');
    const resolution = resolveJavaRuntimePythonLibraryPaths({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: (candidate) => candidate === expected,
    });

    expect(resolution.packagedLibraryRoot).toBe(expected);
    expect(resolution.exists).toBe(true);
  });
});
