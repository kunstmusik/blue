import { describe, expect, it } from 'vitest';
import {
  isResourceKind,
  isResourceKey,
  isCategory,
  isSyntheticNavigationNode,
  isAccountIdentity,
  isAccountState,
  isAccountSessionSnapshot,
  isOpenDialogResult,
  isSignOutResult,
  isPublishSourceSeed,
  isRemoveResourceResult,
  isOpenWebsiteResult,
  isLibraryMutationReceipt,
  isCategoryList,
  isUserLibraryItemKey,
  isRequestId,
  isContextId,
  isAccountEpoch,
  validateBlueShareResult,
  isResourceSummary,
  isResourceDetail,
  isResourcePage,
  isLatestResult,
  validatePublishRequest,
  validateLoginRequest,
  isLoginRequest,
  checkXmlEnvelope,
  MAX_LOGIN_JSON_BYTES,
  MAX_PUBLISH_JSON_BYTES,
  MAX_XML_DEPTH,
  MAX_XML_ELEMENTS,
  isBlueShareSuccess,
  isBlueShareError,
  validateCategoryHierarchy,
  buildCategoryTree,
  flattenCategoryHierarchy,
  isValidIsoUtcDate,
  MAX_PAGE_SIZE,
  MAX_LATEST_SIZE,
  MAX_RESOURCE_ID,
  MAX_RESOURCE_XML_BYTES,
  BLUESHARE_CHANNELS,
  type Category,
  type ResourceSummary,
} from './blueshare';
import { Element } from '@blue/data';

