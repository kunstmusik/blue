import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { publicationInventory, SITE_PREFIX, validateCatalog } from './docs-site-catalog.mjs';
import { escapeHtml } from './docs-site-html.mjs';
import { PUBLIC_REPOSITORY } from './docs-site-release-source.mjs';
import { admitToolingEdition } from './docs-site-tooling.mjs';
import { renderDocsApi } from './render-docs-api.mjs';
import { renderDocsCli } from './render-docs-cli.mjs';
import { renderDocsManual } from './render-docs-manual.mjs';
import { toolingEditionLabel } from './render-docs-tooling-page.mjs';
import { verifyDocsSite } from './verify-docs-site.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));

const sections = [
  ['manual', 'Blue 3 manual', 'Learn to compose, edit, and render projects in Blue 3.'],
  ['cli', 'Blue CLI guide', 'Compile Blue projects to Csound documents from a terminal.'],
  ['api/blue-data', 'Blue Data API reference', 'Load and generate Blue projects in Node.js.'],
];

function fillTemplate(template, values) {
  return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Unknown site template token ${name}`);
    return values[name];
  });
}

async function buildLandingPages(source, siteRoot, catalog) {
  const [home, template, skill] = await Promise.all(
    ['index.html', 'section.html', 'blue-projects.html'].map((file) =>
      readFile(join(source, file), 'utf8'),
    ),
  );
  await writeFile(join(siteRoot, 'index.html'), fillTemplate(home, { prefix: SITE_PREFIX }));
  await copyFile(join(source, 'style.css'), join(siteRoot, 'style.css'));
  const skillRoot = join(siteRoot, 'blue-projects');
  await mkdir(skillRoot);
  await writeFile(join(skillRoot, 'index.html'), fillTemplate(skill, { prefix: SITE_PREFIX }));

  for (const [section, title, description] of sections) {
    const manual = section === 'manual';
    const editions = manual ? catalog.desktop : catalog.tooling;
    const recommended = catalog.recommended[manual ? 'desktop' : 'tooling'];
    const fixedLink = (edition) => {
      const key = manual ? edition.key : edition.version;
      const label = manual ? edition.label : toolingEditionLabel(edition);
      return `<a href="${SITE_PREFIX}${section}/${key}/">${escapeHtml(label)}</a>`;
    };
    const body = recommended
      ? `<p class="recommendation">Recommended edition: ${fixedLink(
          editions.find((edition) => (manual ? edition.key : edition.version) === recommended),
        )}</p>
        <h2>All editions</h2>
        <ul class="edition-list">${editions.map((edition) => `<li>${fixedLink(edition)}</li>`).join('')}</ul>`
      : '<p class="availability">The first versioned edition is pending a public release.</p>';
    const navigation = sections
      .map(
        ([route, label]) =>
          `<li><a href="${SITE_PREFIX}${route}/"${route === section ? ' aria-current="page"' : ''}>${label}</a></li>`,
      )
      .join('');
    const sectionRoot = join(siteRoot, ...section.split('/'));
    await mkdir(sectionRoot, { recursive: true });
    await writeFile(
      join(sectionRoot, 'index.html'),
      fillTemplate(template, { prefix: SITE_PREFIX, title, description, navigation, body }),
    );
  }
}

async function buildMcpGuide(repositoryRoot, source, siteRoot) {
  const { stdout: body } = await exec('quarto', [
    'pandoc',
    '--from=markdown-raw_html',
    '--to=html5',
    '--syntax-highlighting=none',
    join(repositoryRoot, 'docs', 'manual', 'mcp.qmd'),
  ]);
  const template = await readFile(join(source, 'section.html'), 'utf8');
  const guideRoot = join(siteRoot, 'mcp');
  await mkdir(guideRoot);
  await copyFile(
    join(repositoryRoot, 'docs', 'manual', 'COPYING.GFDL'),
    join(guideRoot, 'COPYING.GFDL'),
  );
  await writeFile(
    join(guideRoot, 'index.html'),
    fillTemplate(template, {
      prefix: SITE_PREFIX,
      title: 'Blue MCP',
      description: 'Connect a local client to the Blue desktop app.',
      navigation: `<li><a href="${SITE_PREFIX}manual/">Blue 3 manual</a></li>
      <li><a href="${SITE_PREFIX}mcp/" aria-current="page">Blue MCP</a></li>`,
      body: body + '<p><a href="./COPYING.GFDL">Manual license</a></p>',
    }),
  );
}

async function checkoutEdition(repositoryRoot, checkout, sha) {
  await exec('git', [
    'clone',
    '--quiet',
    '--shared',
    '--no-checkout',
    '--',
    repositoryRoot,
    checkout,
  ]);
  await exec('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', '--detach', sha], {
    cwd: checkout,
  });
  // Generated source links refer to the public source, even in a throwaway checkout.
  await exec('git', ['remote', 'set-url', 'origin', `${PUBLIC_REPOSITORY}.git`], { cwd: checkout });
}

export async function assembleDocsSite({
  repositoryRoot = root,
  output = join(repositoryRoot, 'build', 'docs-site'),
  local = false,
  renderDesktop = renderDocsManual,
  renderTooling = renderDocsTooling,
} = {}) {
  const source = join(repositoryRoot, 'docs', 'site');
  const catalogPath = join(source, 'editions.json');
  const catalog = validateCatalog(JSON.parse(await readFile(catalogPath, 'utf8')));
  const inventory = publicationInventory(catalog);
  await mkdir(dirname(output), { recursive: true });
  const lock = `${output}.lock`;
  await mkdir(lock);
  let stage;
  let retainStage = false;
  try {
    stage = await mkdtemp(join(dirname(output), '.docs-site-'));
    const siteRoot = join(stage, 'candidate');
    const checkout = join(stage, 'source');
    await mkdir(siteRoot);
    await buildLandingPages(source, siteRoot, catalog);
    await buildMcpGuide(repositoryRoot, source, siteRoot);
    for (const edition of [...catalog.desktop, ...catalog.tooling]) {
      await checkoutEdition(repositoryRoot, checkout, edition.sourceSha);
      if ('key' in edition) {
        await renderDesktop({
          edition,
          checkout,
          repositoryRoot,
          local,
          output: join(siteRoot, 'manual', edition.key),
        });
      } else {
        await renderTooling({
          edition,
          checkout,
          repositoryRoot,
          cliOutput: join(siteRoot, 'cli', edition.version),
          apiOutput: join(siteRoot, 'api', 'blue-data', edition.version),
        });
      }
      await rm(checkout, { recursive: true });
    }
    await writeFile(
      join(siteRoot, 'publication-catalog.json'),
      `${JSON.stringify(catalog, null, 2)}\n`,
    );
    await writeFile(
      join(siteRoot, 'publication-inventory.json'),
      `${JSON.stringify(inventory, null, 2)}\n`,
    );
    await verifyDocsSite({ siteRoot, catalogPath });
    const backup = join(stage, 'previous');
    let movedPrevious = false;
    try {
      await rename(output, backup);
      movedPrevious = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await rename(siteRoot, output);
    } catch (error) {
      if (movedPrevious) {
        try {
          await rename(backup, output);
        } catch (restoreError) {
          retainStage = true;
          throw new AggregateError(
            [error, restoreError],
            `Could not replace or restore the output. The previous site is at ${backup}`,
          );
        }
      }
      throw error;
    }
    return inventory;
  } finally {
    try {
      if (stage && !retainStage) await rm(stage, { recursive: true, force: true });
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}

async function renderDocsTooling({ edition, checkout, repositoryRoot, cliOutput, apiOutput }) {
  await admitToolingEdition({ edition, checkout, repositoryRoot });
  await renderDocsCli({ edition, checkout, output: cliOutput });
  await renderDocsApi({ edition, checkout, output: apiOutput });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { local: { type: 'boolean', default: false } } });
    const inventory = await assembleDocsSite({ local: values.local });
    console.log(`Built ${inventory.length} documentation editions in build/docs-site/.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
