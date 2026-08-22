import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import {
  getExampleProjectCandidates,
  resolveExampleProjectPath,
} from './example-project-path';

const RESOURCES = '/Applications/Blue.app/Contents/Resources';

describe('example-project-path', () => {
  it('resolves the development examples location next to the app assets', () => {
    const candidates = getExampleProjectCandidates({
      isPackaged: false,
      mainModuleDir: '/repo/packages/blue-app/dist/main',
    });

    expect(candidates).toEqual([
      path.resolve('/repo/packages/blue-app/dist/main', '../../assets/examples'),
    ]);
  });

  it('lists resources/assets/examples as the first packaged candidate', () => {
    const candidates = getExampleProjectCandidates({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
    });

    expect(candidates[0]).toBe(path.join(RESOURCES, 'assets', 'examples'));
    expect(candidates).toContain(path.join(RESOURCES, 'app.asar.unpacked', 'assets', 'examples'));
    expect(candidates).toContain(
      path.join(RESOURCES, 'app.asar.unpacked', 'packages', 'blue-app', 'assets', 'examples'),
    );
  });

  it('prefers resources/assets/examples for electron-builder extraResources layout', () => {
    const expected = path.join(RESOURCES, 'assets', 'examples');
    const resolution = resolveExampleProjectPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      existsSync: (candidate) => candidate === expected,
    });

    expect(resolution.examplesPath).toBe(expected);
    expect(resolution.exists).toBe(true);
  });

  it('falls back to the first candidate and reports exists=false when none are present', () => {
    const resolution = resolveExampleProjectPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      existsSync: () => false,
    });

    expect(resolution.examplesPath).toBe(path.join(RESOURCES, 'assets', 'examples'));
    expect(resolution.exists).toBe(false);
  });
});
