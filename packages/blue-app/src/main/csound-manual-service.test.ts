import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  createCsoundManualService,
  type CsoundManualServiceDependencies,
} from './csound-manual-service';
import {
  createDefaultProgramSettings,
  type ProgramSettingsSnapshot,
} from '../shared/program-settings';

describe('CsoundManualService', () => {
  const createMockSettings = (manualUrl?: string): ProgramSettingsSnapshot => {
    const settings = createDefaultProgramSettings('darwin');
    if (manualUrl !== undefined) {
      settings.general.csoundManualUrl = manualUrl;
    }
    return settings;
  };

  describe('HTTPS manual entries (User Story 2)', () => {
    it('opens default remote root for oscili when setting is default', async () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result).toEqual({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      expect(fetchMock).toHaveBeenCalledWith('https://csound.com/manual/opcodes/oscili/', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      });
      expect(openExternal).toHaveBeenCalledWith('https://csound.com/manual/opcodes/oscili/');
    });

    it('handles display-name vs manual-id differences properly (e.g. opa for a)', async () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'opa' });

      expect(result).toEqual({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/opa/',
      });
      expect(openExternal).toHaveBeenCalledWith('https://csound.com/manual/opcodes/opa/');
    });

    it('classifies redirects (301/302) as available and opens the target', async () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 301 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result).toEqual({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      expect(openExternal).toHaveBeenCalledWith('https://csound.com/manual/opcodes/oscili/');
    });

    it('classifies confirmed 404 as missing and does NOT call openExternal', async () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 404 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'nonexistent' });

      expect(result).toEqual({
        disposition: 'fallback',
        availability: 'missing',
        reason: 'missing',
        targetUrl: 'https://csound.com/manual/opcodes/nonexistent/',
        message: expect.stringContaining('404'),
      });
      expect(openExternal).not.toHaveBeenCalled();
    });

    it('classifies confirmed 410 as missing and does NOT call openExternal', async () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 410 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'deprecated_removed' });

      expect(result).toEqual({
        disposition: 'fallback',
        availability: 'missing',
        reason: 'missing',
        targetUrl: 'https://csound.com/manual/opcodes/deprecated_removed/',
        message: expect.stringContaining('410'),
      });
      expect(openExternal).not.toHaveBeenCalled();
    });

    it('classifies network error or timeout as indeterminate and proceeds to openExternal', async () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network offline or timeout'));

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result).toEqual({
        disposition: 'opened',
        availability: 'indeterminate',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      expect(openExternal).toHaveBeenCalledWith('https://csound.com/manual/opcodes/oscili/');
    });

    it('classifies 500 or 403 or 405 status as indeterminate and proceeds to openExternal', async () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 405 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result).toEqual({
        disposition: 'opened',
        availability: 'indeterminate',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      expect(openExternal).toHaveBeenCalledWith('https://csound.com/manual/opcodes/oscili/');
    });

    it('handles openExternal failure gracefully with open-failed reason', async () => {
      const openExternal = vi.fn().mockRejectedValue(new Error('Failed to launch default browser'));
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result).toEqual({
        disposition: 'fallback',
        availability: 'available',
        reason: 'open-failed',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
        message: 'Failed to open Csound manual in external application',
      });
    });

    it('reloads current settings per request', async () => {
      let currentUrl = 'https://custom.csound.org/manual';
      const openExternal = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 } as Response);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(currentUrl),
        openExternal,
        fetch: fetchMock as unknown as typeof fetch,
      });

      const first = await service.openManual({ manualId: 'oscili' });
      expect(first.targetUrl).toBe('https://custom.csound.org/manual/opcodes/oscili/');

      currentUrl = 'https://other.domain.com/csound-docs';
      const second = await service.openManual({ manualId: 'oscili' });
      expect(second.targetUrl).toBe('https://other.domain.com/csound-docs/opcodes/oscili/');
    });
  });

  describe('Request and Setting validation', () => {
    it('rejects invalid request payloads without crashing', async () => {
      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
      });

      expect(await service.openManual(null)).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-request',
      });
      expect(await service.openManual({})).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-request',
      });
      expect(await service.openManual({ manualId: '' })).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-request',
      });
      expect(await service.openManual({ manualId: '../traversal' })).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-request',
      });
      expect(await service.openManual({ manualId: 'sub/dir' })).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-request',
      });
      expect(await service.openManual({ manualId: 'test\0null' })).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-request',
      });
    });

    it('rejects lone-surrogate identifiers without throwing and returns fallback invalid-request', async () => {
      const openExternal = vi.fn();
      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(),
        openExternal,
      });

      const result = await service.openManual({ manualId: '\uD800' });
      expect(result).toEqual({
        disposition: 'fallback',
        availability: 'indeterminate',
        reason: 'invalid-request',
        message: expect.stringContaining('surrogates'),
      });
      expect(openExternal).not.toHaveBeenCalled();
    });

    it('returns safe fallback when getProgramSettings throws', async () => {
      const service = createCsoundManualService({
        getProgramSettings: () => {
          throw new Error('Database connection failed: internal secret');
        },
      });

      const result = await service.openManual({ manualId: 'oscili' });
      expect(result).toEqual({
        disposition: 'fallback',
        availability: 'indeterminate',
        reason: 'invalid-setting',
        message: 'Failed to retrieve program settings',
      });
    });

    it('rejects invalid program settings root URLs', async () => {
      const openExternal = vi.fn();
      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings('http://insecure.csound.com/manual'),
        openExternal,
      });

      const result = await service.openManual({ manualId: 'oscili' });
      expect(result).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-setting',
      });
      expect(openExternal).not.toHaveBeenCalled();
    });

    it('rejects settings with credentials, query, or fragment', async () => {
      const openExternal = vi.fn();
      const service = createCsoundManualService({
        getProgramSettings: () =>
          createMockSettings('https://user:pass@csound.com/manual?query=1#frag'),
        openExternal,
      });

      const result = await service.openManual({ manualId: 'oscili' });
      expect(result).toMatchObject({
        disposition: 'fallback',
        reason: 'invalid-setting',
      });
      expect(openExternal).not.toHaveBeenCalled();
    });
  });

  describe('Local file: manual entries (User Story 3 / 4)', () => {
    const testLocalRoot = path.join(os.tmpdir(), 'blue-test-manual');
    const testLocalRootUrl = pathToFileURL(testLocalRoot).href + '/';

    it('opens valid local manual entry index.html via openPath using native paths', async () => {
      const openPath = vi.fn().mockResolvedValue(''); // '' means success in shell.openPath
      const access = vi.fn().mockResolvedValue(undefined); // exists and readable

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(testLocalRootUrl),
        openPath,
        access,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result).toEqual({
        disposition: 'opened',
        availability: 'available',
        targetUrl: `${testLocalRootUrl}opcodes/oscili/`,
      });
      const expectedPath = path.join(testLocalRoot, 'opcodes', 'oscili', 'index.html');
      expect(access).toHaveBeenCalledWith(expectedPath, expect.any(Number));
      expect(openPath).toHaveBeenCalledWith(expectedPath);
    });

    it('handles encoded spaces in file: root', async () => {
      const openPath = vi.fn().mockResolvedValue('');
      const access = vi.fn().mockResolvedValue(undefined);
      const testSpacesRoot = path.join(os.tmpdir(), 'my documents', 'csound manual');
      const testSpacesRootUrl = pathToFileURL(testSpacesRoot).href;

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(testSpacesRootUrl),
        openPath,
        access,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result.disposition).toBe('opened');
      expect(access).toHaveBeenCalledWith(
        expect.stringContaining(path.join('my documents', 'csound manual')),
        expect.any(Number),
      );
    });

    it('classifies missing index.html (ENOENT) as missing and does NOT call openPath', async () => {
      const openPath = vi.fn();
      const enoentErr = new Error('ENOENT: no such file or directory');
      (enoentErr as NodeJS.ErrnoException).code = 'ENOENT';
      const access = vi.fn().mockRejectedValue(enoentErr);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(testLocalRootUrl),
        openPath,
        access,
      });

      const result = await service.openManual({ manualId: 'nonexistent' });

      expect(result).toEqual({
        disposition: 'fallback',
        availability: 'missing',
        reason: 'missing',
        targetUrl: `${testLocalRootUrl}opcodes/nonexistent/`,
        message: 'Local manual entry not found: nonexistent',
      });
      expect(openPath).not.toHaveBeenCalled();
    });

    it.each(['EACCES', 'EPERM', 'EIO'])(
      'classifies %s filesystem error as indeterminate/probe-failed and does NOT call openPath',
      async (code) => {
        const openPath = vi.fn();
        const err = new Error(`${code}: permission or I/O failure`);
        (err as NodeJS.ErrnoException).code = code;
        const access = vi.fn().mockRejectedValue(err);

        const service = createCsoundManualService({
          getProgramSettings: () => createMockSettings(testLocalRootUrl),
          openPath,
          access,
        });

        const result = await service.openManual({ manualId: 'oscili' });

        expect(result).toEqual({
          disposition: 'fallback',
          availability: 'indeterminate',
          reason: 'probe-failed',
          targetUrl: `${testLocalRootUrl}opcodes/oscili/`,
          message:
            'Unable to access local Csound manual entry due to filesystem permissions or I/O error',
        });
        expect(openPath).not.toHaveBeenCalled();
      },
    );

    it('handles shell.openPath error string as open-failed with safe message', async () => {
      const openPath = vi.fn().mockResolvedValue('Failed to launch application');
      const access = vi.fn().mockResolvedValue(undefined);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(testLocalRootUrl),
        openPath,
        access,
      });

      const result = await service.openManual({ manualId: 'oscili' });

      expect(result).toEqual({
        disposition: 'fallback',
        availability: 'available',
        reason: 'open-failed',
        targetUrl: `${testLocalRootUrl}opcodes/oscili/`,
        message: 'Failed to open local Csound manual in external application',
      });
    });

    it('handles synthetic Windows drive-letter file URLs and checks containment', async () => {
      const openPath = vi.fn().mockResolvedValue('');
      const access = vi.fn().mockResolvedValue(undefined);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings('file:///C:/Users/name/manual/'),
        openPath,
        access,
      });

      const result = await service.openManual({ manualId: 'oscili' });
      expect(result.disposition).toBe('opened');
      const expectedPath = path.join(
        fileURLToPath('file:///C:/Users/name/manual/'),
        'opcodes',
        'oscili',
        'index.html',
      );
      expect(access).toHaveBeenCalledWith(expectedPath, expect.any(Number));
      expect(openPath).toHaveBeenCalledWith(expectedPath);
    });

    it('handles synthetic Windows UNC file URLs on Windows and rejects host on POSIX', async () => {
      const openPath = vi.fn().mockResolvedValue('');
      const access = vi.fn().mockResolvedValue(undefined);

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings('file://server/share/manual/'),
        openPath,
        access,
      });

      const result = await service.openManual({ manualId: 'oscili' });
      if (process.platform === 'win32') {
        expect(result.disposition).toBe('opened');
        const expectedPath = path.join(
          '\\\\server\\share\\manual',
          'opcodes',
          'oscili',
          'index.html',
        );
        expect(access).toHaveBeenCalledWith(expectedPath, expect.any(Number));
        expect(openPath).toHaveBeenCalledWith(expectedPath);
      } else {
        expect(result).toMatchObject({
          disposition: 'fallback',
          reason: 'invalid-setting',
          message: 'Failed to convert Csound manual file URL to a native path',
        });
        expect(result.message).not.toContain('ERR_INVALID_FILE_URL_HOST');
        expect(access).not.toHaveBeenCalled();
        expect(openPath).not.toHaveBeenCalled();
      }
    });

    it('rejects target when root resolution fails or escapes directory containment', async () => {
      const openPath = vi.fn();
      const access = vi.fn();

      const service = createCsoundManualService({
        getProgramSettings: () => createMockSettings(testLocalRootUrl),
        openPath,
        access,
      });

      const result = await service.openManual({ manualId: '..%2F..%2Fetc%2Fpasswd' });
      expect(result.disposition).toBe('fallback');
      expect(result.reason).toBe('invalid-request');
      expect(access).not.toHaveBeenCalled();
      expect(openPath).not.toHaveBeenCalled();
    });
  });
});
