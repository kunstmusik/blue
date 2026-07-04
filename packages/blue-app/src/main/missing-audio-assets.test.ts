import { describe, expect, it, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { BlueData, PolyObject, SoundLayer, AudioFile, GenericScore } from '@blue/data';
import type { SoundObject } from '@blue/data';
import {
  applyReplacementMappings,
  buildReplacementMappings,
  clearMissingAudioSession,
  collectMissingAudioFiles,
  createMissingAudioSessionId,
  findAudioFile,
  forEachAudioFile,
  getActiveMissingAudioSession,
  isSessionStale,
  normalizeReplacementPath,
  setActiveMissingAudioSession,
  type MissingAudioFileProbe,
  type MissingAudioResolutionContext,
} from './missing-audio-assets';
import type { MissingAudioAssetsSession } from '../shared/missing-audio-assets';

function makeProbe(existing: ReadonlySet<string>): MissingAudioFileProbe {
  return { isFile: (p: string) => existing.has(p) };
}

function makeAudioFile(soundFileName: string): AudioFile {
  const af = new AudioFile();
  af.setSoundFileName(soundFileName);
  return af;
}

function makeDataWithRootObjects(objects: SoundObject[]): BlueData {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  for (const obj of objects) {
    layer.push(obj);
  }
  poly.push(layer);
  data.getScore().push(poly);
  return data;
}

function makeDataWithNested(nestedObjects: SoundObject[]): BlueData {
  const data = new BlueData();
  data.getScore().length = 0;
  const root = new PolyObject();
  const rootLayer = new SoundLayer();

  const nested = new PolyObject();
  const nestedLayer = new SoundLayer();
  for (const obj of nestedObjects) {
    nestedLayer.push(obj);
  }
  nested.push(nestedLayer);
  rootLayer.push(nested);

  root.push(rootLayer);
  data.getScore().push(root);
  return data;
}

function ctx(projectDirectory: string | null = '/proj', sfDir: string | null = null): MissingAudioResolutionContext {
  return { projectDirectory, sfDir };
}

describe('collectMissingAudioFiles — Java Blue parity scope', () => {
  it('returns no rows when all AudioFile references resolve via project directory', () => {
    const existing = new Set(['/proj/clip.wav']);
    const data = makeDataWithRootObjects([makeAudioFile('clip.wav')]);
    expect(collectMissingAudioFiles(data, ctx('/proj'), makeProbe(existing))).toEqual([]);
  });

  it('returns no rows when a reference resolves as an absolute path', () => {
    const existing = new Set(['/abs/song.wav']);
    const data = makeDataWithRootObjects([makeAudioFile('/abs/song.wav')]);
    expect(collectMissingAudioFiles(data, ctx('/proj'), makeProbe(existing))).toEqual([]);
  });

  it('returns no rows when a separator-less name resolves via SFDIR', () => {
    const existing = new Set(['/sfx/kick.wav']);
    const data = makeDataWithRootObjects([makeAudioFile('kick.wav')]);
    expect(collectMissingAudioFiles(data, ctx('/proj', '/sfx'), makeProbe(existing))).toEqual([]);
  });

  it('lists each unresolved original path once even when referenced by multiple AudioFiles', () => {
    const data = makeDataWithRootObjects([
      makeAudioFile('missing.wav'),
      makeAudioFile('missing.wav'),
      makeAudioFile('other-missing.wav'),
    ]);
    const rows = collectMissingAudioFiles(data, ctx('/proj'), makeProbe(new Set()));
    expect(rows).toEqual([
      { originalPath: 'missing.wav', replacementPath: '' },
      { originalPath: 'other-missing.wav', replacementPath: '' },
    ]);
  });

  it('skips AudioFile references with no file path set (blank, empty, whitespace)', () => {
    const data = makeDataWithRootObjects([
      makeAudioFile(''),
      makeAudioFile('   '),
      makeAudioFile('missing.wav'),
    ]);
    const rows = collectMissingAudioFiles(data, ctx('/proj'), makeProbe(new Set()));
    expect(rows).toEqual([{ originalPath: 'missing.wav', replacementPath: '' }]);
  });

  it('walks nested PolyObject score contents for AudioFile references', () => {
    const data = makeDataWithNested([makeAudioFile('nested-missing.wav')]);
    const rows = collectMissingAudioFiles(data, ctx('/proj'), makeProbe(new Set()));
    expect(rows).toEqual([{ originalPath: 'nested-missing.wav', replacementPath: '' }]);
  });

  it('does not collect non-AudioFile file references (out-of-scope assets)', () => {
    const gs = new GenericScore();
    gs.setScoreText('i1 0 1');
    const data = makeDataWithRootObjects([gs, makeAudioFile('only-this.wav')]);
    const rows = collectMissingAudioFiles(data, ctx('/proj'), makeProbe(new Set()));
    expect(rows).toEqual([{ originalPath: 'only-this.wav', replacementPath: '' }]);
  });

  it('treats a separator-less name as missing when SFDIR is unavailable', () => {
    const data = makeDataWithRootObjects([makeAudioFile('lonely.wav')]);
    const rows = collectMissingAudioFiles(data, ctx('/proj', null), makeProbe(new Set()));
    expect(rows).toEqual([{ originalPath: 'lonely.wav', replacementPath: '' }]);
  });
});

describe('findAudioFile — BlueSystem.findFile parity order', () => {
  const probe = makeProbe(new Set(['/proj/a.wav', '/abs/b.wav', '/sfx/c.wav']));

  it('prefers project-directory resolution', () => {
    expect(findAudioFile('a.wav', ctx('/proj', '/sfx'), probe)).toBe('/proj/a.wav');
  });

  it('falls back to absolute/direct resolution', () => {
    expect(findAudioFile('/abs/b.wav', ctx('/proj', '/sfx'), probe)).toBe('/abs/b.wav');
  });

  it('uses SFDIR only for separator-less names', () => {
    expect(findAudioFile('c.wav', ctx('/proj', '/sfx'), probe)).toBe('/sfx/c.wav');
  });

  it('does not consult SFDIR for paths that contain a separator', () => {
    expect(findAudioFile('sub/c.wav', ctx('/proj', '/sfx'), probe)).toBeNull();
  });

  it('returns null when no resolution succeeds', () => {
    expect(findAudioFile('none.wav', ctx('/proj', '/sfx'), probe)).toBeNull();
  });

  it('returns null when projectDirectory is unavailable and no other rule matches', () => {
    expect(findAudioFile('deep/none.wav', ctx(null, null), probe)).toBeNull();
  });
});

describe('forEachAudioFile — traversal', () => {
  it('visits root and nested AudioFile objects and skips non-AudioFile objects', () => {
    const gs = new GenericScore();
    const data = makeDataWithNested([makeAudioFile('nested.wav'), gs]);
    const root = data.getScore()[0] as PolyObject;
    const rootLayer = root[0]!;
    rootLayer.push(makeAudioFile('root.wav'));

    const visited: string[] = [];
    forEachAudioFile(data.getScore(), (af) => visited.push(af.getSoundFileName()));
    expect(visited.sort()).toEqual(['nested.wav', 'root.wav']);
  });
});

describe('buildReplacementMappings — Java getFilesMap parity', () => {
  const projectDirectory = path.join(os.tmpdir(), 'blue-proj-test');

  it('drops rows whose replacement is empty', () => {
    const map = buildReplacementMappings(
      [{ originalPath: 'a.wav', replacementPath: '' }],
      projectDirectory,
    );
    expect(map.size).toBe(0);
  });

  it('drops rows whose replacement equals the original path', () => {
    const map = buildReplacementMappings(
      [{ originalPath: 'a.wav', replacementPath: 'a.wav' }],
      projectDirectory,
    );
    expect(map.size).toBe(0);
  });

  it('keeps rows whose replacement is non-empty and different', () => {
    const map = buildReplacementMappings(
      [{ originalPath: 'a.wav', replacementPath: '/tmp/b.wav' }],
      projectDirectory,
    );
    expect(map.get('a.wav')).toBe('/tmp/b.wav');
  });

  it('drops rows whose original path is not part of the active session', () => {
    const map = buildReplacementMappings(
      [
        { originalPath: 'listed.wav', replacementPath: '/tmp/listed.wav' },
        { originalPath: 'unlisted.wav', replacementPath: '/tmp/unlisted.wav' },
      ],
      projectDirectory,
      new Set(['listed.wav']),
    );
    expect(map.get('listed.wav')).toBe('/tmp/listed.wav');
    expect(map.has('unlisted.wav')).toBe(false);
  });
});

describe('normalizeReplacementPath — BlueSystem.getRelativePath parity', () => {
  const projectDirectory = path.join(os.tmpdir(), 'blue-rel-test');

  it('returns the chosen path when no project directory is available', () => {
    expect(normalizeReplacementPath('/anywhere/x.wav', null)).toBe('/anywhere/x.wav');
  });

  it('returns a project-relative path when the chosen file is inside the project directory', () => {
    const selected = path.join(projectDirectory, 'audio', 'clip.wav');
    expect(normalizeReplacementPath(selected, projectDirectory)).toBe(
      path.join('audio', 'clip.wav'),
    );
  });

  it('returns the chosen path unchanged when it is outside the project directory', () => {
    expect(normalizeReplacementPath('/elsewhere/y.wav', projectDirectory)).toBe('/elsewhere/y.wav');
  });
});

describe('applyReplacementMappings — Java reconcileAudioFiles parity', () => {
  it('updates every AudioFile whose current path exactly matches a mapped original', () => {
    const data = makeDataWithRootObjects([
      makeAudioFile('missing.wav'),
      makeAudioFile('missing.wav'),
      makeAudioFile('untouched.wav'),
    ]);
    const changed = applyReplacementMappings(
      data,
      new Map([['missing.wav', 'replaced.wav']]),
    );
    expect(changed).toBe(true);
    const poly = data.getScore()[0] as PolyObject;
    const names = Array.from(poly[0]!.map((o) => (o as AudioFile).getSoundFileName()));
    expect(names).toEqual(['replaced.wav', 'replaced.wav', 'untouched.wav']);
  });

  it('returns false and changes nothing when the mapping map is empty', () => {
    const data = makeDataWithRootObjects([makeAudioFile('missing.wav')]);
    expect(applyReplacementMappings(data, new Map())).toBe(false);
    expect(((data.getScore()[0] as PolyObject)[0]![0] as AudioFile).getSoundFileName()).toBe('missing.wav');
  });

  it('updates AudioFile references inside nested PolyObjects', () => {
    const data = makeDataWithNested([makeAudioFile('nested.wav')]);
    applyReplacementMappings(data, new Map([['nested.wav', 'fixed.wav']]));
    const root = data.getScore()[0] as PolyObject;
    const nested = root[0]![0] as PolyObject;
    expect((nested[0]![0] as AudioFile).getSoundFileName()).toBe('fixed.wav');
  });
});

describe('session lifecycle and stale detection', () => {
  beforeEach(() => {
    setActiveMissingAudioSession(null);
  });

  it('treats a missing session as stale', () => {
    expect(isSessionStale(null, 1)).toBe(true);
  });

  it('treats a session bound to a different project session id as stale', () => {
    const session: MissingAudioAssetsSession = {
      sessionId: createMissingAudioSessionId(),
      projectSessionId: 1,
      projectFilePath: '/p/blue.blue',
      missingFiles: [{ originalPath: 'a.wav', replacementPath: '' }],
    };
    expect(isSessionStale(session, 2)).toBe(true);
    expect(isSessionStale(session, 1)).toBe(false);
  });

  it('clears only the matching session id', () => {
    const session: MissingAudioAssetsSession = {
      sessionId: 's1',
      projectSessionId: 1,
      projectFilePath: null,
      missingFiles: [],
    };
    setActiveMissingAudioSession(session);
    clearMissingAudioSession('other-id');
    expect(getActiveMissingAudioSession()).toBe(session);
    clearMissingAudioSession('s1');
    expect(getActiveMissingAudioSession()).toBeNull();
  });

  it('creates unique session ids', () => {
    expect(createMissingAudioSessionId()).not.toBe(createMissingAudioSessionId());
  });

  it('confirm-with-no-mappings is a no-op: empty mapping map changes nothing', () => {
    const data = makeDataWithRootObjects([makeAudioFile('missing.wav')]);
    const mappings = buildReplacementMappings(
      [{ originalPath: 'missing.wav', replacementPath: '' }],
      '/proj',
    );
    expect(applyReplacementMappings(data, mappings)).toBe(false);
    expect(((data.getScore()[0] as PolyObject)[0]![0] as AudioFile).getSoundFileName()).toBe('missing.wav');
  });

  it('partial resolution leaves unmapped original paths unchanged', () => {
    const data = makeDataWithRootObjects([
      makeAudioFile('one.wav'),
      makeAudioFile('two.wav'),
    ]);
    const mappings = buildReplacementMappings(
      [
        { originalPath: 'one.wav', replacementPath: '/tmp/one-fixed.wav' },
        { originalPath: 'two.wav', replacementPath: '' },
      ],
      '/proj',
    );
    applyReplacementMappings(data, mappings);
    const names = Array.from((data.getScore()[0] as PolyObject)[0]!.map((o) => (o as AudioFile).getSoundFileName()));
    expect(names).toEqual(['/tmp/one-fixed.wav', 'two.wav']);
  });
});

describe('AudioFile replacement round-trips through save/load', () => {
  it('persisted replacement paths survive BlueData saveToString/loadFromString', async () => {
    const data = makeDataWithRootObjects([makeAudioFile('original-missing.wav')]);
    applyReplacementMappings(data, new Map([['original-missing.wav', 'media/replaced.wav']]));

    const xml = data.saveToString();
    const reloaded = await BlueData.loadFromString(xml);
    const reloadedName = ((reloaded.getScore()[0] as PolyObject)[0]![0] as AudioFile).getSoundFileName();
    expect(reloadedName).toBe('media/replaced.wav');
  });
});