describe('shared/blueshare DTO guards and constraints', () => {
  describe('ResourceKind and ResourceKey', () => {
    it('accepts only exact kind strings', () => {
      expect(isResourceKind('instrument')).toBe(true);
      expect(isResourceKind('effect')).toBe(true);
      expect(isResourceKind('soundObject')).toBe(true);
      expect(isResourceKind('Instrument')).toBe(false);
      expect(isResourceKind('udo')).toBe(false);
      expect(isResourceKind('blue.orchestra.GenericInstrument')).toBe(false);
      expect(isResourceKind('')).toBe(false);
      expect(isResourceKind(null)).toBe(false);
    });

    it('enforces ResourceKey constraints (integer 1..2147483647)', () => {
      expect(isResourceKey({ kind: 'instrument', id: 1 })).toBe(true);
      expect(isResourceKey({ kind: 'effect', id: 2147483647 })).toBe(true);
      expect(isResourceKey({ kind: 'soundObject', id: 42 })).toBe(true);

      // Invalid IDs
      expect(isResourceKey({ kind: 'instrument', id: 0 })).toBe(false);
      expect(isResourceKey({ kind: 'instrument', id: -1 })).toBe(false);
      expect(isResourceKey({ kind: 'instrument', id: 1.5 })).toBe(false);
      expect(isResourceKey({ kind: 'instrument', id: 2147483648 })).toBe(false);
      expect(isResourceKey({ kind: 'invalid', id: 1 })).toBe(false);
      expect(isResourceKey(null)).toBe(false);
      expect(isResourceKey({})).toBe(false);
    });
  });

  describe('Category and SyntheticNavigationNode', () => {
    it('validates Category and parent reference', () => {
      expect(
        isCategory({
          id: 10,
          kind: 'instrument',
          parentId: null,
          name: 'Synths',
          description: 'All synths',
        }),
      ).toBe(true);

      expect(
        isCategory(
          {
            id: 11,
            kind: 'instrument',
            parentId: 10,
            name: 'Subtractive',
            description: null,
          },
          'instrument',
        ),
      ).toBe(true);

      // Mismatched expected kind
      expect(
        isCategory(
          {
            id: 11,
            kind: 'instrument',
            parentId: null,
            name: 'Subtractive',
            description: null,
          },
          'effect',
        ),
      ).toBe(false);

      // Invalid ID or parentId
      expect(isCategory({ id: 0, kind: 'instrument', parentId: null, name: 'Bad' })).toBe(false);
      expect(isCategory({ id: 1, kind: 'instrument', parentId: 0, name: 'Bad Parent' })).toBe(
        false,
      );
      expect(isCategory({ id: 1, kind: 'instrument', parentId: null, name: '   ' })).toBe(false);
    });

    it('validates SyntheticNavigationNode with no numeric ID', () => {
      expect(
        isSyntheticNavigationNode({
          isSynthetic: true,
          syntheticId: 'nav-latest',
          name: 'Latest Submissions',
          kind: 'instrument',
        }),
      ).toBe(true);

      expect(isSyntheticNavigationNode({ isSynthetic: false })).toBe(false);
      expect(isSyntheticNavigationNode({ isSynthetic: true, syntheticId: 'x' })).toBe(false);
    });
    it('validates and builds a nested category tree preserving sibling ID ordering', () => {
      const input: readonly Category[] = [
        { id: 20, kind: 'instrument', parentId: null, name: 'Sample Based', description: null },
        { id: 10, kind: 'instrument', parentId: null, name: 'Synthesizers', description: null },
        { id: 12, kind: 'instrument', parentId: 10, name: 'FM', description: null },
        { id: 11, kind: 'instrument', parentId: 10, name: 'Subtractive', description: null },
        { id: 13, kind: 'instrument', parentId: 11, name: 'Virtual Analog', description: null },
      ];

      const res = validateCategoryHierarchy(input, 'instrument');
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error('Expected validation to pass');

      // Root level sorted by id ascending: 10 then 20
      expect(res.tree.map((n) => n.id)).toEqual([10, 20]);
      expect(res.tree[0].level).toBe(0);
      expect(res.tree[1].level).toBe(0);

      // Node 10 children sorted by id ascending: 11 then 12
      expect(res.tree[0].children.map((n) => n.id)).toEqual([11, 12]);
      expect(res.tree[0].children[0].level).toBe(1);
      expect(res.tree[0].children[1].level).toBe(1);

      // Node 11 child: 13
      expect(res.tree[0].children[0].children.map((n) => n.id)).toEqual([13]);
      expect(res.tree[0].children[0].children[0].level).toBe(2);

      // Pre-order flattened output
      expect(res.flattened.map((c) => ({ id: c.id, level: c.level }))).toEqual([
        { id: 10, level: 0 },
        { id: 11, level: 1 },
        { id: 13, level: 2 },
        { id: 12, level: 1 },
        { id: 20, level: 0 },
      ]);

      // Helper functions
      expect(buildCategoryTree(input, 'instrument').length).toBe(2);
      expect(flattenCategoryHierarchy(input, 'instrument').length).toBe(5);
    });

    it('rejects corrupt category trees: duplicate IDs, orphans, and cycles', () => {
      // 1. Duplicate ID
      const dupRes = validateCategoryHierarchy([
        { id: 10, kind: 'instrument', parentId: null, name: 'Synths', description: null },
        { id: 10, kind: 'instrument', parentId: null, name: 'Other Synths', description: null },
      ]);
      expect(dupRes.ok).toBe(false);
      if (dupRes.ok) throw new Error('Expected duplicate ID rejection');
      expect(dupRes.error.code).toBe('duplicate_category_id');

      // 2. Orphan category (references non-existent parentId)
      const orphanRes = validateCategoryHierarchy([
        { id: 10, kind: 'instrument', parentId: null, name: 'Synths', description: null },
        { id: 11, kind: 'instrument', parentId: 999, name: 'Lost Child', description: null },
      ]);
      expect(orphanRes.ok).toBe(false);
      if (orphanRes.ok) throw new Error('Expected orphan rejection');
      expect(orphanRes.error.code).toBe('orphan_category');

      // 3. Self-referencing cycle
      const selfCycle = validateCategoryHierarchy([
        { id: 10, kind: 'instrument', parentId: 10, name: 'Ouroboros', description: null },
      ]);
      expect(selfCycle.ok).toBe(false);
      if (selfCycle.ok) throw new Error('Expected self-cycle rejection');
      expect(selfCycle.error.code).toBe('category_cycle');

      // 4. Multi-hop cycle: 1 -> 2 -> 1
      const multiCycle = validateCategoryHierarchy([
        { id: 1, kind: 'instrument', parentId: 2, name: 'Node 1', description: null },
        { id: 2, kind: 'instrument', parentId: 1, name: 'Node 2', description: null },
      ]);
      expect(multiCycle.ok).toBe(false);
      if (multiCycle.ok) throw new Error('Expected cycle rejection');
      expect(multiCycle.error.code).toBe('category_cycle');

      // 5. 3-node cycle: 1 -> 2 -> 3 -> 1
      const threeCycle = validateCategoryHierarchy([
        { id: 1, kind: 'instrument', parentId: 3, name: 'Node 1', description: null },
        { id: 2, kind: 'instrument', parentId: 1, name: 'Node 2', description: null },
        { id: 3, kind: 'instrument', parentId: 2, name: 'Node 3', description: null },
      ]);
      expect(threeCycle.ok).toBe(false);
      if (threeCycle.ok) throw new Error('Expected cycle rejection');
      expect(threeCycle.error.code).toBe('category_cycle');

      // Verify isCategoryList boundary guard rejects corrupt hierarchies
      expect(
        isCategoryList([
          { id: 10, kind: 'instrument', parentId: null, name: 'Synths', description: null },
          { id: 10, kind: 'instrument', parentId: null, name: 'Other', description: null },
        ]),
      ).toBe(false);

      expect(
        isCategoryList([
          { id: 1, kind: 'instrument', parentId: 2, name: 'Node 1', description: null },
          { id: 2, kind: 'instrument', parentId: 1, name: 'Node 2', description: null },
        ]),
      ).toBe(false);

      expect(
        isCategoryList([
          { id: 11, kind: 'instrument', parentId: 999, name: 'Orphan', description: null },
        ]),
      ).toBe(false);
    });
  });

  describe('AccountIdentity sanitization', () => {
    it('accepts sanitized public author identity', () => {
      expect(
        isAccountIdentity({
          id: 'user-1',
          name: 'Steven',
          username: 'steven',
        }),
      ).toBe(true);
    });

    it('rejects identity objects leaking credentials or emails', () => {
      expect(
        isAccountIdentity({
          id: 'user-1',
          name: 'Steven',
          username: 'steven',
          email: 'steven@example.com',
        }),
      ).toBe(false);

      expect(
        isAccountIdentity({
          id: 'user-1',
          name: 'Steven',
          username: 'steven',
          password: 'secret',
        }),
      ).toBe(false);

      expect(
        isAccountIdentity({
          id: 'user-1',
          name: 'Steven',
          username: 'steven',
          cookie: 'session_id=123',
        }),
      ).toBe(false);

      expect(
        isAccountIdentity({
          id: 'user-1',
          name: 'Steven',
          username: 'steven',
          token: 'xyz',
        }),
      ).toBe(false);
    });
  });

  describe('ResourceSummary and ResourceDetail', () => {
    const validSummary: ResourceSummary = {
      kind: 'instrument',
      id: 1,
      name: 'Test Synth',
      description: 'A great synth',
      blueType: 'blue.orchestra.GenericInstrument',
      createdAt: '2026-10-17T12:00:00.000Z',
      category: { id: 10, name: 'Synths' },
      author: { id: 'u1', name: 'Author', username: 'author1' },
    };

    it('validates valid ResourceSummary and nullable fields', () => {
      expect(isResourceSummary(validSummary)).toBe(true);

      const withNulls: ResourceSummary = {
        ...validSummary,
        description: null,
        createdAt: null,
      };
      expect(isResourceSummary(withNulls)).toBe(true);
    });

    it('enforces null blueType for effects', () => {
      const effectSummary: ResourceSummary = {
        kind: 'effect',
        id: 2,
        name: 'Test Delay',
        description: null,
        blueType: null,
        createdAt: null,
        category: { id: 20, name: 'Delays' },
        author: { id: 'u1', name: 'Author', username: 'author1' },
      };
      expect(isResourceSummary(effectSummary)).toBe(true);

      const invalidEffect = {
        ...effectSummary,
        blueType: 'some.type',
      };
      expect(isResourceSummary(invalidEffect)).toBe(false);
    });

    it('rejects invalid dates or author leaks in ResourceSummary', () => {
      expect(
        isResourceSummary({
          ...validSummary,
          createdAt: 'not-a-date',
        }),
      ).toBe(false);

      // Rejects non-UTC offset strings
      expect(
        isResourceSummary({
          ...validSummary,
          createdAt: '2026-10-17T12:00:00+02:00',
        }),
      ).toBe(false);

      // Rejects strings without timezone indicator
      expect(
        isResourceSummary({
          ...validSummary,
          createdAt: '2026-10-17T12:00:00',
        }),
      ).toBe(false);

      // Rejects impossible calendar dates (Feb 31 rollover)
      expect(
        isResourceSummary({
          ...validSummary,
          createdAt: '2026-02-31T12:00:00Z',
        }),
      ).toBe(false);

      // Rejects author leaks
      expect(
        isResourceSummary({
          ...validSummary,
          author: { ...validSummary.author, email: 'leak@example.com' },
        }),
      ).toBe(false);

      // Rejects category ID out of bounds
      expect(
        isResourceSummary({
          ...validSummary,
          category: { id: 0, name: 'Invalid Cat' },
        }),
      ).toBe(false);

      expect(
        isResourceSummary({
          ...validSummary,
          category: { id: 2147483648, name: 'Overflow Cat' },
        }),
      ).toBe(false);
    });

    it('validates ResourceDetail includes xml and enforces 2 MiB bound and matching expectedId', () => {
      expect(isResourceDetail({ ...validSummary, xml: '<instrument></instrument>' })).toBe(true);
      expect(isResourceDetail(validSummary)).toBe(false);
      expect(isResourceDetail({ ...validSummary, xml: '' })).toBe(false);
      expect(isResourceDetail({ ...validSummary, xml: '   ' })).toBe(false);

      // Enforces matching expectedId
      expect(
        isResourceDetail({ ...validSummary, xml: '<instrument></instrument>' }, 'instrument', 1),
      ).toBe(true);
      expect(
        isResourceDetail({ ...validSummary, xml: '<instrument></instrument>' }, 'instrument', 2),
      ).toBe(false);

      // Enforces 2 MiB UTF-8 XML limit
      const maxXml = 'x'.repeat(MAX_RESOURCE_XML_BYTES);
      expect(isResourceDetail({ ...validSummary, xml: maxXml })).toBe(true);

      const oversizedXml = 'x'.repeat(MAX_RESOURCE_XML_BYTES + 1);
      expect(isResourceDetail({ ...validSummary, xml: oversizedXml })).toBe(false);
    });
  });

  describe('ResourcePage and LatestResult catalog response bounds', () => {
    const item1: ResourceSummary = {
      kind: 'instrument',
      id: 20,
      name: 'Item 20',
      description: null,
      blueType: 'blue.orchestra.GenericInstrument',
      createdAt: '2026-10-17T12:00:00Z',
      category: { id: 1, name: 'Cat' },
      author: { id: 'u1', name: 'Author', username: 'author' },
    };

    const item2: ResourceSummary = {
      ...item1,
      id: 19,
      name: 'Item 19',
      createdAt: '2026-10-17T11:00:00Z',
    };

    const item3: ResourceSummary = {
      ...item1,
      id: 18,
      name: 'Item 18',
      createdAt: '2026-10-17T10:00:00Z',
    };

    it('enforces page size at most 25 items', () => {
      const twentyFiveItems = Array.from({ length: 25 }, (_, i) => ({
        ...item1,
        id: 100 - i,
      }));
      expect(isResourcePage({ items: twentyFiveItems, nextBeforeId: 75 })).toBe(true);

      const twentySixItems = Array.from({ length: 26 }, (_, i) => ({
        ...item1,
        id: 100 - i,
      }));
      expect(isResourcePage({ items: twentySixItems, nextBeforeId: 74 })).toBe(false);
    });

    it('enforces valid progressing cursors that do not repeat items', () => {
      // nextBeforeId <= lowest item id is progressing
      expect(isResourcePage({ items: [item1, item2, item3], nextBeforeId: 18 })).toBe(true);
      expect(isResourcePage({ items: [item1, item2, item3], nextBeforeId: 17 })).toBe(true);
      expect(isResourcePage({ items: [item1, item2, item3], nextBeforeId: null })).toBe(true);

      // nextBeforeId > lowest item id is non-progressing (would repeat items!)
      expect(isResourcePage({ items: [item1, item2, item3], nextBeforeId: 19 })).toBe(false);
      expect(isResourcePage({ items: [item1, item2, item3], nextBeforeId: 25 })).toBe(false);

      // Empty page with nextBeforeId is invalid
      expect(isResourcePage({ items: [], nextBeforeId: 18 })).toBe(false);
      expect(isResourcePage({ items: [], nextBeforeId: null })).toBe(true);

      // nextBeforeId out of numeric bounds
      expect(isResourcePage({ items: [item1], nextBeforeId: 0 })).toBe(false);
      expect(isResourcePage({ items: [item1], nextBeforeId: -5 })).toBe(false);
      expect(isResourcePage({ items: [item1], nextBeforeId: 2147483648 })).toBe(false);
    });

    it('enforces strict descending IDs without duplicates', () => {
      expect(isResourcePage({ items: [item2, item1], nextBeforeId: null })).toBe(false);
      expect(isResourcePage({ items: [item1, item1], nextBeforeId: null })).toBe(false);
    });

    it('enforces categoryId and beforeId constraints on ResourcePage', () => {
      // Category constraint
      expect(isResourcePage({ items: [item1, item2], nextBeforeId: null }, 'instrument', 1)).toBe(
        true,
      );
      expect(isResourcePage({ items: [item1, item2], nextBeforeId: null }, 'instrument', 99)).toBe(
        false,
      );

      // beforeId constraint: items must be strictly less than beforeId, and nextBeforeId < beforeId
      expect(isResourcePage({ items: [item1, item2], nextBeforeId: 19 }, 'instrument', 1, 25)).toBe(
        true,
      );

      // Item has id >= beforeId constraint
      expect(isResourcePage({ items: [item1, item2], nextBeforeId: 19 }, 'instrument', 1, 20)).toBe(
        false,
      );

      // nextBeforeId >= beforeId constraint
      expect(isResourcePage({ items: [item2, item3], nextBeforeId: 20 }, 'instrument', 1, 20)).toBe(
        false,
      );
    });

    it('enforces LatestResult bounds (<= 10) and creation descending / null last / tie ordering', () => {
      expect(isLatestResult({ items: [item1, item2] })).toBe(true);

      // Rejects more than 10 items
      const elevenItems = Array.from({ length: 11 }, (_, i) => ({
        ...item1,
        id: 100 - i,
        createdAt: new Date(Date.UTC(2026, 0, 20 - i, 12, 0, 0)).toISOString(),
      }));
      expect(isLatestResult({ items: elevenItems })).toBe(false);

      // Creation date descending: item1 (12:00) then item2 (11:00) is valid
      expect(isLatestResult({ items: [item1, item2] })).toBe(true);

      // Out of order creation date: older date before newer date
      const olderFirst = [item2, item1];
      expect(isLatestResult({ items: olderFirst })).toBe(false);

      // Tie in creation date: ID must be strictly descending
      const tiedDateHigherId: ResourceSummary = {
        ...item1,
        id: 50,
        createdAt: '2026-10-17T12:00:00Z',
      };
      const tiedDateLowerId: ResourceSummary = {
        ...item1,
        id: 40,
        createdAt: '2026-10-17T12:00:00Z',
      };
      expect(isLatestResult({ items: [tiedDateHigherId, tiedDateLowerId] })).toBe(true);
      expect(isLatestResult({ items: [tiedDateLowerId, tiedDateHigherId] })).toBe(false);

      // Null dates must appear last
      const nullDateItem1: ResourceSummary = {
        ...item1,
        id: 30,
        createdAt: null,
      };
      const nullDateItem2: ResourceSummary = {
        ...item1,
        id: 25,
        createdAt: null,
      };

      // Dated item followed by null date item -> valid
      expect(isLatestResult({ items: [item1, nullDateItem1] })).toBe(true);

      // Null date item followed by dated item -> invalid!
      expect(isLatestResult({ items: [nullDateItem1, item1] })).toBe(false);

      // Multiple null date items: ID must be strictly descending
      expect(isLatestResult({ items: [nullDateItem1, nullDateItem2] })).toBe(true);
      expect(isLatestResult({ items: [nullDateItem2, nullDateItem1] })).toBe(false);
    });
  });

  it('accepts only a boolean rememberMe and rejects unknown login fields', () => {
    for (const rememberMe of [false, true]) {
      const result = validateLoginRequest({
        email: 'test@example.invalid',
        password: 'test',
        rememberMe,
      });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.request.rememberMe).toBe(rememberMe);
    }
    for (const rememberMe of [null, 'true', 0, [], {}])
      expect(
        validateLoginRequest({ email: 'test@example.invalid', password: 'test', rememberMe }).valid,
      ).toBe(false);
    expect(
      isLoginRequest({ email: 'test@example.invalid', password: 'test', token: 'forged' }),
    ).toBe(false);
  });

  describe('validateLoginRequest (T065)', () => {
    it('accepts valid credentials and strips outer whitespace on email', () => {
      const res = validateLoginRequest({
        email: '  user@example.com  ',
        password: 'secure-password-123',
      });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.request.email).toBe('user@example.com');
      expect(res.request.password).toBe('secure-password-123');
    });

    it('rejects invalid request objects or unexpected fields', () => {
      expect(validateLoginRequest(null).valid).toBe(false);
      expect(validateLoginRequest('not-an-object').valid).toBe(false);
      expect(validateLoginRequest([]).valid).toBe(false);

      const unexpected = validateLoginRequest({
        email: 'user@example.com',
        password: 'password',
        adminToken: 'secret',
      });
      expect(unexpected.valid).toBe(false);
      if (!unexpected.valid) {
        expect(unexpected.errors.adminToken).toBeDefined();
      }
    });

    it('rejects missing, empty, or non-email email addresses', () => {
      const empty = validateLoginRequest({ email: '   ', password: 'password' });
      expect(empty.valid).toBe(false);
      if (!empty.valid) expect(empty.errors.email).toBeDefined();

      const noAt = validateLoginRequest({ email: 'notanemail', password: 'password' });
      expect(noAt.valid).toBe(false);
      if (!noAt.valid) expect(noAt.errors.email).toBeDefined();

      const nonString = validateLoginRequest({ email: 12345, password: 'password' });
      expect(nonString.valid).toBe(false);
      if (!nonString.valid) expect(nonString.errors.email).toBeDefined();
    });

    it('rejects missing or empty passwords', () => {
      const empty = validateLoginRequest({ email: 'user@example.com', password: '' });
      expect(empty.valid).toBe(false);
      if (!empty.valid) expect(empty.errors.password).toBeDefined();

      const nonString = validateLoginRequest({ email: 'user@example.com', password: null });
      expect(nonString.valid).toBe(false);
      if (!nonString.valid) expect(nonString.errors.password).toBeDefined();
    });

    it('bounds encoded login JSON to 16 KiB', () => {
      // 16 KiB = 16384 bytes
      const hugePassword = 'p'.repeat(MAX_LOGIN_JSON_BYTES + 1);
      const res = validateLoginRequest({
        email: 'user@example.com',
        password: hugePassword,
      });
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.errors.request).toMatch(/16 KiB/);
      }
    });
  });

  describe('validatePublishRequest (T036, T065)', () => {
    it('validates instrument publish request with prefix and length constraints', () => {
      const res = validatePublishRequest('instrument', {
        categoryId: 10,
        name: '  Lead Synth  ',
        description: 'Sample description',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"></instrument>',
      });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.request.name).toBe('Lead Synth');
      expect(res.request.categoryId).toBe(10);
    });

    it('validates soundObject publish request with matching type and root', () => {
      const res = validatePublishRequest('soundObject', {
        categoryId: 5,
        name: 'My PolyObject',
        description: 'A polyphonic sound object',
        blueType: 'blue.soundObject.PolyObject',
        xml: '<soundObject type="blue.soundObject.PolyObject"><name>Test</name></soundObject>',
      });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.request.blueType).toBe('blue.soundObject.PolyObject');
    });

    it('requires null blueType for effect publish request', () => {
      const validEffect = validatePublishRequest('effect', {
        categoryId: 20,
        name: 'Echo',
        description: null,
        blueType: null,
        xml: '<effect></effect>',
      });
      expect(validEffect.valid).toBe(true);

      const invalidEffect = validatePublishRequest('effect', {
        categoryId: 20,
        name: 'Echo',
        blueType: 'some.type',
        xml: '<effect></effect>',
      });
      expect(invalidEffect.valid).toBe(false);
    });

    it('enforces category ID bounds (1 to 2147483647)', () => {
      const zeroCat = validatePublishRequest('instrument', {
        categoryId: 0,
        name: 'Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"/>',
      });
      expect(zeroCat.valid).toBe(false);
      if (!zeroCat.valid) expect(zeroCat.errors.categoryId).toBeDefined();

      const negCat = validatePublishRequest('instrument', {
        categoryId: -10,
        name: 'Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"/>',
      });
      expect(negCat.valid).toBe(false);

      const floatCat = validatePublishRequest('instrument', {
        categoryId: 1.5,
        name: 'Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"/>',
      });
      expect(floatCat.valid).toBe(false);

      const overflowCat = validatePublishRequest('instrument', {
        categoryId: MAX_RESOURCE_ID + 1,
        name: 'Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"/>',
      });
      expect(overflowCat.valid).toBe(false);
    });

    it('enforces dotted type constraints for instrument and soundObject', () => {
      // Missing class suffix after prefix
      const prefixOnlyInst = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Synth',
        blueType: 'blue.orchestra.',
        xml: '<instrument type="blue.orchestra."/>',
      });
      expect(prefixOnlyInst.valid).toBe(false);
      if (!prefixOnlyInst.valid) expect(prefixOnlyInst.errors.blueType).toBeDefined();

      const prefixOnlySound = validatePublishRequest('soundObject', {
        categoryId: 1,
        name: 'Sound',
        blueType: 'blue.soundObject.',
        xml: '<soundObject type="blue.soundObject."/>',
      });
      expect(prefixOnlySound.valid).toBe(false);
      if (!prefixOnlySound.valid) expect(prefixOnlySound.errors.blueType).toBeDefined();

      // Wrong prefix for soundObject
      const wrongSoundPrefix = validatePublishRequest('soundObject', {
        categoryId: 1,
        name: 'Sound',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<soundObject type="blue.orchestra.GenericInstrument"/>',
      });
      expect(wrongSoundPrefix.valid).toBe(false);
      if (!wrongSoundPrefix.valid) expect(wrongSoundPrefix.errors.blueType).toBeDefined();

      // Non-ASCII characters in blueType
      const nonAsciiType = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Synth',
        blueType: 'blue.orchestra.Synthétiseur',
        xml: '<instrument type="blue.orchestra.Synthétiseur"/>',
      });
      expect(nonAsciiType.valid).toBe(false);

      // Exceeding 255 chars
      const hugeType = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Synth',
        blueType: 'blue.orchestra.' + 'A'.repeat(250),
        xml: `<instrument type="blue.orchestra.${'A'.repeat(250)}"/>`,
      });
      expect(hugeType.valid).toBe(false);
    });

    it('enforces matching standalone root element and type attribute', () => {
      // Root element tag mismatch (e.g. <soundObject> for instrument kind)
      const rootMismatch = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<soundObject type="blue.orchestra.GenericInstrument"/>',
      });
      expect(rootMismatch.valid).toBe(false);
      if (!rootMismatch.valid) {
        expect(rootMismatch.errors.xml).toMatch(/does not match resource kind/);
      }

      // Root element missing type attribute for instrument
      const missingTypeAttr = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument><name>No Type</name></instrument>',
      });
      expect(missingTypeAttr.valid).toBe(false);
      if (!missingTypeAttr.valid) {
        expect(missingTypeAttr.errors.xml).toMatch(/missing required type attribute/);
      }

      // Type mismatch between blueType and XML root type attribute
      const typeMismatch = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.BlueSynthBuilder"/>',
      });
      expect(typeMismatch.valid).toBe(false);
      if (!typeMismatch.valid) {
        expect(typeMismatch.errors.blueType).toMatch(/does not match XML root type attribute/);
      }

      // Effect root element with unexpected type attribute
      const effectWithType = validatePublishRequest('effect', {
        categoryId: 1,
        name: 'Delay',
        blueType: null,
        xml: '<effect type="some.Type"/>',
      });
      expect(effectWithType.valid).toBe(false);
      if (!effectWithType.valid) {
        expect(effectWithType.errors.xml).toMatch(/Effect XML root must not have a type attribute/);
      }
    });

    it('enforces XML envelope depth limit of 128', () => {
      // Depth 128: 1 (<instrument>) + 127 (<child>) = 128 levels
      let validXml = '<instrument type="blue.orchestra.GenericInstrument">';
      for (let i = 0; i < 127; i++) validXml += '<level>';
      for (let i = 0; i < 127; i++) validXml += '</level>';
      validXml += '</instrument>';

      const depth128Res = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Deep Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: validXml,
      });
      expect(depth128Res.valid).toBe(true);

      // Depth 129: 1 (<instrument>) + 128 (<child>) = 129 levels (exceeds 128)
      let depth129Xml = '<instrument type="blue.orchestra.GenericInstrument">';
      for (let i = 0; i < 128; i++) depth129Xml += '<level>';
      for (let i = 0; i < 128; i++) depth129Xml += '</level>';
      depth129Xml += '</instrument>';

      const depth129Res = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Too Deep Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: depth129Xml,
      });
      expect(depth129Res.valid).toBe(false);
      if (!depth129Res.valid) {
        expect(depth129Res.errors.xml).toMatch(/maximum depth limit of 128/);
      }
    });

    it('enforces XML envelope element limit of 100,000', () => {
      // 100,001 elements: 1 root + 100,000 children = 100,001 elements
      const tooManyElementsXml =
        '<instrument type="blue.orchestra.GenericInstrument">' +
        '<e/>'.repeat(100000) +
        '</instrument>';

      const res = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Huge Element Count',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: tooManyElementsXml,
      });
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.errors.xml).toMatch(/maximum element limit of 100000/);
      }
    });

    it('rejects unsafe declarations: DOCTYPE, ENTITY, and XInclude', () => {
      const doctypeXml = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Valid',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><instrument type="blue.orchestra.GenericInstrument"/>',
      });
      expect(doctypeXml.valid).toBe(false);
      if (!doctypeXml.valid) {
        expect(doctypeXml.errors.xml).toMatch(/DOCTYPE, ENTITY, or XInclude/);
      }

      const entityXml = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Valid',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<!ENTITY xxe "hello"><instrument type="blue.orchestra.GenericInstrument"/>',
      });
      expect(entityXml.valid).toBe(false);
      if (!entityXml.valid) {
        expect(entityXml.errors.xml).toMatch(/DOCTYPE, ENTITY, or XInclude/);
      }

      const xincludeXml = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Valid',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument xmlns:xi="http://www.w3.org/2001/XInclude" type="blue.orchestra.GenericInstrument"><xi:include href="file.xml"/></instrument>',
      });
      expect(xincludeXml.valid).toBe(false);
      if (!xincludeXml.valid) {
        expect(xincludeXml.errors.xml).toMatch(/DOCTYPE, ENTITY, or XInclude/);
      }
    });

    it('rejects malformed XML syntax with actionable field error', () => {
      const malformedXml = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Valid',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"><unclosed>',
      });
      expect(malformedXml.valid).toBe(false);
      if (!malformedXml.valid) {
        expect(malformedXml.errors.xml).toMatch(/XML is malformed/);
      }
    });

    it('rejects unexpected fields', () => {
      const unexpectedField = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Valid',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"/>',
        extraProperty: 'malicious',
      });
      expect(unexpectedField.valid).toBe(false);
      if (!unexpectedField.valid) {
        expect(unexpectedField.errors.extraProperty).toBeDefined();
      }
    });

    it('rejects invalid names, types, and oversized XML', () => {
      const emptyName = validatePublishRequest('instrument', {
        categoryId: 1,
        name: '   ',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: '<instrument type="blue.orchestra.GenericInstrument"/>',
      });
      expect(emptyName.valid).toBe(false);

      const badPrefix = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Valid',
        blueType: 'com.example.BadPrefix',
        xml: '<instrument type="com.example.BadPrefix"/>',
      });
      expect(badPrefix.valid).toBe(false);

      const hugeXml = validatePublishRequest('instrument', {
        categoryId: 1,
        name: 'Valid',
        blueType: 'blue.orchestra.GenericInstrument',
        xml: 'a'.repeat(2 * 1024 * 1024 + 1),
      });
      expect(hugeXml.valid).toBe(false);
    });
  });

  describe('checkXmlEnvelope (T065)', () => {
    it('accepts balanced trees within depth and element bounds', () => {
      const root = Element.parse('<root><child1/><child2><subchild/></child2></root>');
      const res = checkXmlEnvelope(root, 10, 100);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.elementCount).toBe(4);
        expect(res.maxDepth).toBe(3);
      }
    });

    it('rejects trees exceeding custom depth limit', () => {
      const root = Element.parse('<root><a1><a2><a3/></a2></a1></root>');
      const res = checkXmlEnvelope(root, 3, 100);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/maximum depth limit of 3/);
      }
    });

    it('rejects trees exceeding custom element count limit', () => {
      const root = Element.parse('<root><a/><b/><c/><d/></root>');
      const res = checkXmlEnvelope(root, 10, 4);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/maximum element limit of 4/);
      }
    });
  });

  describe('BlueShareResult and errors', () => {
    it('validates success and error envelopes', () => {
      expect(isBlueShareSuccess({ ok: true, value: 123 })).toBe(true);
      expect(isBlueShareSuccess({ ok: false, error: { code: 'bad', message: 'err' } })).toBe(false);

      expect(
        isBlueShareError({
          code: 'network_error',
          message: 'Connection refused',
          outcome: 'unknown',
          status: 504,
          retryAfterSeconds: 30,
        }),
      ).toBe(true);

      expect(isBlueShareError({ code: '', message: 'empty code' })).toBe(false);
      expect(isBlueShareError({ code: 'err' })).toBe(false);
    });
  });

  describe('BLUESHARE_CHANNELS', () => {
    it('has all required channel constants', () => {
      expect(BLUESHARE_CHANNELS.OPEN).toBe('blueshare:open');
      expect(BLUESHARE_CHANNELS.GET_ACCOUNT).toBe('blueshare:get-account');
      expect(BLUESHARE_CHANNELS.SIGN_IN).toBe('blueshare:sign-in');
      expect(BLUESHARE_CHANNELS.SIGN_OUT).toBe('blueshare:sign-out');
      expect(BLUESHARE_CHANNELS.GET_CATEGORIES).toBe('blueshare:get-categories');
      expect(BLUESHARE_CHANNELS.LIST_RESOURCES).toBe('blueshare:list-resources');
      expect(BLUESHARE_CHANNELS.GET_LATEST).toBe('blueshare:get-latest');
      expect(BLUESHARE_CHANNELS.GET_RESOURCE).toBe('blueshare:get-resource');
      expect(BLUESHARE_CHANNELS.IMPORT_RESOURCE).toBe('blueshare:import-resource');
      expect(BLUESHARE_CHANNELS.PREPARE_PUBLISH).toBe('blueshare:prepare-publish');
      expect(BLUESHARE_CHANNELS.PUBLISH_RESOURCE).toBe('blueshare:publish-resource');
      expect(BLUESHARE_CHANNELS.LIST_MINE).toBe('blueshare:list-mine');
      expect(BLUESHARE_CHANNELS.REMOVE_RESOURCE).toBe('blueshare:remove-resource');
      expect(BLUESHARE_CHANNELS.OPEN_WEBSITE).toBe('blueshare:open-website');
      expect(BLUESHARE_CHANNELS.CLOSE).toBe('blueshare:close');
      expect(BLUESHARE_CHANNELS.ACCOUNT_CHANGED).toBe('blueshare:account-changed');
    });
    describe('Boundary contracts and IPC result guards', () => {
      it('validates isAccountState', () => {
        expect(isAccountState('signedOut')).toBe(true);
        expect(isAccountState('signingIn')).toBe(true);
        expect(isAccountState('signedIn')).toBe(true);
        expect(isAccountState('signingOut')).toBe(true);
        expect(isAccountState('unavailable')).toBe(true);
        expect(isAccountState('loggedIn')).toBe(false);
        expect(isAccountState('')).toBe(false);
        expect(isAccountState(null)).toBe(false);
      });

      it('validates isAccountSessionSnapshot and strictly rejects secret leaks', () => {
        const valid: unknown = {
          state: 'signedIn',
          user: { id: 'u1', name: 'Steven', username: 'steven' },
          expiresAt: '2026-01-01T00:00:00Z',
          accountEpoch: 1,
        };
        expect(isAccountSessionSnapshot(valid)).toBe(true);

        // Null user and expiresAt allowed when signed out
        expect(
          isAccountSessionSnapshot({
            state: 'signedOut',
            user: null,
            expiresAt: null,
            accountEpoch: 0,
          }),
        ).toBe(true);

        // Rejects negative epoch or non-integer
        expect(isAccountSessionSnapshot({ ...valid, accountEpoch: -1 })).toBe(false);
        expect(isAccountSessionSnapshot({ ...valid, accountEpoch: 1.5 })).toBe(false);

        // Rejects non-ISO date
        expect(isAccountSessionSnapshot({ ...valid, expiresAt: 'not-a-date' })).toBe(false);

        // Rejects secret leaks
        expect(isAccountSessionSnapshot({ ...valid, email: 'steven@example.com' })).toBe(false);
        expect(isAccountSessionSnapshot({ ...valid, password: 'secret' })).toBe(false);
        expect(isAccountSessionSnapshot({ ...valid, token: 'xyz' })).toBe(false);
        expect(isAccountSessionSnapshot({ ...valid, cookie: 'session_id=123' })).toBe(false);
      });

      it('validates isOpenDialogResult', () => {
        expect(
          isOpenDialogResult({
            contextId: 'ctx-123',
            serviceScope: 'https://blue3.kunstmusik.com',
            account: {
              state: 'signedOut',
              user: null,
              expiresAt: null,
              accountEpoch: 1,
            },
          }),
        ).toBe(true);

        expect(isOpenDialogResult({ contextId: '', account: {} })).toBe(false);
        expect(isOpenDialogResult(null)).toBe(false);
      });

      it('validates isSignOutResult', () => {
        expect(isSignOutResult({ signedOut: true, remoteRevocationConfirmed: true })).toBe(true);
        expect(isSignOutResult({ signedOut: true, remoteRevocationConfirmed: false })).toBe(true);
        expect(isSignOutResult({ signedOut: 'true', remoteRevocationConfirmed: false })).toBe(
          false,
        );
        expect(isSignOutResult(null)).toBe(false);
      });

      it('validates isPublishSourceSeed', () => {
        const valid = {
          sourceToken: 'token-1',
          kind: 'instrument',
          name: 'Synth',
          blueType: 'blue.orchestra.GenericInstrument',
          descriptionSeed: 'A synth',
          byteLength: 500,
        };
        expect(isPublishSourceSeed(valid)).toBe(true);

        // Invalid tokens or negative bytes
        expect(isPublishSourceSeed({ ...valid, sourceToken: '' })).toBe(false);
        expect(isPublishSourceSeed({ ...valid, byteLength: -5 })).toBe(false);
        expect(isPublishSourceSeed({ ...valid, kind: 'invalid' })).toBe(false);
      });

      it('validates isRemoveResourceResult', () => {
        expect(
          isRemoveResourceResult({
            kind: 'instrument',
            id: 42,
            removed: true,
            alreadyRemoved: false,
          }),
        ).toBe(true);
        expect(
          isRemoveResourceResult({
            kind: 'effect',
            id: 1,
            removed: false,
            alreadyRemoved: true,
          }),
        ).toBe(false);
        expect(
          isRemoveResourceResult({
            kind: 'invalid',
            id: 42,
            removed: true,
            alreadyRemoved: false,
          }),
        ).toBe(false);
        expect(
          isRemoveResourceResult({
            kind: 'instrument',
            id: 0,
            removed: true,
            alreadyRemoved: false,
          }),
        ).toBe(false);
      });

      it('validates isOpenWebsiteResult', () => {
        expect(isOpenWebsiteResult({ opened: true })).toBe(true);
        expect(isOpenWebsiteResult({ opened: false })).toBe(true);
        expect(isOpenWebsiteResult({ opened: 'yes' })).toBe(false);
      });

      it('validates isLibraryMutationReceipt', () => {
        expect(
          isLibraryMutationReceipt({
            contentRevision: 5,
            affectedNodes: [],
          }),
        ).toBe(true);
        expect(isLibraryMutationReceipt({ contentRevision: -1, affectedNodes: [] })).toBe(false);
        expect(isLibraryMutationReceipt({ contentRevision: 5, affectedNodes: 'bad' })).toBe(false);
      });

      it('validates isCategoryList', () => {
        const cat = {
          id: 1,
          kind: 'instrument',
          parentId: null,
          name: 'Synths',
          description: null,
        };
        expect(isCategoryList([cat], 'instrument')).toBe(true);
        expect(isCategoryList([cat], 'effect')).toBe(false);
        expect(isCategoryList('not-an-array')).toBe(false);
      });

      it('validates isUserLibraryItemKey', () => {
        expect(
          isUserLibraryItemKey({
            scope: 'user',
            libraryType: 'instrument',
            nodeId: 'node-1',
          }),
        ).toBe(true);
        // Rejects project scope
        expect(
          isUserLibraryItemKey({
            scope: 'projectOwned',
            libraryType: 'instrument',
            nodeId: 'node-1',
          }),
        ).toBe(false);
        // Rejects empty nodeId
        expect(
          isUserLibraryItemKey({
            scope: 'user',
            libraryType: 'instrument',
            nodeId: '',
          }),
        ).toBe(false);
      });

      it('validates isRequestId and isContextId', () => {
        expect(isRequestId('req-1')).toBe(true);
        expect(isRequestId('')).toBe(false);
        expect(isRequestId(123)).toBe(false);

        expect(isContextId('ctx-abc')).toBe(true);
        expect(isContextId('   ')).toBe(false);
        expect(isContextId(null)).toBe(false);
      });

      it('validates validateBlueShareResult helper', () => {
        const guard = (v: unknown): v is number => typeof v === 'number';

        // Valid success
        const ok = validateBlueShareResult({ ok: true, value: 42 }, guard);
        expect(ok.ok).toBe(true);
        if (ok.ok) expect(ok.value).toBe(42);

        // Malformed success
        const badVal = validateBlueShareResult({ ok: true, value: 'not-number' }, guard);
        expect(badVal.ok).toBe(false);
        if (!badVal.ok) expect(badVal.error.code).toBe('boundary_contract_violation');

        // Valid error
        const err = validateBlueShareResult(
          { ok: false, error: { code: 'my_err', message: 'failed' } },
          guard,
        );
        expect(err.ok).toBe(false);
        if (!err.ok) expect(err.error.code).toBe('my_err');

        // Malformed error
        const badErr = validateBlueShareResult({ ok: false, error: 'raw string' }, guard);
        expect(badErr.ok).toBe(false);
        if (!badErr.ok) expect(badErr.error.code).toBe('boundary_contract_violation');

        // Not an object
        const badPayload = validateBlueShareResult(null, guard);
        expect(badPayload.ok).toBe(false);
      });
    });
  });
});

