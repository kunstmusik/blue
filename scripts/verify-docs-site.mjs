import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { parse } from 'parse5';
import {
  assertRetained,
  assertRetainedCatalog,
  publicationInventory,
  SITE_PREFIX,
  SITE_SECTIONS,
  validateCatalog,
} from './docs-site-catalog.mjs';

const INTERNAL_ORIGIN = 'https://blue.invalid';
const PAGES_ORIGIN = 'https://kunstmusik.github.io';
const MAX_PUBLISHED_BYTES = 1_000_000_000;
const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'poster',
  'data',
  'action',
  'formaction',
  'xlink:href',
]);

/**
 * Resolve a public Pages URL to its corresponding local artifact path.
 *
 * The optional path API exists so callers can validate Windows paths on any
 * host. Public URLs always use forward slashes; native separators are applied
 * only after the `/blue/` prefix has been removed.
 *
 * @param {string} siteRoot
 * @param {string} publicUrl
 * @param {typeof path} [pathApi]
 * @returns {string}
 */
export function resolvePublicUrlToPath(siteRoot, publicUrl, pathApi = path) {
  let url;
  try {
    url = new URL(publicUrl, INTERNAL_ORIGIN);
  } catch (error) {
    throw new Error(`Invalid public URL ${JSON.stringify(publicUrl)}: ${error.message}`);
  }

  if (url.origin !== INTERNAL_ORIGIN && url.origin !== PAGES_ORIGIN) {
    throw new Error(`Expected a local Pages URL, got ${JSON.stringify(publicUrl)}`);
  }
  if (url.pathname !== '/blue' && !url.pathname.startsWith(SITE_PREFIX)) {
    throw new Error(`Local URL ${JSON.stringify(publicUrl)} is outside the public /blue/ prefix`);
  }

  const relativePath = url.pathname === '/blue' ? '' : url.pathname.slice(SITE_PREFIX.length);
  const segments = relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      let decoded;
      try {
        decoded = decodeURIComponent(segment);
      } catch (error) {
        throw new Error(`Invalid URL path segment ${JSON.stringify(segment)}: ${error.message}`);
      }
      if (decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) {
        throw new Error(`Unsafe encoded path segment in ${JSON.stringify(publicUrl)}`);
      }
      return decoded;
    });

  const rootPath = pathApi.resolve(siteRoot);
  let targetPath = pathApi.resolve(rootPath, ...segments);
  if (url.pathname.endsWith('/') || segments.length === 0) {
    targetPath = pathApi.join(targetPath, 'index.html');
  }

  const relativeTarget = pathApi.relative(rootPath, targetPath);
  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relativeTarget)
  ) {
    throw new Error(`Local URL ${JSON.stringify(publicUrl)} escapes the site root`);
  }
  return targetPath;
}

/**
 * Verify a complete, assembled documentation site before publishing it.
 *
 * @param {{
 *   siteRoot: string,
 *   catalogPath: string,
 *   baselineInventoryPath?: string,
 *   baselineCatalogPath?: string,
 *   firstDeploy?: boolean,
 *   maxBytes?: number,
 * }} options
 * @returns {Promise<{ fileCount: number, totalBytes: number, editionCount: number, sectionCount: number }>}
 */
