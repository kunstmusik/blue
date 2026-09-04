#!/usr/bin/env node
/**
 * Non-secret release credential preflight.
 *
 * Verifies that every credential/environment variable reserved for future
 * macOS and Windows signing paths is present and well-formed. Current Blue
 * release workflows publish unsigned packages by default, so this script is a
 * readiness check unless a future signed workflow makes it mandatory.
 * Reports only the missing/malformed variable NAMES - never their values.
 *
 * The preflight is split into platform scopes so a maintainer can run only
 * the relevant check locally:
 *
 *   node scripts/release-credential-preflight.mjs                 # all
 *   node scripts/release-credential-preflight.mjs --scope macos    # macOS only
 *   node scripts/release-credential-preflight.mjs --scope windows  # Windows only
 *   node scripts/release-credential-preflight.mjs --scope publish  # GitHub release publication only
 *
 * Exit codes:
 *   0 - every checked variable is present and well-formed.
 *   1 - one or more checked variables are missing or malformed.
 *   0 - same diagnostic output but the script does not fail when
 *        `--advisory` is passed. Use this mode for local visibility and
 *        unsigned-release verification.
 *
 * When `--emit-availability` is passed, the script additionally writes
 * `macos-signing-available` and `windows-signing-available` boolean lines
 * to the file at `$GITHUB_OUTPUT` so a future signed GitHub Actions workflow
 * can gate signing and signature-verification steps on the resolved
 * availability.
 *
 * SECURITY CONTRACT
 *   - The script reads environment variables to check presence/shape only.
 *   - It MUST NEVER print variable values, lengths, hashes, or substrings.
 *   - "Malformed" reports describe the expected shape (e.g. "non-empty",
 *     "starts with AC-", "UUID") without echoing the supplied value.
 *   - If a new variable is added, only its name and expected shape may be
 *     described in diagnostics.
 */

import { appendFileSync } from 'node:fs';

/**
 * @typedef {'macos' | 'windows' | 'publish'} PreflightScope
 */

/**
 * @typedef {{ ok: boolean, code: string, message: string }} CredentialDiagnostic
 */

/** @type {Record<string, (value: string) => boolean>} */
const VALIDATORS = {
  nonEmpty: (v) => v.length > 0,
  uuid: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  appleTeamId: (v) => /^[0-9A-Z]{10}$/.test(v),
  httpsUrl: (v) => /^https:\/\/[^\s]+$/.test(v),
}; /**
 * @param {{ name: string, validator?: (value: string) => boolean, requiredFor: string, guidance: string }} requirement
 * @returns {CredentialDiagnostic}
 */
function checkVariable(requirement) {
  const raw = process.env[requirement.name];
  // The presence check uses `name in process.env` so an explicitly empty
  // value still surfaces as "set but malformed" rather than "missing".
  const isSet = requirement.name in process.env;
  if (!isSet) {
    return {
      ok: false,
      code: 'MISSING',
      message: `${requirement.name}: required for ${requirement.requiredFor}. ${requirement.guidance}`,
    };
  }
  if (raw.length === 0) {
    return {
      ok: false,
      code: 'EMPTY',
      message: `${requirement.name}: set but empty. Required for ${requirement.requiredFor}. ${requirement.guidance}`,
    };
  }
  if (requirement.validator && !requirement.validator(raw)) {
    return {
      ok: false,
      code: 'MALFORMED',
      message: `${requirement.name}: set but does not match the expected shape. Required for ${requirement.requiredFor}. ${requirement.guidance}`,
    };
  }
  return {
    ok: true,
    code: 'OK',
    message: `${requirement.name}: present and well-formed. Scope: ${requirement.requiredFor}.`,
  };
}

/**
 * @param {PreflightScope} scope
 * @returns {CredentialDiagnostic[]}
 */
