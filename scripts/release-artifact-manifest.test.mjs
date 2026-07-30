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

const packageFiles = {
  [`blue-macos-arm64-${appVersion}.dmg`]: "MAC-A",
  [`blue-windows-x64-${appVersion}.exe`]: "WIN-A",
  [`blue-linux-x64-${appVersion}.AppImage`]: "APPIMAGE-A",
  [`blue-linux-x64-${appVersion}.deb`]: "DEB-A",
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
    "packages",
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
  for (const [name, contents] of Object.entries(packageFiles)) {
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
    "packages",
    "--verification-status",
    "verified",
    "--app-version",
    appVersion,
    "--source-revision",
    sourceRevision,
  ]);
  assert(
    generated.status === 0,
    `package manifest generation failed:\n${generated.stderr}`,
  );

  const valid = validate();
  assert(
    valid.status === 0,
    `valid package manifest was rejected:\n${valid.stderr}`,
  );

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  assert(
    manifest.targets.length === 4,
    `native package manifest must contain four entries, found ${manifest.targets.length}`,
  );
  assert(
    manifest.targets
      .map((target) => target.format)
      .sort()
      .join(",") === "AppImage,DMG,Deb,NSIS",
    "native package manifest must describe the DMG, NSIS, AppImage, and Deb assets",
  );
  assert(
    manifest.targets.every(
      (target) => target.verificationStatus === "verified",
    ),
    "generated stable entries must be verified",
  );
  assert(
    manifest.engine?.protocolVersion === 1 &&
      manifest.engine?.sourceRevision === sourceRevision &&
      manifest.engine?.verificationStatus === "verified",
    "manifest must record verified revision-matched Blue Engine protocol metadata",
  );
  assert(
    manifest.targets.every(
      (target) => target.path === target.path.split("/").at(-1),
    ),
    "manifest paths must be portable file names",
  );

  const macPackagePath = join(fixtureDir, `blue-macos-arm64-${appVersion}.dmg`);
  writeFileSync(macPackagePath, "MAC-B");
  const tampered = validate();
  assert(tampered.status === 1, "tampered package must fail validation");
  assert(
    tampered.stderr.includes("sha256 does not match"),
    "tampered package failure must identify checksum mismatch",
  );
  writeFileSync(
    macPackagePath,
    packageFiles[`blue-macos-arm64-${appVersion}.dmg`],
  );

  manifest.targets[0].verificationStatus = "pending";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const pending = validate();
  assert(pending.status === 1, "pending package must fail stable validation");
  assert(
    pending.stderr.includes('verificationStatus must be "verified"'),
    "pending status failure must be actionable",
  );
  manifest.targets[0].verificationStatus = "verified";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  manifest.engine.protocolVersion = 99;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const mismatchedEngineProtocol = validate();
  assert(
    mismatchedEngineProtocol.status === 1 &&
      mismatchedEngineProtocol.stderr.includes("engine protocolVersion"),
    "mismatched Blue Engine protocol metadata must fail stable validation",
  );
  manifest.engine.protocolVersion = 1;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

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

  const debTarget = manifest.targets.find((target) => target.format === "Deb");
  assert(debTarget, "generated package manifest must include a Debian target");
  manifest.targets.push({ ...debTarget });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const duplicateFormat = validate();
  assert(
    duplicateFormat.status === 1,
    "duplicate target formats must fail validation",
  );
  assert(
    duplicateFormat.stderr.includes("Duplicate target format entries"),
    "duplicate target failure must identify the repeated format",
  );
  manifest.targets.pop();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const debPackagePath = join(
    fixtureDir,
    `blue-linux-x64-${appVersion}.deb`,
  );
  rmSync(debPackagePath);
  const missingDeb = validate();
  assert(missingDeb.status === 1, "missing Debian package must fail validation");
  assert(
    missingDeb.stderr.includes("path is missing or unreachable"),
    "missing Debian package failure must identify the missing path",
  );
  writeFileSync(
    debPackagePath,
    packageFiles[`blue-linux-x64-${appVersion}.deb`],
  );

  const duplicateDebPath = join(fixtureDir, `Blue_${appVersion}_amd64.deb`);
  writeFileSync(duplicateDebPath, "DEB-B");
  const duplicateGeneration = run([
    "generate",
    "--out",
    join(fixtureDir, "duplicate-manifest.json"),
    "--release-dir",
    fixtureDir,
    "--asset-mode",
    "packages",
    "--verification-status",
    "verified",
    "--app-version",
    appVersion,
    "--source-revision",
    sourceRevision,
  ]);
  assert(
    duplicateGeneration.status === 1,
    "duplicate Debian packages must fail manifest generation",
  );
  assert(
    duplicateGeneration.stderr.includes("Duplicate linux-x64/Deb assets"),
    `duplicate Debian generation failure must identify the repeated package format:\n${duplicateGeneration.stderr}`,
  );

  process.stderr.write(
    "PASS release artifact manifest generation and validation\n",
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}
