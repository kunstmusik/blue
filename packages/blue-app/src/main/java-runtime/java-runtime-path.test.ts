import { describe, expect, it } from 'vitest';
import {
  getJavaRuntimeArtifactCandidates,
  getJavaRuntimePythonLibraryCandidates,
  resolveJavaRuntimeArtifactPath,
  resolveJavaRuntimePythonLibraryPaths,
} from './java-runtime-path';

describe('java-runtime-path', () => {
  it('resolves the development helper location next to the app assets', () => {
    const candidates = getJavaRuntimeArtifactCandidates({
      isPackaged: false,
      mainModuleDir: '/repo/packages/blue-app/dist/main',
    });

    expect(candidates).toEqual(['/repo/packages/blue-app/assets/java/blue-java.jar']);
  });

  it('prefers packaged resources candidates when packaged', () => {
    const resolution = resolveJavaRuntimeArtifactPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: '/Applications/Blue.app/Contents/Resources',
      existsSync: (candidate) => candidate.includes('app.asar.unpacked/assets/java/blue-java.jar'),
    });

    expect(resolution.artifactPath).toBe(
      '/Applications/Blue.app/Contents/Resources/app.asar.unpacked/assets/java/blue-java.jar',
    );
    expect(resolution.exists).toBe(true);
  });

  it('prefers resources/assets/java/blue-java.jar for electron-builder extraResources layout', () => {
    // electron-builder copies assets/java to resources/assets/java as an
    // extraResource. The preferred packaged candidate must be the first
    // match when that file is present so the ASAR-unpacked fallbacks remain
    // compatibility-only.
    const resolution = resolveJavaRuntimeArtifactPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: '/Applications/Blue.app/Contents/Resources',
      existsSync: (candidate) =>
        candidate === '/Applications/Blue.app/Contents/Resources/assets/java/blue-java.jar',
    });

    expect(resolution.candidatePaths[0]).toBe(
      '/Applications/Blue.app/Contents/Resources/assets/java/blue-java.jar',
    );
    expect(resolution.artifactPath).toBe(
      '/Applications/Blue.app/Contents/Resources/assets/java/blue-java.jar',
    );
    expect(resolution.exists).toBe(true);
  });

  it('lists resources/assets/java/blue-java.jar as the first packaged candidate', () => {
    // Guarantee deterministic preference: the electron-builder extraResources
    // destination must appear before any ASAR-unpacked fallback so a future
    // packaging change that only updates one location does not silently break
    // installed-resource resolution.
    const candidates = getJavaRuntimeArtifactCandidates({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: '/Applications/Blue.app/Contents/Resources',
    });

    expect(candidates[0]).toBe(
      '/Applications/Blue.app/Contents/Resources/assets/java/blue-java.jar',
    );
    expect(candidates).toContain(
      '/Applications/Blue.app/Contents/Resources/app.asar.unpacked/assets/java/blue-java.jar',
    );
    expect(candidates).toContain(
      '/Applications/Blue.app/Contents/Resources/app.asar.unpacked/packages/blue-app/assets/java/blue-java.jar',
    );
  });

  it('resolves the development python library location next to the app assets', () => {
    const candidates = getJavaRuntimePythonLibraryCandidates({
      isPackaged: false,
      mainModuleDir: '/repo/packages/blue-app/dist/main',
    });

    expect(candidates).toEqual(['/repo/packages/blue-app/assets/java/pythonLib']);
  });

  it('returns packaged and user python library roots', () => {
    const resolution = resolveJavaRuntimePythonLibraryPaths({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: '/Applications/Blue.app/Contents/Resources',
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: (candidate) => candidate.includes('app.asar.unpacked/assets/java/pythonLib'),
    });

    expect(resolution.packagedLibraryRoot).toBe(
      '/Applications/Blue.app/Contents/Resources/app.asar.unpacked/assets/java/pythonLib',
    );
    expect(resolution.userLibraryRoot).toBe(
      '/Users/test/Library/Application Support/Blue/pythonLib',
    );
    expect(resolution.exists).toBe(true);
  });

  it('prefers resources/assets/java/pythonLib for electron-builder extraResources layout', () => {
    // electron-builder copies the Python library to
    // resources/assets/java/pythonLib. Ensure the preferred candidate is the
    // first packaged location and that ASAR-unpacked fallbacks remain
    // available for backward compatibility without taking precedence.
    const candidates = getJavaRuntimePythonLibraryCandidates({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: '/Applications/Blue.app/Contents/Resources',
    });

    expect(candidates[0]).toBe(
      '/Applications/Blue.app/Contents/Resources/assets/java/pythonLib',
    );
    expect(candidates).toContain(
      '/Applications/Blue.app/Contents/Resources/app.asar.unpacked/assets/java/pythonLib',
    );
  });

  it('resolves resources/assets/java/pythonLib as the packaged Python library root when present', () => {
    const resolution = resolveJavaRuntimePythonLibraryPaths({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: '/Applications/Blue.app/Contents/Resources',
      userDataPath: '/Users/test/Library/Application Support/Blue',
      existsSync: (candidate) =>
        candidate === '/Applications/Blue.app/Contents/Resources/assets/java/pythonLib',
    });

    expect(resolution.packagedLibraryRoot).toBe(
      '/Applications/Blue.app/Contents/Resources/assets/java/pythonLib',
    );
    expect(resolution.exists).toBe(true);
  });
});