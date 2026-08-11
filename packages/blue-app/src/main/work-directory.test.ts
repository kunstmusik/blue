import { describe, expect, it } from 'vitest';

import {
  normalizeWorkDirectory,
  resolveWorkDirectoryDefaultPath,
} from './work-directory';

describe('work-directory dialog defaults', () => {
  it('normalizes blank settings to no configured directory', () => {
    expect(normalizeWorkDirectory('  ')).toBeUndefined();
    expect(normalizeWorkDirectory(undefined)).toBeUndefined();
    expect(normalizeWorkDirectory('/tmp/work')).toBe('/tmp/work');
  });

  it('resolves a filename inside the configured work directory', () => {
    expect(resolveWorkDirectoryDefaultPath('/tmp/work', 'project.blue')).toBe('/tmp/work/project.blue');
    expect(resolveWorkDirectoryDefaultPath('/tmp/work')).toBe('/tmp/work');
  });

  it('preserves an explicit filename when no work directory is configured', () => {
    expect(resolveWorkDirectoryDefaultPath('', 'project.blue')).toBe('project.blue');
    expect(resolveWorkDirectoryDefaultPath('/tmp/work', '/explicit/project.blue')).toBe('/explicit/project.blue');
  });
});
