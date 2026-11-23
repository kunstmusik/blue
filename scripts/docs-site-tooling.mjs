import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertPublishedTag } from './docs-site-release-source.mjs';

const packages = [
  ['data', '@kunstmusik/blue-data'],
  ['cli', '@kunstmusik/blue-cli'],
];
const sha512 = /^sha512-[A-Za-z0-9+/]{86}==$/;

async function fetchExactVersion(name, version) {
  const endpoint = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(`npm registry returned ${response.status} for ${name}@${version}`);
  return response.json();
}

async function getReleaseIntegrity(edition, repositoryRoot) {
  if (edition.integrity) return edition.integrity;
  const manifestPath = join(
    repositoryRoot,
    'docs',
    'site',
    'npm-release-manifests',
    `${edition.tag}.json`,
  );
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8').catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      throw new Error(
        `Missing retained release manifest or maintainer integrity evidence for ${edition.tag}`,
      );
    }),
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.tag !== edition.tag ||
    manifest.version !== edition.version ||
    manifest.sourceRevision !== edition.sourceSha
  ) {
    throw new Error(
      `Release manifest does not match the tag, version, and source revision for ${edition.tag}`,
    );
  }
  if (!Array.isArray(manifest.packages) || manifest.packages.length !== packages.length) {
    throw new Error(`Release manifest must contain the two packages for ${edition.tag}`);
  }
  const integrity = {};
  for (const [role, name] of packages) {
    const record = manifest.packages.find((item) => item.role === role);
    if (record?.name !== name || record.version !== edition.version) {
      throw new Error(`Release manifest is missing ${name}@${edition.version}`);
    }
    integrity[role] = record.integrity;
  }
  return integrity;
}

export async function admitToolingEdition({
  edition,
  checkout,
  repositoryRoot,
  fetchVersion = fetchExactVersion,
  checkTag = assertPublishedTag,
}) {
  const { tag, version } = edition;
  if (tag !== `npm-v${version}`) throw new Error(`Invalid npm tag for ${version}: ${tag}`);
  await checkTag(edition, checkout);

  for (const path of ['blue-data/typedoc.json', 'blue-data/README.md', 'blue-cli/README.md']) {
    await access(join(checkout, 'packages', ...path.split('/'))).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      throw new Error(`Tooling edition ${tag} is missing reference source packages/${path}`);
    });
  }
  const expectedIntegrity = await getReleaseIntegrity(edition, repositoryRoot);
  for (const [role, name] of packages) {
    const packagePath = join(checkout, 'packages', `blue-${role}`, 'package.json');
    const source = JSON.parse(await readFile(packagePath, 'utf8'));
    if (
      source.version !== version ||
      source.publishConfig?.name !== name ||
      source.publishConfig?.access !== 'public'
    ) {
      throw new Error(
        `Source package name, version, or access does not identify public ${name}@${version}`,
      );
    }
    const metadata = await fetchVersion(name, version);
    if (!metadata) throw new Error(`${name}@${version} is not public in the npm registry`);
    if (metadata.name !== name || metadata.version !== version) {
      throw new Error(`Unexpected npm registry name or version for ${name}@${version}`);
    }
    if (
      !sha512.test(expectedIntegrity[role]) ||
      metadata.dist?.integrity !== expectedIntegrity[role]
    ) {
      throw new Error(`Registry integrity mismatch for ${name}@${version}`);
    }
  }
}
