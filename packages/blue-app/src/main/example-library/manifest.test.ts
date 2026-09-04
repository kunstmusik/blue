import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import {
  buildFactoryManifest,
  createFactoryManifestProvider,
  deriveFactoryRevision,
  FactorySourceError,
  FactoryFileManifestRecord,
} from './manifest';

let tempRoot = '';

function writeTree(files: Record<string, string | Buffer>): string {
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(tempRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (typeof contents === 'string') {
      fs.writeFileSync(target, contents, 'utf8');
    } else {
      fs.writeFileSync(target, contents);
    }
  }
  return tempRoot;
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manifest-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = '';
});

describe('buildFactoryManifest', () => {
  it('hashes text and binary files exactly and records true sizes', async () => {
    const root = writeTree({
      'a/blue1.blue': '<project>',
      'media/loop.wav': Buffer.from([0, 159, 255, 7, 0, 42]),
      'z-deep/nested/file.csd': Buffer.alloc(5000, 0xab),
    });

    const manifest = await buildFactoryManifest(root);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.files.map((f) => f.relativePath)).toEqual([
      'a/blue1.blue',
      'media/loop.wav',
      'z-deep/nested/file.csd',
    ]);

    const loop = manifest.files[1];
    expect(loop.size).toBe(6);
    expect(loop.sha256).toBe(crypto.createHash('sha256').update(loopSha()).digest('hex'));

    function loopSha(): Buffer {
      return Buffer.from([0, 159, 255, 7, 0, 42]);
    }

    expect(manifest.files[2].size).toBe(5000);
  });

  it('derives the same revision regardless of traversal order, mtimes, or install root', async () => {
    const rootA = writeTree({ 'b/x.blue': 'B', 'a/y.blue': 'A' });
    const manifestA = await buildFactoryManifest(rootA);

    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manifest-alt-'));
    try {
      // Same bytes, written in a different order with back-dated mtimes.
      fs.mkdirSync(path.join(otherRoot, 'a'), { recursive: true });
      fs.mkdirSync(path.join(otherRoot, 'b'), { recursive: true });
      fs.writeFileSync(path.join(otherRoot, 'a', 'y.blue'), 'A');
      fs.writeFileSync(path.join(otherRoot, 'b', 'x.blue'), 'B');
      fs.utimesSync(path.join(otherRoot, 'a', 'y.blue'), new Date(0), new Date(0));
      fs.utimesSync(path.join(otherRoot, 'b', 'x.blue'), new Date(0), new Date(0));

      const manifestOther = await buildFactoryManifest(otherRoot);
      expect(manifestOther.revision).toBe(manifestA.revision);
      expect(manifestOther.revision).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(rootA).not.toEqual(otherRoot);
    } finally {
      fs.rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  it('produces sorted portable paths independent of underlying readdir order', async () => {
    const root = writeTree({ 'm.txt': 'm', 'Z.txt': 'Z', 'a/deep.txt': 'd' });

    let reversedCalls = 0;
    const realReaddir = fs.promises.readdir.bind(fs.promises);
    const manifest = await buildFactoryManifest(root, {
      fsSeams: {
        async readdirWithTypes(dirPath) {
          reversedCalls += 1;
          const dirents = await realReaddir(dirPath, { withFileTypes: true });
          return [...dirents].reverse();
        },
      },
    });

    expect(reversedCalls).toBeGreaterThan(0);
    expect(manifest.files.map((f) => f.relativePath)).toEqual(['Z.txt', 'a/deep.txt', 'm.txt']);
  });

  it.each([
    [
      'symlink to file',
      (root: string) => {
        fs.writeFileSync(path.join(root, 'real.blue'), 'x');
        fs.symlinkSync(path.join(root, 'real.blue'), path.join(root, 'link.blue'));
      },
      'symlink-entry',
    ],
    [
      'symlinked directory',
      (root: string) => {
        fs.mkdirSync(path.join(root, 'inside'));
        fs.symlinkSync(path.join(root, 'inside'), path.join(root, 'elsewhere'), 'dir');
      },
      'symlink-entry',
    ],
  ])('rejects %s as invalid factory input', async (_label, setup, expectedCode) => {
    const root = writeTree({ 'base.blue': 'ok' });
    setup(root);
    await expect(buildFactoryManifest(root)).rejects.toMatchObject({ code: expectedCode });
  });

  it('rejects non-regular entries such as sockets through the dirent seam', async () => {
    await expect(
      buildFactoryManifest('/unused', {
        fsSeams: {
          readdirWithTypes: async () => [
            {
              name: 'socket.sock',
              isFile: () => false,
              isDirectory: () => false,
              isSymbolicLink: () => false,
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'non-regular-entry' });
  });

  it('folds directory identities for collisions only on win32 form', async () => {
    const seamDirs = async (dirPath: string) =>
      dirPath === '/unused-fold'
        ? [
            {
              name: 'Media',
              isFile: () => false,
              isDirectory: () => true,
              isSymbolicLink: () => false,
            },
            {
              name: 'media',
              isFile: () => false,
              isDirectory: () => true,
              isSymbolicLink: () => false,
            },
          ]
        : [];

    await expect(
      buildFactoryManifest('/unused-fold', {
        platform: 'win32',
        fsSeams: { readdirWithTypes: seamDirs },
      }),
    ).rejects.toMatchObject({ code: 'path-collision' });

    // POSIX hosts keep both directories distinct; descend and find no files.
    const posixManifest = await buildFactoryManifest('/unused-fold', {
      platform: 'linux',
      fsSeams: { readdirWithTypes: seamDirs },
    });
    expect(posixManifest.files).toHaveLength(0);
  });

  it('rejects a file whose identity a directory already occupies', async () => {
    await expect(
      buildFactoryManifest('/unused-root', {
        platform: 'linux',
        fsSeams: {
          readdirWithTypes: async (dirPath) => {
            if (dirPath === '/unused-root') {
              return [
                {
                  name: 'entry',
                  isFile: () => true,
                  isDirectory: () => false,
                  isSymbolicLink: () => false,
                },
                {
                  name: 'entry',
                  isFile: () => false,
                  isDirectory: () => true,
                  isSymbolicLink: () => false,
                },
              ];
            }
            return [];
          },
          readFileStream: () => Readable.from(['bytes']),
        },
      }),
    ).rejects.toMatchObject({ code: 'path-collision' });
  });

  it('detects case-only collisions between two files through the identity fold', async () => {
    await expect(
      buildFactoryManifest('/unused-case-root', {
        platform: 'win32',
        fsSeams: {
          readdirWithTypes: async () => [
            {
              name: 'SAME.TXT',
              isFile: () => true,
              isDirectory: () => false,
              isSymbolicLink: () => false,
            },
            {
              name: 'same.txt',
              isFile: () => true,
              isDirectory: () => false,
              isSymbolicLink: () => false,
            },
          ],
          readFileStream: () => Readable.from(['first']),
        },
      }),
    ).rejects.toMatchObject({ code: 'path-collision' });
  });

  it('reports unreadable directories as unreadable-factory-source via injected failures', async () => {
    await expect(
      buildFactoryManifest('/does/not/exist', {
        fsSeams: {
          readdirWithTypes: async () => {
            const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
            err.code = 'EACCES';
            throw err;
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'unreadable-factory-source' });
  });

  it('streams large binaries without loading them whole through the seam', async () => {
    const root = writeTree({ 'big.bin': Buffer.alloc(64 * 1024, 0xcd) });
    const realCreateReadStream = fs.createReadStream.bind(fs);
    let maxChunkObserved = 0;
    const manifest = await buildFactoryManifest(root, {
      fsSeams: {
        readFileStream(filePath: string) {
          const source = realCreateReadStream(filePath, { highWaterMark: 4096 });
          const wrapped = new Readable();
          wrapped._read = () => {};
          source.on('data', (chunk: Buffer) => {
            maxChunkObserved = Math.max(maxChunkObserved, chunk.length);
            wrapped.push(chunk);
          });
          source.on('end', () => wrapped.push(null));
          return wrapped;
        },
      },
    });
    expect(manifest.files[0].size).toBe(64 * 1024);
    expect(maxChunkObserved).toBeLessThanOrEqual(4096 + 16);
  });
});

describe('factory manifest provider cache', () => {
  it('reuses one manifest per root per session and honors explicit clearing', async () => {
    let builds = 0;
    const provider = createFactoryManifestProvider({
      build: async () => {
        builds += 1;
        return {
          schemaVersion: 1,
          revision: deriveFactoryRevision([]),
          files: [] as FactoryFileManifestRecord[],
        };
      },
    });

    await provider.get('/tree');
    await provider.get('/tree');
    expect(builds).toBe(1);

    await provider.get('/other-tree');
    expect(builds).toBe(2);

    provider.clearForTesting();
    await provider.get('/tree');
    expect(builds).toBe(3);
  });
});
