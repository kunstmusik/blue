import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PortableExamplePath } from './path-boundary';
import {
  collisionIdentityForPortables,
  ExamplePathError,
  hostCollisionKey,
  lexicalNativeContains,
  parsePortableExamplePath,
  portableToNativePath,
  realPathInsideRoot,
  resolveExamplePathPlatform,
  tryParsePortableExamplePath,
  tryRelativePortableFromNative,
} from './path-boundary';

describe('path-boundary', () => {
  describe('parsePortableExamplePath', () => {
    it('accepts normalized relative forward-slash paths', () => {
      expect(parsePortableExamplePath('techniques/pvoc2.blue')).toBe('techniques/pvoc2.blue');
      expect(parsePortableExamplePath('single.blue')).toBe('single.blue');
    });

    it.each([
      ['', 'non-empty'],
      ['/', 'relative'],
      ['/abs/path.blue', 'relative'],
      ['trailing/', 'edge slashes'],
      ['..\\escape.blue', 'backslash'],
      ['a/../b.blue', 'Dot segments'],
      ['./x.blue', 'Dot segments'],
      ['a//b.blue', 'segment'],
      ['nul\0byte.blue', 'NUL'],
      ['C:/temp/x.blue', 'Drive-qualified'],
      [null, 'strings'],
      [42, 'strings'],
    ])('rejects %j', (input, messagePart) => {
      expect(() => parsePortableExamplePath(input)).toThrow(ExamplePathError);
      expect(() => parsePortableExamplePath(input)).toThrow(messagePart);
    });

    it('returns null through the non-throwing variant for invalid input', () => {
      expect(tryParsePortableExamplePath('../outside.blue')).toBeNull();
      expect(tryParsePortableExamplePath('ok/inside.blue')).toBe('ok/inside.blue');
    });
  });

  describe('portable ↔ native conversion (posix host forms)', () => {
    it('joins validated segments below the root', () => {
      const native = portableToNativePath(
        parsePortableExamplePath('media/loop.wav'),
        '/tmp/library/content',
        {
        platform: 'linux',
      });
      expect(native).toBe('/tmp/library/content/media/loop.wav');
    });

    it('converts a native child back to portable identity', () => {
      const portable = tryRelativePortableFromNative(
        '/tmp/library/content',
        '/tmp/library/content/media/loop.wav',
        { platform: 'linux' },
      );
      expect(portable).toBe('media/loop.wav');
    });

    it('rejects children outside the root without throwing', () => {
      expect(
        tryRelativePortableFromNative('/root/content', '/root/elsewhere/x.blue', {
          platform: 'linux',
        }),
      ).toBeNull();
      expect(
        tryRelativePortableFromNative('/root/content', '/root/content', { platform: 'linux' }),
      ).toBeNull();
    });
  });

  describe('synthetic Windows fixtures', () => {
    const WIN_ROOT = 'C:\\Users\\tester\\AppData\\Roaming\\Blue\\examples\\current\\content';

    it('builds native Windows paths from portable identity using win32 semantics', () => {
      const native = portableToNativePath(
        parsePortableExamplePath('techniques/pvoc2.blue'),
        WIN_ROOT,
        { platform: 'win32' },
      );
      expect(native).toBe(`${WIN_ROOT}\\techniques\\pvoc2.blue`);
    });

    it('round-trips native Windows children back to portable text', () => {
      const child = `${WIN_ROOT}\\sub dir\\Example02.blue`;
      const portable = tryRelativePortableFromNative(WIN_ROOT, child, { platform: 'win32' });
      expect(portable).toBe('sub dir/Example02.blue');

      expect(
        portableToNativePath(portable as PortableExamplePath, WIN_ROOT, { platform: 'win32' }),
      ).toBe(child);
    });

    it('folds case and slash forms for host identity only on win32', () => {
      expect(collisionIdentityForPortables('Media/A.WAV', 'media/a.wav', { platform: 'win32' })).toBe(true);
      expect(collisionIdentityForPortables('Media/A.WAV', 'media/a.wav', { platform: 'linux' })).toBe(false);

      expect(hostCollisionKey('Media\\A.WAV', { platform: 'win32' })).toBe('media/a.wav');
      expect(resolveExamplePathPlatform({ platform: 'darwin' })).toBe('posix');
    });

    it('keeps serialized spelling untouched by identity folding', () => {
      // Serialized factory spelling is preserved; folding happens in memory.
      expect(parsePortableExamplePath('Media/A.WAV')).toBe('Media/A.WAV');
    });

    it('rejects synthetic drive-fragment segments on any platform', () => {
      expect(tryParsePortableExamplePath('C:/Users/x')).toBeNull();
      expect(tryParsePortableExamplePath('c:.blue')).not.toBeNull();
    });
  });

  describe('containment', () => {
    it('accepts lexical descendants and rejects escapes and the root itself', () => {
      expect(lexicalNativeContains('/root/c', '/root/c/a.blue')).toBe(true);
      expect(lexicalNativeContains('/root/c', '/root/c2/a.blue')).toBe(false);
      expect(lexicalNativeContains('/root/c', '/other/a.blue')).toBe(false);
      expect(realPathInsideRoot('/real/root', '/real/root')).toBe(false);
    });

    it('rejects symlink escapes that lexical checks alone would miss', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-expath-'));
      try {
        const contentRoot = path.join(tempDir, 'content');
        const outsideDir = path.join(tempDir, 'outside');
        fs.mkdirSync(contentRoot);
        fs.mkdirSync(outsideDir);
        fs.writeFileSync(path.join(outsideDir, 'target.blue'), '<project/>', 'utf8');

        const escapeLink = path.join(contentRoot, 'escape');
        if (process.platform !== 'win32') {
          fs.symlinkSync(outsideDir, escapeLink, 'dir');
          const linkRealPath = fs.realpathSync(escapeLink);
          expect(linkRealPath).toBe(fs.realpathSync(outsideDir));
          expect(
            realPathInsideRoot(fs.realpathSync(contentRoot), fs.realpathSync(escapeLink)),
          ).toBe(false);
        }
        fs.writeFileSync(path.join(contentRoot, 'inside.blue'), '<project/>', 'utf8');
        expect(
          realPathInsideRoot(fs.realpathSync(contentRoot), fs.realpathSync(path.join(contentRoot, 'inside.blue'))),
        ).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
