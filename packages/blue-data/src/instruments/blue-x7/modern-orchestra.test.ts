import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderGeneratedModule } from '../../../scripts/generate-blue-x7-modern-orchestra.mjs';
import { BLUE_X7_MODERN_ORCHESTRA } from './modern-orchestra.generated';
import { BlueData } from '../../blue-data';
import { BlueX7 } from '../blue-x7';
import { TrackLayerGroup } from '../../score/track/track-layer-group';

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

const PINNED_BASELINE_SHA256 = '2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda';

/** The only files allowed under resources/blue-x7-modern/. */
const ALLOWED_RESOURCE_FILES = new Set([
  'bluex7.orc',
  'ATTRIBUTION.md',
  'provenance.json',
  'LICENSES/Apache-2.0.txt',
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
    const scriptPath = path.join(PACKAGE_ROOT, 'scripts', 'generate-blue-x7-modern-orchestra.mjs');
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
      expect(source.licenseSha256).toBe(
        createHash('sha256').update(fs.readFileSync(licensePath)).digest('hex'),
      );
    }
    expect(provenance.attribution.reconstructed.length).toBeGreaterThan(0);
    expect(provenance.attribution.referenceOnly.length).toBeGreaterThan(0);
    expect(provenance.blueModifications.length).toBeGreaterThanOrEqual(4);
    expect(
      provenance.blueModifications.every(
        (modification: { summary?: unknown; files?: unknown[] }) =>
          typeof modification.summary === 'string' &&
          modification.summary.length > 0 &&
          Array.isArray(modification.files) &&
          modification.files.length > 0,
      ),
    ).toBe(true);
    const attribution = fs.readFileSync(path.join(RESOURCE_DIR, 'ATTRIBUTION.md'), 'utf8');
    expect(attribution).toContain('msfa');
    expect(attribution).toContain(PINNED_BASELINE_SHA256);
  });
});

describe('generated CSD modern-module hygiene (Spec 092 FR-001)', () => {
  it('emits one shared modern module per render and no legacy dx701..dx732 bodies', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const arrangementX7 = new BlueX7();
    arrangementX7.setName('Regression X7');
    data.getArrangement().addInstrument(arrangementX7, '1');
    const group = new TrackLayerGroup();
    group.setUniqueId('regression-group');
    const track = group.newLayerAt(group.length);
    track.setUniqueId('regression-track');
    const trackX7 = new BlueX7();
    trackX7.setName('Regression X7');
    trackX7.setEnabled(true);
    track.setOwnedInstrument(trackX7);
    data.getScore().push(group);

    const { csdText, blueX7Bindings } = data.toRealtimePlaybackCSD();
    expect(blueX7Bindings).toHaveLength(2);

    // The shared modern synthesis module is emitted exactly once per render.
    expect(csdText.match(/; bluex7\.orc — BlueX7 modern synthesis module/g)).toHaveLength(1);
    expect(csdText.match(/opcode bluex7_voice/g)).toHaveLength(1);
    // Each instance still gets its own generated inline host body. The live
    // target deliberately does not cross the UDO boundary, so there are no
    // per-note UDO argument arrays to marshal.
    expect(csdText.match(/aout = aOut/g)).toHaveLength(2);
    // Direct chnexport globals are the live interface; no transport table or
    // per-note table publication remains in generated CSD.
    expect(csdText).not.toContain('tabw');
    expect(csdText).not.toContain('chnget');
    expect(csdText).toContain('kBlueX7CoordinatorChanged changed');
    const coordinator = csdText.match(/kBlueX7CoordinatorChanged changed ([^\n]+)/);
    expect(coordinator).not.toBeNull();
    expect(coordinator![1].split(', ')).toHaveLength(15);
    expect(coordinator![1]).toContain('gk_blue_auto1');
    expect(coordinator![1]).toContain('gk_blue_auto35');
    expect(coordinator![1]).not.toContain('gk_blue_auto0');
    expect(coordinator![1]).not.toContain('gk_blue_auto19');

    // The legacy Pinkston-derived per-algorithm bodies (dx701..dx732) must
    // never appear in modern output: neither their banner comment nor their
    // source file names.
    expect(csdText).not.toContain('Yamaha DX7 Emulation Instrument');
    expect(csdText).not.toMatch(/dx70[1-9]|dx7[12][0-9]|dx73[0-2]/);
  });
});
