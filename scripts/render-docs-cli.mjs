import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PUBLIC_REPOSITORY } from './docs-site-release-source.mjs';
import { copyPackageNotices, renderToolingPage } from './render-docs-tooling-page.mjs';

export async function renderDocsCli({ edition, checkout, output }) {
  const packageRoot = join(checkout, 'packages', 'blue-cli');
  const readme = await readFile(join(packageRoot, 'README.md'), 'utf8');
  const example = `## Compile the example project

Download [example.blue](${PUBLIC_REPOSITORY}/blob/${edition.sourceSha}/skills/blue-projects/assets/example.blue) and run this in the directory containing it.

\`\`\`bash
npx --yes @kunstmusik/blue-cli@${edition.version} compile -p example.blue -o example.csd
\`\`\`
`;
  await mkdir(output, { recursive: true });
  await copyPackageNotices(packageRoot, output);
  await renderToolingPage({
    edition,
    packageDir: 'blue-cli',
    section: 'cli',
    title: 'Blue CLI guide',
    markdown: readme.replace(/(?=^## Installation\s*$)/im, `${example}\n`),
    output: join(output, 'index.html'),
  });
}
