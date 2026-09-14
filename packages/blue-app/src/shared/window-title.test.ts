import { describe, expect, it } from 'vitest';
import { getWindowTitle } from './window-title';

describe('getWindowTitle save-state matrix (spec 109)', () => {
  it('shows Blue when no project document is open', () => {
    expect(getWindowTitle(null, 'none')).toBe('Blue');
  });

  it('marks a never-saved project', () => {
    expect(getWindowTitle(null, 'unsaved')).toBe('Blue - New Project - [UNSAVED PROJECT]');
  });

  it('shows the file basename for a saved project', () => {
    expect(getWindowTitle('/work/demo.blue', 'saved')).toBe('Blue - demo.blue');
  });

  it('marks a modified on-disk project', () => {
    expect(getWindowTitle('/work/demo.blue', 'modified')).toBe('Blue - demo.blue - [modified]');
  });

  it('preserves the full basename including dots and extensions', () => {
    expect(getWindowTitle('/work/weird.name.v2.blue', 'saved')).toBe('Blue - weird.name.v2.blue');
    expect(getWindowTitle('/work/archive.tar.blue', 'modified')).toBe(
      'Blue - archive.tar.blue - [modified]',
    );
  });

  it('keeps Unicode and punctuation intact', () => {
    expect(getWindowTitle('/work/项目-ünïcode.blue', 'saved')).toBe('Blue - 项目-ünïcode.blue');
    expect(getWindowTitle("/work/it's a [draft].blue", 'modified')).toBe(
      "Blue - it's a [draft].blue - [modified]",
    );
  });

  it('keeps marker-like project names distinguishable from state markers', () => {
    expect(getWindowTitle('/work/project [modified].blue', 'saved')).toBe(
      'Blue - project [modified].blue',
    );
    expect(getWindowTitle('/work/[UNSAVED PROJECT].blue', 'modified')).toBe(
      'Blue - [UNSAVED PROJECT].blue - [modified]',
    );
  });

  it('recognizes both slash forms for display without normalizing the path', () => {
    expect(getWindowTitle('C:\\Users\\Blue\\saved.blue', 'saved')).toBe('Blue - saved.blue');
    expect(getWindowTitle('C:\\Users\\Blue\\saved.blue', 'modified')).toBe(
      'Blue - saved.blue - [modified]',
    );
    expect(getWindowTitle('/Users/Blue/saved.blue', 'saved')).toBe('Blue - saved.blue');
  });
});
