import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AudioClip, buildWavBytes, Element, TimeBase } from '@blue/data';
import {
  commitAudioFileDrop,
  getFileManagerRoots,
  listFileManagerDirectory,
  normalizeFileManagerHostIdentity,
  validateFileManagerDirectory,
  type AudioFileDropCommitContext,
} from './file-manager-service';

let tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-file-manager-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function makeListingFixture(): string {
  const root = makeTempDir();
  fs.mkdirSync(path.join(root, 'nested'));
  fs.writeFileSync(path.join(root, 'b-file.wav'), 'b');
  fs.writeFileSync(path.join(root, 'A-file.txt'), 'a');
  fs.writeFileSync(path.join(root, '.hidden.wav'), 'h');
  fs.writeFileSync(path.join(root, 'café sound.aif'), 'c');
  return root;
}

describe('getFileManagerRoots', () => {
  it('composes platform root, home, and valid favorites in order', async () => {
    const home = makeTempDir();
    const favorite = makeTempDir();
    const roots = await getFileManagerRoots({
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => [favorite],
    });

    expect(roots.map((root) => root.kind)).toEqual(['static', 'static', 'favorite']);
    expect(roots[0]).toMatchObject({ path: '/', kind: 'static', available: true, isDirectory: true });
    expect(roots[1]).toMatchObject({ path: home, kind: 'static' });
    expect(roots[2]).toMatchObject({ path: favorite, kind: 'favorite' });
    expect(new Set(roots.map((root) => root.id)).size).toBe(3);
  });

  it('omits missing and non-directory favorites without failing', async () => {
    const home = makeTempDir();
    const notADirectory = path.join(home, 'file.txt');
    fs.writeFileSync(notADirectory, 'x');
    const roots = await getFileManagerRoots({
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => [path.join(home, 'missing'), notADirectory, ''],
    });

    expect(roots).toHaveLength(2);
    expect(roots.every((root) => root.kind === 'static')).toBe(true);
  });

  it('omits relative favorite paths instead of resolving them against the process directory', async () => {
    const home = makeTempDir();
    const roots = await getFileManagerRoots({
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => ['relative-favorite'],
    });

    expect(roots).toHaveLength(2);
    expect(roots.every((root) => root.kind === 'static')).toBe(true);
  });

  it('drops a favorite that duplicates a static root identity', async () => {
    const home = makeTempDir();
    const roots = await getFileManagerRoots({
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => [home],
    });

    expect(roots).toHaveLength(2);
    expect(roots.every((root) => root.kind === 'static')).toBe(true);
  });

  it('dedupes favorites that resolve to the same real path', async () => {
    const home = makeTempDir();
    const favorite = makeTempDir();
    const link = path.join(home, 'favorite-link');
    fs.symlinkSync(favorite, link);
    const roots = await getFileManagerRoots({
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => [favorite, link],
    });

    const favoriteRoots = roots.filter((root) => root.kind === 'favorite');
    expect(favoriteRoots).toHaveLength(1);
  });

  it('keeps omitting a missing favorite across reloads while the stored list retains it', async () => {
    const home = makeTempDir();
    const favorite = makeTempDir();
    fs.rmSync(favorite, { recursive: true });
    // The stored preference still names the removed directory, as it would
    // after an app restart before the next successful favorite write.
    const stored = [path.join(home, 'missing-favorite')];
    const deps = {
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => stored,
    };

    const first = await getFileManagerRoots(deps);
    const second = await getFileManagerRoots(deps);
    expect(first.every((root) => root.kind === 'static')).toBe(true);
    expect(second.every((root) => root.kind === 'static')).toBe(true);
    expect(stored).toHaveLength(1);
  });

  it('serves default labels (Root, Home, plain favorite path) and custom labels when provided', async () => {
    const home = makeTempDir();
    const favorite = makeTempDir();
    const rootsDefault = await getFileManagerRoots({
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => [favorite],
    });

    expect(rootsDefault[0].label).toBe('Root');
    expect(rootsDefault[1].label).toBe('Home');
    expect(rootsDefault[2].label).toBe(favorite);

    const rootsCustom = await getFileManagerRoots({
      platform: 'darwin',
      homeDirectory: home,
      loadFavoritePaths: () => [favorite],
      loadRootLabels: () => ({
        '/': 'System Root',
        [home]: 'My User Directory',
        [favorite]: 'Samples Library',
      }),
    });

    expect(rootsCustom[0].label).toBe('System Root');
    expect(rootsCustom[1].label).toBe('My User Directory');
    expect(rootsCustom[2].label).toBe('Samples Library');
  });
});

