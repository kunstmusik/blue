#!/usr/bin/env node
/**
 * Deterministic wrapper for the Java Blue automation parity fixture corpus.
 *
 * Modes:
 *   generate (default) - regenerate the committed corpus in place
 *   --check            - regenerate into a temporary directory and byte-compare
 *
 * Usage:
 *   node scripts/generate-java-blue-automation-fixtures.mjs --java-blue-root <path> [--check]
 *   pnpm fixtures:java-automation -- --java-blue-root "$JAVA_BLUE_ROOT"
 *   pnpm fixtures:java-automation:check -- --java-blue-root "$JAVA_BLUE_ROOT"
 *
 * The wrapper verifies the pinned Java Blue commit and source-file SHA-256
 * values recorded in the committed manifest, validates Java release 25, builds
 * the required Java Blue Maven reactor artifacts, compiles the generator under
 * tools/java-blue-automation-fixtures, and runs it against those artifacts.
 * Output contains no timestamp or machine-local metadata; regeneration at the
 * pinned revision is byte-identical.
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_DIR = path.join(REPO_ROOT, 'tools', 'java-blue-automation-fixtures');
const CORPUS_DIR = path.join(REPO_ROOT, 'fixtures', 'java-blue-automation-parity', 'v1');
const REQUIRED_JAVA_MAJOR = 25;
const OUTPUT_FILES = ['manifest.json', 'realtime.tsv', 'resolution.tsv', 'offline.tsv'];

function fail(message) {
  console.error(`[fixtures] ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { check: false, javaBlueRoot: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') {
      args.check = true;
    } else if (arg === '--java-blue-root') {
      args.javaBlueRoot = argv[++i];
      if (!args.javaBlueRoot) fail('--java-blue-root requires a path');
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  if (!args.javaBlueRoot) fail('--java-blue-root is required');
  args.javaBlueRoot = path.resolve(args.javaBlueRoot);
  return args;
}

function run(cmd, cmdArgs, options = {}) {
  const label = options.label ?? `${cmd} ${cmdArgs.join(' ')}`;
  try {
    return execFileSync(cmd, cmdArgs, {
      cwd: options.cwd ?? REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr) : '';
    fail(`command failed: ${label}\n${stderr}`);
  }
}

function validateJavaRelease() {
  const versionOutput = run('java', ['--version'], { label: 'java --version' });
  // "openjdk 25 2025-09-16 LTS" / "openjdk 25.0.1 2025-10-21"
  const match = versionOutput.match(/version\s+"?(\d+)/) ?? versionOutput.match(/^\S+\s+(\d+)/);
  const major = match ? Number(match[1]) : null;
  if (major !== REQUIRED_JAVA_MAJOR) {
    fail(
      `Java release ${REQUIRED_JAVA_MAJOR} is required for fixture schema v1; found: ${
        major ?? 'unknown'
      }`,
    );
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveCommit(javaBlueRoot) {
  if (!fs.existsSync(path.join(javaBlueRoot, '.git'))) {
    fail(`--java-blue-root is not a Git checkout: ${javaBlueRoot}`);
  }
  return run('git', ['rev-parse', 'HEAD'], {
    cwd: javaBlueRoot,
    label: 'git rev-parse HEAD',
  }).trim();
}

function verifyCheckoutProvenance(javaBlueRoot, manifest, commit) {
  if (commit !== manifest.javaBlue.commit) {
    fail(
      `Java Blue checkout commit mismatch\n  expected: ${manifest.javaBlue.commit}\n  actual:   ${commit}`,
    );
  }
  for (const entry of manifest.javaBlue.sourceFiles) {
    const filePath = path.join(javaBlueRoot, entry.path);
    if (!fs.existsSync(filePath)) {
      fail(`recorded source file missing from checkout: ${entry.path}`);
    }
    const digest = sha256File(filePath);
    if (digest !== entry.sha256) {
      fail(
        `source hash mismatch for ${entry.path}\n  expected: ${entry.sha256}\n  actual:   ${digest}`,
      );
    }
  }
}

function buildJavaBlue(javaBlueRoot) {
  run('mvn', ['-q', '-pl', 'blue-core,blue-ui-core', '-am', '-DskipTests', 'package'], {
    cwd: javaBlueRoot,
    label: 'mvn package blue-core,blue-ui-core',
  });
}

function javaBlueClasspath(javaBlueRoot) {
  const parts = [];
  for (const module of ['blue-core', 'blue-ui-core']) {
    const moduleDir = path.join(javaBlueRoot, module);
    const classesDir = path.join(moduleDir, 'target', 'classes');
    if (!fs.existsSync(classesDir)) {
      fail(`missing built classes for ${module}: ${classesDir}`);
    }
    parts.push(classesDir);
    const cpFile = path.join(moduleDir, 'target', 'classpath.txt');
    run(
      'mvn',
      [
        '-q',
        `dependency:build-classpath`,
        `-Dmdep.outputFile=${cpFile}`,
        `-Dmdep.pathSeparator=${path.delimiter}`,
      ],
      { cwd: moduleDir, label: `mvn dependency:build-classpath (${module})` },
    );
    const cp = fs.readFileSync(cpFile, 'utf8').trim();
    if (cp) parts.push(cp);
  }
  return parts.join(path.delimiter);
}

function compileGenerator(classpath) {
  const srcDir = path.join(TOOL_DIR, 'src', 'main', 'java');
  const outDir = path.join(TOOL_DIR, 'target', 'classes');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const sources = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.java')) sources.push(full);
    }
  })(srcDir);
  if (sources.length === 0) fail(`no generator sources under ${srcDir}`);
  run(
    'javac',
    ['--release', '25', '-encoding', 'UTF-8', '-cp', classpath, '-d', outDir, ...sources],
    {
      label: 'javac fixture generator',
    },
  );
  return outDir;
}

function runGenerator(classpath, generatorClasses, outputDir, javaBlueRoot, commit) {
  fs.mkdirSync(outputDir, { recursive: true });
  run(
    'java',
    [
      '-cp',
      [generatorClasses, classpath].join(path.delimiter),
      'blue.parity.FixtureGenerator',
      '--output',
      outputDir,
      '--java-blue-root',
      javaBlueRoot,
      '--commit',
      commit,
    ],
    { label: 'run fixture generator' },
  );
  for (const name of OUTPUT_FILES) {
    if (!fs.existsSync(path.join(outputDir, name))) {
      fail(`generator did not produce ${name}`);
    }
  }
}

function assertDeterministicContent(outputDir) {
  for (const name of OUTPUT_FILES) {
    const text = fs.readFileSync(path.join(outputDir, name), 'utf8');
    if (text.includes(REPO_ROOT)) {
      fail(`${name} contains the absolute checkout path; generation must be machine-local free`);
    }
    if (name.endsWith('.tsv') && (text.includes('\r') || text.charCodeAt(0) === 0xfeff)) {
      fail(`${name} must use LF endings without a BOM`);
    }
  }
}

function compareDirectories(actualDir, expectedDir) {
  for (const name of OUTPUT_FILES) {
    const actual = fs.readFileSync(path.join(actualDir, name));
    const expected = fs.readFileSync(path.join(expectedDir, name));
    if (!actual.equals(expected)) {
      fail(
        `corpus is not byte-identical for ${name}.\n  regenerated: ${path.join(actualDir, name)}\n  committed:  ${path.join(expectedDir, name)}`,
      );
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.join(CORPUS_DIR, 'manifest.json');
  const bootstrapping = !fs.existsSync(manifestPath);
  const manifest = bootstrapping ? null : JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (bootstrapping && args.check) {
    fail('check mode requires a committed manifest; run generation first to pin the corpus');
  }

  validateJavaRelease();
  const commit = resolveCommit(args.javaBlueRoot);
  if (bootstrapping) {
    console.log(
      '[fixtures] bootstrap: no committed manifest found; pinning this checkout as the corpus reference',
    );
  } else {
    verifyCheckoutProvenance(args.javaBlueRoot, manifest, commit);
  }
  buildJavaBlue(args.javaBlueRoot);
  const classpath = javaBlueClasspath(args.javaBlueRoot);
  const generatorClasses = compileGenerator(classpath);

  if (args.check) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'java-parity-fixtures-'));
    try {
      runGenerator(classpath, generatorClasses, tempDir, args.javaBlueRoot, commit);
      assertDeterministicContent(tempDir);
      compareDirectories(tempDir, CORPUS_DIR);
      console.log('[fixtures] check passed: regenerated corpus is byte-identical');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } else {
    const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'java-parity-fixtures-'));
    try {
      runGenerator(classpath, generatorClasses, stagingDir, args.javaBlueRoot, commit);
      assertDeterministicContent(stagingDir);
      for (const name of OUTPUT_FILES) {
        fs.copyFileSync(path.join(stagingDir, name), path.join(CORPUS_DIR, name));
      }
      console.log(
        `[fixtures] regenerated corpus written to ${path.relative(REPO_ROOT, CORPUS_DIR)}`,
      );
    } finally {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
  }
}

main();
