import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  assertRegistryVersionsAbsent,
  createReleaseManifest,
  decidePublishAction,
  executeReleasePublish,
  parseNpmTag,
  validateWorkspaceVersions,
  verifyReleaseManifest,
} from './verify-npm-release.mjs';
import { REPO_ROOT } from './verify-npm-packages.mjs';

const VALID_SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);

/**
 * Create a 512-byte USTAR tar header for a regular file entry.
 *
 * @param {string} entryName
 * @param {number} byteLength
 * @returns {Buffer}
 */
function createTarHeader(entryName, byteLength) {
  const header = Buffer.alloc(512, 0);
  const nameBytes = Buffer.from(entryName, 'utf8');
  if (nameBytes.length > 100) {
    throw new Error(`Tar entry name exceeds 100 bytes: ${entryName}`);
  }
  nameBytes.copy(header, 0);
  header.write('0000644\0', 100, 'ascii');
  header.write('0000000\0', 108, 'ascii');
  header.write('0000000\0', 116, 'ascii');
  header.write(`${byteLength.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
  header.write('00000000000\0', 136, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 'ascii');
  header.write('ustar\0', 257, 'ascii');
  header.write('00', 263, 'ascii');

  let checksum = 0;
  for (let i = 0; i < 512; i += 1) {
    checksum += header[i];
  }
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  return header;
}

/**
 * Write a minimal valid gzipped USTAR `.tgz` archive to disk.
 *
 * @param {string} archivePath
 * @param {Record<string, string | Buffer>} files
 */
function createTgzArchive(archivePath, files) {
  const blocks = [];
  for (const [entryName, content] of Object.entries(files)) {
    const payload = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    blocks.push(createTarHeader(entryName, payload.length));
    blocks.push(payload);
    const remainder = payload.length % 512;
    if (remainder !== 0) {
      blocks.push(Buffer.alloc(512 - remainder, 0));
    }
  }
  blocks.push(Buffer.alloc(1024, 0));
  writeFileSync(archivePath, gzipSync(Buffer.concat(blocks)));
}

/**
 * Write a valid `.tgz` archive for `@kunstmusik/blue-data` or `@kunstmusik/blue-cli`.
 *
 * @param {string} archivePath
 * @param {'data' | 'cli'} kind
 * @param {string} version
 * @param {{ readme?: string }} [options]
 */
function writePackageTarball(archivePath, kind, version, options = {}) {
  const manifest =
    kind === 'data'
      ? {
          name: '@kunstmusik/blue-data',
          version,
          engines: { node: '>=22' },
          dependencies: {
            '@rgrove/parse-xml': '^4.2.0',
            'quickjs-emscripten': '^0.32.0',
          },
        }
      : {
          name: '@kunstmusik/blue-cli',
          version,
          bin: { 'blue-cli': './dist/blue-cli.cjs' },
          engines: { node: '>=22' },
          dependencies: {
            'quickjs-emscripten': '^0.32.0',
            zeromq: '^6.8.0',
          },
        };

  createTgzArchive(archivePath, {
    'package/package.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'package/LICENSE': 'MIT\n',
    'package/THIRD_PARTY_NOTICES.md': '# Third-Party Notices\n',
    'package/README.md': options.readme ?? `# ${manifest.name}\n`,
  });
}

/**
 * Create a matched `.tgz` archive pair inside `artifactsDir`.
 *
 * @param {string} artifactsDir
 * @param {{ dataVersion?: string, cliVersion?: string }} [options]
 * @returns {{ dataPath: string, cliPath: string }}
 */
function createArchiveFixturePair(artifactsDir, options = {}) {
  const dataVersion = options.dataVersion ?? '0.1.0';
  const cliVersion = options.cliVersion ?? dataVersion;
  const dataPath = path.join(artifactsDir, `kunstmusik-blue-data-${dataVersion}.tgz`);
  const cliPath = path.join(artifactsDir, `kunstmusik-blue-cli-${cliVersion}.tgz`);
  writePackageTarball(dataPath, 'data', dataVersion);
  writePackageTarball(cliPath, 'cli', cliVersion);
  return { dataPath, cliPath };
}

/**
 * Compute npm SRI SHA-512 integrity for an archive file.
 *
 * @param {string} filePath
 * @returns {string}
 */
function computeIntegrity(filePath) {
  return `sha512-${createHash('sha512').update(readFileSync(filePath)).digest('base64')}`;
}

/**
 * Write a temporary workspace with `packages/blue-data/package.json` and `packages/blue-cli/package.json`.
 *
 * @param {string} workspaceRoot
 * @param {{
 *   dataPkg?: Record<string, unknown>,
 *   cliPkg?: Record<string, unknown>,
 * }} [overrides]
 */
