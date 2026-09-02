import { afterEach, describe, expect, it, vi } from 'vitest';

import { generatePrefixedUuid, generateUuid } from './uuid';

describe('uuid utility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
    });

    expect(generateUuid()).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('falls back to a valid RFC4122 v4 UUID format when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});

    const uuid = generateUuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('falls back to a UUID-like format without browser crypto globals', () => {
    vi.stubGlobal('crypto', undefined);

    const uuid = generateUuid();

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('can generate prefixed UUID-style identifiers', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
    });

    expect(generatePrefixedUuid('widget')).toBe('widget-123e4567-e89b-12d3-a456-426614174000');
  });
});