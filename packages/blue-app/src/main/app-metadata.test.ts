import { describe, expect, it } from 'vitest';

import { resolveAppMetadata } from './app-metadata';

describe('resolveAppMetadata', () => {
  it('uses packaged release metadata and runtime versions', () => {
    const metadata = resolveAppMetadata({
      appVersion: '2.10.0',
      appPath: '/app',
      isPackaged: true,
      processVersions: {
        electron: '35.7.5',
        chromium: '134.0.6998.179',
        node: '22.14.0',
      },
      readFile: (filePath) => {
        expect(filePath).toBe('/app/release-metadata.json');
        return JSON.stringify({
          appVersion: '2.10.0',
          sourceRevision: 'a'.repeat(40),
          generatedAt: '2026-05-04T12:00:00.000Z',
          channel: 'stable',
        });
      },
    });

    expect(metadata).toEqual({
      version: '2.10.0',
      sourceRevision: 'a'.repeat(40),
      buildDate: '2026-05-04T12:00:00.000Z',
      channel: 'stable',
      runtime: {
        electron: '35.7.5',
        chromium: '134.0.6998.179',
        node: '22.14.0',
      },
    });
  });

  it('uses the development git fallback when packaged metadata is unavailable', () => {
    expect(resolveAppMetadata({
      appVersion: '0.0.1',
      isPackaged: false,
      getSourceRevision: () => 'b'.repeat(40),
      releaseChannel: 'development',
      processVersions: {},
      readFile: () => {
        throw new Error('metadata unavailable');
      },
    })).toEqual({
      version: '0.0.1',
      sourceRevision: 'b'.repeat(40),
      buildDate: 'unknown',
      channel: 'development',
      runtime: {
        electron: 'unknown',
        chromium: 'unknown',
        node: 'unknown',
      },
    });
  });

  it('ignores generated release metadata during non-packaged development runs', () => {
    expect(resolveAppMetadata({
      appVersion: '0.0.1',
      appPath: '/app',
      isPackaged: false,
      releaseChannel: 'development',
      getSourceRevision: () => 'c'.repeat(40),
      readFile: () => JSON.stringify({
        appVersion: '9.9.9',
        sourceRevision: 'd'.repeat(40),
        generatedAt: '2026-05-04T12:00:00.000Z',
        channel: 'stable',
      }),
    })).toEqual({
      version: '0.0.1',
      sourceRevision: 'c'.repeat(40),
      buildDate: 'unknown',
      channel: 'development',
      runtime: {
        electron: 'unknown',
        chromium: 'unknown',
        node: 'unknown',
      },
    });
  });

  it('does not trust invalid packaged fields', () => {
    expect(resolveAppMetadata({
      appVersion: '',
      appPath: '/app',
      isPackaged: true,
      readFile: () => JSON.stringify({
        appVersion: '',
        sourceRevision: '',
        generatedAt: 'not a date',
        channel: 'nightly',
      }),
    })).toEqual({
      version: 'unknown',
      sourceRevision: 'unknown',
      buildDate: 'unknown',
      channel: 'unknown',
      runtime: {
        electron: 'unknown',
        chromium: 'unknown',
        node: 'unknown',
      },
    });
  });
});