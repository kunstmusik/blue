import { isDeepStrictEqual } from 'node:util';
import { STRICT_SEMVER_NO_BUILD } from './verify-npm-packages.mjs';

export const SITE_PREFIX = '/blue/';
export const SECTION_MANUAL = 'manual';
export const SECTION_CLI = 'cli';
export const SECTION_API_BLUE_DATA = 'api/blue-data';
export const SITE_SECTIONS = Object.freeze([SECTION_MANUAL, SECTION_CLI, SECTION_API_BLUE_DATA]);

const FULL_SHA = /^[0-9a-f]{40}$/i;
const ROUTE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SRI = /^sha(?:1|256|384|512)-[A-Za-z0-9+/]+=*$/;
const DESKTOP_CHANNELS = new Set(['stable', 'prerelease', 'preview']);
const TOOLING_CHANNELS = new Set(['stable', 'prerelease']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, context) {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }
}

function requireFields(value, context, { required, optional = [] }) {
  requireRecord(value, context);
  const allowed = new Set([...required, ...optional]);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      throw new Error(`${context} has unexpected field ${JSON.stringify(field)}.`);
    }
  }
  for (const field of required) {
    if (!Object.hasOwn(value, field)) {
      throw new Error(`${context} is missing required field ${JSON.stringify(field)}.`);
    }
  }
}

