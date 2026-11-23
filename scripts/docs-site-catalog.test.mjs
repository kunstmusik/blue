import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  SITE_PREFIX,
  SITE_SECTIONS,
  assertRetained,
  assertRetainedCatalog,
  publicationInventory,
  validateCatalog,
} from './docs-site-catalog.mjs';

const SOURCE_A = 'a'.repeat(40);
const SOURCE_B = 'b'.repeat(40);
const SOURCE_C = 'c'.repeat(40);

function desktopEdition(overrides = {}) {
  return {
    key: 'v3.0.0-beta.6',
    channel: 'prerelease',
    label: 'Blue 3.0.0-beta.6 (prerelease)',
    sourceSha: SOURCE_A,
    tag: 'v3.0.0-beta.6',
    ...overrides,
  };
}

function toolingEdition(overrides = {}) {
  return {
    version: '0.1.0-beta.1',
    channel: 'prerelease',
    sourceSha: SOURCE_C,
    tag: 'npm-v0.1.0-beta.1',
    ...overrides,
  };
}

function catalog({ desktop, tooling, recommended } = {}) {
  const desktopRows = desktop ?? [desktopEdition()];
  const toolingRows = tooling ?? [];
  return {
    desktop: desktopRows,
    tooling: toolingRows,
    recommended: recommended ?? {
      desktop: desktopRows[0]?.key,
      ...(toolingRows.length > 0 ? { tooling: toolingRows[0].version } : {}),
    },
  };
}

function assertInvalid(value, message) {
  assert.throws(() => validateCatalog(value), message);
}

test('exports the stable site prefix and section names', () => {
  assert.equal(SITE_PREFIX, '/blue/');
  assert.deepEqual(SITE_SECTIONS, ['manual', 'cli', 'api/blue-data']);
});

test('validates the checked-in catalog and derives its manual route', async () => {
  const catalogPath = resolve(import.meta.dirname, '../docs/site/editions.json');
  const value = JSON.parse(await readFile(catalogPath, 'utf8'));

  assert.equal(validateCatalog(value), value);
  assert.deepEqual(
    publicationInventory(value).find(
      (entry) => entry.editionKey === 'v3.0.0-beta.6' && entry.section === 'manual',
    ),
    {
      section: 'manual',
      editionKey: 'v3.0.0-beta.6',
      fixedUrl: '/blue/manual/v3.0.0-beta.6/',
      sourceSha: '308bc5c8ae479a44a047a96531edb1d673253069',
    },
  );
});

test('accepts a released prerelease and a correctly labeled source-only preview', () => {
  const preview = {
    key: `preview-${SOURCE_B.slice(0, 12)}`,
    channel: 'preview',
    label: 'Blue 3 Preview from a source revision',
    sourceSha: SOURCE_B,
  };
  const value = catalog({
    desktop: [desktopEdition(), preview],
    recommended: { desktop: preview.key },
  });

  assert.equal(validateCatalog(value), value);
  assert.deepEqual(
    publicationInventory(value).map(({ fixedUrl }) => fixedUrl),
    ['/blue/manual/v3.0.0-beta.6/', `/blue/manual/${preview.key}/`],
  );
});

test('allows the first tooling edition to be pending without a tooling recommendation', () => {
  const value = catalog();

  assert.deepEqual(value.tooling, []);
  assert.equal('tooling' in value.recommended, false);
  assert.deepEqual(publicationInventory(validateCatalog(value)), [
    {
      section: 'manual',
      editionKey: 'v3.0.0-beta.6',
      fixedUrl: '/blue/manual/v3.0.0-beta.6/',
      sourceSha: SOURCE_A,
    },
  ]);
});

test('validates an npm edition and emits paired CLI and API routes', () => {
  const value = catalog({ tooling: [toolingEdition()] });

  assert.equal(validateCatalog(value), value);
  assert.deepEqual(publicationInventory(value).slice(1), [
    {
      section: 'cli',
      editionKey: '0.1.0-beta.1',
      fixedUrl: '/blue/cli/0.1.0-beta.1/',
      sourceSha: SOURCE_C,
    },
    {
      section: 'api/blue-data',
      editionKey: '0.1.0-beta.1',
      fixedUrl: '/blue/api/blue-data/0.1.0-beta.1/',
      sourceSha: SOURCE_C,
    },
  ]);
});

test('accepts the optional verified npm integrity record', () => {
  const value = catalog({
    tooling: [
      toolingEdition({
        integrity: {
          cli: 'sha512-YWJj',
          data: 'sha512-ZGVm',
          verification: 'https://github.com/kunstmusik/blue/issues/123',
        },
      }),
    ],
  });

  assert.equal(validateCatalog(value), value);
});

test('rejects malformed desktop and tooling fields', () => {
  const missingDesktopLabel = catalog();
  delete missingDesktopLabel.desktop[0].label;
  assertInvalid(missingDesktopLabel, /desktop.*label/i);

  assertInvalid(
    catalog({ desktop: [desktopEdition({ sourceSha: 'abc123' })] }),
    /desktop.*sourceSha/i,
  );
  assertInvalid(
    catalog({ desktop: [desktopEdition({ channel: 'development' })] }),
    /desktop.*channel/i,
  );
  assertInvalid(catalog({ desktop: [desktopEdition({ tag: 'v3.0.0-beta.5' })] }), /desktop.*tag/i);
  assertInvalid(catalog({ desktop: [desktopEdition({ key: '../manual' })] }), /desktop.*key/i);

  assertInvalid(catalog({ tooling: [toolingEdition({ version: '0.1' })] }), /tooling.*version/i);
  assertInvalid(
    catalog({ tooling: [toolingEdition({ sourceSha: 'short' })] }),
    /tooling.*sourceSha/i,
  );
  assertInvalid(
    catalog({ tooling: [toolingEdition({ tag: 'npm-v0.1.0-beta.2' })] }),
    /tooling.*tag/i,
  );
  assertInvalid(catalog({ tooling: [toolingEdition({ channel: 'stable' })] }), /tooling.*channel/i);
  assertInvalid(
    catalog({
      tooling: [
        toolingEdition({
          integrity: { cli: 'not-an-integrity', data: 'sha512-ZGVm', verification: 'not a URL' },
        }),
      ],
    }),
    /tooling.*integrity/i,
  );
});

