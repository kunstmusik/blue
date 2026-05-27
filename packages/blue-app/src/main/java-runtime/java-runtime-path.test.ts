import { describe, expect, it } from 'vitest';
import {
  getJavaRuntimeArtifactCandidates,
  resolveJavaRuntimeArtifactPath,
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
});