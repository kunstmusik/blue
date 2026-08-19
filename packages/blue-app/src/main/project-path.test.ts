import { describe, expect, it } from 'vitest';
import {
  canonicalProjectPathIdentity,
  isSameProjectPathIdentity,
} from './project-path';

describe('canonicalProjectPathIdentity', () => {
  it('preserves case on POSIX platforms', () => {
    expect(canonicalProjectPathIdentity('/Users/steven/Project.blue', 'darwin'))
      .toBe('/Users/steven/Project.blue');
    expect(canonicalProjectPathIdentity('/home/blue/demo.blue', 'linux'))
      .toBe('/home/blue/demo.blue');
  });

  it('treats differing POSIX case spellings as distinct identities', () => {
    expect(isSameProjectPathIdentity('/Users/steven/Project.blue', '/users/steven/project.blue', 'darwin'))
      .toBe(false);
  });

  it('resolves relative segments and redundant separators on POSIX', () => {
    expect(isSameProjectPathIdentity('/Users/steven/work/../work/./demo.blue', '/Users/steven/work/demo.blue', 'darwin'))
      .toBe(true);
    expect(isSameProjectPathIdentity('/Users//steven///demo.blue', '/Users/steven/demo.blue', 'darwin'))
      .toBe(true);
    expect(isSameProjectPathIdentity('/Users/steven/work/', '/Users/steven/work', 'darwin'))
      .toBe(true);
  });

  it('folds case for Windows identities', () => {
    expect(isSameProjectPathIdentity('C:\\Users\\steven\\Demo.blue', 'c:\\USERS\\STEVEN\\demo.BLUE', 'win32'))
      .toBe(true);
  });

  it('accepts equivalent Windows slash forms', () => {
    expect(isSameProjectPathIdentity('C:\\Users\\steven\\demo.blue', 'C:/Users/steven/demo.blue', 'win32'))
      .toBe(true);
    expect(isSameProjectPathIdentity('C:/Users/steven/sub/../demo.blue', 'C:\\Users\\steven\\demo.blue', 'win32'))
      .toBe(true);
  });

  it('folds case and separators together for UNC paths', () => {
    expect(isSameProjectPathIdentity('\\\\Server\\Share\\demo.blue', '//server/SHARE/demo.blue', 'win32'))
      .toBe(true);
  });

  it('distinguishes different Windows files regardless of spelling', () => {
    expect(isSameProjectPathIdentity('C:\\Users\\steven\\demo.blue', 'C:\\Users\\steven\\other.blue', 'win32'))
      .toBe(false);
    expect(isSameProjectPathIdentity('C:\\Users\\steven\\demo.blue', 'D:\\Users\\steven\\demo.blue', 'win32'))
      .toBe(false);
  });

  it('computes identity for missing targets without file I/O', () => {
    const missingA = `${'/Users/steven/work'}/does-not-exist/demo.blue`;
    const missingB = '/Users/steven/work/does-not-exist/../does-not-exist/demo.blue';
    expect(isSameProjectPathIdentity(missingA, missingB, 'darwin')).toBe(true);

    const missingWin = 'C:\\Users\\steven\\Missing\\demo.blue';
    expect(isSameProjectPathIdentity(missingWin, 'c:/users/steven/missing/DEMO.blue', 'win32'))
      .toBe(true);
  });

  it('defaults to the host platform for identity rules', () => {
    const hostPlatform = process.platform;
    const expected = hostPlatform === 'win32'
      ? 'c:\\users\\steven\\demo.blue'
      : '/Users/steven/Demo.blue';
    const input = hostPlatform === 'win32'
      ? 'C:/Users/steven/Demo.blue'
      : '/Users/steven/Demo.blue';
    expect(canonicalProjectPathIdentity(input)).toBe(expected);
  });

  it('returns identity values without altering the native input path', () => {
    const native = 'C:\\Users\\steven\\sub\\..\\demo.blue';
    canonicalProjectPathIdentity(native, 'win32');
    expect(native).toBe('C:\\Users\\steven\\sub\\..\\demo.blue');
  });
});
