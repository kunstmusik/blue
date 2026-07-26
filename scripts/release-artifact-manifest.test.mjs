#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const manifestScript = join(scriptDir, "release-artifact-manifest.mjs");
const fixtureDir = mkdtempSync(join(tmpdir(), "blue-release-manifest-"));
const manifestPath = join(fixtureDir, "release-manifest.json");
const checksumPath = join(fixtureDir, "checksums-sha256.txt");
const appVersion = "1.2.3";
const sourceRevision = "a".repeat(40);

const bundleFiles = {
  [`blue-macos-arm64-${appVersion}.zip`]: "MAC-A",
  [`blue-windows-x64-${appVersion}.zip`]: "WIN-A",
  [`blue-linux-x64-${appVersion}.zip`]: "LINUX",
};

function run(args) {
  return spawnSync(process.execPath, [manifestScript, ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validate() {
  return run([
    "validate",
    "--manifest",
    manifestPath,
    "--asset-mode",
    "bundles",
    "--require-verified",
    "--app-version",
    appVersion,
    "--source-revision",
    sourceRevision,
    "--expected-targets",
    "macos-arm64,windows-x64,linux-x64",
  ]);
}

try {
  for (const [name, contents] of Object.entries(bundleFiles)) {
    writeFileSync(join(fixtureDir, name), contents);
  }

  const generated = run([
    "generate",
    "--out",
    manifestPath,
    "--release-dir",
    fixtureDir,
    "--checksums-out",
    checksumPath,
    "--asset-mode",
    "bundles",
    "--verification-status",
    "verified",
    "--app-version",
    appVersion,
    "--source-revision",
    sourceRevision,
  ]);
  assert(
    generated.status === 0,
    `bundle manifest generation failed:\n${generated.stderr}`,
  );

  const valid = validate();
  assert(
    valid.status === 0,
    `valid bundle manifest was rejected:\n${valid.stderr}`,
  );

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  assert(
    manifest.targets.every(
      (target) => target.verificationStatus === "verified",
    ),
    "generated stable entries must be verified",
  );
  assert(
    manifest.targets.every(
      (target) => target.path === target.path.split("/").at(-1),
    ),
    "manifest paths must be portable file names",
  );

  const macBundlePath = join(fixtureDir, `blue-macos-arm64-${appVersion}.zip`);
  writeFileSync(macBundlePath, "MAC-B");
  const tampered = validate();
  assert(tampered.status === 1, "tampered bundle must fail validation");
  assert(
    tampered.stderr.includes("sha256 does not match"),
    "tampered bundle failure must identify checksum mismatch",
  );
  writeFileSync(
    macBundlePath,
    bundleFiles[`blue-macos-arm64-${appVersion}.zip`],
  );

  manifest.targets[0].verificationStatus = "pending";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const pending = validate();
  assert(pending.status === 1, "pending bundle must fail stable validation");
  assert(
    pending.stderr.includes('verificationStatus must be "verified"'),
    "pending status failure must be actionable",
  );
  manifest.targets[0].verificationStatus = "verified";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const originalMacPath = manifest.targets[0].path;
  manifest.targets[0].path = `blue-windows-x64-${appVersion}.zip`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const mismatchedPath = validate();
  assert(
    mismatchedPath.status === 1,
    "bundle assigned to the wrong target must fail validation",
  );
  assert(
    mismatchedPath.stderr.includes("required stable ZIP name"),
    "wrong-target bundle failure must identify the filename mismatch",
  );
  manifest.targets[0].path = originalMacPath;

  manifest.targets[0].arch = "x64";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const mismatchedArchitecture = validate();
  assert(
    mismatchedArchitecture.status === 1,
    "incorrect target architecture must fail validation",
  );
  assert(
    mismatchedArchitecture.stderr.includes('architecture must be "arm64"'),
    "architecture failure must identify the required value",
  );
  manifest.targets[0].arch = "arm64";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  writeFileSync(
    join(fixtureDir, `blue-unexpected-x64-${appVersion}.zip`),
    "EXTRA",
  );
  const unexpected = validate();
  assert(
    unexpected.status === 1,
    "unexpected bundle must fail stable validation",
  );
  assert(
    unexpected.stderr.includes("Unexpected release ZIP"),
    "unexpected bundle failure must name the extra asset",
  );

  process.stderr.write(
    "PASS release artifact manifest generation and validation\n",
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}
