import { expect } from 'vitest';
import { Element } from '../../src/serialization/xml-reader';

export function normalizeXml(xml: string): string {
  return Element.parse(xml).toXml();
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function expectEquivalentXml(actual: string, expected: string): void {
  expect(normalizeXml(actual)).toBe(normalizeXml(expected));
}
