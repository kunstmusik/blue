import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { moveChildElements } from './xml-migration-utils';

describe('moveChildElements', () => {
  it('moves all direct children in their original order', () => {
    const source = Element.parse('<source><first>1</first><second /><first>2</first></source>');
    const destination = Element.parse('<destination><existing /></destination>');

    moveChildElements(source, destination);

    expect(source.getElements().size).toBe(0);
    expect(destination.getElements().toArray().map((child) => child.getName())).toEqual([
      'existing',
      'first',
      'second',
      'first',
    ]);
    expect(destination.getElements('first').toArray().map((child) => child.getTextString())).toEqual([
      '1',
      '2',
    ]);
  });

  it('is a no-op for an empty source', () => {
    const source = Element.parse('<source />');
    const destination = Element.parse('<destination><existing /></destination>');
    const before = destination.toXml();

    moveChildElements(source, destination);

    expect(source.getElements().size).toBe(0);
    expect(destination.toXml()).toBe(before);
  });

  it('can move only children with a requested name', () => {
    const source = Element.parse('<source><keep /><move /><keep /></source>');
    const destination = Element.parse('<destination />');

    moveChildElements(source, destination, 'move');

    expect(source.getElements().toArray().map((child) => child.getName())).toEqual([
      'keep',
      'keep',
    ]);
    expect(destination.getElements().toArray().map((child) => child.getName())).toEqual(['move']);
  });
});
