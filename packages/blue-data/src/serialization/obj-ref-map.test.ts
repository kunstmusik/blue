import { describe, expect, it } from 'vitest';
import { ObjRefSaveMap } from './obj-ref-map';

describe('ObjRefSaveMap stable IDs', () => {
  it('uses a seeded Java-compatible ID without renumbering it', () => {
    const map = new ObjRefSaveMap();
    const object = {};

    map.seed(object, 'lib_42');

    expect(map.getId(object)).toBe('lib_42');
    expect(map.hasId(object)).toBe(true);
  });

  it('does not allocate a generated ID that collides with a seed', () => {
    const map = new ObjRefSaveMap();
    const seeded = {};
    const generated = {};
    map.seed(seeded, 'ref_1');

    expect(map.getId(generated)).toBe('ref_2');
  });
});
