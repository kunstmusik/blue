#!/usr/bin/env node
/**
 * Example: inspect a `.blue` project, update its title, save a copy, and reload to verify.
 *
 * Usage:
 *   node inspect-edit.mjs <input.blue> <output.blue> [new-title]
 */

import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { readProjectXml } from '@kunstmusik/blue-data';

const DEFAULT_TITLE = 'Updated Blue Project';

function printUsage() {
  process.stderr.write('Usage: node inspect-edit.mjs <input.blue> <output.blue> [new-title]\n');
}

function formatDiagnostic(diagnostic) {
  const colSuffix = diagnostic.column !== undefined ? `:${diagnostic.column}` : '';
  const location = diagnostic.line !== undefined ? ` (line ${diagnostic.line}${colSuffix})` : '';
  const value =
    diagnostic.value === undefined ? '' : ` Value: ${JSON.stringify(diagnostic.value)}.`;
  const prefix = `[${diagnostic.severity} ${diagnostic.code}] ${diagnostic.source.label}${location}`;
  return `${prefix}: ${diagnostic.path}: ${diagnostic.message}${value} ${diagnostic.recovery}\n`;
}

function surfaceDiagnostics(diagnostics) {
  for (const diagnostic of diagnostics) {
    process.stderr.write(formatDiagnostic(diagnostic));
  }
}

function isSameFile(inputPath, outputPath) {
  if (inputPath === outputPath) {
    return true;
  }

  try {
    const inputStat = statSync(inputPath);
    const outputStat = statSync(outputPath);
    if (inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) {
      return true;
    }
    return realpathSync(inputPath) === realpathSync(outputPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function main() {
  const [inputArg, outputArg, newTitleArg] = process.argv.slice(2);
  if (!inputArg || !outputArg) {
    printUsage();
    process.exit(1);
  }

  const nextTitle = newTitleArg ?? DEFAULT_TITLE;
  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(outputArg);

  if (isSameFile(inputPath, outputPath)) {
    process.stderr.write(
      `Refusing to overwrite input project (${inputPath}); pass a separate output path.\n`,
    );
    process.exit(1);
  }

  const xml = readFileSync(inputPath, 'utf8');
  const report = readProjectXml(xml, {
    kind: 'project',
    label: inputPath,
    nativePath: inputPath,
  });
  surfaceDiagnostics(report.diagnostics);
  if (!report.ok) {
    if (report.diagnostics.length === 0) {
      process.stderr.write(`Failed to load project: ${inputPath}\n`);
    }
    process.exit(1);
  }

  const project = report.value;
  const currentTitle = project.getProjectProperties().title;
  process.stdout.write(`Title: ${currentTitle || '(untitled)'}\n`);
  process.stdout.write(`Version: ${project.getVersion()}\n`);
  process.stdout.write(`Score layer groups: ${project.getScore().length}\n`);

  project.getProjectProperties().title = nextTitle;

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, project.saveToString(), 'utf8');

  const reloadedXml = readFileSync(outputPath, 'utf8');
  const reloaded = readProjectXml(reloadedXml, {
    kind: 'project',
    label: outputPath,
    nativePath: outputPath,
  });
  surfaceDiagnostics(reloaded.diagnostics);
  if (!reloaded.ok) {
    if (reloaded.diagnostics.length === 0) {
      process.stderr.write(`Failed to reload saved project: ${outputPath}\n`);
    }
    process.exit(1);
  }

  const verifiedTitle = reloaded.value.getProjectProperties().title;
  if (verifiedTitle !== nextTitle) {
    process.stderr.write(
      `Verification failed: expected ${JSON.stringify(nextTitle)}, got ${JSON.stringify(verifiedTitle)}.\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `Verified updated title ${JSON.stringify(verifiedTitle)} in ${outputPath}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