describe('listFileManagerDirectory', () => {
  it('normalizes host identities explicitly at the platform boundary', () => {
    const windowsPath = String.raw`C:\Users\RunnerAdmin\AppData\Local\Temp\Sample`;
    expect(normalizeFileManagerHostIdentity(windowsPath, 'win32')).toBe(
      'c:/users/runneradmin/appdata/local/temp/sample',
    );
    expect(normalizeFileManagerHostIdentity('/tmp/Sample', 'darwin')).toBe('/tmp/Sample');
  });

  it('lists visible direct children in deterministic order and omits dot entries', async () => {
    const root = makeListingFixture();
    const result = await listFileManagerDirectory({ path: root });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.snapshot.children.map((child) => child.name)).toEqual([
      'A-file.txt',
      'b-file.wav',
      'café sound.aif',
      'nested',
    ]);
    expect(result.snapshot.directoryPath).toBe(root);
    expect(result.snapshot.loadedAt).toBeGreaterThan(0);
  });

  it('reports kinds, expandability, parent paths, and symlinks', async () => {
    const root = makeListingFixture();
    const linkTarget = makeTempDir();
    const linkPath = path.join(root, 'dir-link');
    fs.symlinkSync(linkTarget, linkPath);

    const result = await listFileManagerDirectory({ path: root });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const children = new Map(result.snapshot.children.map((child) => [child.name, child]));

    expect(children.get('nested')).toMatchObject({ kind: 'directory', canExpand: true, isSymlink: false, parentPath: root });
    expect(children.get('A-file.txt')).toMatchObject({ kind: 'file', canExpand: false });
    const expectedLinkIdentity = normalizeFileManagerHostIdentity(
      await fs.promises.realpath(linkPath),
      process.platform,
    );
    expect(children.get('dir-link')).toMatchObject({
      id: expectedLinkIdentity,
      kind: 'directory',
      canExpand: true,
      isSymlink: true,
    });
  });

  it('omits an unreadable child with a directory-level diagnostic', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'visible.wav'), 'x');
    fs.symlinkSync(path.join(root, 'missing-target.wav'), path.join(root, 'dangling.wav'));

    const result = await listFileManagerDirectory({ path: root });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.snapshot.children.map((child) => child.name)).toEqual(['visible.wav']);
    expect(result.snapshot.diagnostic).toBe('1 entry was unreadable and omitted.');
  });

  it('returns typed errors for missing paths, files, and invalid input', async () => {
    const root = makeListingFixture();
    const missing = await listFileManagerDirectory({ path: path.join(root, 'nope') });
    expect(missing).toMatchObject({ status: 'error', code: 'not-found' });

    const notDir = await listFileManagerDirectory({ path: path.join(root, 'A-file.txt') });
    expect(notDir).toMatchObject({ status: 'error', code: 'not-directory' });

    const relative = await listFileManagerDirectory({ path: 'relative/path' });
    expect(relative).toMatchObject({ status: 'error', code: 'not-found' });

    const empty = await listFileManagerDirectory({ path: '' });
    expect(empty).toMatchObject({ status: 'error', code: 'not-found' });
  });

  it('maps a permission failure while reading a directory to permission-denied', async () => {
    const root = makeTempDir();
    const permissionError = Object.assign(new Error('access denied'), { code: 'EACCES' });
    const readdir = vi.spyOn(fs.promises, 'readdir').mockRejectedValueOnce(permissionError);
    try {
      const result = await listFileManagerDirectory({ path: root });
      expect(result).toMatchObject({ status: 'error', code: 'permission-denied' });
    } finally {
      readdir.mockRestore();
    }
  });

  it('handles a 1,000-entry directory exactly once per entry with stable ordering', async () => {
    const root = makeTempDir();
    for (let i = 0; i < 1000; i++) {
      const padded = String(i).padStart(4, '0');
      if (i % 10 === 0) {
        fs.mkdirSync(path.join(root, `dir-${padded}`));
      } else if (i % 10 === 1) {
        fs.writeFileSync(path.join(root, `.hidden-${padded}`), 'x');
      } else {
        fs.writeFileSync(path.join(root, `file-${padded}.wav`), 'x');
      }
    }

    const first = await listFileManagerDirectory({ path: root });
    const second = await listFileManagerDirectory({ path: root });
    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    if (first.status !== 'ok' || second.status !== 'ok') return;

    expect(first.snapshot.children).toHaveLength(900);
    expect(first.snapshot.children.some((child) => child.name.startsWith('.'))).toBe(false);
    expect(first.snapshot.children.map((child) => child.name)).toEqual(
      second.snapshot.children.map((child) => child.name),
    );
    const names = first.snapshot.children.map((child) => child.name);
    const sorted = [...names].sort((a, b) => {
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      if (la !== lb) return la < lb ? -1 : 1;
      return a < b ? -1 : 1;
    });
    expect(names).toEqual(sorted);
  });
});

