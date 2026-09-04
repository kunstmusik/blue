import { describe, expect, it } from 'vitest';
import {
  BLUE_FILE_MANAGER_DRAG_MIME,
  CSOUND_AUDIO_SOURCE_EXTENSIONS,
  decodeFileUri,
  getFileManagerActionState,
  isCsoundAudioSourcePath,
  normalizeFileManagerFavorites,
  normalizeFileManagerRootLabels,
  parseExternalOsFileDrop,
  parseFileManagerDragPayload,
  serializeFileManagerDragPayload,
} from './file-manager';

describe('file-manager shared contract', () => {
  describe('context action eligibility matrix', () => {
    it('regular files expose no File Manager actions', () => {
      expect(getFileManagerActionState({ nodeKind: 'file', rootKind: null })).toEqual({
        refreshFolder: false,
        addToFavorites: false,
        removeFromFavorites: false,
      });
    });

    it('static roots expose Refresh Folder only', () => {
      expect(getFileManagerActionState({ nodeKind: 'directory', rootKind: 'static' })).toEqual({
        refreshFolder: true,
        addToFavorites: false,
        removeFromFavorites: false,
      });
    });

    it('favorite roots expose Refresh Folder and Remove from Favorites', () => {
      expect(getFileManagerActionState({ nodeKind: 'directory', rootKind: 'favorite' })).toEqual({
        refreshFolder: true,
        addToFavorites: false,
        removeFromFavorites: true,
      });
    });

    it('ordinary directories expose Refresh Folder and Add to Favorites', () => {
      expect(getFileManagerActionState({ nodeKind: 'directory', rootKind: null })).toEqual({
        refreshFolder: true,
        addToFavorites: true,
        removeFromFavorites: false,
      });
    });
  });

  describe('favorite settings normalization', () => {
    it('missing and non-array values become empty lists', () => {
      expect(normalizeFileManagerFavorites(undefined)).toEqual([]);
      expect(normalizeFileManagerFavorites(null)).toEqual([]);
      expect(normalizeFileManagerFavorites('nope')).toEqual([]);
    });

    it('discards non-string and blank entries and exact duplicates', () => {
      expect(
        normalizeFileManagerFavorites([
          '/Users/a/music',
          42,
          null,
          '   ',
          '/Users/a/music',
          '/Users/a/samples',
        ]),
      ).toEqual(['/Users/a/music', '/Users/a/samples']);
    });
  });

  describe('root labels normalization', () => {
    it('missing and non-object values become empty maps', () => {
      expect(normalizeFileManagerRootLabels(undefined)).toEqual({});
      expect(normalizeFileManagerRootLabels(null)).toEqual({});
      expect(normalizeFileManagerRootLabels('nope')).toEqual({});
      expect(normalizeFileManagerRootLabels([1, 2, 3])).toEqual({});
    });

    it('discards non-string and blank keys and values', () => {
      expect(
        normalizeFileManagerRootLabels({
          '/Users/a': 'Home Folder',
          '/': '   ',
          '   ': 'Root Folder',
          '/Volumes/media': 123,
          '/Volumes/backup': 'Backup Drive',
        }),
      ).toEqual({
        '/Users/a': 'Home Folder',
        '/Volumes/backup': 'Backup Drive',
      });
    });
  });

  describe('drag payload', () => {
    it('round-trips a versioned regular-file payload', () => {
      const payload = {
        version: 1 as const,
        kind: 'file' as const,
        path: '/tmp/a.wav',
        name: 'a.wav',
      };
      expect(parseFileManagerDragPayload(serializeFileManagerDragPayload(payload))).toEqual(
        payload,
      );
    });

    it('rejects malformed payloads', () => {
      expect(parseFileManagerDragPayload(null)).toBeNull();
      expect(parseFileManagerDragPayload('not json')).toBeNull();
      expect(
        parseFileManagerDragPayload(
          JSON.stringify({ version: 2, kind: 'file', path: '/a', name: 'a' }),
        ),
      ).toBeNull();
      expect(
        parseFileManagerDragPayload(
          JSON.stringify({ version: 1, kind: 'directory', path: '/a', name: 'a' }),
        ),
      ).toBeNull();
      expect(
        parseFileManagerDragPayload(
          JSON.stringify({ version: 1, kind: 'file', path: '', name: 'a' }),
        ),
      ).toBeNull();
    });

    it('uses the documented custom MIME type', () => {
      expect(BLUE_FILE_MANAGER_DRAG_MIME).toBe('application/x-blue-file-manager-file');
    });
  });

  describe('Csound audio-source allowlist', () => {
    it('accepts core Java extensions plus capability-derived formats', () => {
      for (const name of ['a.wav', 'b.AIFF', 'c.aif', 'd.flac', 'e.ogg', 'f.mp3', 'g.WAVE']) {
        expect(isCsoundAudioSourcePath(name)).toBe(true);
      }
    });

    it('rejects browser-only and headerless formats', () => {
      for (const name of ['a.m4a', 'b.mp4', 'c.webm', 'd.opus', 'e.raw']) {
        expect(isCsoundAudioSourcePath(name)).toBe(false);
      }
    });

    it('matches the final suffix only', () => {
      expect(isCsoundAudioSourcePath('take.WAV.backup')).toBe(false);
      expect(isCsoundAudioSourcePath('archive.tar.wav')).toBe(true);
    });

    it('never matches bare dotfiles or extensionless names', () => {
      expect(isCsoundAudioSourcePath('.wav')).toBe(false);
      expect(isCsoundAudioSourcePath('noext')).toBe(false);
      expect(isCsoundAudioSourcePath('trailing.')).toBe(false);
    });

    it('keeps the documented extension list', () => {
      expect(CSOUND_AUDIO_SOURCE_EXTENSIONS).toHaveLength(24);
    });
  });

  describe('external OS drop parsing', () => {
    it('accepts a single resolved file path', () => {
      expect(parseExternalOsFileDrop({ fileCount: 1, firstFilePath: '/Users/a/one.wav' })).toEqual({
        status: 'ok',
        path: '/Users/a/one.wav',
      });
    });

    it('rejects multiple files even when one is supported', () => {
      expect(parseExternalOsFileDrop({ fileCount: 2, firstFilePath: '/Users/a/one.wav' })).toEqual({
        status: 'rejected',
        reason: 'multiple-files',
      });
    });

    it('accepts one file:// URI from uri-list, ignoring comments', () => {
      const uriList = '#comment\r\nfile:///Users/a/one%20track.wav';
      expect(parseExternalOsFileDrop({ fileCount: 0, uriList })).toEqual({
        status: 'ok',
        path: '/Users/a/one track.wav',
      });
    });

    it('falls back to a file:// value in text/plain', () => {
      expect(
        parseExternalOsFileDrop({ fileCount: 0, textPlain: 'file:///Users/a/one.wav' }),
      ).toEqual({ status: 'ok', path: '/Users/a/one.wav' });
    });

    it('rejects more than one URI line', () => {
      expect(
        parseExternalOsFileDrop({ fileCount: 0, uriList: 'file:///a.wav\r\nfile:///b.wav' }),
      ).toEqual({ status: 'rejected', reason: 'multiple-uris' });
    });

    it('rejects non-file schemes without fetching them', () => {
      expect(
        parseExternalOsFileDrop({ fileCount: 0, uriList: 'https://example.com/a.wav' }),
      ).toEqual({ status: 'rejected', reason: 'unsupported-scheme' });
    });

    it('reports no-source when nothing usable is present', () => {
      expect(parseExternalOsFileDrop({ fileCount: 0 })).toEqual({
        status: 'rejected',
        reason: 'no-source',
      });
    });
  });

  describe('file URI decoding', () => {
    it('decodes POSIX paths once', () => {
      expect(decodeFileUri('file:///Users/name/audio.wav')).toBe('/Users/name/audio.wav');
      expect(decodeFileUri('file:///Users/name/caf%C3%A9.wav')).toBe('/Users/name/café.wav');
    });

    it('loses only the leading slash for Windows drive paths', () => {
      expect(decodeFileUri('file:///C:/Users/name/audio.wav')).toBe('C:/Users/name/audio.wav');
    });

    it('retains UNC host/share form', () => {
      expect(decodeFileUri('file://server/share/audio.wav')).toBe('//server/share/audio.wav');
    });

    it('returns null for non-file URIs and empty targets', () => {
      expect(decodeFileUri('https://example.com/a.wav')).toBeNull();
      expect(decodeFileUri('file://')).toBeNull();
    });
  });
});
