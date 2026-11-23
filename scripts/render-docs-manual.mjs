import { execFile } from 'node:child_process';
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decorateEditionHtml, escapeHtml } from './docs-site-html.mjs';
import { PUBLIC_REPOSITORY, assertPublishedTag } from './docs-site-release-source.mjs';
import { publicationInventory, SITE_PREFIX, validateCatalog } from './docs-site-catalog.mjs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const PRODUCT_SITE = 'https://blue.kunstmusik.com/';
const GITHUB_API = 'https://api.github.com';
const QUARTO_VERSION = '1.10.18';

/**
 * Render a pinned Blue 3 manual edition from its disposable source checkout.
 *
 * @param {{
 *   edition: { key: string, channel: string, label: string, sourceSha: string, tag?: string },
 *   checkout: string,
 *   repositoryRoot: string,
 *   output: string,
 *   local?: boolean,
 *   fetchImpl?: typeof fetch,
 * }} options
 * @returns {Promise<{ output: string, pageCount: number, sourceSha: string }>}
 */
export async function renderDocsManual({
  edition,
  checkout,
  repositoryRoot,
  output,
  local = false,
  fetchImpl = fetch,
}) {
  if (!edition || !checkout || !repositoryRoot || !output) {
    throw new Error('edition, checkout, repositoryRoot, and output are required');
  }
  validateCatalog({ desktop: [edition], tooling: [], recommended: { desktop: edition.key } });

  const sourceSha = edition.sourceSha.toLowerCase();
  await assertCheckoutCommit(checkout, sourceSha);
  if (edition.channel === 'preview') {
    await assertTrustedPreview(repositoryRoot, sourceSha);
  } else {
    await assertPublishedTag({ tag: edition.tag, sourceSha }, checkout);
    await assertPublishedRelease(edition, fetchImpl);
  }

  const manualRoot = path.join(checkout, 'docs', 'manual');
  const outputRoot = path.resolve(output);
  const { stdout } = await exec('quarto', ['--version']);
  const quartoVersion = stdout.trim();
  const reviewed = quartoVersion === QUARTO_VERSION;
  if (!reviewed && !local) {
    throw new Error(
      `Use Quarto ${QUARTO_VERSION} for the reviewed hosted manual assets (found ${quartoVersion})`,
    );
  }
  if (!reviewed) {
    console.warn(
      `Quarto ${quartoVersion} output is for local preview. Pages uses Quarto ${QUARTO_VERSION}.`,
    );
  }
  await exec('quarto', ['render', manualRoot, '--to', 'html', '--output-dir', outputRoot], {
    cwd: checkout,
    maxBuffer: 16 * 1024 * 1024,
  });

  await assertManualFiles(manualRoot, outputRoot);
  const notices = path.join(outputRoot, 'QUARTO-NOTICES.md');
  if (reviewed) {
    await copyFile(
      path.join(repositoryRoot, 'docs', 'site', `quarto-${QUARTO_VERSION}-NOTICES.md`),
      notices,
    );
  } else {
    await writeFile(
      notices,
      `# Quarto asset notices\n\nThis build is for local preview. It uses Quarto ${quartoVersion}. The reviewed GitHub Pages asset notices apply to builds made with Quarto ${QUARTO_VERSION}.\n`,
    );
  }
  const inventory = publicationInventory({
    desktop: [edition],
    tooling: [],
    recommended: { desktop: edition.key },
  });
  const pageCount = await addEditionInformation(outputRoot, edition, inventory[0].fixedUrl);
  return { output: outputRoot, pageCount, sourceSha };
}

async function assertCheckoutCommit(checkout, sourceSha) {
  const { stdout } = await exec('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
    cwd: checkout,
  });
  if (stdout.trim().toLowerCase() !== sourceSha) {
    throw new Error(
      `Manual checkout HEAD ${stdout.trim()} does not match catalog source SHA ${sourceSha}`,
    );
  }
}

async function assertTrustedPreview(repositoryRoot, sourceSha) {
  try {
    await exec('git', ['merge-base', '--is-ancestor', sourceSha, 'refs/remotes/origin/develop'], {
      cwd: repositoryRoot,
    });
  } catch (error) {
    if (error.code === 1) {
      throw new Error(
        `Manual preview ${sourceSha} is not an ancestor of refs/remotes/origin/develop in ${repositoryRoot}`,
      );
    }
    throw new Error(
      `Could not verify manual preview ${sourceSha} against refs/remotes/origin/develop: ${error.message}`,
    );
  }
}