describe('validateFileManagerDirectory', () => {
  it('accepts a directory and returns the normalized absolute path', async () => {
    const dir = makeTempDir();
    const result = await validateFileManagerDirectory({ path: path.join(dir, '.') });
    expect(result.ok).toBe(true);
    expect(result.normalizedPath).toBe(path.resolve(dir));
  });

  it('rejects files and missing paths with a recoverable message', async () => {
    const root = makeTempDir();
    const file = path.join(root, 'file.txt');
    fs.writeFileSync(file, 'x');

    expect(await validateFileManagerDirectory({ path: file })).toMatchObject({ ok: false });
    expect(await validateFileManagerDirectory({ path: path.join(root, 'gone') })).toMatchObject({ ok: false });
    expect(await validateFileManagerDirectory({ path: '' })).toMatchObject({ ok: false });
    expect(await validateFileManagerDirectory({ path: 'relative/path' })).toMatchObject({ ok: false });
  });
});

describe('commitAudioFileDrop', () => {
  const track = {
    rootGroupId: 'root',
    trackId: 'track-1',
    projectSessionId: 1,
    projectRevision: 1,
  };

  function makeContext(overrides: Partial<AudioFileDropCommitContext['getCurrentProject'] extends () => infer P ? P : never> = {}) {
    const projectDirectory = makeTempDir();
    const commitProjectDocumentPatch = vi.fn().mockResolvedValue({
      revision: 2,
      sessionId: 1,
      changed: true,
    });
    const project = {
      sessionId: 1,
      revision: 1,
      projectDirectory,
      copyToMediaFileOnImport: false,
      mediaFolder: undefined as string | undefined,
      ...overrides,
    };
    const context: AudioFileDropCommitContext = {
      getCurrentProject: () => project,
      commitProjectDocumentPatch,
    };
    return { context, commitProjectDocumentPatch, project };
  }

  function makeSource(name: string, contents: string | Uint8Array = 'not-a-real-audio-header'): string {
    const dir = makeTempDir();
    const source = path.join(dir, name);
    fs.writeFileSync(source, contents);
    return source;
  }

  it('creates one clip through the canonical patch path without copying', async () => {
    const source = makeSource('clip.wav');
    const { context, commitProjectDocumentPatch, project } = makeContext();

    const result = await commitAudioFileDrop(
      { sourcePath: source, sourceKind: 'file-manager', track, startBeats: 2 },
      context,
    );

    expect(result).toMatchObject({
      status: 'created',
      objectName: 'clip.wav',
      storedPath: source,
      copiedToMedia: false,
      receipt: { revision: 2, changed: true },
    });
    expect(commitProjectDocumentPatch).toHaveBeenCalledOnce();
    const patch = commitProjectDocumentPatch.mock.calls[0]![0] as {
      score: { type: string; item: { objectType: string; name: string; serializedXml: string }; startBeats: number };
    };
    expect(patch.score.type).toBe('addTrackItem');
    expect(patch.score.item.objectType).toBe('AudioClip');
    expect(patch.score.item.name).toBe('clip.wav');
    expect(patch.score.item.serializedXml).toContain('<audioClip');
    expect(patch.score.startBeats).toBe(2);
    expect(project.projectDirectory && fs.readdirSync(project.projectDirectory)).toEqual([]);
  });

  it('stores imported audio duration using Java-compatible TIME units', async () => {
    const source = makeSource('clip.wav', buildWavBytes(2, 44100, 16, 44100));
    const { context, commitProjectDocumentPatch } = makeContext();

    await commitAudioFileDrop(
      { sourcePath: source, sourceKind: 'file-manager', track, startBeats: 0 },
      context,
    );

    const patch = commitProjectDocumentPatch.mock.calls[0]![0] as {
      score: { item: { serializedXml: string } };
    };
    const clip = AudioClip.loadFromXML(Element.parse(patch.score.item.serializedXml));
    expect(clip.getAudioDuration()).toBeCloseTo(1, 5);
    expect(clip.getSubjectiveDuration().getTimeBase()).toBe(TimeBase.TIME);
    expect(clip.getSubjectiveDuration().toTotalSecondsValue()).toBeCloseTo(1, 5);
  });

  it('copies into the configured media folder when import copying is enabled', async () => {
    const source = makeSource('clip.wav');
    const { context, commitProjectDocumentPatch, project } = makeContext({
      copyToMediaFileOnImport: true,
    });

    const result = await commitAudioFileDrop(
      { sourcePath: source, sourceKind: 'external-os', track, startBeats: 0 },
      context,
    );

    expect(result).toMatchObject({ status: 'created', copiedToMedia: true });
    const copy = path.join(project.projectDirectory!, 'media', 'clip.wav');
    expect(fs.existsSync(copy)).toBe(true);
    expect((result as { storedPath: string }).storedPath).toBe(path.join('media', 'clip.wav'));
    expect(commitProjectDocumentPatch).toHaveBeenCalledOnce();
  });

  it('rejects a stale project fence without copying or committing', async () => {
    const source = makeSource('clip.wav');
    const { context, commitProjectDocumentPatch, project } = makeContext({
      copyToMediaFileOnImport: true,
      revision: 5,
    });

    const result = await commitAudioFileDrop(
      { sourcePath: source, sourceKind: 'file-manager', track, startBeats: 1 },
      context,
    );

    expect(result).toMatchObject({ status: 'rejected', code: 'stale-project' });
    expect(commitProjectDocumentPatch).not.toHaveBeenCalled();
    expect(fs.readdirSync(project.projectDirectory!)).toEqual([]);
  });

  it('rejects directories, missing files, and unsupported extensions', async () => {
    const directory = makeTempDir();
    const textFile = makeSource('notes.txt');
    const { context, commitProjectDocumentPatch } = makeContext();

    const directoryDrop = await commitAudioFileDrop(
      { sourcePath: directory, sourceKind: 'file-manager', track, startBeats: 0 },
      context,
    );
    expect(directoryDrop).toMatchObject({ status: 'rejected', code: 'not-a-file' });

    const missingDrop = await commitAudioFileDrop(
      { sourcePath: path.join(directory, 'gone.wav'), sourceKind: 'file-manager', track, startBeats: 0 },
      context,
    );
    expect(missingDrop).toMatchObject({ status: 'rejected', code: 'not-a-file' });

    const extensionDrop = await commitAudioFileDrop(
      { sourcePath: textFile, sourceKind: 'external-os', track, startBeats: 0 },
      context,
    );
    expect(extensionDrop).toMatchObject({ status: 'rejected', code: 'unsupported-extension' });
    expect(commitProjectDocumentPatch).not.toHaveBeenCalled();
  });

  it('rejects with no project open', async () => {
    const source = makeSource('clip.wav');
    const context: AudioFileDropCommitContext = {
      getCurrentProject: () => null,
      commitProjectDocumentPatch: vi.fn(),
    };

    const result = await commitAudioFileDrop(
      { sourcePath: source, sourceKind: 'file-manager', track, startBeats: 0 },
      context,
    );
    expect(result).toMatchObject({ status: 'rejected', code: 'no-project' });
  });

  it('reports a failed media copy without committing', async () => {
    const source = makeSource('clip.wav');
    const { context, commitProjectDocumentPatch, project } = makeContext({
      copyToMediaFileOnImport: true,
      // Points the media folder at a file so directory creation fails.
      mediaFolder: 'blocked.txt',
    });
    fs.writeFileSync(path.join(project.projectDirectory!, 'blocked.txt'), 'x');

    const result = await commitAudioFileDrop(
      { sourcePath: source, sourceKind: 'file-manager', track, startBeats: 0 },
      context,
    );

    expect(result).toMatchObject({ status: 'rejected', code: 'copy-failed' });
    expect(commitProjectDocumentPatch).not.toHaveBeenCalled();
  });

  it('cleans up only its own new media copy when the canonical commit rejects', async () => {
    const source = makeSource('clip.wav');
    const { context, commitProjectDocumentPatch, project } = makeContext({
      copyToMediaFileOnImport: true,
    });
    commitProjectDocumentPatch.mockResolvedValue({ revision: 1, sessionId: 1, changed: false });

    const result = await commitAudioFileDrop(
      { sourcePath: source, sourceKind: 'file-manager', track, startBeats: 0 },
      context,
    );

    expect(result).toMatchObject({ status: 'rejected', code: 'invalid-location' });
    const mediaDir = path.join(project.projectDirectory!, 'media');
    expect(fs.existsSync(path.join(mediaDir, 'clip.wav'))).toBe(false);
    // The media folder itself may remain, but no orphaned copy does.
    expect(fs.readdirSync(mediaDir)).toEqual([]);
  });
});