function runScope(scope) {
  /** @type {Array<{ name: string, validator?: (value: string) => boolean, for: string, guidance: string }>} */
  let requirements = [];
  if (scope === 'macos') {
    const guidance =
      'Set this only when preparing a future signed macOS release; current unsigned releases do not require it.';
    requirements = [
      { name: 'CSC_LINK', for: 'macOS signing', guidance },
      { name: 'CSC_KEY_PASSWORD', for: 'macOS signing', guidance },
      { name: 'APPLE_ID', for: 'macOS notarization', guidance },
      { name: 'APPLE_APP_SPECIFIC_PASSWORD', for: 'macOS notarization', guidance },
      {
        name: 'APPLE_TEAM_ID',
        validator: VALIDATORS.appleTeamId,
        for: 'macOS notarization',
        guidance,
      },
    ];
  } else if (scope === 'windows') {
    const guidance =
      'Set this only when preparing a future signed Windows release; current unsigned releases do not require it.';
    requirements = [
      {
        name: 'AZURE_CLIENT_ID',
        validator: VALIDATORS.uuid,
        for: 'Windows Azure OIDC signing',
        guidance,
      },
      {
        name: 'AZURE_TENANT_ID',
        validator: VALIDATORS.uuid,
        for: 'Windows Azure OIDC signing',
        guidance,
      },
      {
        name: 'AZURE_SUBSCRIPTION_ID',
        validator: VALIDATORS.uuid,
        for: 'Windows Azure OIDC signing',
        guidance,
      },
      {
        name: 'AZURE_TRUSTED_SIGNING_ENDPOINT',
        validator: VALIDATORS.httpsUrl,
        for: 'Windows signing',
        guidance,
      },
      { name: 'AZURE_TRUSTED_SIGNING_ACCOUNT', for: 'Windows signing', guidance },
      { name: 'AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE', for: 'Windows signing', guidance },
    ];
  } else if (scope === 'publish') {
    requirements = [
      {
        name: 'GH_TOKEN',
        for: 'GitHub release publication from local tooling',
        guidance:
          'Set this only for local publication or duplicate-release checks; GitHub Actions provides GITHUB_TOKEN automatically.',
      },
    ];
  }
  return requirements.map((req) =>
    checkVariable({
      name: req.name,
      validator: req.validator,
      requiredFor: req.for,
      guidance: req.guidance,
    }),
  );
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseFlags(argv) {
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = 'true';
      }
    }
  }
  return flags;
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const scopeFlag = flags.scope;
  const advisory = flags.advisory === 'true';
  const emitAvailability = flags['emit-availability'] === 'true';
  /** @type {PreflightScope[]} */
  const scopes =
    scopeFlag && scopeFlag !== 'true'
      ? /** @type {PreflightScope[]} */ ([scopeFlag])
      : ['macos', 'windows', 'publish'];

  /** @type {CredentialDiagnostic[]} */
  const diagnostics = [];
  /** @type {Record<PreflightScope, boolean>} */
  const scopeAvailability = { macos: true, windows: true, publish: true };
  for (const scope of scopes) {
    process.stderr.write(`\n== ${scope.toUpperCase()} ==\n`);
    const results = runScope(scope);
    for (const result of results) {
      process.stderr.write(`${result.ok ? '[ok]' : '[FAIL]'} (${result.code}) ${result.message}\n`);
      diagnostics.push(result);
      if (!result.ok) {
        scopeAvailability[scope] = false;
      }
    }
  }

  if (emitAvailability) {
    // Machine-readable availability flags for GitHub Actions job outputs.
    // Write to $GITHUB_OUTPUT when present ( Actions runners ), otherwise to
    // stderr so a local maintainer can still see the values.
    const outPath = process.env.GITHUB_OUTPUT;
    const lines = [
      `macos-signing-available=${scopeAvailability.macos ? 'true' : 'false'}`,
      `windows-signing-available=${scopeAvailability.windows ? 'true' : 'false'}`,
      `publish-available=${scopeAvailability.publish ? 'true' : 'false'}`,
    ];
    if (outPath) {
      try {
        for (const line of lines) {
          appendFileSync(outPath, `${line}\n`);
        }
      } catch (error) {
        process.stderr.write(
          `Failed to emit availability to GITHUB_OUTPUT: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
    } else {
      for (const line of lines) {
        process.stderr.write(`${line}\n`);
      }
    }
  }

  const failed = diagnostics.some((d) => !d.ok);
  if (failed) {
    if (advisory) {
      process.stderr.write(
        '\nCredential preflight reported missing/malformed values. Running in --advisory mode: ' +
          'continuing because current releases are unsigned by default.\n',
      );
      process.exit(0);
    }
    process.stderr.write(
      '\nCredential preflight failed. See the named variables above; do NOT log their values.\n',
    );
    process.exit(1);
  }
  process.stderr.write('\nCredential preflight passed.\n');
  process.exit(0);
}

main();
