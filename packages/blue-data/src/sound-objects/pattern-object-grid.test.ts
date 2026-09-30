import { describe, expect, it } from 'vitest';
import { PatternObject } from './pattern-object';
import { Pattern } from './pattern/pattern';

describe('PatternObject grid resize', () => {
  it('removes hidden steps when beats shrink while keeping visible triggers', () => {
    const object = new PatternObject();
    const row = new Pattern(16);
    row.values[2] = true;
    row.values[14] = true;
    object.addPattern(row);

    object.setBeats(2);

    expect(object.getPattern(0).values).toHaveLength(8);
    expect(object.getPattern(0).values[2]).toBe(true);
    expect(object.getPattern(0).values.includes(true)).toBe(true);
  });

  it('clears old trigger positions when the subdivision changes', () => {
    const object = new PatternObject();
    const row = new Pattern(16);
    row.values[4] = true;
    object.addPattern(row);

    object.setSubDivisions(2);

    expect(object.getPattern(0).values).toHaveLength(8);
    expect(object.getPattern(0).values.every((active) => !active)).toBe(true);
  });
});