export async function verifyDocsSite({
  siteRoot,
  catalogPath,
  baselineInventoryPath,
  baselineCatalogPath,
  firstDeploy = false,
  maxBytes = MAX_PUBLISHED_BYTES,
}) {
  if (!siteRoot || !catalogPath) throw new Error('siteRoot and catalogPath are required');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new Error('maxBytes must be a positive safe integer');
  if (Boolean(baselineInventoryPath) !== Boolean(baselineCatalogPath)) {
    throw new Error('Provide both baseline inventory and baseline catalog paths');
  }
  if (firstDeploy && (baselineInventoryPath || baselineCatalogPath)) {
    throw new Error('--first-deploy cannot be combined with baseline files');
  }

  const root = path.resolve(siteRoot);
  const rootInfo = await stat(root);
  if (!rootInfo.isDirectory()) throw new Error(`Site root is not a directory: ${root}`);

  const catalog = await readJson(catalogPath, 'tracked catalog');
  validateCatalog(catalog);
  const expectedInventory = publicationInventory(catalog);
  const candidateInventory = await readJson(
    path.join(root, 'publication-inventory.json'),
    'publication inventory',
  );
  if (
    !Array.isArray(candidateInventory) ||
    !isDeepStrictEqual(candidateInventory, expectedInventory)
  ) {
    throw new Error(
      'publication-inventory.json does not match the inventory derived from the tracked catalog',
    );
  }

  const snapshotCatalog = await readJson(
    path.join(root, 'publication-catalog.json'),
    'publication catalog snapshot',
  );
  if (!isDeepStrictEqual(snapshotCatalog, catalog)) {
    throw new Error('publication-catalog.json does not match the validated tracked catalog');
  }

  if (baselineInventoryPath && baselineCatalogPath) {
    const previousInventory = await readJson(
      baselineInventoryPath,
      'baseline publication inventory',
    );
    const previousCatalog = await readJson(baselineCatalogPath, 'baseline publication catalog');
    if (!isDeepStrictEqual(previousInventory, publicationInventory(previousCatalog))) {
      throw new Error('Baseline publication inventory does not match the baseline catalog');
    }
    assertRetained(previousInventory, candidateInventory);
    assertRetainedCatalog(previousCatalog, catalog);
  }

  const files = await walkFiles(root);
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > maxBytes) {
    throw new Error(
      `Published site size ${totalBytes} bytes exceeds the limit of ${maxBytes} bytes`,
    );
  }

  const pages = new Map();
  for (const file of files) {
    if (path.extname(file.absolutePath).toLowerCase() !== '.html') continue;
    const html = await readFile(file.absolutePath, 'utf8');
    pages.set(file.absolutePath, parseHtml(html, file));
  }

  await verifySectionPages(root, pages, expectedInventory);
  await verifyEditionPages(root, pages, expectedInventory);
  await verifyLocalReferences(root, files, pages);

  return {
    fileCount: files.length,
    totalBytes,
    editionCount: expectedInventory.length,
    sectionCount: SITE_SECTIONS.length,
  };
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

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Published site contains a symbolic link: ${absolutePath}`);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const info = await stat(absolutePath);
        files.push({
          absolutePath,
          publicUrl: publicUrlForFile(root, absolutePath),
          size: info.size,
        });
      } else {
        throw new Error(`Published site contains a non-regular file: ${absolutePath}`);
      }
    }
  }
  await visit(root);
  return files;
}

function publicUrlForFile(root, filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  if (relative === 'index.html') return '/blue/';
  if (relative.endsWith('/index.html'))
    return `${SITE_PREFIX}${relative.slice(0, -'index.html'.length)}`;
  return `${SITE_PREFIX}${relative}`;
}

function parseHtml(html, file) {
  const document = parse(html);
  const anchors = new Set();
  const urls = [];
  const inlineStyles = [];
  const bodyText = [];
  let bodyNode;

  function visit(node, state = {}) {
    const tagName = node.tagName?.toLowerCase();
    const inBody = state.inBody || tagName === 'body';
    const insideNonVisible =
      state.insideNonVisible || ['script', 'style', 'template', 'noscript'].includes(tagName);
    if (tagName === 'body') bodyNode = node;

    if (tagName) {
      const attributes = new Map(
        node.attrs.map((attribute) => [attribute.name.toLowerCase(), attribute.value]),
      );
      const id = attributes.get('id');
      if (id) anchors.add(id);
      if (tagName === 'a' && attributes.get('name')) anchors.add(attributes.get('name'));

      for (const [name, value] of attributes) {
        if (URL_ATTRIBUTES.has(name) && value.trim()) {
          urls.push({
            value: value.trim(),
            kind: tagName === 'a' || tagName === 'area' ? 'page' : 'asset',
          });
        }
        if (name === 'srcset') {
          for (const candidate of value.split(',')) {
            const source = candidate.trim().split(/\s+/, 1)[0];
            if (source) urls.push({ value: source, kind: 'asset' });
          }
        }
        if (name === 'style') inlineStyles.push(value);
      }
    }

    if (node.nodeName === '#text') {
      if (inBody && !insideNonVisible) bodyText.push(node.value);
      if (state.parentTagName === 'style') inlineStyles.push(node.value);
    }
    for (const child of node.childNodes ?? []) {
      visit(child, { inBody, insideNonVisible, parentTagName: tagName });
    }
  }
  visit(document);

  return {
    file,
    anchors,
    urls,
    inlineStyles,
    bodyText: bodyText.join(' '),
    bodyNode,
    sourceShaMetadata: findSourceShaMetadata(document),
  };
}

function findSourceShaMetadata(document) {
  const values = [];
  const pending = [document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.tagName?.toLowerCase() === 'meta') {
      const attributes = new Map(
        node.attrs.map((attribute) => [attribute.name.toLowerCase(), attribute.value]),
      );
      if (attributes.get('name')?.toLowerCase() === 'blue-source-sha') {
        values.push(attributes.get('content') ?? '');
      }
    }
    for (const child of node.childNodes ?? []) pending.push(child);
  }
  return values;
}

async function verifySectionPages(root, pages, inventory) {
  const homePath = resolvePublicUrlToPath(root, '/blue/');
  const homePage = pages.get(homePath);
  if (!homePage) throw new Error('Missing docs home page at /blue/');
  const homePaths = new Set(getPageLinkPaths(homePage, '/blue/'));

  for (const section of SITE_SECTIONS) {
    const sectionUrl = `${SITE_PREFIX}${section}/`;
    const sectionPath = resolvePublicUrlToPath(root, sectionUrl);
    const page = pages.get(sectionPath);
    if (!page) throw new Error(`Missing stable section page: ${sectionUrl}`);
    if (!homePaths.has(sectionUrl))
      throw new Error(`Docs home does not link to stable section ${sectionUrl}`);

    const sectionLinks = new Set(getPageLinkPaths(page, sectionUrl));
    for (const edition of inventory.filter((entry) => entry.section === section)) {
      if (!sectionLinks.has(edition.fixedUrl)) {
        throw new Error(
          `Stable section ${section} does not link to fixed edition ${edition.fixedUrl}`,
        );
      }
    }
  }
}

function getPageLinkPaths(page, basePublicUrl) {
  const paths = [];
  for (const reference of page.urls) {
    if (reference.kind !== 'page') continue;
    const url = parseReference(reference.value, basePublicUrl, page.file.absolutePath);
    if (url?.local) paths.push(normalizePublicPath(url.pathname));
  }
  return paths;
}

async function verifyEditionPages(root, pages, inventory) {
  for (const edition of inventory) {
    const editionPath = resolvePublicUrlToPath(root, edition.fixedUrl);
    const page = pages.get(editionPath);
    if (!page) throw new Error(`Missing fixed edition page: ${edition.fixedUrl}`);

    if (page.sourceShaMetadata.length !== 1 || page.sourceShaMetadata[0] !== edition.sourceSha) {
      throw new Error(
        `Edition ${edition.fixedUrl} must have one blue-source-sha meta tag matching ${edition.sourceSha}`,
      );
    }
    if (!page.bodyText.includes(edition.sourceSha)) {
      throw new Error(
        `Edition ${edition.fixedUrl} must show source SHA ${edition.sourceSha} in visible body text`,
      );
    }
  }
}

async function verifyLocalReferences(root, files, pages) {
  const filePaths = new Set(files.map((file) => file.absolutePath));
  for (const file of files) {
    const extension = path.extname(file.absolutePath).toLowerCase();
    if (extension === '.html') {
      const page = pages.get(file.absolutePath);
      const references = page.urls.map((reference) => ({ ...reference, base: file.publicUrl }));
      for (const css of page.inlineStyles) {
        for (const value of extractCssUrls(css))
          references.push({ value, kind: 'asset', base: file.publicUrl });
      }
      for (const reference of references) {
        await verifyReference(root, filePaths, pages, file, reference);
      }
    } else if (extension === '.css') {
      const css = await readFile(file.absolutePath, 'utf8');
      for (const value of extractCssUrls(css)) {
        await verifyReference(root, filePaths, pages, file, {
          value,
          kind: 'asset',
          base: file.publicUrl,
        });
      }
    }
  }
}

function extractCssUrls(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const values = [];
  const seen = new Set();
  const add = (value) => {
    const cleaned = value.trim();
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      values.push(cleaned);
    }
  };

  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    add(match[1] ?? match[2] ?? match[3] ?? '');
  }
  for (const match of source.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) {
    add(match[1] ?? match[2] ?? '');
  }
  return values;
}

async function verifyReference(root, filePaths, pages, sourceFile, reference) {
  const resolved = parseReference(reference.value, reference.base, sourceFile.absolutePath);
  if (!resolved?.local) return;
  let targetPath = resolvePublicUrlToPath(root, resolved.pathname);
  // Pages redirects a directory without a trailing slash, while also serving
  // plain files such as LICENSE at the exact requested path.
  if (!filePaths.has(targetPath) && !resolved.pathname.endsWith('/')) {
    const directoryIndex = path.join(targetPath, 'index.html');
    if (filePaths.has(directoryIndex)) targetPath = directoryIndex;
  }
  if (!filePaths.has(targetPath)) {
    const lastSegment = decodeURIComponent(
      resolved.pathname.slice(resolved.pathname.lastIndexOf('/') + 1),
    );
    const extension = path.extname(lastSegment).toLowerCase();
    const isPageRoute = reference.kind === 'page' && (!extension || extension === '.html');
    const kind = isPageRoute ? 'page' : 'asset';
    throw new Error(
      `Missing local ${kind} ${resolved.pathname} referenced from ${sourceFile.publicUrl}`,
    );
  }

  if (!resolved.hash) return;
  const targetPage = pages.get(targetPath);
  if (!targetPage) return;
  let anchor;
  try {
    anchor = decodeURIComponent(resolved.hash.slice(1));
  } catch (error) {
    throw new Error(`Invalid anchor in ${resolved.pathname}${resolved.hash}: ${error.message}`);
  }
  if (anchor && !targetPage.anchors.has(anchor)) {
    throw new Error(
      `Missing anchor #${anchor} in ${resolved.pathname} referenced from ${sourceFile.publicUrl}`,
    );
  }
}

