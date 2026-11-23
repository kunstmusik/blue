import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { admitToolingEdition } from './docs-site-tooling.mjs';
import { pinNpmExamples } from './render-docs-tooling-page.mjs';

const version = '0.1.0-beta.2';
const sourceSha = '1'.repeat(40);
const integrity = {
  data: `sha512-${Buffer.alloc(64, 1).toString('base64')}`,
  cli: `sha512-${Buffer.alloc(64, 2).toString('base64')}`,
  verification: 'https://github.com/kunstmusik/blue/actions/runs/1',
};
const edition = { version, sourceSha, tag: `npm-v${version}`, channel: 'prerelease', integrity };

async function fixture(t) {
  const checkout = await mkdtemp(join(tmpdir(), 'blue-tooling-admission-'));
  t.after(() => rm(checkout, { recursive: true, force: true }));
  const write = async (path, content) => {
    const target = join(checkout, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  const names = { cli: '@kunstmusik/blue-cli', data: '@kunstmusik/blue-data' };
  for (const role of ['cli', 'data']) {
    await write(
      `packages/blue-${role}/package.json`,
      JSON.stringify({ version, publishConfig: { name: names[role], access: 'public' } }),
    );
    await write(`packages/blue-${role}/README.md`, '# Guide');
  }
  await write('packages/blue-data/typedoc.json', '{}');
  const registry = {
    [names.cli]: { name: names.cli, version, dist: { integrity: integrity.cli } },
    [names.data]: { name: names.data, version, dist: { integrity: integrity.data } },
  };
  const options = {
    edition,
    checkout,
    repositoryRoot: checkout,
    fetchVersion: async (name, requestedVersion) => {
      assert.equal(requestedVersion, version);
      return registry[name];
    },
    checkTag: async (candidate, workspace) => {
      assert.equal(candidate.tag, `npm-v${version}`);
      assert.equal(candidate.sourceSha, sourceSha);
      assert.equal(workspace, checkout);
    },
  };
  return { names, options, registry, write };
}

test('admits the two exact scoped versions with matching maintainer evidence', async (t) => {
  const { options } = await fixture(t);
  await admitToolingEdition(options);
});

test('requires both packages, with no fallback to npm dist-tags', async (t) => {
  const { names, options, registry } = await fixture(t);
  delete registry[names.cli];
  await assert.rejects(admitToolingEdition(options), /blue-cli.*public/i);
  delete registry[names.data];
  await assert.rejects(admitToolingEdition(options), /not public/i);
});

test('rejects a wrong tag commit, source version, registry version, or integrity', async (t) => {
  const { names, options, registry, write } = await fixture(t);
  await assert.rejects(
    admitToolingEdition({
      ...options,
      checkTag: async () => {
        throw new Error('wrong tag commit');
      },
    }),
    /wrong tag commit/,
  );
  registry[names.data].version = '0.1.0-beta.9';
  await assert.rejects(admitToolingEdition(options), /registry.*version/i);
  registry[names.data].version = version;
  registry[names.data].dist.integrity = integrity.cli;
  await assert.rejects(admitToolingEdition(options), /integrity mismatch/i);
  await write(
    'packages/blue-data/package.json',
    JSON.stringify({
      version: '0.1.0-beta.3',
      publishConfig: { name: names.data, access: 'public' },
    }),
  );
  await assert.rejects(admitToolingEdition(options), /source package.*version/i);
});

test('rejects a pinned release without TypeDoc sources, including the first beta', async (t) => {
  const { options } = await fixture(t);
  await rm(join(options.checkout, 'packages', 'blue-data', 'typedoc.json'));
  const firstBeta = {
    ...edition,
    tag: 'npm-v0.1.0-beta.1',
    version: '0.1.0-beta.1',
    sourceSha: '6bd93b238946c1b54fa7f5e70cb6b7a3ac6202e2',
  };
  await assert.rejects(
    admitToolingEdition({ ...options, edition: firstBeta, checkTag: async () => {} }),
    /typedoc\.json/i,
  );
});

test('checks the source revision and pair in a retained release manifest', async (t) => {
  const { names, options, write } = await fixture(t);
  const persistedEdition = { version, sourceSha, tag: edition.tag, channel: 'prerelease' };
  const manifest = {
    schemaVersion: 1,
    version,
    tag: edition.tag,
    sourceRevision: sourceSha,
    packages: ['data', 'cli'].map((role) => ({
      role,
      name: names[role],
      version,
      integrity: integrity[role],
    })),
  };
  const file = `docs/site/npm-release-manifests/${edition.tag}.json`;
  await write(file, JSON.stringify(manifest));
  await admitToolingEdition({ ...options, edition: persistedEdition });
  manifest.sourceRevision = '3'.repeat(40);
  await write(file, JSON.stringify(manifest));
  await assert.rejects(
    admitToolingEdition({ ...options, edition: persistedEdition }),
    /source revision/i,
  );
});

test('pins install and compile commands without changing package imports', () => {
  const input = [
    'npm install --save-dev @kunstmusik/blue-cli@next',
    'npm install @kunstmusik/blue-data',
    'npx @kunstmusik/blue-cli@latest compile -p example.blue -o example.csd',
    "import { readProjectXml } from '@kunstmusik/blue-data';",
  ].join('\n');
  const rendered = pinNpmExamples(input, version);
  assert.equal(
    rendered,
    [
      `npm install --save-dev @kunstmusik/blue-cli@${version}`,
      `npm install @kunstmusik/blue-data@${version}`,
      `npx @kunstmusik/blue-cli@${version} compile -p example.blue -o example.csd`,
      "import { readProjectXml } from '@kunstmusik/blue-data';",
    ].join('\n'),
  );
});
