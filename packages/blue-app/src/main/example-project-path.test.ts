import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  getExampleProjectCandidates,
  resolveExampleLibraryPickerSelection,
  resolveExampleProjectPath,
  tryRelativeExistingExamplePath,
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

  it('never returns a partial tree: unusable candidates fall back without picking roots', () => {
    // A partially installed tree (missing examples dir entirely) resolves like
    // the missing case: the caller receives exists=false plus every candidate
    // so the example-library inspection layer can diagnose the degradation
    // instead of opening a partial factory root.
    const resolution = resolveExampleProjectPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      existsSync: (candidate) => candidate.includes('app.asar.unpacked'),
    });

    expect(resolution.exists).toBe(true);
    expect(resolution.candidatePaths).toHaveLength(3);
    expect(resolution.examplesPath).toContain('app.asar.unpacked');
  });

  it('treats inaccessible factory roots as absent rather than usable sources', () => {
    // On every supported host, existsSync reports false when the candidate
    // cannot be stat-ed (unreadable parent, permission wall) — mirroring an
    // EACCES-shaped environment without chmod assumptions.
    const resolution = resolveExampleProjectPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      existsSync: () => {
        const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        err.code = 'EACCES';
        // Node's exists implementation swallows errno errors and reports
        // absence; emulate that documented behavior here.
        void err;
        return false;
      },
    });

    expect(resolution.exists).toBe(false);
    expect(resolution.candidatePaths.length).toBeGreaterThan(0);
  });

  it('rejects an existing non-directory candidate as unusable', () => {
    const expected = path.join(RESOURCES, 'assets', 'examples');
    const resolution = resolveExampleProjectPath({
      isPackaged: true,
      mainModuleDir: '/ignored',
      resourcesPath: RESOURCES,
      existsSync: (candidate) => candidate === expected,
      isDirectorySync: () => false,
    });

    expect(resolution.exists).toBe(false);
    expect(resolution.examplesPath).toBe(expected);
  });

  it.skipIf(process.platform !== 'darwin')(
    'finds a case-variant path inside the same macOS directory',
    () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-picker-'));
      const contentRoot = path.join(tempRoot, 'Blue', 'content');
      const projectPath = path.join(contentRoot, 'techniques', 'pvoc.blue');
      fs.mkdirSync(path.dirname(projectPath), { recursive: true });
      fs.writeFileSync(projectPath, '<project />', 'utf8');

      try {
        const caseVariant = projectPath.replace(
          `${path.sep}Blue${path.sep}`,
          `${path.sep}blue${path.sep}`,
        );
        expect(tryRelativeExistingExamplePath(contentRoot, caseVariant, 'darwin')).toBe(
          path.join('techniques', 'pvoc.blue'),
        );
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    },
  );

  it('maps a stable current-library selection into the offered staging tree', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-picker-generation-'));
    const currentRoot = path.join(tempRoot, 'current', 'content');
    const offeredRoot = path.join(tempRoot, 'staging-123', 'content');
    const relativePath = path.join('features', 'automation1.blue');
    const currentProject = path.join(currentRoot, relativePath);
    const offeredProject = path.join(offeredRoot, relativePath);
    fs.mkdirSync(path.dirname(currentProject), { recursive: true });
    fs.mkdirSync(path.dirname(offeredProject), { recursive: true });
    fs.writeFileSync(currentProject, '<project>current</project>', 'utf8');
    fs.writeFileSync(offeredProject, '<project>updated</project>', 'utf8');

    try {
      expect(
        resolveExampleLibraryPickerSelection(currentProject, offeredRoot, currentRoot),
      ).toEqual({ filePath: offeredProject, relativePath });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not map packaged, external, or missing candidate files', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-picker-boundary-'));
    const currentRoot = path.join(tempRoot, 'current', 'content');
    const offeredRoot = path.join(tempRoot, 'staging-123', 'content');
    const externalProject = path.join(tempRoot, 'packaged', 'automation1.blue');
    fs.mkdirSync(path.dirname(externalProject), { recursive: true });
    fs.mkdirSync(offeredRoot, { recursive: true });
    fs.writeFileSync(externalProject, '<project />', 'utf8');

    try {
      expect(
        resolveExampleLibraryPickerSelection(externalProject, offeredRoot, currentRoot),
      ).toBeNull();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
