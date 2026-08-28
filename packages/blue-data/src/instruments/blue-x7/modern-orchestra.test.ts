import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderGeneratedModule } from '../../../scripts/generate-blue-x7-modern-orchestra.mjs';
import { BLUE_X7_MODERN_ORCHESTRA } from './modern-orchestra.generated';

// Test-only host access (fs/path) to audit repository resources; production
// @blue/data source stays browser-safe. This mirrors the established pattern
// in blue-data-csd-parity.test.ts.
const PACKAGE_ROOT = path.join(__dirname, '..', '..', '..');
const RESOURCE_DIR = path.join(PACKAGE_ROOT, 'resources', 'blue-x7-modern');
const ORC_PATH = path.join(RESOURCE_DIR, 'bluex7.orc');
const PROVENANCE_PATH = path.join(RESOURCE_DIR, 'provenance.json');
const GENERATED_PATH = path.join(
  PACKAGE_ROOT,
  'src',
  'instruments',
  'blue-x7',
  'modern-orchestra.generated.ts',
);

const PINNED_BASELINE_SHA256 =
  '2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda';

/** The only files allowed under resources/blue-x7-modern/. */
const ALLOWED_RESOURCE_FILES = new Set([
  'bluex7.orc',
  'ATTRIBUTION.md',
  'provenance.json',
  path.join('LICENSES', 'Apache-2.0.txt'),
]);

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('modern BlueX7 orchestra artifact', () => {
  it('exports the maintained orchestra byte-for-byte', () => {
    const orc = fs.readFileSync(ORC_PATH, 'utf8');
    expect(BLUE_X7_MODERN_ORCHESTRA).toBe(orc);
  });

  it('generated module is not stale against the maintained source', () => {
    const orc = fs.readFileSync(ORC_PATH, 'utf8');
    const expected = renderGeneratedModule(orc, sha256(orc));
    const actual = fs.readFileSync(GENERATED_PATH, 'utf8');
    expect(actual).toBe(expected);
  });

  it('provenance.json records the pinned imported baseline digest', () => {
    const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'));
    expect(provenance.baseline.sha256).toBe(PINNED_BASELINE_SHA256);
    expect(provenance.precursor.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(provenance.precursor.reviewedReport.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('provenance.json current digests match the files on disk', () => {
    const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'));
    const orc = fs.readFileSync(ORC_PATH, 'utf8');
    const generated = fs.readFileSync(GENERATED_PATH, 'utf8');
    expect(provenance.current.orchestra.sha256).toBe(sha256(orc));
    expect(provenance.current.generatedModule.sha256).toBe(sha256(generated));
  });

  it('generation and artifacts never reference the transient precursor checkout', () => {
    const scriptPath = path.join(
      PACKAGE_ROOT,
      'scripts',
      'generate-blue-x7-modern-orchestra.mjs',
    );
    const script = fs.readFileSync(scriptPath, 'utf8');
    const generated = fs.readFileSync(GENERATED_PATH, 'utf8');
    const orc = fs.readFileSync(ORC_PATH, 'utf8');
    // Naming the precursor in provenance prose is fine; a filesystem path
    // into the transient checkout (a build/runtime dependency) is not.
    for (const text of [script, generated, orc]) {
      expect(text).not.toContain('/csound/');
      expect(text).not.toContain('~/work/');
      expect(text).not.toMatch(/dx7-emulation[\/"]/);
    }
  });

  it('resource directory contains no ROM, demo, render, or unrelated precursor files', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relative = path.relative(RESOURCE_DIR, path.join(dir, entry.name));
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name));
        } else {
          found.push(relative.split(path.sep).join('/'));
        }
      }
    };
    walk(RESOURCE_DIR);
    expect(found.sort()).toEqual([...ALLOWED_RESOURCE_FILES].sort());
    for (const file of found) {
      expect(file).not.toMatch(/\.(syx|wav|aif|aiff|mp3|bin|mid|midi)$/i);
    }
  });

  it('provenance.json keeps attribution and license records', () => {
    const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'));
    expect(provenance.attribution.incorporated.length).toBeGreaterThan(0);
    for (const source of provenance.attribution.incorporated) {
      expect(source.licenseFile).toBeTruthy();
      const licensePath = path.join(RESOURCE_DIR, source.licenseFile);
      expect(fs.existsSync(licensePath)).toBe(true);
    }
    const attribution = fs.readFileSync(path.join(RESOURCE_DIR, 'ATTRIBUTION.md'), 'utf8');
    expect(attribution).toContain('msfa');
    expect(attribution).toContain(PINNED_BASELINE_SHA256);
  });
});
