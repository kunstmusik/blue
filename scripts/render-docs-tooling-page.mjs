import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { parseFragment, serialize } from 'parse5';
import { SITE_PREFIX } from './docs-site-catalog.mjs';
import { PUBLIC_REPOSITORY } from './docs-site-release-source.mjs';

const exec = promisify(execFile);

export function pinNpmExamples(markdown, version) {
  return markdown
    .replace(
      /(@kunstmusik\/blue-(?:cli|data))@(?:next|latest|(?:[~^])?\d[\w.-]*)\b/g,
      `$1@${version}`,
    )
    .replace(/(npm install[^\n]*?@kunstmusik\/blue-(?:cli|data))(?![\w@-])/g, `$1@${version}`);
}

export function toolingEditionLabel(edition) {
  return `${edition.version}${edition.channel === 'prerelease' ? ' (prerelease)' : ''}`;
}

export async function renderToolingPage({ edition, packageDir, section, title, markdown, output }) {
  const temp = await mkdtemp(join(tmpdir(), 'blue-docs-markdown-'));
  try {
    const source = join(temp, 'page.md');
    await writeFile(source, pinNpmExamples(markdown, edition.version));
    const { stdout } = await exec(
      'quarto',
      [
        'pandoc',
        '--from=gfm-raw_html',
        '--to=html5',
        '--wrap=none',
        '--syntax-highlighting=none',
        source,
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    const fragment = parseFragment(stdout);
    const sourceUrl = `${PUBLIC_REPOSITORY}/blob/${edition.sourceSha}/packages/${packageDir}/README.md`;
    pinSourceLinks(fragment, sourceUrl);
    await writeFile(
      output,
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="blue-source-sha" content="${edition.sourceSha}">
<title>${title} · ${toolingEditionLabel(edition)}</title>
<link rel="stylesheet" href="${SITE_PREFIX}style.css">
</head>
<body class="site-page tooling-page">
<header class="site-header"><nav aria-label="Documentation">
<a href="${SITE_PREFIX}">Blue Documentation</a> <a href="${SITE_PREFIX}${section}/">All editions</a>
</nav></header>
<main>
<p>${toolingEditionLabel(edition)}</p>
<p>Source revision <a href="${sourceUrl}"><code>${edition.sourceSha}</code></a></p>
${serialize(fragment)}
</main>
<footer><a href="./LICENSE">Package license</a> <a href="./THIRD_PARTY_NOTICES.md">Package notices</a></footer>
</body>
</html>
`,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

function pinSourceLinks(node, sourceUrl) {
  for (const attribute of node.attrs ?? []) {
    if (!['href', 'src'].includes(attribute.name)) continue;
    const value = attribute.value;
    if (value.startsWith('#') || /^([a-z][a-z0-9+.-]*:|\/)/i.test(value)) continue;
    if (['LICENSE', 'THIRD_PARTY_NOTICES.md'].includes(value.replace(/^\.\//, ''))) continue;
    const target = new URL(value, sourceUrl);
    if (target.host === 'github.com' && target.pathname.includes('/tree/')) {
      target.pathname = target.pathname.replace('/tree/', '/blob/');
    }
    attribute.value = target.href;
  }
  for (const child of node.childNodes ?? []) pinSourceLinks(child, sourceUrl);
}

export async function copyPackageNotices(packageRoot, output) {
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'LICENSES']) {
    await cp(join(packageRoot, name), join(output, name), { recursive: true });
  }
}
