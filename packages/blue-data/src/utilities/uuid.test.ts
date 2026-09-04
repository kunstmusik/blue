import { afterEach, describe, expect, it, vi } from 'vitest';

import { generatePrefixedUuid, generateUuid } from './uuid';

describe('uuid utility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('generates a valid RFC4122 v4 UUID using crypto.randomUUID', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('delegates to crypto.randomUUID directly', () => {
    const spy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('123e4567-e89b-12d3-a456-426614174000');

    expect(generateUuid()).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('can generate prefixed UUID-style identifiers', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('123e4567-e89b-12d3-a456-426614174000');

    expect(generatePrefixedUuid('widget')).toBe('widget-123e4567-e89b-12d3-a456-426614174000');
  });
});
