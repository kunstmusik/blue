import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  chromium,
  DOCS_SITE_ROOT,
  SITE_PREFIX,
  startSiteServer,
} from './docs-site-browser-helpers.mjs';

test(
  'manual edition navigation works under the GitHub Pages prefix',
  { timeout: 60_000 },
  async (t) => {
    await access(DOCS_SITE_ROOT);
    const [catalog, inventory] = await Promise.all([
      readFile(join(DOCS_SITE_ROOT, 'publication-catalog.json'), 'utf8').then(JSON.parse),
      readFile(join(DOCS_SITE_ROOT, 'publication-inventory.json'), 'utf8').then(JSON.parse),
    ]);
    const edition = catalog.desktop.find(
      (candidate) => candidate.key === catalog.recommended.desktop,
    );
    assert.ok(
      edition,
      'the recommended desktop edition must be present in the publication catalog',
    );
    assert.equal(
      edition.channel,
      'prerelease',
      'the current manual smoke covers the beta prerelease',
    );
    const editionInventory = inventory.find(
      (entry) => entry.section === 'manual' && entry.editionKey === edition.key,
    );
    assert.ok(editionInventory, 'the recommended manual must have a fixed publication route');

    const site = await startSiteServer(DOCS_SITE_ROOT);
    let browser;
    t.after(async () => {
      await browser?.close();
      await site.close();
    });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const failedResponses = [];
    const pageErrors = [];
    page.on('response', (response) => {
      const responseUrl = new URL(response.url());
      if (
        responseUrl.origin === new URL(site.baseUrl).origin &&
        responseUrl.pathname.startsWith(SITE_PREFIX) &&
        response.status() >= 400
      ) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`${site.baseUrl}${SITE_PREFIX}`, { waitUntil: 'networkidle' });
    assert.equal(await page.title(), 'Blue Documentation');
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
    assert.equal(await page.locator('main').count(), 1);
    assert.ok(
      await page.locator('a[href="https://blue.kunstmusik.com/"]').count(),
      'the docs home must link back to the product site',
    );

    for (const section of ['manual', 'cli', 'api/blue-data']) {
      assert.ok(
        (await page.locator(`a[href="${SITE_PREFIX}${section}/"]`).count()) > 0,
        `the docs home must link to ${section}`,
      );
    }
    await page.getByRole('link', { name: 'Blue MCP', exact: true }).click();
    await page.waitForURL(`**${SITE_PREFIX}mcp/`);
    await page.getByRole('heading', { level: 1, name: 'Blue MCP' }).waitFor();
    await page.getByRole('heading', { level: 2, name: 'Connect a client' }).waitFor();
    assert.equal(
      await page.getByRole('link', { name: 'Blue MCP', exact: true }).getAttribute('aria-current'),
      'page',
    );
    await page.locator(`a[href="${SITE_PREFIX}manual/"]`).first().click();
    await page.getByRole('heading', { level: 1, name: 'Blue 3 manual' }).waitFor();
    const recommendedLink = page.locator(`.recommendation a[href="${editionInventory.fixedUrl}"]`);
    assert.equal(await recommendedLink.innerText(), edition.label);
    if (edition.channel === 'prerelease')
      assert.match(await recommendedLink.innerText(), /prerelease/i);
    if (edition.channel === 'preview') assert.match(await recommendedLink.innerText(), /preview/i);
    await recommendedLink.click();

    await page.waitForURL(`**${editionInventory.fixedUrl}`);
    assert.equal(
      await page.locator('meta[name="blue-source-sha"]').getAttribute('content'),
      edition.sourceSha,
    );
    assert.ok((await page.locator('.blue-edition-note').innerText()).includes(edition.label));
    assert.ok(await page.getByText(edition.sourceSha, { exact: true }).count());

    await page.getByRole('link', { name: 'Score', exact: true }).first().click();
    await page.waitForURL(`**${editionInventory.fixedUrl}score.html`);
    await page.getByRole('heading', { level: 1, name: 'Score timeline' }).waitFor();
    const chapterImage = page.locator('img[src$="images/score-timeline.png"]');
    await chapterImage.waitFor({ state: 'visible' });
    assert.ok(
      await chapterImage.evaluate((image) => image.complete && image.naturalWidth > 0),
      'the score chapter image must load from the pinned manual edition',
    );

    await page.getByRole('link', { name: 'About and contributor credits', exact: true }).click();
    await page.waitForURL(`**${editionInventory.fixedUrl}about.html`);
    await page.getByRole('heading', { level: 1, name: 'About this manual' }).waitFor();
    assert.ok(await page.getByText('Michael Bechard', { exact: false }).count());
    assert.ok(await page.getByText('Andrés Cabrera', { exact: false }).count());
    const licenseLink = page.getByRole('link', { name: 'COPYING.GFDL', exact: true }).first();
    const licenseUrl = new URL(await licenseLink.getAttribute('href'), page.url());
    const licenseResponse = await page.request.get(licenseUrl.href);
    assert.equal(licenseResponse.status(), 200);
    assert.match(await licenseResponse.text(), /GNU Free Documentation License/i);
    const themeNotices = page.getByRole('link', { name: 'Quarto and theme licenses' });
    const themeNoticesUrl = new URL(await themeNotices.getAttribute('href'), page.url());
    const themeResponse = await page.request.get(themeNoticesUrl.href);
    assert.equal(themeResponse.status(), 200);
    assert.match(await themeResponse.text(), /Bootstrap|This build is for local preview/);
    const screenshot = page.getByRole('link', { name: 'Screenshot credits', exact: true });
    assert.ok((await screenshot.getAttribute('href')).includes(`/blob/${edition.sourceSha}/`));

    await page.goto(`${site.baseUrl}${SITE_PREFIX}`, { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, 'the docs home must fit a narrow viewport');
    assert.deepEqual(failedResponses, []);
    assert.deepEqual(pageErrors, []);
  },
);