async function assertPublishedRelease(edition, fetchImpl) {
  const url = `${GITHUB_API}/repos/kunstmusik/blue/releases/tags/${encodeURIComponent(edition.tag)}`;
  const token = process.env.BLUE_DOCS_RELEASE_TOKEN;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'blue-docs-site-builder',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Could not verify GitHub release ${edition.tag}: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub release lookup for ${edition.tag} returned HTTP ${response.status}`);
  }

  const release = await response.json();
  if (release.tag_name !== edition.tag) {
    throw new Error(`GitHub release returned tag ${release.tag_name}, expected ${edition.tag}`);
  }
  if (release.draft !== false) {
    throw new Error(`GitHub release ${edition.tag} is not published`);
  }
  const expectedPrerelease = edition.channel === 'prerelease';
  if (release.prerelease !== expectedPrerelease) {
    const expected = expectedPrerelease ? 'a prerelease' : 'a stable release';
    throw new Error(
      `GitHub release ${edition.tag} does not match catalog channel; expected ${expected}`,
    );
  }
}

async function assertManualFiles(manualRoot, outputRoot) {
  const sourceEntries = await readdir(manualRoot, { withFileTypes: true });
  const outputFiles = new Set(await listRelativeFiles(outputRoot));
  const sourceChapters = sourceEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.qmd'))
    .map((entry) =>
      entry.name === 'index.qmd' ? 'index.html' : `${entry.name.slice(0, -4)}.html`,
    );

  for (const page of sourceChapters) {
    if (!outputFiles.has(page)) throw new Error(`Quarto did not emit manual chapter ${page}`);
  }
  if (!outputFiles.has('COPYING.GFDL')) {
    throw new Error('Quarto output is missing the manual license COPYING.GFDL');
  }

  const imageEntries = await readdir(path.join(manualRoot, 'images'), { withFileTypes: true });
  for (const entry of imageEntries) {
    if (!entry.isFile() || entry.name.toLowerCase() === 'readme.md') continue;
    const relative = path.posix.join('images', entry.name);
    if (!outputFiles.has(relative))
      throw new Error(`Quarto output is missing manual asset ${relative}`);
  }
}

async function listRelativeFiles(root) {
  const files = [];
  async function visit(directory, relativeDirectory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
  await visit(root, '');
  return files;
}

async function addEditionInformation(outputRoot, edition, fixedUrl) {
  const htmlFiles = (await listRelativeFiles(outputRoot)).filter((file) =>
    file.toLowerCase().endsWith('.html'),
  );
  const escapedLabel = escapeHtml(edition.label);
  const escapedSha = escapeHtml(edition.sourceSha);
  const editionSource = `${PUBLIC_REPOSITORY}/tree/${edition.sourceSha}/docs/manual`;
  const screenshotCredits = `${PUBLIC_REPOSITORY}/blob/${edition.sourceSha}/docs/manual/images/README.md`;
  const aboutUrl = `${fixedUrl}about.html`;
  const licenseUrl = `${fixedUrl}COPYING.GFDL`;
  const banner = `<aside class="blue-edition-note" aria-label="Manual edition">
  <strong>Blue 3 Manual</strong>
  <span class="blue-edition-label">${escapedLabel}</span>
  <span>Source revision <code>${escapedSha}</code></span>
  <nav aria-label="Edition information">
    <a href="${SITE_PREFIX}manual/">All manual editions</a>
    <a href="${editionSource}">Quarto source</a>
    <a href="${PRODUCT_SITE}">Blue product site</a>
    <a href="${aboutUrl}">About and contributor credits</a>
    <a href="${screenshotCredits}">Screenshot credits</a>
    <a href="${licenseUrl}">GNU Free Documentation License 1.3</a>
    <a href="${fixedUrl}QUARTO-NOTICES.md">Quarto and theme licenses</a>
  </nav>
</aside>`;

  for (const relativeFile of htmlFiles) {
    const filePath = path.join(outputRoot, ...relativeFile.split('/'));
    const html = await readFile(filePath, 'utf8');
    const updated = decorateEditionHtml(html, {
      filename: relativeFile,
      sourceSha: edition.sourceSha,
      label: edition.label,
      banner,
      stylesheet: `${SITE_PREFIX}style.css`,
    });
    await writeFile(filePath, updated, 'utf8');
  }
  return htmlFiles.length;
}
