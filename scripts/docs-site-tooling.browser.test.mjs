import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  chromium,
  DOCS_SITE_ROOT,
  SITE_PREFIX,
  startSiteServer,
} from './docs-site-browser-helpers.mjs';

test(
  'tooling selectors and versioned documentation work under the Pages prefix',
  { timeout: 60_000 },
  async (t) => {
    const catalog = JSON.parse(
      await readFile(join(DOCS_SITE_ROOT, 'publication-catalog.json'), 'utf8'),
    );
    const site = await startSiteServer();
    t.after(() => site.close());
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const page = await browser.newPage();
    const failures = [];
    page.on('response', (response) => {
      if (response.url().startsWith(site.baseUrl) && response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });

    const version = catalog.recommended.tooling;
    if (!version) {
      for (const section of ['cli', 'api/blue-data']) {
        await page.goto(`${site.baseUrl}${SITE_PREFIX}${section}/`);
        const message = page.locator('main .availability');
        assert.match(await message.innerText(), /pending a public release/i);
        assert.equal(await page.locator('main .recommendation a').count(), 0);
      }
      assert.deepEqual(failures, []);
      return;
    }

    const cli = `${SITE_PREFIX}cli/${version}/`;
    await page.goto(`${site.baseUrl}${SITE_PREFIX}cli/`);
    await page.locator(`.recommendation a[href="${cli}"]`).click();
    await page.waitForURL(`**${cli}`);
    assert.match(await page.title(), /Blue CLI guide/);
    assert.ok((await page.locator('main p').first().innerText()).includes(version));
    const compile = await page
      .getByText(
        `npx --yes @kunstmusik/blue-cli@${version} compile -p example.blue -o example.csd`,
        { exact: true },
      )
      .count();
    assert.equal(compile, 1);

    const api = `${SITE_PREFIX}api/blue-data/${version}/`;
    const edition = catalog.tooling.find((row) => row.version === version);
    await page.goto(`${site.baseUrl}${SITE_PREFIX}api/blue-data/`);
    await page.locator(`.recommendation a[href="${api}"]`).click();
    await page.waitForURL(`**${api}`);
    assert.ok((await page.title()).includes(version));
    assert.equal(
      await page.locator('meta[name="blue-source-sha"]').getAttribute('content'),
      edition.sourceSha,
    );
    await page
      .getByRole('link', { name: /Node(?:\.js)? quickstart/i })
      .first()
      .click();
    await page.waitForURL(`**${api}quickstart.html`);
    assert.match(await page.locator('main').innerText(), /toDiskCSD/);
    assert.ok(
      (await page.locator('main').innerText()).includes(`@kunstmusik/blue-data@${version}`),
    );

    await page.goto(`${site.baseUrl}${api}`);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('combobox').fill('BlueData');
    await page.locator('#tsd-search-results a[href*="BlueData.html"]').first().click();
    assert.ok(new URL(page.url()).pathname.startsWith(api));
    await page.getByRole('heading', { level: 1, name: /BlueData/ }).waitFor();
    assert.ok(await page.locator(`a[href*="/blob/${edition.sourceSha}/"]`).count());
    assert.deepEqual(failures, []);
  },
);
