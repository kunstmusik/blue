import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { decorateEditionHtml, escapeHtml } from './docs-site-html.mjs';
import { SITE_PREFIX } from './docs-site-catalog.mjs';
import {
  renderToolingPage,
  copyPackageNotices,
  toolingEditionLabel,
} from './render-docs-tooling-page.mjs';
import { PUBLIC_REPOSITORY } from './docs-site-release-source.mjs';
import { STRICT_SEMVER_NO_BUILD } from './verify-npm-packages.mjs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const EXPECTED_DATA_LICENSE = 'MIT AND Apache-2.0';

/**
 * Render the pinned Blue Data API and its Node quickstart.
 *
 * @param {{
 *   edition: { version: string, channel: string, sourceSha: string, tag: string },
 *   checkout: string,
 *   output: string,
 * }} options
 * @returns {Promise<{ output: string, typedocVersion: string, lunrVersion: string, sourceSha: string }>}
 */
export async function renderDocsApi({ edition, checkout, output }) {
  if (!edition || !checkout || !output)
    throw new Error('edition, checkout, and output are required');
  if (!STRICT_SEMVER_NO_BUILD.test(edition.version)) {
    throw new Error(`Invalid tooling edition version: ${edition.version}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(edition.sourceSha)) {
    throw new Error('A full 40-character source SHA is required for the API edition');
  }

  const sourceSha = edition.sourceSha.toLowerCase();
  checkout = await realpath(checkout);
  await assertCheckoutCommit(checkout, sourceSha);
  const packageRoot = path.join(checkout, 'packages', 'blue-data');
  const packageJson = await readJson(
    path.join(packageRoot, 'package.json'),
    'Blue Data package metadata',
  );
  if (packageJson.name !== '@blue/data' || packageJson.version !== edition.version) {
    throw new Error(
      `Pinned @blue/data package ${packageJson.name}@${packageJson.version} does not match edition ${edition.version}`,
    );
  }
  if (packageJson.license !== EXPECTED_DATA_LICENSE) {
    throw new Error(`Unexpected @blue/data license expression: ${packageJson.license}`);
  }

  const typedocConfigPath = path.join(packageRoot, 'typedoc.json');
  const typedocConfig = await readJson(typedocConfigPath, 'TypeDoc configuration');
  assertStrictTypeDocConfig(typedocConfig);
  const packageRequire = createRequire(path.join(packageRoot, 'package.json'));
  let typedocPackages = await tryResolveTypeDocPackages(checkout, packageRequire);
  if (!typedocPackages) {
    if (typeof packageJson.devDependencies?.typedoc !== 'string') {
      throw new Error(
        'Pinned @blue/data package does not declare TypeDoc as a development dependency',
      );
    }
    await exec(
      'pnpm',
      ['install', '--frozen-lockfile', '--ignore-scripts', '--filter', '@blue/data'],
      {
        cwd: checkout,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    typedocPackages = await tryResolveTypeDocPackages(checkout, packageRequire);
  }
  if (!typedocPackages)
    throw new Error('Could not resolve TypeDoc from the pinned checkout installation');

  const expectedTypeDocVersion = packageJson.devDependencies?.typedoc;
  if (typedocPackages.typedoc.version !== expectedTypeDocVersion) {
    throw new Error(
      `Installed TypeDoc ${typedocPackages.typedoc.version} does not match pinned package dependency ${expectedTypeDocVersion}`,
    );
  }
  if (typedocPackages.typedoc.license !== 'Apache-2.0') {
    throw new Error(`Unexpected TypeDoc license: ${typedocPackages.typedoc.license}`);
  }
  if (typedocPackages.lunr.license !== 'MIT') {
    throw new Error(`Unexpected Lunr license: ${typedocPackages.lunr.license}`);
  }

  const outputRoot = path.resolve(output);
  const sourceLinkTemplate = `${PUBLIC_REPOSITORY}/blob/{gitRevision}/{path}#L{line}`;
  await exec(
    'pnpm',
    [
      'exec',
      'typedoc',
      '--options',
      typedocConfigPath,
      '--out',
      outputRoot,
      '--customCss',
      fileURLToPath(new URL('../docs/site/style.css', import.meta.url)),
      '--disableGit',
      '--displayBasePath',
      checkout,
      '--sourceLinkTemplate',
      sourceLinkTemplate,
      '--gitRevision',
      sourceSha,
    ],
    { cwd: packageRoot, maxBuffer: 32 * 1024 * 1024 },
  );

  const readme = await readFile(path.join(packageRoot, 'README.md'), 'utf8');
  const readmeUrl = `${PUBLIC_REPOSITORY}/blob/${sourceSha}/packages/blue-data/README.md`;
  const runtimeUrl = `${readmeUrl}#csd-generation--runtime-requirements`;
  const cliGuideUrl = `${SITE_PREFIX}cli/${edition.version}/`;
  const quickstart = createQuickstart(readme, edition, sourceSha, runtimeUrl, cliGuideUrl);

  await copyPackageNotices(packageRoot, outputRoot);
  await copyDataAttribution(packageRoot, outputRoot);
  await copyRendererLicenses(outputRoot, typedocPackages);
  await renderToolingPage({
    edition,
    packageDir: 'blue-data',
    section: 'api/blue-data',
    title: 'Blue Data Node Quickstart',
    markdown: quickstart,
    output: path.join(outputRoot, 'quickstart.html'),
  });
  await addApiEditionInformation(outputRoot, edition, sourceSha, typedocPackages);
  await assertPinnedSourceLinks(outputRoot, sourceSha);

  return {
    output: outputRoot,
    typedocVersion: typedocPackages.typedoc.version,
    lunrVersion: typedocPackages.lunr.version,
    sourceSha,
  };
}

async function assertCheckoutCommit(checkout, sourceSha) {
  const { stdout } = await exec('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
    cwd: checkout,
  });
  if (stdout.trim().toLowerCase() !== sourceSha) {
    throw new Error(
      `API checkout HEAD ${stdout.trim()} does not match catalog source SHA ${sourceSha}`,
    );
  }
}

function assertStrictTypeDocConfig(config) {
  if (config.treatWarningsAsErrors !== true) {
    throw new Error('Pinned TypeDoc configuration must set treatWarningsAsErrors to true');
  }
  if (config.validation?.notDocumented !== true) {
    throw new Error('Pinned TypeDoc configuration must fail for undocumented public API');
  }
  if (!Array.isArray(config.requiredToBeDocumented) || config.requiredToBeDocumented.length === 0) {
    throw new Error(
      'Pinned TypeDoc configuration must require documentation coverage for public API kinds',
    );
  }
  for (const entryPoint of ['src/index.ts', 'docs/supporting-types.ts']) {
    if (!config.entryPoints?.includes(entryPoint)) {
      throw new Error(`Pinned TypeDoc configuration is missing required entry point ${entryPoint}`);
    }
  }
}

async function tryResolveTypeDocPackages(checkout, packageRequire) {
  let typedocManifestPath;
  try {
    typedocManifestPath = packageRequire.resolve('typedoc/package.json');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return undefined;
    throw error;
  }

  const typedocRoot = path.dirname(typedocManifestPath);
  if (!(await isWithin(checkout, typedocManifestPath))) return undefined;
  const typedoc = await readJson(typedocManifestPath, 'installed TypeDoc metadata');
  const typedocRequire = createRequire(typedocManifestPath);
  const lunrManifestPath = typedocRequire.resolve('lunr/package.json');
  if (!(await isWithin(checkout, lunrManifestPath))) return undefined;
  const lunr = await readJson(lunrManifestPath, 'installed Lunr metadata');
  return {
    typedoc,
    typedocLicense: path.join(typedocRoot, 'LICENSE'),
    lunr,
    lunrLicense: path.join(path.dirname(lunrManifestPath), 'LICENSE'),
  };
}

async function isWithin(root, filePath) {
  const [realRoot, realFilePath] = await Promise.all([realpath(root), realpath(filePath)]);
  const relative = path.relative(realRoot, realFilePath);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

async function readJson(filePath, label) {
  let contents;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${label} at ${filePath}: ${error.message}`);
  }
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Could not parse ${label} at ${filePath}: ${error.message}`);
  }
}