describe('nested IPC contracts (T074)', () => {
  it('requires a canonical service scope from main', () => {
    const value = {
      contextId: 'ctx',
      serviceScope: 'https://blue3.kunstmusik.com',
      account: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 1 },
    };
    expect(isOpenDialogResult(value)).toBe(true);
    expect(isOpenDialogResult({ ...value, serviceScope: undefined })).toBe(false);
    expect(isOpenDialogResult({ ...value, serviceScope: 'https://host/path' })).toBe(false);
  });
  it('rejects malformed receipt nodes and optional nested fields', () => {
    expect(isLibraryMutationReceipt({ contentRevision: 1, affectedNodes: [null] })).toBe(false);
    expect(
      isLibraryMutationReceipt({
        contentRevision: 1,
        affectedNodes: [],
        closedEditorSessionIds: [1],
      }),
    ).toBe(false);
  });
  it.each([
    { fields: { xml: {} } },
    { diagnostics: [null] },
    { diagnostics: [{ code: 'bad' }] },
    { status: NaN },
    { retryAfterSeconds: -1 },
    { message: 'x'.repeat(1001) },
  ])('rejects malformed nested errors: %j', (extra) => {
    expect(isBlueShareError({ code: 'invalid_payload', message: 'Invalid', ...extra })).toBe(false);
  });
});

