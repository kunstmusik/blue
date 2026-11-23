import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assembleDocsSite } from './build-docs-site.mjs';

test('assembles a pinned desktop edition and retains a verified output after a failed build', async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'blue-docs-site-'));
  try {
    const git = (...args) =>
      execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
    git('init', '--quiet');
    await writeFile(join(repositoryRoot, 'chapter.txt'), 'Pinned chapter');
    git('add', 'chapter.txt');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'pin');
    const sourceSha = git('rev-parse', 'HEAD');
    await writeFile(join(repositoryRoot, 'chapter.txt'), 'Uncommitted chapter');

    const source = join(repositoryRoot, 'docs', 'site');
    await mkdir(source, { recursive: true });
    const catalog = {
      desktop: [
        { key: 'v3.0.0', channel: 'stable', label: 'Blue 3.0.0', sourceSha, tag: 'v3.0.0' },
      ],
      tooling: [],
      recommended: { desktop: 'v3.0.0' },
    };
    await Promise.all([
      writeFile(join(source, 'editions.json'), JSON.stringify(catalog)),
      writeFile(
        join(source, 'index.html'),
        '<a href="{{prefix}}blue-projects/">Blue Projects</a>' +
          '<a href="{{prefix}}manual/">Manual</a><a href="{{prefix}}cli/">CLI</a>' +
          '<a href="{{prefix}}api/blue-data/">API</a>',
      ),
      writeFile(join(source, 'section.html'), '<h1>{{title}}</h1>{{body}}'),
      writeFile(join(source, 'blue-projects.html'), '<a href="{{prefix}}">Blue Documentation</a>'),
      writeFile(join(source, 'style.css'), ''),
    ]);
    const output = join(repositoryRoot, 'build', 'docs-site');
    const actualIndex = join(output, 'manual', 'v3.0.0', 'index.html');
    const renderDesktop = async ({ checkout, output: editionOutput }) => {
      const chapter = await readFile(join(checkout, 'chapter.txt'), 'utf8');
      await mkdir(editionOutput);
      await writeFile(
        join(editionOutput, 'index.html'),
        `<meta name="blue-source-sha" content="${sourceSha}"><p>${sourceSha} ${chapter}</p>`,
      );
    };
    await assembleDocsSite({ repositoryRoot, output, renderDesktop });
    assert.match(await readFile(actualIndex, 'utf8'), /Pinned chapter/);
    assert.match(
      await readFile(join(output, 'blue-projects', 'index.html'), 'utf8'),
      /href="\/blue\/"/,
    );
    await assert.rejects(
      assembleDocsSite({
        repositoryRoot,
        output,
        renderDesktop: async ({ output: editionOutput }) => {
          await mkdir(editionOutput);
        },
      }),
      /fixed edition|index\.html/i,
    );
    assert.match(await readFile(actualIndex, 'utf8'), /Pinned chapter/);
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});
