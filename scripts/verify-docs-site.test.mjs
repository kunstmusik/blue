import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publicationInventory } from './docs-site-catalog.mjs';
import { resolvePublicUrlToPath, verifyDocsSite } from './verify-docs-site.mjs';

const DESKTOP_SHA = 'a'.repeat(40);
const DESKTOP_SHA_2 = 'c'.repeat(40);
const TOOLING_SHA = 'b'.repeat(40);

function createCatalog({ includeSecondDesktop = false } = {}) {
  const desktop = [
    {
      key: 'v3.0.0-beta.6',
      channel: 'prerelease',
      label: 'Blue 3.0.0-beta.6 (prerelease)',
      sourceSha: DESKTOP_SHA,
      tag: 'v3.0.0-beta.6',
    },
  ];
  if (includeSecondDesktop) {
    desktop.push({
      key: 'preview-cccccccccccc',
      channel: 'preview',
      label: 'Blue 3 preview',
      sourceSha: DESKTOP_SHA_2,
    });
  }
  return {
    desktop,
    tooling: [
      {
        version: '1.2.3',
        channel: 'stable',
        sourceSha: TOOLING_SHA,
        tag: 'npm-v1.2.3',
      },
    ],
    recommended: { desktop: desktop[0].key, tooling: '1.2.3' },
  };
}

async function withTempDir(callback) {
  const root = await mkdtemp(path.join(tmpdir(), 'blue-docs-site-verify-'));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeFixture(root, catalog, options = {}) {
  const siteRoot = path.join(root, 'candidate site');
  const catalogPath = path.join(root, 'catalog.json');
  const inventory = publicationInventory(catalog);
  await writeJson(catalogPath, catalog);
  await mkdir(siteRoot, { recursive: true });

  const sectionRoutes = ['/blue/manual/', '/blue/cli/', '/blue/api/blue-data/'];
  const homeLinks = sectionRoutes.map((url) => `<a href="${url}">${url}</a>`).join('\n');
  await writeFile(
    path.join(siteRoot, 'index.html'),
    `<!doctype html><html><body>${homeLinks}</body></html>`,
    'utf8',
  );

  for (const section of ['manual', 'cli', 'api/blue-data']) {
    const sectionUrl = `/blue/${section}/`;
    const editions = inventory.filter((entry) => entry.section === section);
    const links = editions
      .map((entry) => `<a href="${entry.fixedUrl}">${entry.editionKey}</a>`)
      .join('\n');
    const sectionFile = path.join(siteRoot, section, 'index.html');
    await mkdir(path.dirname(sectionFile), { recursive: true });
    await writeFile(
      sectionFile,
      `<!doctype html><html><body><h1>${sectionUrl}</h1>${links}</body></html>`,
      'utf8',
    );
  }

  for (const entry of inventory) {
    const editionFile = resolvePublicUrlToPath(siteRoot, entry.fixedUrl);
    await mkdir(path.dirname(editionFile), { recursive: true });
    await writeFile(
      editionFile,
      `<!doctype html><html><head><meta name="blue-source-sha" content="${entry.sourceSha}"><link rel="stylesheet" href="/blue/site.css"></head><body><h1 id="edition">${entry.editionKey}</h1><p>Source revision: <code>${entry.sourceSha}</code></p><a href="#edition">Top</a><img src="/blue/assets/pixel.svg" alt="fixture"></body></html>`,
      'utf8',
    );
  }

  await mkdir(path.join(siteRoot, 'assets'), { recursive: true });
  await writeFile(
    path.join(siteRoot, 'assets', 'pixel.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
    'utf8',
  );
  await writeFile(
    path.join(siteRoot, 'site.css'),
    'body { background-image: url("/blue/assets/pixel.svg"); }\n',
    'utf8',
  );
  await writeJson(
    path.join(siteRoot, 'publication-inventory.json'),
    options.inventory ?? inventory,
  );
  await writeJson(
    path.join(siteRoot, 'publication-catalog.json'),
    options.snapshotCatalog ?? catalog,
  );

  return { root, siteRoot, catalogPath, inventory, catalog };
}

test('verifies stable sections and complete fixed editions under the Pages prefix', async () => {
  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog());
    const result = await verifyDocsSite({
      siteRoot: fixture.siteRoot,
      catalogPath: fixture.catalogPath,
    });

    assert.equal(result.editionCount, fixture.inventory.length);
    assert.ok(result.totalBytes > 0);
    assert.equal(result.sectionCount, 3);
  });
});