function writeTempWorkspace(workspaceRoot, overrides = {}) {
  const dataDir = path.join(workspaceRoot, 'packages', 'blue-data');
  const cliDir = path.join(workspaceRoot, 'packages', 'blue-cli');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(cliDir, { recursive: true });

  const defaultDataPkg = {
    name: '@blue/data',
    version: '0.1.0',
    engines: { node: '>=22' },
    publishConfig: {
      name: '@kunstmusik/blue-data',
      access: 'public',
    },
  };
  const defaultCliPkg = {
    name: 'blue-cli',
    version: '0.1.0',
    engines: { node: '>=22' },
    publishConfig: {
      name: '@kunstmusik/blue-cli',
      access: 'public',
    },
  };

  writeFileSync(
    path.join(dataDir, 'package.json'),
    `${JSON.stringify(overrides.dataPkg ?? defaultDataPkg, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(cliDir, 'package.json'),
    `${JSON.stringify(overrides.cliPkg ?? defaultCliPkg, null, 2)}\n`,
    'utf8',
  );
}

/**
 * Run a callback with a temporary directory that is always removed afterward.
 *
 * @template T
 * @param {string} prefix
 * @param {(dir: string) => Promise<T> | T} fn
 * @returns {Promise<T>}
 */
async function withTempDir(prefix, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('parseNpmTag accepts stable and prerelease npm-v tags and maps dist-tags', () => {
  assert.deepEqual(parseNpmTag('npm-v0.1.0'), {
    tag: 'npm-v0.1.0',
    version: '0.1.0',
    isPrerelease: false,
    distTag: 'latest',
  });

  assert.deepEqual(parseNpmTag('npm-v0.1.0-beta.1'), {
    tag: 'npm-v0.1.0-beta.1',
    version: '0.1.0-beta.1',
    isPrerelease: true,
    distTag: 'next',
  });

  const rc = parseNpmTag('npm-v1.2.3-rc.2');
  assert.deepEqual(rc, {
    tag: 'npm-v1.2.3-rc.2',
    version: '1.2.3-rc.2',
    isPrerelease: true,
    distTag: 'next',
  });
});

test('parseNpmTag rejects non-npm tags, build metadata, invalid semver, and empty tags', () => {
  for (const invalidTag of ['v0.1.0', 'npm-v0.1.0+build.1', 'npm-vinvalid', '']) {
    assert.throws(() => parseNpmTag(invalidTag), { name: 'Error' });
  }
});

test('validateWorkspaceVersions accepts matching versions and public scoped publishConfig', async () => {
  await withTempDir('blue-npm-ws-valid-', async (workspaceRoot) => {
    writeTempWorkspace(workspaceRoot);
    await assert.doesNotReject(async () =>
      validateWorkspaceVersions({ workspaceRoot, expectedVersion: '0.1.0' }),
    );
  });

  await withTempDir('blue-npm-ws-prerelease-', async (workspaceRoot) => {
    writeTempWorkspace(workspaceRoot, {
      dataPkg: {
        name: '@blue/data',
        version: '0.1.0-beta.1',
        engines: { node: '>=22' },
        publishConfig: { name: '@kunstmusik/blue-data', access: 'public' },
      },
      cliPkg: {
        name: 'blue-cli',
        version: '0.1.0-beta.1',
        engines: { node: '>=22' },
        publishConfig: { name: '@kunstmusik/blue-cli', access: 'public' },
      },
    });
    await assert.doesNotReject(async () =>
      validateWorkspaceVersions({ workspaceRoot, expectedVersion: '0.1.0-beta.1' }),
    );
  });
});

test('validateWorkspaceVersions rejects version and publishConfig mismatches', async (t) => {
  await t.test('blue-data version mismatch', async () => {
    await withTempDir('blue-npm-ws-data-ver-', async (workspaceRoot) => {
      writeTempWorkspace(workspaceRoot, {
        dataPkg: {
          name: '@blue/data',
          version: '0.2.0',
          publishConfig: { name: '@kunstmusik/blue-data', access: 'public' },
        },
      });
      await assert.rejects(
        async () => validateWorkspaceVersions({ workspaceRoot, expectedVersion: '0.1.0' }),
        /0\.1\.0|0\.2\.0|version|blue-data/i,
      );
    });
  });

  await t.test('blue-cli version mismatch', async () => {
    await withTempDir('blue-npm-ws-cli-ver-', async (workspaceRoot) => {
      writeTempWorkspace(workspaceRoot, {
        cliPkg: {
          name: 'blue-cli',
          version: '0.2.0',
          publishConfig: { name: '@kunstmusik/blue-cli', access: 'public' },
        },
      });
      await assert.rejects(
        async () => validateWorkspaceVersions({ workspaceRoot, expectedVersion: '0.1.0' }),
        /0\.1\.0|0\.2\.0|version|blue-cli/i,
      );
    });
  });

  await t.test('publishConfig name mismatch', async () => {
    await withTempDir('blue-npm-ws-pub-name-', async (workspaceRoot) => {
      writeTempWorkspace(workspaceRoot, {
        dataPkg: {
          name: '@blue/data',
          version: '0.1.0',
          publishConfig: { name: '@blue/data', access: 'public' },
        },
      });
      await assert.rejects(
        async () => validateWorkspaceVersions({ workspaceRoot, expectedVersion: '0.1.0' }),
        /publishConfig|@kunstmusik\/blue-data|name/i,
      );
    });
  });

  await t.test('publishConfig access mismatch', async () => {
    await withTempDir('blue-npm-ws-pub-access-', async (workspaceRoot) => {
      writeTempWorkspace(workspaceRoot, {
        cliPkg: {
          name: 'blue-cli',
          version: '0.1.0',
          publishConfig: { name: '@kunstmusik/blue-cli', access: 'restricted' },
        },
      });
      await assert.rejects(
        async () => validateWorkspaceVersions({ workspaceRoot, expectedVersion: '0.1.0' }),
        /publishConfig|access|public/i,
      );
    });
  });
});

test('createReleaseManifest and verifyReleaseManifest succeed for matching .tgz fixtures and 40-char git SHA', async () => {
  await withTempDir('blue-npm-manifest-ok-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.sourceRevision, VALID_SHA);
    assert.equal(manifest.distTag, 'latest');

    const roundTripped = JSON.parse(JSON.stringify(manifest));
    await assert.doesNotReject(async () =>
      verifyReleaseManifest({
        manifest: roundTripped,
        artifactsDir,
        expectedVersion: '0.1.0',
        expectedRevision: VALID_SHA,
      }),
    );
  });
});

test('createReleaseManifest and verifyReleaseManifest reject tag, manifest, and archive version mismatches', async (t) => {
  await t.test('expectedVersion differs from manifest.version', async () => {
    await withTempDir('blue-npm-manifest-expver-', async (artifactsDir) => {
      const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, {
        dataVersion: '0.1.0',
      });
      const manifest = await createReleaseManifest({
        dataPath,
        cliPath,
        version: '0.1.0',
        sourceRevision: VALID_SHA,
        distTag: 'latest',
      });

      await assert.rejects(
        async () =>
          verifyReleaseManifest({
            manifest,
            artifactsDir,
            expectedVersion: '0.2.0',
            expectedRevision: VALID_SHA,
          }),
        /version|0\.1\.0|0\.2\.0|mismatch/i,
      );
    });
  });

  await t.test('archive package.json version differs from manifest.version', async () => {
    await withTempDir('blue-npm-manifest-archver-', async (artifactsDir) => {
      const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, {
        dataVersion: '0.1.0',
      });
      const manifest = await createReleaseManifest({
        dataPath,
        cliPath,
        version: '0.1.0',
        sourceRevision: VALID_SHA,
        distTag: 'latest',
      });

      await assert.rejects(
        async () =>
          verifyReleaseManifest({
            manifest: { ...manifest, version: '0.2.0' },
            artifactsDir,
            expectedVersion: '0.2.0',
            expectedRevision: VALID_SHA,
          }),
        /version|0\.1\.0|0\.2\.0|mismatch/i,
      );
    });
  });

  await t.test(
    'createReleaseManifest rejects mismatched archive versions across the pair',
    async () => {
      await withTempDir('blue-npm-manifest-pairver-', async (artifactsDir) => {
        const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, {
          dataVersion: '0.1.0',
          cliVersion: '0.1.1',
        });

        await assert.rejects(
          async () =>
            createReleaseManifest({
              dataPath,
              cliPath,
              version: '0.1.0',
              sourceRevision: VALID_SHA,
              distTag: 'latest',
            }),
          /version|0\.1\.0|0\.1\.1/i,
        );
      });
    },
  );
});

test('verifyReleaseManifest fails when an expected archive is missing from artifactsDir', async () => {
  await withTempDir('blue-npm-manifest-missing-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    rmSync(cliPath);
    await assert.rejects(
      async () =>
        verifyReleaseManifest({
          manifest,
          artifactsDir,
          expectedVersion: '0.1.0',
          expectedRevision: VALID_SHA,
        }),
      /missing|not found|archive|enoent/i,
    );
  });
});

test('verifyReleaseManifest fails on archive byte tampering after manifest creation', async () => {
  await withTempDir('blue-npm-manifest-tamper-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    // Rebuild a valid tarball with altered contents so SHA-512 integrity fails specifically.
    writePackageTarball(dataPath, 'data', '0.1.0', {
      readme: '# @kunstmusik/blue-data\n\nTampered after verification.\n',
    });

    await assert.rejects(
      async () =>
        verifyReleaseManifest({
          manifest,
          artifactsDir,
          expectedVersion: '0.1.0',
          expectedRevision: VALID_SHA,
        }),
      /integrity|sha-?512|digest|mismatch/i,
    );
  });
});

test('verifyReleaseManifest fails on expectedRevision mismatch or invalid short SHA', async (t) => {
  await t.test('expectedRevision mismatch', async () => {
    await withTempDir('blue-npm-manifest-revmismatch-', async (artifactsDir) => {
      const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, {
        dataVersion: '0.1.0',
      });
      const manifest = await createReleaseManifest({
        dataPath,
        cliPath,
        version: '0.1.0',
        sourceRevision: VALID_SHA,
        distTag: 'latest',
      });

      await assert.rejects(
        async () =>
          verifyReleaseManifest({
            manifest,
            artifactsDir,
            expectedVersion: '0.1.0',
            expectedRevision: OTHER_SHA,
          }),
        /revision|sha|mismatch/i,
      );
    });
  });

  await t.test('invalid short SHA', async () => {
    await withTempDir('blue-npm-manifest-shortsha-', async (artifactsDir) => {
      const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, {
        dataVersion: '0.1.0',
      });
      const manifest = await createReleaseManifest({
        dataPath,
        cliPath,
        version: '0.1.0',
        sourceRevision: VALID_SHA,
        distTag: 'latest',
      });

      await assert.rejects(
        async () =>
          verifyReleaseManifest({
            manifest: { ...manifest, sourceRevision: 'abc1234' },
            artifactsDir,
            expectedVersion: '0.1.0',
            expectedRevision: 'abc1234',
          }),
        /revision|sha|40|invalid/i,
      );

      await assert.rejects(
        async () =>
          verifyReleaseManifest({
            manifest,
            artifactsDir,
            expectedVersion: '0.1.0',
            expectedRevision: VALID_SHA.slice(0, 7),
          }),
        /revision|sha|40|invalid|mismatch/i,
      );
    });
  });
});

test('decidePublishAction selects publish, skip, or throws on registry integrity mismatch', () => {
  const pkg = {
    name: '@kunstmusik/blue-data',
    version: '0.1.0',
    integrity: 'sha512-expectedDigest==',
  };

  assert.equal(decidePublishAction({ pkg, registryIntegrity: null }).action, 'publish');
  assert.equal(decidePublishAction({ pkg, registryIntegrity: pkg.integrity }).action, 'skip');
  assert.throws(
    () => decidePublishAction({ pkg, registryIntegrity: 'sha512-conflictingDigest==' }),
    /integrity mismatch/i,
  );
});

test('executeReleasePublish publishes both packages when absent on latest and next channels', async (t) => {
  for (const scenario of [
    { version: '0.1.0', distTag: 'latest' },
    { version: '0.1.0-beta.1', distTag: 'next' },
  ]) {
    await t.test(`distTag ${scenario.distTag}`, async () => {
      await withTempDir('blue-npm-publish-fresh-', async (artifactsDir) => {
        const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, {
          dataVersion: scenario.version,
        });
        const manifest = await createReleaseManifest({
          dataPath,
          cliPath,
          version: scenario.version,
          sourceRevision: VALID_SHA,
          distTag: scenario.distTag,
        });

        const publishCalls = [];
        const result = await executeReleasePublish({
          manifest,
          artifactsDir,
          queryRegistryIntegrity: async () => null,
          publishArchive: async (call) => {
            publishCalls.push(call);
          },
          provenance: true,
          dryRun: false,
        });

        assert.deepEqual(result.skipped, []);
        assert.deepEqual(result.published, ['@kunstmusik/blue-data', '@kunstmusik/blue-cli']);
        assert.equal(publishCalls.length, 2);

        const expectedArchives = [
          ['@kunstmusik/blue-data', path.resolve(dataPath)],
          ['@kunstmusik/blue-cli', path.resolve(cliPath)],
        ];
        for (const [index, [expectedName, expectedArchivePath]] of expectedArchives.entries()) {
          const call = publishCalls[index];
          assert.equal(call.pkg?.name ?? call.name, expectedName);
          assert.equal(path.resolve(call.archivePath), expectedArchivePath);
          assert.equal(call.access, 'public');
          assert.equal(call.distTag, scenario.distTag);
          assert.equal(call.provenance, true);
          assert.equal(call.dryRun, false);
        }
      });
    });
  }
});

test('executeReleasePublish resumes partial release when data matches registry integrity and cli is absent', async () => {
  await withTempDir('blue-npm-publish-partial-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const dataIntegrity = computeIntegrity(dataPath);
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    const publishCalls = [];
    const result = await executeReleasePublish({
      manifest,
      artifactsDir,
      queryRegistryIntegrity: async ({ name }) =>
        name === '@kunstmusik/blue-data' ? dataIntegrity : null,
      publishArchive: async (call) => {
        publishCalls.push(call);
      },
      provenance: true,
      dryRun: false,
    });

    assert.deepEqual(result.skipped, ['@kunstmusik/blue-data']);
    assert.deepEqual(result.published, ['@kunstmusik/blue-cli']);
    assert.equal(publishCalls.length, 1);
    assert.equal(publishCalls[0].pkg?.name ?? publishCalls[0].name, '@kunstmusik/blue-cli');
    assert.equal(path.resolve(publishCalls[0].archivePath), path.resolve(cliPath));
    assert.equal(publishCalls[0].access, 'public');
    assert.equal(publishCalls[0].distTag, 'latest');
    assert.equal(publishCalls[0].provenance, true);
  });
});

test('executeReleasePublish performs idempotent no-op when both packages match registry integrity', async () => {
  await withTempDir('blue-npm-publish-retry-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const integrities = {
      '@kunstmusik/blue-data': computeIntegrity(dataPath),
      '@kunstmusik/blue-cli': computeIntegrity(cliPath),
    };
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    const publishCalls = [];
    const result = await executeReleasePublish({
      manifest,
      artifactsDir,
      queryRegistryIntegrity: async ({ name }) => integrities[name] ?? null,
      publishArchive: async (call) => {
        publishCalls.push(call);
      },
      provenance: true,
      dryRun: false,
    });

    assert.deepEqual(result.skipped, ['@kunstmusik/blue-data', '@kunstmusik/blue-cli']);
    assert.deepEqual(result.published, []);
    assert.equal(publishCalls.length, 0);
  });
});

test('executeReleasePublish blocks immediately and never publishes when either package has conflicting registry integrity', async (t) => {
  for (const conflictTarget of ['@kunstmusik/blue-data', '@kunstmusik/blue-cli']) {
    await t.test(`conflict on ${conflictTarget}`, async () => {
      await withTempDir('blue-npm-publish-conflict-', async (artifactsDir) => {
        const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, {
          dataVersion: '0.1.0',
        });
        const manifest = await createReleaseManifest({
          dataPath,
          cliPath,
          version: '0.1.0',
          sourceRevision: VALID_SHA,
          distTag: 'latest',
        });

        const publishCalls = [];
        await assert.rejects(
          async () =>
            executeReleasePublish({
              manifest,
              artifactsDir,
              queryRegistryIntegrity: async ({ name }) =>
                name === conflictTarget ? 'sha512-conflictingRegistryDigest==' : null,
              publishArchive: async (call) => {
                publishCalls.push(call);
              },
              provenance: true,
              dryRun: false,
            }),
          /integrity mismatch/i,
        );

        assert.equal(publishCalls.length, 0);
      });
    });
  }
});

const MALFORMED_SEMVERS = [
  '01.0.0',
  '0.01.0',
  '0.1.00',
  '0.1.0-',
  '0.1.0-.1',
  '0.1.0-beta..1',
  '0.1.0-beta.',
  '0.1.0-beta.01',
  '0.1.0+build.1',
];

test('parseNpmTag, validateWorkspaceVersions, createReleaseManifest, and verifyReleaseManifest reject malformed SemVer', async () => {
  await withTempDir('blue-npm-badsemver-', async (dir) => {
    const validPair = createArchiveFixturePair(dir, { dataVersion: '0.1.0' });
    const validManifest = await createReleaseManifest({
      ...validPair,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    for (const badVersion of MALFORMED_SEMVERS) {
      assert.throws(() => parseNpmTag(`npm-v${badVersion}`), /Invalid|SemVer/i);

      writeTempWorkspace(dir, {
        dataPkg: {
          name: '@blue/data',
          version: badVersion,
          publishConfig: { name: '@kunstmusik/blue-data', access: 'public' },
        },
        cliPkg: {
          name: 'blue-cli',
          version: badVersion,
          publishConfig: { name: '@kunstmusik/blue-cli', access: 'public' },
        },
      });
      await assert.rejects(
        async () => validateWorkspaceVersions({ workspaceRoot: dir }),
        /Invalid SemVer/i,
      );

      await assert.rejects(
        async () =>
          createReleaseManifest({
            ...validPair,
            version: badVersion,
            sourceRevision: VALID_SHA,
            distTag: badVersion.includes('-') ? 'next' : 'latest',
          }),
        /Invalid SemVer/i,
      );

      await assert.rejects(
        async () =>
          verifyReleaseManifest({
            manifest: { ...validManifest, version: badVersion, tag: `npm-v${badVersion}` },
            artifactsDir: dir,
          }),
        /Invalid SemVer/i,
      );
    }
  });
});

test('createReleaseManifest and verifyReleaseManifest reject inconsistent tag, prerelease, schemaVersion, and distTag metadata', async () => {
  await withTempDir('blue-npm-inconsistent-meta-', async (artifactsDir) => {
    const stablePair = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    await assert.rejects(
      async () =>
        createReleaseManifest({
          ...stablePair,
          version: '0.1.0',
          sourceRevision: VALID_SHA,
          distTag: 'next',
        }),
      /distTag/i,
    );

    const preArtifacts = path.join(artifactsDir, 'pre');
    mkdirSync(preArtifacts, { recursive: true });
    const prePair = createArchiveFixturePair(preArtifacts, { dataVersion: '0.1.0-beta.1' });
    await assert.rejects(
      async () =>
        createReleaseManifest({
          ...prePair,
          version: '0.1.0-beta.1',
          sourceRevision: VALID_SHA,
          distTag: 'latest',
        }),
      /distTag/i,
    );

    const manifest = await createReleaseManifest({
      ...stablePair,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    for (const [label, mutated, extraOpts] of [
      ['wrong schemaVersion', { ...manifest, schemaVersion: 2 }, {}],
      ['mismatched manifest.tag', { ...manifest, tag: 'npm-v0.2.0' }, {}],
      ['mismatched expectedTag', manifest, { expectedTag: 'npm-v0.2.0' }],
      ['mismatched isPrerelease', { ...manifest, isPrerelease: true }, {}],
      ['mismatched distTag', { ...manifest, distTag: 'next' }, {}],
    ]) {
      await assert.rejects(
        async () =>
          verifyReleaseManifest({
            manifest: mutated,
            artifactsDir,
            expectedVersion: '0.1.0',
            expectedRevision: VALID_SHA,
            ...extraOpts,
          }),
        { name: 'Error' },
        `${label} must be rejected`,
      );
    }
  });
});

test('verifyReleaseManifest rejects extra, duplicate, unknown, role-mismatched, and path-traversal package records', async () => {
  await withTempDir('blue-npm-pkg-records-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    const dataEntry = manifest.packages[0];
    const cliEntry = manifest.packages[1];

    const extraThird = {
      ...manifest,
      packages: [
        dataEntry,
        cliEntry,
        {
          ...dataEntry,
          role: 'extra',
          name: '@kunstmusik/blue-extra',
        },
      ],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: extraThird, artifactsDir }),
      /strictly 2 package entries/i,
    );

    const duplicateTwo = {
      ...manifest,
      packages: [dataEntry, { ...dataEntry }],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: duplicateTwo, artifactsDir }),
      /Duplicate package entry/i,
    );

    const unknownName = {
      ...manifest,
      packages: [dataEntry, { ...cliEntry, name: '@kunstmusik/unexpected' }],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: unknownName, artifactsDir }),
      /Unexpected package entry/i,
    );

    const swappedRoleName = {
      ...manifest,
      packages: [{ ...dataEntry, name: '@kunstmusik/blue-cli' }, cliEntry],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: swappedRoleName, artifactsDir }),
      /Unexpected package entry/i,
    );

    const pathTraversalFilename = {
      ...manifest,
      packages: [{ ...dataEntry, filename: `../${dataEntry.filename}` }, cliEntry],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: pathTraversalFilename, artifactsDir }),
      /unsafe or invalid archive filename/i,
    );
  });
});

test('createReleaseManifest and verifyReleaseManifest record and enforce sorted per-package file inventories', async () => {
  await withTempDir('blue-npm-file-inventory-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    assert.deepEqual(manifest.packages[0].files, [
      'LICENSE',
      'README.md',
      'THIRD_PARTY_NOTICES.md',
      'package.json',
    ]);
    assert.equal(manifest.packages[0].entryCount, 4);
    assert.deepEqual(manifest.packages[1].files, [
      'LICENSE',
      'README.md',
      'THIRD_PARTY_NOTICES.md',
      'package.json',
    ]);
    assert.equal(manifest.packages[1].entryCount, 4);

    // Reject missing files array
    const noFiles = {
      ...manifest,
      packages: [{ ...manifest.packages[0], files: undefined }, manifest.packages[1]],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: noFiles, artifactsDir }),
      /files inventory/i,
    );

    // Reject unsorted or duplicate files array
    const unsortedFiles = {
      ...manifest,
      packages: [
        { ...manifest.packages[0], files: [...manifest.packages[0].files].reverse() },
        manifest.packages[1],
      ],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: unsortedFiles, artifactsDir }),
      /sorted/i,
    );

    const dupFiles = {
      ...manifest,
      packages: [
        {
          ...manifest.packages[0],
          files: ['LICENSE', 'LICENSE', 'README.md', 'package.json'],
        },
        manifest.packages[1],
      ],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: dupFiles, artifactsDir }),
      /duplicate/i,
    );

    // Rebuild data tarball with an extra file and update byte count + hashes while keeping stale files list
    createTgzArchive(dataPath, {
      'package/package.json': `${JSON.stringify(
        {
          name: '@kunstmusik/blue-data',
          version: '0.1.0',
          engines: { node: '>=22' },
          dependencies: {
            '@rgrove/parse-xml': '^4.2.0',
            'quickjs-emscripten': '^0.32.0',
          },
        },
        null,
        2,
      )}\n`,
      'package/LICENSE': 'MIT\n',
      'package/THIRD_PARTY_NOTICES.md': '# Third-Party Notices\n',
      'package/README.md': '# @kunstmusik/blue-data\n',
      'package/unexpected-extra.txt': 'extra\n',
    });
    const rebuiltBytes = readFileSync(dataPath).length;
    const rebuiltSha256 = createHash('sha256').update(readFileSync(dataPath)).digest('hex');
    const rebuiltIntegrity = computeIntegrity(dataPath);

    const staleInventoryManifest = {
      ...manifest,
      packages: [
        {
          ...manifest.packages[0],
          bytes: rebuiltBytes,
          sha256: rebuiltSha256,
          integrity: rebuiltIntegrity,
        },
        manifest.packages[1],
      ],
    };
    await assert.rejects(
      async () => verifyReleaseManifest({ manifest: staleInventoryManifest, artifactsDir }),
      /inventory mismatch/i,
    );
  });
});

test('executeReleasePublish rejects malformed manifests and integrity mismatches before registry lookups or writes', async () => {
  await withTempDir('blue-npm-fail-before-registry-', async (artifactsDir) => {
    const { dataPath, cliPath } = createArchiveFixturePair(artifactsDir, { dataVersion: '0.1.0' });
    const manifest = await createReleaseManifest({
      dataPath,
      cliPath,
      version: '0.1.0',
      sourceRevision: VALID_SHA,
      distTag: 'latest',
    });

    const malformedCases = [
      { label: 'bad SemVer', mutated: { ...manifest, version: '01.0.0', tag: 'npm-v01.0.0' } },
      { label: 'mismatched distTag', mutated: { ...manifest, distTag: 'next' } },
      { label: 'mismatched tag', mutated: { ...manifest, tag: 'npm-v0.2.0' } },
      { label: 'mismatched isPrerelease', mutated: { ...manifest, isPrerelease: true } },
      {
        label: 'extra package record',
        mutated: {
          ...manifest,
          packages: [
            ...manifest.packages,
            { ...manifest.packages[0], role: 'extra', name: '@kunstmusik/extra' },
          ],
        },
      },
      {
        label: 'duplicate package record',
        mutated: {
          ...manifest,
          packages: [manifest.packages[0], { ...manifest.packages[0] }],
        },
      },
      {
        label: 'tampered file inventory',
        mutated: {
          ...manifest,
          packages: [
            {
              ...manifest.packages[0],
              files: ['LICENSE', 'MISSING.md', 'README.md', 'package.json'],
            },
            manifest.packages[1],
          ],
        },
      },
    ];

    for (const testCase of malformedCases) {
      let queryCalls = 0;
      let publishCalls = 0;
      await assert.rejects(
        async () =>
          executeReleasePublish({
            manifest: testCase.mutated,
            artifactsDir,
            queryRegistryIntegrity: async () => {
              queryCalls += 1;
              return null;
            },
            publishArchive: async () => {
              publishCalls += 1;
            },
          }),
        { name: 'Error' },
        `${testCase.label} should reject`,
      );
      assert.equal(queryCalls, 0, `${testCase.label} must not query npm registry`);
      assert.equal(publishCalls, 0, `${testCase.label} must not publish archives`);
    }

    // Mismatching expectedIntegrities must also fail before registry lookups or publish
    let expectedQueryCalls = 0;
    let expectedPublishCalls = 0;
    await assert.rejects(
      async () =>
        executeReleasePublish({
          manifest,
          artifactsDir,
          expectedVersion: '0.1.0',
          expectedTag: 'npm-v0.1.0',
          expectedRevision: VALID_SHA,
          expectedIntegrities: {
            data: 'sha512-wrongExpectedDigest==',
            cli: manifest.packages[1].integrity,
          },
          queryRegistryIntegrity: async () => {
            expectedQueryCalls += 1;
            return null;
          },
          publishArchive: async () => {
            expectedPublishCalls += 1;
          },
        }),
      /Expected SHA-512 integrity mismatch/i,
    );
    assert.equal(expectedQueryCalls, 0);
    assert.equal(expectedPublishCalls, 0);
  });
});

test('assertRegistryVersionsAbsent passes when absent and rejects with recovery link if already published', async () => {
  await assert.doesNotReject(async () =>
    assertRegistryVersionsAbsent({
      version: '0.1.0',
      queryRegistryIntegrity: async () => null,
    }),
  );

  await assert.rejects(
    async () =>
      assertRegistryVersionsAbsent({
        version: '0.1.0',
        queryRegistryIntegrity: async ({ name }) =>
          name === '@kunstmusik/blue-cli' ? 'sha512-existing==' : null,
      }),
    /@kunstmusik\/blue-cli@0\.1\.0.*docs\/npm-release-guide\.md/i,
  );
});

test('npm-release workflow keeps retained archives immutable across reruns and isolates trusted publishing', () => {
  const workflowPath = path.join(REPO_ROOT, '.github', 'workflows', 'npm-release.yml');
  const workflow = readFileSync(workflowPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  assert.equal(
    workflow.includes('overwrite: true'),
    false,
    'must not overwrite uploaded artifacts',
  );
  assert.equal(
    workflow.includes('overwrite: false'),
    true,
    'must retain uploaded archives immutably with overwrite: false',
  );
  assert.equal(
    workflow.includes('github.run_attempt > 1'),
    true,
    'tagged reruns must detect run_attempt > 1 and reuse retained archives',
  );
  assert.equal(
    workflow.includes('Refusing to re-pack an already-tagged release'),
    true,
    'missing retained artifact on tagged rerun must fail cleanly instead of re-packing',
  );
  assert.equal(
    workflow.includes('docs/npm-release-guide.md#failure-and-partial-release-recovery'),
    true,
  );
  assert.equal(workflow.includes('check-registry-absent'), true);
  assert.equal(workflow.includes('verify-npm-packages.test.mjs'), true);
  assert.equal(
    workflow.includes('artifact-name: ${{ steps.validate.outputs.artifact-name }}'),
    true,
  );
  assert.equal(
    workflow.includes('data-integrity: ${{ steps.prepare-archives.outputs.data-integrity }}'),
    true,
  );
  assert.equal(
    workflow.includes('cli-integrity: ${{ steps.prepare-archives.outputs.cli-integrity }}'),
    true,
  );
  assert.equal(
    workflow.match(/name:\s*\$\{\{\s*needs\.pack-and-validate\.outputs\.artifact-name\s*\}\}/g)
      ?.length,
    2,
    'both verify-consumers and publish-npm must download the exact artifact-name from pack-and-validate',
  );
  assert.equal(
    workflow.match(/--expected-data-integrity/g)?.length,
    3,
    'verify-consumers, publish-npm pre-verify, and publish-npm publish must all enforce expected data integrity',
  );
  assert.equal(
    workflow.match(/--expected-cli-integrity/g)?.length,
    3,
    'verify-consumers, publish-npm pre-verify, and publish-npm publish must all enforce expected cli integrity',
  );
  assert.equal(
    workflow.match(/id-token:\s*write/g)?.length,
    1,
    'id-token: write must appear exclusively inside publish-npm',
  );
  assert.equal(
    workflow.match(/environment:\s*npm-release/g)?.length,
    1,
    'environment: npm-release must appear exclusively inside publish-npm',
  );
});

test('consumer smoke writes and uploads the same matrix report and requires it on success', () => {
  const workflow = readFileSync(path.join(REPO_ROOT, '.github/workflows/npm-release.yml'), 'utf8');
  const consumers = workflow.split('  verify-consumers:\n')[1].split('  publish-npm:\n')[0];
  const [smoke, upload] = consumers.split('      - name: Upload consumer smoke report\n');
  assert.match(smoke, /id: smoke-report/);
  assert.ok(smoke.includes('SMOKE_REPORT: ${{ runner.temp }}/smoke-${{ matrix.target-id }}.json'));
  assert.ok(smoke.includes('--json "${SMOKE_REPORT}"'));
  assert.ok(smoke.includes('echo "path=${SMOKE_REPORT}" >> "$GITHUB_OUTPUT"'));
  assert.ok(upload.includes('path: ${{ steps.smoke-report.outputs.path }}'));
  assert.match(upload, /if-no-files-found: error/);
  assert.doesNotMatch(upload, /if: always\(\)/);
});