function requireNonEmptyString(value, context) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context} must be a non-empty string.`);
  }
}

function requireRouteSegment(value, context) {
  requireNonEmptyString(value, context);
  if (!ROUTE_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`${context} must be a safe URL path segment.`);
  }
}

function requireSha(value, context) {
  if (typeof value !== 'string' || !FULL_SHA.test(value)) {
    throw new Error(`${context} must be a full 40-character sourceSha.`);
  }
}

function validateDesktopEdition(edition, index) {
  const context = `desktop[${index}]`;
  requireFields(edition, context, {
    required: ['key', 'channel', 'label', 'sourceSha'],
    optional: ['tag'],
  });
  requireRouteSegment(edition.key, `${context}.key`);
  if (!DESKTOP_CHANNELS.has(edition.channel)) {
    throw new Error(`${context}.channel must be stable, prerelease, or preview.`);
  }
  requireNonEmptyString(edition.label, `${context}.label`);
  requireSha(edition.sourceSha, `${context}.sourceSha`);

  if (edition.channel === 'preview') {
    if (Object.hasOwn(edition, 'tag')) {
      throw new Error(`${context}.tag must be omitted for a source-only preview.`);
    }
    const expectedKey = `preview-${edition.sourceSha.slice(0, 12)}`;
    if (edition.key !== expectedKey) {
      throw new Error(
        `${context}.key must be ${JSON.stringify(expectedKey)} for this source preview.`,
      );
    }
    if (!/preview/i.test(edition.label)) {
      throw new Error(`${context}.label must identify this edition as Preview.`);
    }
  } else if (edition.tag !== edition.key) {
    throw new Error(`${context}.tag must equal its desktop key.`);
  }

  return edition.key;
}

function validateToolingIntegrity(integrity, context) {
  requireFields(integrity, context, {
    required: ['cli', 'data', 'verification'],
  });
  for (const field of ['cli', 'data']) {
    if (typeof integrity[field] !== 'string' || !SRI.test(integrity[field])) {
      throw new Error(`${context}.${field} must be a registry integrity value.`);
    }
  }
  requireNonEmptyString(integrity.verification, `${context}.verification`);
  let verificationUrl;
  try {
    verificationUrl = new URL(integrity.verification);
  } catch {
    throw new Error(`${context}.verification must be an HTTP or HTTPS URL.`);
  }
  if (verificationUrl.protocol !== 'http:' && verificationUrl.protocol !== 'https:') {
    throw new Error(`${context}.verification must be an HTTP or HTTPS URL.`);
  }
}

function validateToolingEdition(edition, index) {
  const context = `tooling[${index}]`;
  requireFields(edition, context, {
    required: ['version', 'channel', 'sourceSha', 'tag'],
    optional: ['integrity'],
  });
  if (typeof edition.version !== 'string' || !STRICT_SEMVER_NO_BUILD.test(edition.version)) {
    throw new Error(`${context}.version must be a valid SemVer version without build metadata.`);
  }
  if (!TOOLING_CHANNELS.has(edition.channel)) {
    throw new Error(`${context}.channel must be stable or prerelease.`);
  }
  if ((edition.channel === 'prerelease') !== edition.version.includes('-')) {
    throw new Error(`${context}.channel does not match the tooling version.`);
  }
  requireSha(edition.sourceSha, `${context}.sourceSha`);
  if (edition.tag !== `npm-v${edition.version}`) {
    throw new Error(`${context}.tag must equal npm-v${edition.version}.`);
  }
  if (Object.hasOwn(edition, 'integrity')) {
    validateToolingIntegrity(edition.integrity, `${context}.integrity`);
  }

  return edition.version;
}

/** Validate the maintainer-reviewed catalog and return it without changing it. */
export function validateCatalog(catalog) {
  requireFields(catalog, 'catalog', {
    required: ['desktop', 'tooling', 'recommended'],
  });
  if (!Array.isArray(catalog.desktop) || catalog.desktop.length === 0) {
    throw new Error('catalog.desktop must contain at least one edition.');
  }
  if (!Array.isArray(catalog.tooling)) {
    throw new Error('catalog.tooling must be an array.');
  }

  const desktopKeys = new Set();
  for (let index = 0; index < catalog.desktop.length; index += 1) {
    const key = validateDesktopEdition(catalog.desktop[index], index);
    if (desktopKeys.has(key)) {
      throw new Error(`Duplicate desktop key and route ${JSON.stringify(key)}.`);
    }
    desktopKeys.add(key);
  }

  const toolingVersions = new Set();
  for (let index = 0; index < catalog.tooling.length; index += 1) {
    const version = validateToolingEdition(catalog.tooling[index], index);
    if (toolingVersions.has(version)) {
      throw new Error(`Duplicate tooling version and route ${JSON.stringify(version)}.`);
    }
    toolingVersions.add(version);
  }

  requireFields(catalog.recommended, 'catalog.recommended', {
    required: ['desktop'],
    optional: ['tooling'],
  });
  requireNonEmptyString(catalog.recommended.desktop, 'catalog.recommended.desktop');
  if (!desktopKeys.has(catalog.recommended.desktop)) {
    throw new Error(
      `catalog.recommended.desktop must reference a registered desktop key, got ${JSON.stringify(catalog.recommended.desktop)}.`,
    );
  }

  if (toolingVersions.size === 0) {
    if (Object.hasOwn(catalog.recommended, 'tooling')) {
      throw new Error('catalog.recommended.tooling must be omitted while tooling is pending.');
    }
  } else {
    requireNonEmptyString(catalog.recommended.tooling, 'catalog.recommended.tooling');
    if (!toolingVersions.has(catalog.recommended.tooling)) {
      throw new Error(
        `catalog.recommended.tooling must reference a registered tooling version, got ${JSON.stringify(catalog.recommended.tooling)}.`,
      );
    }
  }

  return catalog;
}

/** Derive every stable publication route from the catalog's pinned editions. */
export function publicationInventory(catalog) {
  validateCatalog(catalog);

  return [
    ...catalog.desktop.map((edition) => ({
      section: SECTION_MANUAL,
      editionKey: edition.key,
      fixedUrl: `${SITE_PREFIX}${SECTION_MANUAL}/${edition.key}/`,
      sourceSha: edition.sourceSha,
    })),
    ...catalog.tooling.flatMap((edition) => [
      {
        section: SECTION_CLI,
        editionKey: edition.version,
        fixedUrl: `${SITE_PREFIX}${SECTION_CLI}/${edition.version}/`,
        sourceSha: edition.sourceSha,
      },
      {
        section: SECTION_API_BLUE_DATA,
        editionKey: edition.version,
        fixedUrl: `${SITE_PREFIX}${SECTION_API_BLUE_DATA}/${edition.version}/`,
        sourceSha: edition.sourceSha,
      },
    ]),
  ];
}

function inventoryIdentity(entry) {
  return `${entry.section}\0${entry.editionKey}`;
}

function validateInventory(inventory, context) {
  if (!Array.isArray(inventory)) {
    throw new Error(`${context} must be an array.`);
  }
  const identities = new Set();
  const routes = new Set();
  for (let index = 0; index < inventory.length; index += 1) {
    const entry = inventory[index];
    const entryContext = `${context}[${index}]`;
    requireFields(entry, entryContext, {
      required: ['section', 'editionKey', 'fixedUrl', 'sourceSha'],
    });
    if (!SITE_SECTIONS.includes(entry.section)) {
      throw new Error(`${entryContext}.section is not a supported documentation section.`);
    }
    requireRouteSegment(entry.editionKey, `${entryContext}.editionKey`);
    if (entry.fixedUrl !== `${SITE_PREFIX}${entry.section}/${entry.editionKey}/`) {
      throw new Error(`${entryContext}.fixedUrl does not match its section and edition key.`);
    }
    requireSha(entry.sourceSha, `${entryContext}.sourceSha`);

    const identity = inventoryIdentity(entry);
    if (identities.has(identity)) {
      throw new Error(
        `${context} contains duplicate edition ${entry.section}/${entry.editionKey}.`,
      );
    }
    if (routes.has(entry.fixedUrl)) {
      throw new Error(`${context} contains duplicate route ${entry.fixedUrl}.`);
    }
    identities.add(identity);
    routes.add(entry.fixedUrl);
  }
  return inventory;
}

/** Require every previously published route and its source revision to remain unchanged. */
export function assertRetained(previousInventory, candidateInventory) {
  validateInventory(previousInventory, 'previous inventory');
  validateInventory(candidateInventory, 'candidate inventory');
  const candidateByIdentity = new Map(
    candidateInventory.map((entry) => [inventoryIdentity(entry), entry]),
  );

  for (const previous of previousInventory) {
    const candidate = candidateByIdentity.get(inventoryIdentity(previous));
    if (!candidate) {
      throw new Error(
        `Previously published route ${previous.fixedUrl} was removed from the candidate inventory.`,
      );
    }
    if (candidate.fixedUrl !== previous.fixedUrl) {
      throw new Error(
        `Previously published route ${previous.fixedUrl} changed to ${candidate.fixedUrl}.`,
      );
    }
    if (candidate.sourceSha !== previous.sourceSha) {
      throw new Error(
        `Previously published source revision for ${previous.fixedUrl} changed from ${previous.sourceSha} to ${candidate.sourceSha}.`,
      );
    }
  }
}

function rowIdentity(series, row) {
  return series === 'desktop' ? row.key : row.version;
}

function changedField(previous, candidate) {
  for (const field of new Set([...Object.keys(previous), ...Object.keys(candidate)])) {
    if (!isDeepStrictEqual(previous[field], candidate[field])) {
      return field;
    }
  }
  return null;
}

/** Require existing catalog rows to remain unchanged while permitting pointer moves and appended editions. */
export function assertRetainedCatalog(previousCatalog, candidateCatalog) {
  validateCatalog(previousCatalog);
  validateCatalog(candidateCatalog);

  for (const series of ['desktop', 'tooling']) {
    const previousRows = previousCatalog[series];
    const candidateRows = candidateCatalog[series];
    for (let index = 0; index < previousRows.length; index += 1) {
      const previous = previousRows[index];
      const identity = rowIdentity(series, previous);
      const candidate = candidateRows[index];
      if (!candidate) {
        throw new Error(`Previously published ${series} edition ${identity} was removed.`);
      }
      if (rowIdentity(series, candidate) !== identity) {
        throw new Error(
          `Previously published ${series} edition ${identity} changed position or was replaced; append new editions after existing rows.`,
        );
      }
      const field = changedField(previous, candidate);
      if (field) {
        throw new Error(
          `Previously published ${series} edition ${identity} field ${JSON.stringify(field)} changed.`,
        );
      }
    }
  }
}