test('requires the candidate inventory and embedded catalog snapshot to match tracked sources', async () => {
  await withTempDir(async (root) => {
    const catalog = createCatalog();
    const fixture = await writeFixture(root, catalog, {
      snapshotCatalog: { ...catalog, recommended: { ...catalog.recommended, desktop: 'wrong' } },
    });

    await assert.rejects(
      verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
      /publication-catalog\.json.*catalog/i,
    );
  });

  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog(), { inventory: [] });

    await assert.rejects(
      verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
      /publication-inventory\.json.*catalog/i,
    );
  });
});

test('requires all three stable section pages and links to every fixed edition', async () => {
  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog());
    await rm(path.join(fixture.siteRoot, 'cli', 'index.html'));

    await assert.rejects(
      verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
      /stable section.*cli/i,
    );
  });

  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog());
    await writeFile(
      path.join(fixture.siteRoot, 'manual', 'index.html'),
      '<html><body>Manual</body></html>',
      'utf8',
    );

    await assert.rejects(
      verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
      /manual.*fixed edition/i,
    );
  });
});

test('requires the correct source SHA in metadata and visible edition text', async () => {
  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog());
    const manualEdition = fixture.inventory.find((entry) => entry.section === 'manual');
    const editionFile = resolvePublicUrlToPath(fixture.siteRoot, manualEdition.fixedUrl);
    await writeFile(
      editionFile,
      `<html><head><meta name="blue-source-sha" content="${manualEdition.sourceSha}"></head><body>Source revision: ${'f'.repeat(40)}</body></html>`,
      'utf8',
    );

    await assert.rejects(
      verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
      /source SHA.*visible/i,
    );
  });
});

test('crawls local page, asset, CSS, and anchor links', async (t) => {
  const mutations = [
    {
      name: 'missing page',
      href: '/blue/missing/page.html',
      error: /missing local page/i,
    },
    {
      name: 'missing asset',
      href: '/blue/assets/missing.svg',
      error: /missing local asset/i,
    },
    {
      name: 'missing anchor',
      href: '/blue/manual/v3.0.0-beta.6/#missing-anchor',
      error: /missing anchor/i,
    },
  ];

  for (const mutation of mutations) {
    await t.test(mutation.name, async () => {
      await withTempDir(async (root) => {
        const fixture = await writeFixture(root, createCatalog());
        const homePath = path.join(fixture.siteRoot, 'index.html');
        const html = await readFile(homePath, 'utf8');
        await writeFile(homePath, `${html}<a href="${mutation.href}">bad link</a>`, 'utf8');

        await assert.rejects(
          verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
          mutation.error,
        );
      });
    });
  }

  await t.test('missing CSS asset', async () => {
    await withTempDir(async (root) => {
      const fixture = await writeFixture(root, createCatalog());
      await writeFile(
        path.join(fixture.siteRoot, 'site.css'),
        'body { background: url("/blue/assets/nope.png"); }\n',
        'utf8',
      );

      await assert.rejects(
        verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
        /missing local asset/i,
      );
    });
  });
});

test('checks published size using an injected limit', async () => {
  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog());

    await assert.rejects(
      verifyDocsSite({
        siteRoot: fixture.siteRoot,
        catalogPath: fixture.catalogPath,
        maxBytes: 10,
      }),
      /published site size.*exceeds.*10 bytes/i,
    );
  });
});

test('retains prior routes and source rows when the catalog grows', async () => {
  await withTempDir(async (root) => {
    const baseline = createCatalog();
    const candidate = createCatalog({ includeSecondDesktop: true });
    const fixture = await writeFixture(root, candidate);
    const baselineInventoryPath = path.join(root, 'baseline-inventory.json');
    const baselineCatalogPath = path.join(root, 'baseline-catalog.json');
    await writeJson(baselineInventoryPath, publicationInventory(baseline));
    await writeJson(baselineCatalogPath, baseline);

    const result = await verifyDocsSite({
      siteRoot: fixture.siteRoot,
      catalogPath: fixture.catalogPath,
      baselineInventoryPath,
      baselineCatalogPath,
    });
    assert.equal(result.editionCount, publicationInventory(candidate).length);
  });
});