function parseReference(value, basePublicUrl, sourcePath) {
  let resolved;
  try {
    const base = new URL(basePublicUrl, INTERNAL_ORIGIN);
    resolved = new URL(value, base);
  } catch (error) {
    throw new Error(
      `Invalid local reference ${JSON.stringify(value)} in ${sourcePath}: ${error.message}`,
    );
  }

  if (resolved.origin !== INTERNAL_ORIGIN && resolved.origin !== PAGES_ORIGIN) return null;
  if (resolved.pathname !== '/blue' && !resolved.pathname.startsWith(SITE_PREFIX)) {
    throw new Error(
      `Local reference ${JSON.stringify(value)} in ${sourcePath} is outside the public /blue/ prefix`,
    );
  }
  return { local: true, pathname: resolved.pathname, hash: resolved.hash };
}

function normalizePublicPath(pathname) {
  if (pathname === '/blue') return '/blue/';
  const decoded = decodeURIComponent(pathname);
  if (decoded.endsWith('/')) return decoded;
  const lastSegment = decoded.slice(decoded.lastIndexOf('/') + 1);
  if (path.extname(lastSegment) === '') return `${decoded}/`;
  return decoded;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--first-deploy') {
      options.firstDeploy = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    const optionNames = new Map([
      ['--site', 'siteRoot'],
      ['--catalog', 'catalogPath'],
      ['--baseline', 'baselineInventoryPath'],
      ['--baseline-catalog', 'baselineCatalogPath'],
    ]);
    const name = optionNames.get(argument);
    if (!name) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    options[name] = path.resolve(value);
    index += 1;
  }
  return options;
}

function isDirectExecution() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Usage: node scripts/verify-docs-site.mjs [--site <path>] [--catalog <path>] [--baseline <inventory.json> --baseline-catalog <catalog.json>] [--first-deploy]\n',
    );
    return;
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = await verifyDocsSite({
    siteRoot: options.siteRoot ?? path.join(repoRoot, 'build', 'docs-site'),
    catalogPath: options.catalogPath ?? path.join(repoRoot, 'docs', 'site', 'editions.json'),
    baselineInventoryPath: options.baselineInventoryPath,
    baselineCatalogPath: options.baselineCatalogPath,
    firstDeploy: options.firstDeploy,
  });
  process.stdout.write(
    `Verified ${result.editionCount} editions in ${result.sectionCount} sections (${result.fileCount} files, ${result.totalBytes} bytes).\n`,
  );
}

if (isDirectExecution()) {
  main().catch((error) => {
    process.stderr.write(`Documentation site verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