describe('structural XML safety (T080)', () => {
  const request = {
    categoryId: 1,
    name: 'Synthetic',
    blueType: 'blue.orchestra.GenericInstrument',
    description: '',
  };
  it('accepts literal include/declaration text in comments and code CDATA without changing bytes', () => {
    const xml =
      '<instrument type="blue.orchestra.GenericInstrument"><!-- <!DOCTYPE fake> xmlns:xi --><instrumentText><![CDATA[  <include>\n<!ENTITY fake>  ]]></instrumentText></instrument>';
    const result = validatePublishRequest('instrument', { ...request, xml });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.request.xml).toBe(xml);
  });
  it.each([
    '<include href="file"/>',
    '<x:include xmlns:x="http://www.w3.org/2001/XInclude" href="file"/>',
    '<part xmlns="http://www.w3.org/2001/XInclude"/>',
  ])('rejects actual include structures: %s', (child) => {
    expect(
      validatePublishRequest('instrument', {
        ...request,
        xml: `<instrument type="blue.orchestra.GenericInstrument">${child}</instrument>`,
      }).valid,
    ).toBe(false);
  });
});

it('rejects unexpected proof/XML members instead of returning them as checked DTOs', () => {
  expect(
    isAccountIdentity({
      id: 'u1',
      name: 'Synthetic',
      username: 'synthetic',
      sessionToken: 'synthetic-proof',
    }),
  ).toBe(false);
  const summary = {
    kind: 'instrument',
    id: 1,
    name: 'Synthetic',
    description: null,
    blueType: null,
    createdAt: null,
    category: { id: 1, name: 'Synthetic' },
    author: { id: 'u1', name: 'Synthetic', username: 'synthetic' },
  };
  expect(isResourceSummary({ ...summary, xml: '<instrument/>' })).toBe(false);
  expect(isResourceDetail({ ...summary, xml: '<instrument/>' })).toBe(true);
});