test('rejects a rewritten prior catalog row even if its fixed route is unchanged', async () => {
  await withTempDir(async (root) => {
    const baseline = createCatalog();
    const candidate = createCatalog();
    candidate.desktop[0].label = 'Rewritten published label';
    const fixture = await writeFixture(root, candidate);
    const baselineInventoryPath = path.join(root, 'baseline-inventory.json');
    const baselineCatalogPath = path.join(root, 'baseline-catalog.json');
    await writeJson(baselineInventoryPath, publicationInventory(baseline));
    await writeJson(baselineCatalogPath, baseline);

    await assert.rejects(
      verifyDocsSite({
        siteRoot: fixture.siteRoot,
        catalogPath: fixture.catalogPath,
        baselineInventoryPath,
        baselineCatalogPath,
      }),
      /Previously published.*label|append.only|immutable/i,
    );
  });
});

test('maps root-relative public URLs using native and synthetic Windows paths', () => {
  const nativeRoot = path.join(tmpdir(), 'blue-docs');
  assert.equal(
    resolvePublicUrlToPath(nativeRoot, '/blue/manual/v3.0.0-beta.6/'),
    path.join(nativeRoot, 'manual', 'v3.0.0-beta.6', 'index.html'),
  );

  const windowsPath = path.win32;
  assert.equal(
    resolvePublicUrlToPath('C:\\runner\\docs-site', '/blue/api/blue-data/1.2.3/', windowsPath),
    'C:\\runner\\docs-site\\api\\blue-data\\1.2.3\\index.html',
  );
});

test('does not allow local links to escape the public `/blue/` prefix', async () => {
  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog());
    const homePath = path.join(fixture.siteRoot, 'index.html');
    const html = await readFile(homePath, 'utf8');
    await writeFile(homePath, `${html}<a href="/outside.html">outside</a>`, 'utf8');

    await assert.rejects(
      verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath }),
      /outside the public \/blue\/ prefix/i,
    );
  });
});

test('rejects baseline files from different deployments', async () => {
  await withTempDir(async (root) => {
    const baseline = createCatalog();
    const candidate = createCatalog({ includeSecondDesktop: true });
    const fixture = await writeFixture(root, candidate);
    const baselineInventoryPath = path.join(root, 'baseline-inventory.json');
    const baselineCatalogPath = path.join(root, 'baseline-catalog.json');
    await writeJson(baselineInventoryPath, publicationInventory(baseline));
    await writeJson(baselineCatalogPath, candidate);

    await assert.rejects(
      verifyDocsSite({
        siteRoot: fixture.siteRoot,
        catalogPath: fixture.catalogPath,
        baselineInventoryPath,
        baselineCatalogPath,
      }),
      /baseline publication inventory does not match the baseline catalog/i,
    );
  });
});

test('retains both series across successive desktop-only and tooling-only updates', async () => {
  await withTempDir(async (root) => {
    const baselineCatalogPath = path.join(root, 'previous-catalog.json');
    const baselineInventoryPath = path.join(root, 'previous-inventory.json');
    const initial = createCatalog();
    const desktopUpdate = createCatalog({ includeSecondDesktop: true });
    desktopUpdate.recommended.desktop = desktopUpdate.desktop[1].key;
    const toolingUpdate = structuredClone(desktopUpdate);
    toolingUpdate.tooling.push({
      version: '1.2.4',
      channel: 'stable',
      sourceSha: 'd'.repeat(40),
      tag: 'npm-v1.2.4',
    });
    toolingUpdate.recommended.tooling = '1.2.4';
    let previous = initial;
    for (const catalog of [desktopUpdate, toolingUpdate]) {
      const fixture = await writeFixture(root, catalog);
      await writeJson(baselineCatalogPath, previous);
      await writeJson(baselineInventoryPath, publicationInventory(previous));
      const result = await verifyDocsSite({
        siteRoot: fixture.siteRoot,
        catalogPath: fixture.catalogPath,
        baselineCatalogPath,
        baselineInventoryPath,
      });
      assert.equal(result.editionCount, publicationInventory(catalog).length);
      previous = catalog;
    }
  });
});

test('verifies extensionless notice files and directory redirects by their actual target', async () => {
  await withTempDir(async (root) => {
    const fixture = await writeFixture(root, createCatalog());
    const edition = fixture.inventory.find((entry) => entry.section === 'api/blue-data');
    const page = resolvePublicUrlToPath(fixture.siteRoot, edition.fixedUrl);
    await writeFile(path.join(path.dirname(page), 'LICENSE'), 'Package license');
    await writeFile(
      page,
      `<meta name="blue-source-sha" content="${edition.sourceSha}">
<p>${edition.sourceSha}</p>
<a href="LICENSE">Package license</a>
<a href="/blue/cli/1.2.3">Fixed CLI guide</a>`,
    );
    await verifyDocsSite({ siteRoot: fixture.siteRoot, catalogPath: fixture.catalogPath });
  });
});