function createQuickstart(readme, edition, sourceSha, runtimeUrl, cliGuideUrl) {
  const requirements = extractMarkdownSection(readme, '## Requirements & Installation');
  const nodeExample = extractMarkdownSection(readme, '### Generate a CSD from a Project in Node.js')
    .replace(
      /^### Generate a CSD from a Project in Node\.js$/m,
      '## Generate a CSD from a Project in Node.js',
    )
    .replace(
      'For projects that need those services, see the runtime sections below or use the CLI.',
      `For projects that need those services, see the [runtime requirements in the pinned README](${runtimeUrl}) or use the [paired Blue CLI guide](${cliGuideUrl}).`,
    );
  if (nodeExample.includes('see the runtime sections below')) {
    throw new Error('Pinned Blue Data quickstart has an unresolved runtime-sections reference');
  }

  const exampleUrl = `https://raw.githubusercontent.com/kunstmusik/blue/${sourceSha}/skills/blue-projects/assets/example.blue`;
  return [
    '# Blue Data Node Quickstart',
    requirements,
    nodeExample,
    `Download [example.blue](${exampleUrl}) and save it as input.blue before running the example.`,
  ].join('\n\n');
}

function extractMarkdownSection(markdown, expectedHeading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === expectedHeading);
  if (headingIndex < 0) throw new Error(`Pinned Blue Data README is missing ${expectedHeading}`);
  const level = expectedHeading.match(/^#+/)[0].length;
  let endIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const heading = lines[index].match(/^(#{1,6})\s/);
    if (heading && heading[1].length <= level) {
      endIndex = index;
      break;
    }
  }
  return lines.slice(headingIndex, endIndex).join('\n').trim();
}

async function copyDataAttribution(packageRoot, outputRoot) {
  const source = path.join(packageRoot, 'resources', 'blue-x7-modern');
  const destination = path.join(outputRoot, 'resources', 'blue-x7-modern');
  await mkdir(destination, { recursive: true });
  for (const name of ['ATTRIBUTION.md', 'provenance.json']) {
    await copyFile(path.join(source, name), path.join(destination, name));
  }
}

async function copyRendererLicenses(outputRoot, typedocPackages) {
  const typedocDestination = path.join(outputRoot, 'LICENSES', 'typedoc');
  const lunrDestination = path.join(outputRoot, 'LICENSES', 'lunr');
  await Promise.all([
    mkdir(typedocDestination, { recursive: true }),
    mkdir(lunrDestination, { recursive: true }),
  ]);
  await Promise.all([
    copyFile(typedocPackages.typedocLicense, path.join(typedocDestination, 'LICENSE')),
    copyFile(typedocPackages.lunrLicense, path.join(lunrDestination, 'LICENSE')),
  ]);
}

async function addApiEditionInformation(outputRoot, edition, sourceSha, typedocPackages) {
  const indexPath = path.join(outputRoot, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  const escapedSha = escapeHtml(sourceSha);
  const escapedLabel = escapeHtml(toolingEditionLabel(edition));
  const notice = `<aside class="blue-api-edition-note" aria-label="API edition">
  <strong>Blue Data API reference</strong>
  <span class="blue-edition-label">${escapedLabel}</span>
  <span>Source revision <code>${escapedSha}</code></span>
  <nav aria-label="API edition links"><a href="./quickstart.html">Node quickstart</a></nav>
</aside>`;
  const footer = `<footer class="blue-api-notices">
  <h2>Licenses and attributions</h2>
  <ul>
    <li><a href="./LICENSE">Blue Data package license</a></li>
    <li><a href="./LICENSES/Apache-2.0.txt">Apache License 2.0 for BlueX7 data</a></li>
    <li><a href="./THIRD_PARTY_NOTICES.md">Blue Data third-party notices</a></li>
    <li><a href="./resources/blue-x7-modern/ATTRIBUTION.md">BlueX7 data attribution</a></li>
    <li><a href="./resources/blue-x7-modern/provenance.json">BlueX7 data provenance</a></li>
    <li><a href="./LICENSES/typedoc/LICENSE">TypeDoc ${typedocPackages.typedoc.version} license (Apache-2.0)</a></li>
    <li><a href="./LICENSES/lunr/LICENSE">Lunr ${typedocPackages.lunr.version} license (MIT)</a></li>
  </ul>
</footer>`;

  const updated = decorateEditionHtml(html, {
    filename: indexPath,
    sourceSha,
    label: toolingEditionLabel(edition),
    banner: notice,
    footer,
  });
  await writeFile(indexPath, updated, 'utf8');
}

async function assertPinnedSourceLinks(outputRoot, sourceSha) {
  const htmlFiles = (await listHtmlFiles(outputRoot)).map((file) =>
    path.join(outputRoot, ...file.split('/')),
  );
  let count = 0;
  for (const htmlPath of htmlFiles) {
    const document = parse(await readFile(htmlPath, 'utf8'));
    const pending = [document];
    while (pending.length > 0) {
      const node = pending.pop();
      for (const attribute of node.attrs ?? []) {
        if (attribute.name !== 'href' && attribute.name !== 'src') continue;
        let url;
        try {
          url = new URL(attribute.value);
        } catch {
          continue;
        }
        if (url.hostname !== 'github.com' || !url.pathname.includes('/packages/blue-data/'))
          continue;
        if (!url.pathname.includes(`/blob/${sourceSha}/packages/blue-data/`)) {
          throw new Error(
            `TypeDoc or quickstart source link is not pinned to ${sourceSha}: ${url.href}`,
          );
        }
        if (/^#L\d+$/.test(url.hash)) count += 1;
      }
      for (const child of node.childNodes ?? []) pending.push(child);
    }
  }
  if (count === 0)
    throw new Error(`TypeDoc output contains no pinned Blue Data source links for ${sourceSha}`);
}

async function listHtmlFiles(root) {
  const files = [];
  async function visit(directory, relativeDirectory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        files.push(relativePath);
      }
    }
  }
  await visit(root, '');
  return files;
}