test('rejects duplicate edition keys and fixed routes within a series', () => {
  assertInvalid(
    catalog({ desktop: [desktopEdition(), desktopEdition({ sourceSha: SOURCE_B })] }),
    /duplicate.*desktop.*key|desktop.*duplicate/i,
  );

  assertInvalid(
    catalog({ tooling: [toolingEdition(), toolingEdition({ sourceSha: SOURCE_B })] }),
    /duplicate.*tooling.*version|tooling.*duplicate/i,
  );
});

test('rejects dangling and cross-series recommendation pointers', () => {
  assertInvalid(catalog({ recommended: { desktop: 'v3.0.0' } }), /recommended\.desktop/i);

  assertInvalid(
    catalog({
      tooling: [toolingEdition()],
      recommended: { desktop: '0.1.0-beta.1', tooling: '0.1.0-beta.1' },
    }),
    /recommended\.desktop/i,
  );
  assertInvalid(
    catalog({
      tooling: [],
      recommended: { desktop: 'v3.0.0-beta.6', tooling: '0.1.0-beta.1' },
    }),
    /recommended\.tooling/i,
  );
  assertInvalid(
    catalog({
      tooling: [toolingEdition()],
      recommended: { desktop: 'v3.0.0-beta.6' },
    }),
    /recommended\.tooling/i,
  );
});

test('allows independent recommendation changes while keeping published routes', () => {
  const oldDesktop = desktopEdition();
  const newDesktop = desktopEdition({
    key: `preview-${SOURCE_B.slice(0, 12)}`,
    channel: 'preview',
    label: 'Blue 3 Preview',
    sourceSha: SOURCE_B,
    tag: undefined,
  });
  delete newDesktop.tag;
  const previous = catalog({
    desktop: [oldDesktop],
    tooling: [toolingEdition()],
  });
  const candidate = catalog({
    desktop: [oldDesktop, newDesktop],
    tooling: [
      toolingEdition(),
      toolingEdition({
        version: '0.1.0',
        channel: 'stable',
        tag: 'npm-v0.1.0',
        sourceSha: SOURCE_B,
      }),
    ],
    recommended: { desktop: newDesktop.key, tooling: '0.1.0' },
  });

  validateCatalog(candidate);
  assertRetainedCatalog(previous, candidate);
  assertRetained(publicationInventory(previous), publicationInventory(candidate));
});

test('rejects removed or rewritten published routes and source revisions', () => {
  const previous = publicationInventory(catalog({ tooling: [toolingEdition()] }));
  const candidate = publicationInventory(catalog());
  assert.throws(() => assertRetained(previous, candidate), /removed|missing|retained/i);

  const rewrittenSource = previous.map((entry) =>
    entry.section === 'manual' ? { ...entry, sourceSha: SOURCE_B } : entry,
  );
  assert.throws(
    () => assertRetained(previous, rewrittenSource),
    /sourceSha|source revision|changed/i,
  );

  const rewrittenRoute = previous.map((entry) =>
    entry.section === 'manual' ? { ...entry, fixedUrl: '/blue/manual/other/' } : entry,
  );
  assert.throws(() => assertRetained(previous, rewrittenRoute), /fixedUrl|route|changed/i);
});

test('rejects removal or any rewrite of a persisted edition row', () => {
  const previous = catalog({ tooling: [toolingEdition()] });
  const appended = catalog({
    desktop: [
      desktopEdition(),
      desktopEdition({
        key: 'v3.0.0',
        channel: 'stable',
        label: 'Blue 3.0.0',
        sourceSha: SOURCE_B,
        tag: 'v3.0.0',
      }),
    ],
    tooling: [
      toolingEdition(),
      toolingEdition({
        version: '0.1.0',
        channel: 'stable',
        sourceSha: SOURCE_B,
        tag: 'npm-v0.1.0',
      }),
    ],
    recommended: { desktop: 'v3.0.0', tooling: '0.1.0' },
  });

  assert.doesNotThrow(() => assertRetainedCatalog(previous, appended));

  const removed = catalog();
  assert.throws(() => assertRetainedCatalog(previous, removed), /removed|missing|append/i);

  for (const [field, replacement] of [
    ['label', 'Rewritten edition label'],
    ['channel', 'stable'],
    ['tag', 'v3.0.0'],
    ['sourceSha', SOURCE_B],
  ]) {
    const rewritten = catalog({ desktop: [desktopEdition({ [field]: replacement })] });
    assert.throws(() => assertRetainedCatalog(catalog(), rewritten), new RegExp(field, 'i'));
  }

  const changedIntegrity = catalog({
    tooling: [
      toolingEdition({
        integrity: {
          cli: 'sha512-YWJj',
          data: 'sha512-ZGVm',
          verification: 'https://github.com/kunstmusik/blue/issues/123',
        },
      }),
    ],
  });
  assert.throws(
    () => assertRetainedCatalog(catalog({ tooling: [toolingEdition()] }), changedIntegrity),
    /integrity|changed/i,
  );
});
