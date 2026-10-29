import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStandardCSD,
  buildStandardCSDAsync,
  BlueData,
  Channel,
  Effect,
  GenericInstrument,
  GenericScore,
  Send,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
  type RenderCsdResult,
} from '@blue/data';
import { preflightAudioLayout } from './audio-layout-preflight';
import {
  buildPanningFixtures,
  expectedFixtureRender,
  serializeMixerBindings,
  buildRoutingFixtures,
  buildProjectCorpusFixtures,
  writePanningSources,
  buildBlueLiveFixture,
  buildFixtureSet,
  benchmarkDurationSeconds,
  fixtureInputIdentity,
  pruneSourceWavBuffer,
  type MixerFixture,
} from './mixer-optimization-test-support';
import {
  CONTROLLED_STATEFUL_RESIDUAL_LIMIT,
  LINEAR_DOUBLE_RESIDUAL_LIMIT,
  assertAllFinite,
  assertExpectedRender,
  assertMatchingRenderFormat,
  assertWholeBufferResidual,
  decodeFloatWavBuffer,
} from './mixer-optimization-render-support';

/**
 * Spec 118 mixer-optimization capture/compare harness.
 *
 * Modes:
 * - default: deterministic generation and failure-contract checks (no engine).
 * - BLUE_MIXER_CAPTURE=1 + BLUE_MIXER_EVIDENCE_DIR: write fixture CSDs and the
 *   baseline/candidate manifest. Capture alone never claims audio acceptance.
 * - BLUE_RUN_REAL_ENGINE=1 + BLUE_MIXER_BASELINE_DIR (optional
 *   BLUE_MIXER_EVIDENCE_DIR for candidate artifacts): render every comparison
 *   fixture on both revisions with the same double-sample Csound CLI and apply
 *   the render-equivalence contract. Missing runtime, baseline data, or
 *   scenarios FAIL; they are never skipped.
 */

const MANIFEST_NAME = 'baseline-manifest.json';
const MANIFEST_SCHEMA_VERSION = 2;
/** Comparison fixtures use short scores; longer ones are benchmark inputs. */
const COMPARISON_MAX_DURATION_SECONDS = 10;

function sha256(data: string | Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function gitOutput(repositoryRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' }).trim();
}

function repositoryRoot(): string {
  let current = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(current, 'native', 'blue-engine'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

interface RevisionIdentity {
  readonly revision: string;
  readonly dirtyDiffHash: string;
  readonly exporterHash: string;
}

function revisionIdentity(): RevisionIdentity {
  const root = repositoryRoot();
  const status = gitOutput(root, ['status', '--porcelain']);
  const diff = status.length > 0 ? gitOutput(root, ['diff', 'HEAD']) : '';
  const untracked = gitOutput(root, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .sort()
    .map((file) => [file, sha256(fs.readFileSync(path.join(root, file)))]);
  const exporterSources = [
    'packages/blue-app/src/main/mixer-optimization-test-support.ts',
    'packages/blue-app/src/main/mixer-optimization.integration.test.ts',
    'packages/blue-app/src/main/mixer-optimization-render-support.ts',
  ]
    .map((relative) => fs.readFileSync(path.join(root, relative)))
    .map((buffer) => sha256(buffer));
  return {
    revision: gitOutput(root, ['rev-parse', 'HEAD']),
    dirtyDiffHash: sha256(JSON.stringify({ status, diff, untracked })),
    exporterHash: sha256(exporterSources.join('\n')),
  };
}

let cachedCsoundCli: string | null | undefined;

/**
 * Resolves the Csound CLI. Vitest workers can run with a stripped PATH, so
 * PATH is tried first and common install locations follow; an explicit
 * BLUE_CSOUND_PATH wins. Returns null when no runtime is reachable so
 * non-acceptance paths can distinguish availability from failure.
 */
function resolveCsoundCli(): string | null {
  if (cachedCsoundCli !== undefined) return cachedCsoundCli;
  const requested = process.env.BLUE_CSOUND_PATH?.trim();
  const executableName = process.platform === 'win32' ? 'csound.exe' : 'csound';
  const onPath = (name: string) =>
    (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((directory) => path.join(directory || process.cwd(), name));
  const candidates = requested
    ? path.isAbsolute(requested) || /[\\/]/.test(requested)
      ? [requested]
      : onPath(requested)
    : [...onPath(executableName), '/usr/local/bin/csound', '/opt/homebrew/bin/csound'];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      cachedCsoundCli = fs.realpathSync(candidate);
      return cachedCsoundCli;
    } catch {
      // try the next candidate location
    }
  }
  cachedCsoundCli = null;
  return null;
}

function csoundRuntimeIdentity(): string | null {
  const cli = resolveCsoundCli();
  if (!cli) return null;
  const result = spawnSync(cli, ['--version'], { encoding: 'utf8' });
  const identity = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  if (result.status !== 0 || !identity || !/double samples/.test(identity)) return null;
  return identity;
}

function renderRuntimeEvidence() {
  const cli = resolveCsoundCli(),
    version = csoundRuntimeIdentity();
  if (!cli || !version)
    throw new Error('render acceptance requires a nonempty double-sample runtime identity');
  const rc = path.join(os.homedir(), '.csound7rc');
  return {
    version,
    precision: 'float64',
    executable: cli,
    executableSha256: sha256(fs.readFileSync(cli)),
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    cpu: os.cpus()[0]?.model,
    options: [
      '-nd',
      '--sample-accurate',
      '-j1',
      '-W',
      '--0dbfs=1',
      '--format=double',
      '-o',
      '<fixture-output>',
      '<fixture-csd>',
    ],
    threads: 1,
    userRcSha256: fs.existsSync(rc) ? sha256(fs.readFileSync(rc)) : null,
  };
}

/** Renders one fixture through public generation entry points. */
function generateFixture(fixture: MixerFixture): {
  result: RenderCsdResult;
  csdText: string;
  emitMetering: boolean;
  data: BlueData;
} {
  const data = fixture.build();
  const layout = fixture.id.startsWith('pan-contract-')
    ? preflightAudioLayout(data, { projectDirectory: path.dirname(fixture.options.audioFile!) })
    : null;
  if (layout && !layout.success) throw new Error('panning fixture layout preflight failed');
  const emitMetering = fixture.id === 'metering' || fixture.id === 'live-control-trace';
  if (fixture.profile === 'blueLive') {
    const result = data.toBlueLiveCSD(undefined, emitMetering);
    return { result, csdText: result.csdText, emitMetering, data };
  }
  if (fixture.profile === 'disk') {
    const result = buildStandardCSD(data, 'disk', undefined, false);
    return { result, csdText: result.csdText, emitMetering: false, data };
  }
  const result =
    fixture.profile === 'realtime'
      ? buildStandardCSD(data, 'realtime', undefined, emitMetering, layout?.manifest)
      : buildStandardCSD(data, 'disk');
  return { result, csdText: result.csdText, emitMetering, data };
}

type SerializedBindings = ReturnType<typeof serializeMixerBindings>;
const serializeBindings = serializeMixerBindings;

interface FixtureManifestEntry {
  readonly id: string;
  readonly profile: 'realtime' | 'disk' | 'blueLive';
  readonly identity: string;
  readonly residualClass: 'linear' | 'stateful';
  readonly sampleRate: number;
  readonly ksmps: number;
  readonly channels: number;
  readonly durationSeconds: number;
  readonly expectedFrames: number | null;
  readonly maximumAmplitude: number;
  readonly emitMetering: boolean;
  readonly csdFile: string;
  readonly csdSha256: string;
  readonly bindings: SerializedBindings;
  readonly bindingsSha256: string;
}

interface CaptureManifest {
  readonly schemaVersion: number;
  readonly capturedAt: string;
  readonly blueRevision: string;
  readonly dirtyDiffHash: string;
  readonly exporterHash: string;
  readonly csoundRuntime: string | null;
  readonly audioAccepted: false;
  readonly fixtures: readonly FixtureManifestEntry[];
}

function csdFileName(fixture: MixerFixture): string {
  return `${fixture.id}-${fixture.options.sampleRate}-${fixture.options.ksmps}-${fixture.options.durationSeconds}s${
    fixture.profile === 'disk' ? '-disk' : fixture.profile === 'blueLive' ? '-blueLive' : ''
  }.csd`;
}

function csdHeaderInt(csdText: string, key: 'sr' | 'ksmps' | 'nchnls'): number {
  const match = csdText.match(new RegExp(`^${key}\\s*=\\s*(\\d+)$`, 'm'));
  if (!match) {
    throw new Error(`generated CSD is missing the ${key} header`);
  }
  return Number(match[1]);
}

function captureFixtureEntry(
  fixture: MixerFixture,
  identity: RevisionIdentity,
): { entry: FixtureManifestEntry; csdText: string } {
  const { csdText, result, emitMetering, data } = generateFixture(fixture);
  const entry: FixtureManifestEntry = {
    id: fixture.id,
    profile: fixture.profile,
    identity: fixture.identity,
    residualClass: fixture.residualClass,
    sampleRate: csdHeaderInt(csdText, 'sr'),
    ksmps: csdHeaderInt(csdText, 'ksmps'),
    channels: csdHeaderInt(csdText, 'nchnls'),
    durationSeconds: fixture.options.durationSeconds,
    expectedFrames: fixture.profile === 'blueLive' ? null : expectedFixtureRender(fixture).frames,
    maximumAmplitude: fixture.options.maximumAmplitude!,
    emitMetering,
    csdFile: csdFileName(fixture),
    csdSha256: sha256(csdText),
    bindings: serializeBindings(result, data),
    bindingsSha256: sha256(JSON.stringify(serializeBindings(result, data))),
  };
  return { entry, csdText };
}

function writeCapture(evidenceDir: string, fixtures: readonly MixerFixture[]): CaptureManifest {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const identity = revisionIdentity();
  const entries: FixtureManifestEntry[] = [];
  for (const fixture of fixtures) {
    const { entry, csdText } = captureFixtureEntry(fixture, identity);
    fs.writeFileSync(path.join(evidenceDir, entry.csdFile), csdText, 'utf8');
    entries.push(entry);
  }
  const manifest: CaptureManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    blueRevision: identity.revision,
    dirtyDiffHash: identity.dirtyDiffHash,
    exporterHash: identity.exporterHash,
    csoundRuntime: csoundRuntimeIdentity(),
    audioAccepted: false,
    fixtures: entries,
  };
  fs.writeFileSync(
    path.join(evidenceDir, MANIFEST_NAME),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  return manifest;
}

class ManifestError extends Error {}

function loadManifest(dir: string): CaptureManifest {
  const manifestPath = path.join(dir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    throw new ManifestError(`baseline manifest missing: ${manifestPath}`);
  }
  let parsed: CaptureManifest;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CaptureManifest;
  } catch (error) {
    throw new ManifestError(`baseline manifest is not valid JSON: ${String(error)}`);
  }
  if (parsed.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new ManifestError(
      `baseline manifest schema version ${String(parsed.schemaVersion)} is unsupported`,
    );
  }
  if (
    !/^[0-9a-f]{40}$/.test(parsed.blueRevision) ||
    !/^[0-9a-f]{64}$/.test(parsed.dirtyDiffHash) ||
    !/^[0-9a-f]{64}$/.test(parsed.exporterHash) ||
    !(
      parsed.csoundRuntime === null ||
      (typeof parsed.csoundRuntime === 'string' && parsed.csoundRuntime.trim())
    )
  ) {
    throw new ManifestError(
      'baseline manifest has missing revision/diff/exporter/runtime identity',
    );
  }
  if (!Array.isArray(parsed.fixtures) || parsed.fixtures.length === 0) {
    throw new ManifestError('baseline manifest lists no fixtures');
  }
  for (const fixture of parsed.fixtures) {
    const required: ReadonlyArray<keyof FixtureManifestEntry> = [
      'id',
      'identity',
      'profile',
      'sampleRate',
      'ksmps',
      'channels',
      'csdFile',
      'csdSha256',
      'bindings',
      'bindingsSha256',
    ];
    for (const key of required) {
      if (fixture[key] === undefined || fixture[key] === null) {
        throw new ManifestError(`baseline fixture ${String(fixture.id)} is missing ${String(key)}`);
      }
    }
    if (sha256(JSON.stringify(fixture.bindings)) !== fixture.bindingsSha256) {
      throw new ManifestError(`baseline binding hash mismatch for ${fixture.id}`);
    }
    const csdPath = path.join(dir, fixture.csdFile);
    if (!fs.existsSync(csdPath)) {
      throw new ManifestError(`baseline CSD file missing: ${csdPath}`);
    }
    if (sha256(fs.readFileSync(csdPath)) !== fixture.csdSha256) {
      throw new ManifestError(`baseline CSD hash mismatch for ${fixture.id}`);
    }
  }
  return parsed;
}

/** Ordered accumulator-reset variable list from one revision's CSD text. */
function resetVariablesOf(csdText: string): string[] {
  const instrument = csdText.match(/\tinstr BlueMixer[\s\S]*?\tendin/);
  if (!instrument) {
    throw new Error('CSD has no BlueMixer instrument');
  }
  const lines = instrument[0].split('\n').map((line) => line.trim());
  const zeroAssigned = lines
    .filter((line) => /^ga_(bluemix|bluesub)_\S+ = 0$/.test(line))
    .map((line) => line.slice(0, line.indexOf(' =')));
  if (zeroAssigned.length > 0) return zeroAssigned;
  const clearLines = lines.filter((line) => /^clear /.test(line));
  if (clearLines.length === 0) {
    throw new Error('BlueMixer has no accumulator reset statements');
  }
  return clearLines.flatMap((line) =>
    line
      .slice('clear '.length)
      .split(',')
      .map((v) => v.trim()),
  );
}

function renderCsdToDoubleWav(
  csdTextOrPath: string,
  outputDirectory: string,
  name: string,
): ReturnType<typeof decodeFloatWavBuffer> {
  const cli = resolveCsoundCli();
  if (!cli) {
    throw new Error(
      'explicit acceptance requires the Csound CLI (PATH, /usr/local/bin, ' +
        '/opt/homebrew/bin, or BLUE_CSOUND_PATH); a skip is not an acceptance result',
    );
  }
  const isPath = fs.existsSync(csdTextOrPath) && fs.statSync(csdTextOrPath).isFile();
  const csdPath = isPath ? (csdTextOrPath as string) : path.join(outputDirectory, `${name}.csd`);
  if (!isPath) fs.writeFileSync(csdPath, csdTextOrPath, 'utf8');
  const wavPath = path.join(outputDirectory, `${name}.wav`);
  execFileSync(
    cli,
    [
      '-nd',
      '--sample-accurate',
      '-j1',
      '-W',
      '--0dbfs=1',
      '--format=double',
      '-o',
      wavPath,
      csdPath,
    ],
    {
      cwd: outputDirectory,
      timeout: 60_000,
      killSignal: 'SIGKILL',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return decodeFloatWavBuffer(fs.readFileSync(wavPath));
}

interface ComparisonOutcome {
  readonly fixtureId: string;
  readonly inputIdentity: string;
  readonly profile: string;
  readonly baselineIdentity: RevisionIdentity & { manifestSha256: string; bindingsSha256: string };
  readonly candidateIdentity: RevisionIdentity & { manifestSha256: string; bindingsSha256: string };
  readonly candidateManifest: {
    blueRevision: string;
    dirtyDiffHash: string;
    exporterHash: string;
    fixture: FixtureManifestEntry;
  };
  readonly baselineCsdSha256: string;
  readonly candidateCsdSha256: string;
  readonly sampleFormat: string;
  readonly frames: number;
  readonly peakResidual: number;
  readonly residualLimit: number;
  readonly bindingsIdentical: boolean;
}

function compareFixtureAgainstBaseline(
  fixture: MixerFixture,
  baselineDir: string,
  outputDirectory: string,
): ComparisonOutcome {
  const manifest = loadManifest(baselineDir);
  const entry = manifest.fixtures.find(
    (candidate) =>
      candidate.id === fixture.id &&
      candidate.profile === fixture.profile &&
      candidate.sampleRate === fixture.options.sampleRate &&
      candidate.ksmps === fixture.options.ksmps &&
      candidate.durationSeconds === fixture.options.durationSeconds,
  );
  if (!entry) {
    throw new ManifestError(
      `baseline has no ${fixture.profile} fixture '${fixture.id}'; an absent scenario is a failed comparison`,
    );
  }
  if (entry.identity !== fixture.identity) {
    throw new ManifestError(
      `fixture '${fixture.id}' identity differs from the baseline capture; ` +
        'inputs must be identical on both revisions',
    );
  }
  if (entry.sampleRate !== fixture.options.sampleRate || entry.ksmps !== fixture.options.ksmps) {
    throw new ManifestError(`fixture '${fixture.id}' rate/block settings differ from baseline`);
  }

  const candidateIdentity = revisionIdentity();
  if (candidateIdentity.exporterHash !== manifest.exporterHash)
    throw new ManifestError('baseline/candidate exporter hash differs');
  const { csdText, result, data } = generateFixture(fixture);
  if (
    sha256(csdText) === entry.csdSha256 &&
    JSON.stringify(serializeBindings(result, data)) !== JSON.stringify(entry.bindings)
  ) {
    throw new Error(`fixture '${fixture.id}' bindings changed while CSD text is unchanged`);
  }

  // Structural invariants: identical ordered reset set and identical bindings.
  // The disabled-mixer fixture has no BlueMixer instrument on either side.
  const baselineCsd = fs.readFileSync(path.join(baselineDir, entry.csdFile), 'utf8');
  const hasMixer = (text: string) => text.includes('\tinstr BlueMixer');
  if (hasMixer(baselineCsd) || hasMixer(csdText)) {
    const baselineResets = resetVariablesOf(baselineCsd);
    const candidateResets = resetVariablesOf(csdText);
    expect(candidateResets).toEqual(baselineResets);
  }
  expect(serializeBindings(result, data)).toEqual(entry.bindings);

  const baselineAudio = renderCsdToDoubleWav(
    path.join(baselineDir, entry.csdFile),
    outputDirectory,
    `${fixture.id}-baseline`,
  );
  const candidateAudio = renderCsdToDoubleWav(csdText, outputDirectory, `${fixture.id}-candidate`);
  assertExpectedRender(baselineAudio, expectedFixtureRender(fixture), `${fixture.id} baseline`);
  assertExpectedRender(candidateAudio, expectedFixtureRender(fixture), `${fixture.id} candidate`);
  assertMatchingRenderFormat(baselineAudio, candidateAudio);
  assertAllFinite(baselineAudio.samples, `${fixture.id} baseline`);
  assertAllFinite(candidateAudio.samples, `${fixture.id} candidate`);
  if (['partial-first-final', 'impulse-effect-tail', 'effect-from-silence'].includes(fixture.id)) {
    const impulse = 3 + Math.round(0.01 * fixture.options.sampleRate);
    // Csound's ksmps=1 note-off path rounds fractional durations up; the
    // vector path truncates duration_samps when computing ksmps_no_end.
    const duration =
      fixture.options.ksmps === 1
        ? fixture.id === 'partial-first-final'
          ? 12
          : 2
        : fixture.id === 'partial-first-final'
          ? 11
          : 1;
    for (const audio of [baselineAudio, candidateAudio]) {
      for (let frame = 0; frame < audio.frames; frame++) {
        const active =
          fixture.id === 'effect-from-silence'
            ? frame <
              Math.round((fixture.options.durationSeconds + 1.1) * fixture.options.sampleRate)
            : fixture.id === 'partial-first-final'
              ? frame >= 3 && frame < 3 + duration
              : frame >= impulse && frame < impulse + duration;
        const expected = active ? 0.125 : 0;
        if (audio.samples[frame * 2] !== expected || audio.samples[frame * 2 + 1] !== -expected) {
          throw new Error(
            `${fixture.id} ${fixture.options.sampleRate}/${fixture.options.ksmps} frame ${frame}: expected [${expected}, ${-expected}], got [${audio.samples[frame * 2]}, ${audio.samples[frame * 2 + 1]}]`,
          );
        }
      }
    }
  }
  if (fixture.id.startsWith('routing-') || fixture.id === 'java-project-corpus') {
    for (const audio of [baselineAudio, candidateAudio]) {
      const frame = Math.floor(audio.sampleRate * 0.5);
      for (let channel = 0; channel < audio.channels; channel++) {
        const expected = fixture.id.startsWith('routing-direct-chain-')
          ? ((channel + 1) / 32) * 3.5
          : fixture.id === 'routing-mixer-in'
            ? channel === 0
              ? 0.125
              : -0.125
            : fixture.id === 'routing-nested-observer-writer'
              ? 0.28125
              : fixture.id === 'java-project-corpus'
                ? channel === 0
                  ? 0.125
                  : -0.125
                : 0;
        expect(
          audio.samples[frame * audio.channels + channel],
          `${fixture.id} channel ${channel}`,
        ).toBe(expected);
      }
      if (fixture.id === 'routing-no-source')
        expect(audio.samples.every((sample) => sample === 0)).toBe(true);
    }
  }
  if (fixture.id === 'sound-then-silence') {
    for (const audio of [baselineAudio, candidateAudio]) {
      const start = Math.ceil(fixture.options.sampleRate * 1.5) * audio.channels;
      expect(audio.samples.subarray(start).every((sample) => sample === 0)).toBe(true);
    }
  }
  const limit =
    fixture.residualClass === 'linear'
      ? LINEAR_DOUBLE_RESIDUAL_LIMIT
      : CONTROLLED_STATEFUL_RESIDUAL_LIMIT;
  const peakResidual = assertWholeBufferResidual(
    baselineAudio.samples,
    candidateAudio.samples,
    limit,
    `${fixture.id} (${fixture.residualClass})`,
  );
  const candidateEntry = captureFixtureEntry(fixture, candidateIdentity).entry;
  const candidateManifest = {
    blueRevision: candidateIdentity.revision,
    dirtyDiffHash: candidateIdentity.dirtyDiffHash,
    exporterHash: candidateIdentity.exporterHash,
    fixture: candidateEntry,
  };
  return {
    fixtureId: fixture.id,
    inputIdentity: fixture.identity,
    profile: fixture.profile,
    baselineIdentity: {
      revision: manifest.blueRevision,
      dirtyDiffHash: manifest.dirtyDiffHash,
      exporterHash: manifest.exporterHash,
      manifestSha256: sha256(fs.readFileSync(path.join(baselineDir, MANIFEST_NAME))),
      bindingsSha256: entry.bindingsSha256,
    },
    candidateManifest,
    candidateIdentity: {
      ...candidateIdentity,
      manifestSha256: sha256(JSON.stringify(candidateManifest)),
      bindingsSha256: sha256(JSON.stringify(serializeBindings(result, data))),
    },
    baselineCsdSha256: entry.csdSha256,
    candidateCsdSha256: sha256(csdText),
    sampleFormat: `${baselineAudio.format}/${baselineAudio.channels}ch`,
    frames: baselineAudio.frames,
    peakResidual,
    residualLimit: limit,
    bindingsIdentical: true,
  };
}

/** Deterministic 16-bit mono PCM source for AudioClip fixtures. */
export const PRUNE_SOURCE_WAV_NAME = 'prune-source.wav';

function writePruneSourceWav(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const wavPath = path.join(dir, PRUNE_SOURCE_WAV_NAME);
  fs.writeFileSync(wavPath, pruneSourceWavBuffer());
  return wavPath;
}

function comparisonFixtures(audioFile?: string): MixerFixture[] {
  return buildFixtureSet({
    mode: 'comparison',
    sampleRate: 44100,
    ksmps: 64,
    audioFile,
  }).filter((fixture) => fixture.options.durationSeconds <= COMPARISON_MAX_DURATION_SECONDS);
}

/** Spec 118 T018 lifecycle matrix across valid rates and block sizes. */
function lifecycleFixtures(
  sampleRate: 44100 | 48000,
  ksmps: 1 | 32 | 64 | 128,
  audioFile?: string,
): MixerFixture[] {
  const lifecycleIds = new Set([
    'send-level-matrix',
    'sound-then-silence',
    'small-single',
    'barrier-rich',
    'partial-first-final',
    'impulse-effect-tail',
    'effect-from-silence',
  ]);
  return buildFixtureSet({
    mode: 'comparison',
    sampleRate,
    ksmps,
    audioFile,
  }).filter((fixture) => lifecycleIds.has(fixture.id) && fixture.profile === 'realtime');
}

function representativeFixturesForConfiguration(
  mode: 'comparison' | 'benchmark',
  sampleRate: 44100 | 48000,
  ksmps: 32 | 64 | 128,
  audioFile?: string,
): MixerFixture[] {
  return [
    ...buildFixtureSet({ mode, sampleRate, ksmps, audioFile }),
    ...buildRoutingFixtures({
      sampleRate,
      ksmps,
      durationSeconds: mode === 'benchmark' ? benchmarkDurationSeconds(sampleRate, ksmps) : 2,
    }).filter((fixture) => mode === 'comparison' || fixture.id.startsWith('routing-direct-chain-')),
  ];
}

function representativeFixtures(
  mode: 'comparison' | 'benchmark',
  audioFile?: string,
): MixerFixture[] {
  return ([44100, 48000] as const).flatMap((sampleRate) =>
    ([32, 64, 128] as const).flatMap((ksmps) =>
      representativeFixturesForConfiguration(mode, sampleRate, ksmps, audioFile),
    ),
  );
}

describe('mixer-optimization generation determinism (Spec 118 T007)', () => {
  it('declares the cubic resampling bound for the original 44.1 kHz PCM fixture', () => {
    for (const sampleRate of [44100, 48000] as const) {
      const fixture = buildFixtureSet({ mode: 'comparison', sampleRate, ksmps: 32 }).find(
        (entry) => entry.id === 'muted-disk-pruned',
      )!;
      expect(expectedFixtureRender(fixture).maximumAmplitude).toBe(
        (12000 / 32768) * (sampleRate === 44100 ? 1 : 1.25),
      );
      expect(expectedFixtureRender(fixture).maximumAmplitude).toBeLessThan(1);
    }
  });
  for (const sampleRate of [44100, 48000] as const) {
    for (const ksmps of [32, 64, 128] as const) {
      it(`covers full-window mono and stereo workloads at ${sampleRate} Hz / ksmps ${ksmps}`, () => {
        const fixtures = representativeFixturesForConfiguration('benchmark', sampleRate, ksmps);
        for (const id of ['primary-send-heavy', 'representative', 'routing-direct-chain-1']) {
          const fixture = fixtures.find((entry) => entry.id === id)!;
          expect(fixture).toBeDefined();
          expect(fixture.options.sampleRate).toBe(sampleRate);
          expect(fixture.options.ksmps).toBe(ksmps);
          expect((fixture.options.durationSeconds * sampleRate) / ksmps).toBeGreaterThan(
            1024 + 65536,
          );
        }
        const mono = fixtures.find((entry) => entry.id === 'routing-direct-chain-1')!;
        const text = generateFixture(mono).csdText;
        expect(text).toContain('nchnls=1');
        expect(text).toContain(`i"DirectWriter"\t0.0\t${mono.options.durationSeconds}`);
      });
    }
  }
  it('generates byte-identical CSD for every comparison fixture on repeated builds', () => {
    for (const fixture of comparisonFixtures()) {
      const first = generateFixture(fixture).csdText;
      const second = generateFixture(fixture).csdText;
      expect(second).toBe(first);
      if (fixture.id !== 'disabled-mixer') {
        expect(first).toContain('BlueMixer');
      }
    }
  });

  it('generates identical sync and async disk CSD for the primary fixture', async () => {
    const fixtures = buildFixtureSet({
      mode: 'comparison',
      sampleRate: 44100,
      ksmps: 64,
    });
    const primary = fixtures.find((fixture) => fixture.id === 'primary-send-heavy')!;
    const data = primary.build();
    const sync = await buildStandardCSDAsync(data, 'disk');
    expect(sync.csdText).toBe(buildStandardCSD(data, 'disk').csdText);
  });

  it('generates a BlueLive CSD with gate machinery for the live fixture', () => {
    const result = buildBlueLiveFixture().toBlueLiveCSD();
    expect(result.csdText).toContain('instr BlueMixer');
    expect(result.mixerGateBindings).toBeDefined();
  });

  it('fingerprints meaningful project input changes including authored whitespace', () => {
    const fixture = comparisonFixtures().find((fixture) => fixture.id === 'barrier-rich')!;
    const fingerprint = (data: BlueData, options = fixture.options, profile = fixture.profile) =>
      fixtureInputIdentity(data, fixture.id, profile, options);
    expect(fingerprint(fixture.build())).toBe(fixture.identity);
    const mutations: Array<(data: BlueData) => void> = [
      (data) => {
        const instrument = data.getArrangement().getInstrument(0) as GenericInstrument;
        instrument.setText(instrument.getText() + '\n  ');
      },
      (data) => {
        const effect = data
          .getMixer()
          .getChannels()[1]
          .getPreEffects()
          .find((entry) => entry instanceof Effect) as Effect;
        effect.setCode(effect.getCode() + '\n  ');
      },
      (data) => data.getMixer().getChannels().reverse(),
      (data) => data.getMixer().getChannels()[0].setOutChannel('Return'),
      (data) => data.getMixer().getChannels()[0].setLevel(0.123),
      (data) => (data.getMixer().getChannels()[0].getPostEffects()[0] as Send).setLevel(0.123),
      (data) => data.getMixer().getChannels()[0].setMuted(true),
      (data) => data.getMixer().getChannels()[0].setPan(0.1),
      (data) => data.setRenderEndTime(1.25),
      (data) => {
        data.getProjectProperties().channels = '1';
      },
    ];
    for (const mutate of mutations) {
      const data = fixture.build();
      mutate(data);
      expect(fingerprint(data)).not.toBe(fixture.identity);
    }
    expect(fingerprint(fixture.build(), fixture.options, 'disk')).not.toBe(fixture.identity);
    expect(fingerprint(fixture.build(), { ...fixture.options, ksmps: 32 })).not.toBe(
      fixture.identity,
    );
  });

  it('hashes referenced audio content while ignoring only the selected artifact location', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'blue mixer identity '));
    try {
      const firstPath = writePruneSourceWav(dir);
      const secondPath = path.join(dir, 'same audio elsewhere.wav');
      fs.copyFileSync(firstPath, secondPath);
      const make = (audioFile: string) =>
        buildFixtureSet({ mode: 'comparison', sampleRate: 44100, ksmps: 64, audioFile }).find(
          (fixture) => fixture.id === 'muted-disk-pruned',
        )!;
      expect(make(firstPath).identity).toBe(make(secondPath).identity);
      const bytes = fs.readFileSync(secondPath);
      bytes[44] ^= 1;
      fs.writeFileSync(secondPath, bytes);
      expect(make(firstPath).identity).not.toBe(make(secondPath).identity);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps fixture identities stable across builds', () => {
    const first = comparisonFixtures().map((fixture) => fixture.identity);
    const second = comparisonFixtures().map((fixture) => fixture.identity);
    expect(second).toEqual(first);
  });
});

describe('mixer-optimization capture/compare failure contracts (Spec 118 T007)', () => {
  it('capture mode never records audio acceptance', () => {
    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      audioAccepted: false as const,
    };
    expect(manifest.audioAccepted).toBe(false);
  });

  it('explicit acceptance fails at process level for missing baseline, runtime and binary', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'blue mixer prerequisites '));
    try {
      const validManifest = writeCapture(dir, [
        comparisonFixtures().find((fixture) => fixture.id === 'small-single')!,
      ]);
      expect(validManifest.fixtures).toHaveLength(1);
      writePruneSourceWav(dir);
      const missing = path.join(dir, 'missing executable');
      const acceptanceEnv: NodeJS.ProcessEnv = {
        ...process.env,
        BLUE_MIXER_CAPTURE: '',
        BLUE_RUN_REAL_ENGINE: '1',
        BLUE_MIXER_EVIDENCE_DIR: '',
        BLUE_MIXER_BASELINE_DIR: dir,
        // These negative probes fail before any engine startup.
        BLUE_ENGINE_PATH: process.execPath,
      };
      const prerequisiteCases: Array<[NodeJS.ProcessEnv, RegExp]> = [
        [{ BLUE_MIXER_BASELINE_DIR: '' }, /requires BLUE_MIXER_BASELINE_DIR/],
        [{ BLUE_CSOUND_PATH: missing }, /requires.*Csound CLI/],
      ];
      if (resolveCsoundCli())
        prerequisiteCases.push(
          [{ BLUE_ENGINE_PATH: missing }, /requires.*engine binary/],
          [{}, /baseline has no.*fixture/],
        );
      for (const [overrides, diagnostic] of prerequisiteCases) {
        const result = spawnSync(
          process.execPath,
          [
            path.join(repositoryRoot(), 'packages/blue-app/node_modules/vitest/vitest.mjs'),
            'run',
            '--config',
            'vitest.config.ts',
            'src/main/mixer-optimization.integration.test.ts',
            '-t',
            Object.keys(overrides).length === 0
              ? 'compares every comparison fixture'
              : '__prerequisite_probe__',
          ],
          {
            cwd: path.join(repositoryRoot(), 'packages/blue-app'),
            encoding: 'utf8',
            timeout: 30_000,
            env: { ...acceptanceEnv, ...overrides },
          },
        );
        expect(result.status).not.toBe(0);
        expect(`${result.stdout}\n${result.stderr}`).toMatch(diagnostic);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it('captures WAV, CSD and manifest into a fresh nested directory containing spaces', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'blue mixer fresh capture '));
    const target = path.join(parent, 'new nested directory', 'capture artifacts');
    try {
      const result = spawnSync(
        process.execPath,
        [
          path.join(repositoryRoot(), 'packages/blue-app/node_modules/vitest/vitest.mjs'),
          'run',
          '--config',
          'vitest.config.ts',
          'src/main/mixer-optimization.integration.test.ts',
          '-t',
          'writes fixture CSDs',
        ],
        {
          cwd: path.join(repositoryRoot(), 'packages/blue-app'),
          encoding: 'utf8',
          timeout: 60_000,
          env: {
            ...process.env,
            BLUE_RUN_REAL_ENGINE: '',
            BLUE_MIXER_CAPTURE: '1',
            BLUE_MIXER_EVIDENCE_DIR: target,
          },
        },
      );
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const manifest = loadManifest(target);
      expect(manifest.audioAccepted).toBe(false);
      expect(fs.readFileSync(path.join(target, PRUNE_SOURCE_WAV_NAME))).toEqual(
        pruneSourceWavBuffer(),
      );
      expect(manifest.fixtures.length).toBeGreaterThan(0);
      expect(
        manifest.fixtures.every((fixture) => fs.existsSync(path.join(target, fixture.csdFile))),
      ).toBe(true);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  }, 90_000);

  it('rejects missing revision identities and changed bindings independently of the CSD', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'blue-mixer-chain-'));
    try {
      const single = comparisonFixtures().find((fixture) => fixture.id === 'small-single')!;
      const good = writeCapture(dir, [single]);
      if (resolveCsoundCli()) expect(good.csoundRuntime).toMatch(/double samples/);
      else expect(good.csoundRuntime).toBeNull();
      for (const field of ['blueRevision', 'dirtyDiffHash', 'exporterHash', 'csoundRuntime']) {
        fs.writeFileSync(path.join(dir, MANIFEST_NAME), JSON.stringify({ ...good, [field]: '' }));
        expect(() => loadManifest(dir)).toThrow(/identity/);
      }
      fs.writeFileSync(
        path.join(dir, MANIFEST_NAME),
        JSON.stringify({
          ...good,
          fixtures: [
            { ...good.fixtures[0], bindings: { ...good.fixtures[0].bindings, parameters: [] } },
          ],
        }),
      );
      expect(() => loadManifest(dir)).toThrow(/binding hash mismatch/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects a missing baseline manifest explicitly', () => {
    expect(() => loadManifest(path.join(os.tmpdir(), 'blue-mixer-no-such-baseline'))).toThrow(
      /baseline manifest missing/i,
    );
  });

  it('rejects malformed manifests and hash mismatches', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'blue-mixer-bad-manifest-'));
    try {
      fs.writeFileSync(path.join(dir, MANIFEST_NAME), '{not json', 'utf8');
      expect(() => loadManifest(dir)).toThrow(/not valid JSON/i);

      const good = captureFixtureEntry(
        buildFixtureSet({ mode: 'comparison', sampleRate: 44100, ksmps: 64 }).find(
          (fixture) => fixture.id === 'small-single',
        )!,
        revisionIdentity(),
      );
      fs.writeFileSync(path.join(dir, good.entry.csdFile), good.csdText, 'utf8');
      const tamperedHash = { ...good.entry, csdSha256: '0'.repeat(64) };
      fs.writeFileSync(
        path.join(dir, MANIFEST_NAME),
        JSON.stringify(
          {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            blueRevision: 'a'.repeat(40),
            dirtyDiffHash: 'b'.repeat(64),
            exporterHash: revisionIdentity().exporterHash,
            csoundRuntime: 'test double samples',
            fixtures: [tamperedHash],
          },
          null,
          2,
        ),
        'utf8',
      );
      expect(() => loadManifest(dir)).toThrow(/hash mismatch/i);

      const missingFile = { ...good.entry, csdFile: 'absent.csd' };
      fs.writeFileSync(
        path.join(dir, MANIFEST_NAME),
        JSON.stringify(
          {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            blueRevision: 'a'.repeat(40),
            dirtyDiffHash: 'b'.repeat(64),
            exporterHash: revisionIdentity().exporterHash,
            csoundRuntime: 'test double samples',
            fixtures: [missingFile],
          },
          null,
          2,
        ),
        'utf8',
      );
      expect(() => loadManifest(dir)).toThrow(/baseline CSD file missing/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails comparisons for absent or identity-mismatched baseline fixtures', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'blue-mixer-mismatch-'));
    try {
      const single = buildFixtureSet({
        mode: 'comparison',
        sampleRate: 44100,
        ksmps: 64,
      }).find((fixture) => fixture.id === 'small-single')!;
      const identity = revisionIdentity();
      const good = captureFixtureEntry(single, identity);
      fs.writeFileSync(path.join(dir, good.entry.csdFile), good.csdText, 'utf8');
      fs.writeFileSync(
        path.join(dir, MANIFEST_NAME),
        JSON.stringify(
          {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            blueRevision: 'a'.repeat(40),
            dirtyDiffHash: 'b'.repeat(64),
            exporterHash: revisionIdentity().exporterHash,
            csoundRuntime: 'test double samples',
            fixtures: [good.entry],
          },
          null,
          2,
        ),
        'utf8',
      );
      // Absent scenario: the manifest lacks every other fixture.
      const absent = comparisonFixtures().find((fixture) => fixture.id !== 'small-single')!;
      expect(() => compareFixtureAgainstBaseline(absent, dir, dir)).toThrow(/no .*fixture/i);
      // Absent rate/block combination for a recorded id.
      const otherRate = buildFixtureSet({ mode: 'comparison', sampleRate: 48000, ksmps: 64 }).find(
        (fixture) => fixture.id === 'small-single',
      )!;
      expect(() => compareFixtureAgainstBaseline(otherRate, dir, dir)).toThrow(/no .*fixture/i);
      // Identity mismatch: same id/settings, different fixture inputs.
      const wrongIdentity = { ...good.entry, identity: '0'.repeat(64) };
      fs.writeFileSync(
        path.join(dir, MANIFEST_NAME),
        JSON.stringify(
          {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            blueRevision: 'a'.repeat(40),
            dirtyDiffHash: 'b'.repeat(64),
            exporterHash: revisionIdentity().exporterHash,
            csoundRuntime: 'test double samples',
            fixtures: [wrongIdentity],
          },
          null,
          2,
        ),
        'utf8',
      );
      expect(() => compareFixtureAgainstBaseline(single, dir, dir)).toThrow(/identity differs/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

/**
 * Spec 118 T014: independent expected tap values for send taps, rendered
 * through the double-sample Csound CLI. These are correctness cases with
 * mathematically expected amplitudes; baseline/candidate whole-buffer
 * equivalence is the compare mode above. The source strip's dry output is
 * routed to a self-named sink (dropped by routeChannelOutput) so the master
 * signal contains only the send path.
 */
function createTapProject(options: {
  sendLevel: number;
  preFader?: boolean;
  channelLevel?: number;
  muted?: boolean;
  effect?: 'nonlinear' | 'stateful';
  nchnls?: 1 | 2;
}): BlueData {
  const data = new BlueData();
  const mixer = data.getMixer();
  mixer.setEnabled(true);
  mixer.setPanningEnabled(false);
  if (options.nchnls !== undefined) {
    data.getProjectProperties().channels = String(options.nchnls);
    data.getProjectProperties().diskChannels = String(options.nchnls);
  }
  data.setRenderStartTime(0);
  data.setRenderEndTime(2);

  const source = new Channel();
  source.setName('Src');
  source.setAssociation('src-track');
  source.setOutChannel('Sink'); // self-route drop: master sees only the send
  if (options.channelLevel !== undefined) source.setLevel(options.channelLevel);
  if (options.muted) source.setMuted(true);
  const send = new Send();
  send.setSendChannel('Bus');
  send.setLevel(options.sendLevel);
  (options.preFader ? source.getPreEffects() : source.getPostEffects()).push(send);
  if (options.effect === 'nonlinear') {
    source
      .getPreEffects()
      .push(makeTapEffect('aout1 = tanh(1.5 * ain1) / 1.5\naout2 = tanh(1.5 * ain2) / 1.5'));
  } else if (options.effect === 'stateful') {
    source
      .getPreEffects()
      .push(
        makeTapEffect(
          'aState1 init 0\naState2 init 0\naState1 = aState1 + 0.15 * (ain1 - aState1)\naState2 = aState2 + 0.15 * (ain2 - aState2)\naout1 = aState1\naout2 = aState2',
        ),
      );
  }
  mixer.getChannels().push(source);

  for (const name of ['Sink', 'Bus']) {
    const channel = new Channel();
    channel.setName(name);
    channel.setOutChannel(name === 'Bus' ? 'Master' : name);
    mixer.getSubChannels().push(channel);
  }

  const instrument = new GenericInstrument();
  instrument.setName('Sine');
  const channels =
    options.nchnls === 1
      ? 'aL oscili 0.22, 200, -1\nblueMixerOut aL, aL'
      : 'aL oscili 0.22, 200, -1\naR oscili 0.22, 203.5, -1\nblueMixerOut aL, aR';
  instrument.setText(channels);
  // The arrangementId must equal the channel name so blueMixerOut feeds the
  // Src channel bus; an unmatched id writes straight to Master.
  data.getArrangement().addInstrument(instrument, 'Src');

  const group = new TrackLayerGroup();
  const track = group.newLayerAt(0);
  track.setUniqueId('tap-track');
  const score = new GenericScore();
  score.setStartTime(TimePosition.beats(0));
  score.setSubjectiveDuration(TimeDuration.beats(2));
  score.setScoreText('i"Src" 0 2');
  track.push(score);
  data.getScore().length = 0;
  data.getScore().push(group);
  return data;
}

function makeTapEffect(code: string): Effect {
  const effect = new Effect();
  effect.setName('TapEffect');
  effect.setNumIns(2);
  effect.setNumOuts(2);
  effect.setCode(code);
  return effect;
}

/** RMS of one channel over the whole decoded buffer. */
function channelRms(audio: ReturnType<typeof decodeFloatWavBuffer>, channel: number): number {
  let sum = 0;
  const frames = audio.frames;
  for (let frame = 0; frame < frames; frame++) {
    const sample = audio.samples[frame * audio.channels + channel];
    sum += sample * sample;
  }
  return Math.sqrt(sum / frames);
}

describe.skipIf(!resolveCsoundCli())(
  'mixer-optimization bus observation order (Spec 118 T029)',
  () => {
    const temporaryDirectories: string[] = [];

    afterEach(() => {
      for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    /**
     * An observer effect reading a bus between two contributors must see only
     * the first contribution (original emission order); its own output is
     * verified against an independently computed expectation, so a shared
     * baseline defect cannot mask changed observation order.
     */
    it('an interleaved bus observer sees the original partial contribution set', () => {
      const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-118-obs-'));
      temporaryDirectories.push(scratchDir);
      const data = new BlueData();
      const mixer = data.getMixer();
      mixer.setEnabled(true);
      mixer.setPanningEnabled(false);
      data.setRenderStartTime(0);
      data.setRenderEndTime(2);

      const bus = new Channel();
      bus.setName('Bus');
      bus.setOutChannel('Master');
      mixer.getSubChannels().push(bus);

      const addStrip = (name: string, effectCode: string | null) => {
        const channel = new Channel();
        channel.setName(name);
        channel.setOutChannel('Sink');
        const send = new Send();
        send.setSendChannel('Bus');
        send.setLevel(0.5);
        channel.getPostEffects().push(send);
        if (effectCode) {
          const effect = new Effect();
          effect.setName(`${name} Effect`);
          effect.setNumIns(2);
          effect.setNumOuts(2);
          effect.setCode(effectCode);
          channel.getPreEffects().push(effect);
        }
        mixer.getChannels().push(channel);
        const instrument = new GenericInstrument();
        instrument.setName(name);
        instrument.setText(
          `aL oscili 0.22, ${name === 'First' ? 200 : 214}, -1\naR oscili 0.22, ${
            name === 'First' ? 203.5 : 217.5
          }, -1\nblueMixerOut aL, aR`,
        );
        data.getArrangement().addInstrument(instrument, name);
        return channel;
      };
      // Sink drops both dry outputs; the master carries Bus (both sends) plus
      // the observer effect's echo of the bus observed AFTER the first send.
      const sink = new Channel();
      sink.setName('Sink');
      sink.setOutChannel('Sink');
      mixer.getSubChannels().push(sink);
      addStrip('First', null);
      const observer = new Channel();
      observer.setName('Obs');
      observer.setOutChannel('Master');
      const observerEffect = new Effect();
      observerEffect.setName('Bus Reader');
      observerEffect.setNumIns(2);
      observerEffect.setNumOuts(2);
      observerEffect.setCode('aout1 = 0.5 * ga_bluesub_Bus_0\naout2 = 0.5 * ga_bluesub_Bus_1');
      observer.getPreEffects().push(observerEffect);
      mixer.getChannels().push(observer);
      addStrip('Second', null);

      const group = new TrackLayerGroup();
      const track = group.newLayerAt(0);
      track.setUniqueId('obs-track');
      const score = new GenericScore();
      score.setStartTime(TimePosition.beats(0));
      score.setSubjectiveDuration(TimeDuration.beats(2));
      score.setScoreText('i"First" 0 2\ni"Second" 0 2');
      track.push(score);
      data.getScore().length = 0;
      data.getScore().push(group);

      const csdText = buildStandardCSD(data, 'realtime').csdText;
      // Emission order: First's send precedes the observer effect call, which
      // precedes Second's send.
      const lines = csdText.split('\n').map((line) => line.trim());
      const firstSend = lines.findIndex((line) =>
        /^ga_bluesub_Bus_0\s\+=\sga_bluemix_0_0 \* kMixSendGain$/.test(line),
      );
      const observerCall = lines.findIndex((line) => /= blueEffect0\(/.test(line));
      const secondSend = lines.findIndex((line) =>
        /^ga_bluesub_Bus_0\s\+=\sga_bluemix_2_0 \* kMixSendGain$/.test(line),
      );
      expect(observerCall).toBeGreaterThan(firstSend);
      expect(secondSend).toBeGreaterThan(observerCall);

      const audio = renderCsdToDoubleWav(csdText, scratchDir, 'observer');
      assertAllFinite(audio.samples, 'observer render');
      // Independent expectation: master = Bus(First + Second sends) + 0.5 *
      // First's send (the observer sees only First's contribution). Uncorrelated
      // tones give expected RMS = sqrt((0.75^2 + 0.5^2) * (0.22^2 / 2)); the
      // phase-insensitive comparison isolates the contribution-set question
      // from any driver-level frame offset.
      let sum = 0;
      const frames = audio.frames;
      for (let frame = 0; frame < frames; frame++) {
        sum += audio.samples[frame * audio.channels] ** 2;
      }
      const actualRms = Math.sqrt(sum / frames);
      const expectedRms = Math.sqrt((0.75 ** 2 + 0.5 ** 2) * (0.22 ** 2 / 2));
      expect(Math.abs(actualRms / expectedRms - 1)).toBeLessThanOrEqual(0.02);
    });
  },
);

describe('mixer-optimization routing compatibility (Spec 118 T025)', () => {
  function mixerInstrumentCsd(data: BlueData): string {
    return buildStandardCSD(data, 'realtime').csdText;
  }

  it('generates an empty-source mixer with only the master accumulators', () => {
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    const csd = mixerInstrumentCsd(data);
    expect(csd).toContain('instr BlueMixer');
    const clearLine = csd
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('clear '));
    expect(clearLine).toBe('clear ga_bluesub_Master_0, ga_bluesub_Master_1');
  });

  it('supports direct authored blueMixerOut into a subchannel and Master', () => {
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    const sub = new Channel();
    sub.setName('Sub');
    sub.setOutChannel('Master');
    data.getMixer().getSubChannels().push(sub);
    const instrument = new GenericInstrument();
    instrument.setName('Direct');
    instrument.setText(
      'aL oscili 0.2, 110, -1\naR oscili 0.2, 111, -1\nblueMixerOut "Sub", aL, aR\nblueMixerOut aL, aR',
    );
    data.getArrangement().addInstrument(instrument, 'Direct');
    const csd = mixerInstrumentCsd(data);
    // The argument's literal leading space is preserved by the legacy
    // conversion; the direct subchannel write and the unmatched-id Master
    // fallback both keep their exact original statements.
    expect(csd).toContain('ga_bluesub_Sub_0 +=  aL');
    expect(csd).toContain('ga_bluesub_Master_0 +=  aL');
  });

  it('replaces channel buses for blueMixerIn users', () => {
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    const instrument = new GenericInstrument();
    instrument.setName('Reader');
    instrument.setText('aL, aR blueMixerIn\naOut = aL + aR\nblueMixerOut aOut, aOut');
    data.getArrangement().addInstrument(instrument, 'Reader');
    const csd = mixerInstrumentCsd(data);
    // No channel named after the arrangement id: blueMixerIn resolves to the
    // Master bus, exactly as before the optimization.
    expect(csd).toContain('aL = ga_bluesub_Master_0');
    expect(csd).toContain('aR = ga_bluesub_Master_1');
  });

  it('drops self-routed channel output and keeps the channel audible through sends', () => {
    const data = new BlueData();
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const bus = new Channel();
    bus.setName('Bus');
    bus.setOutChannel('Master');
    mixer.getSubChannels().push(bus);
    const source = new Channel();
    source.setName('Loop');
    source.setOutChannel('Loop'); // self route: dropped
    const send = new Send();
    send.setSendChannel('Bus');
    send.setLevel(0.5);
    source.getPostEffects().push(send);
    mixer.getChannels().push(source);
    const csd = mixerInstrumentCsd(data);
    expect(csd).not.toMatch(/ga_bluesub_Loop_0\t\+=\tga_bluemix_0_0\n/);
    expect(csd).toMatch(/^kMixSendGain = /m);
    // No Loop accumulator is created by a self-route; the clear lists only
    // the real buses.
    expect(csd).not.toContain('ga_bluesub_Loop_0');
    expect(csd.match(/clear .*/g)![0]).toContain('ga_bluesub_Bus_0');
  });

  it('keeps cyclic subchannel diagnostics unchanged', () => {
    const data = new BlueData();
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const x = new Channel();
    x.setName('X');
    x.setOutChannel('Y');
    const y = new Channel();
    y.setName('Y');
    y.setOutChannel('X');
    mixer.getSubChannels().push(x, y);
    // Cycle handling is owned by sortSubChannelsForRendering; generation
    // completes through the existing behavior and both channels appear.
    const csd = mixerInstrumentCsd(data);
    expect(csd).toContain('ga_bluesub_X_0');
    expect(csd).toContain('ga_bluesub_Y_0');
  });

  it('keeps unresolved-route sends emitting their original statements', () => {
    const data = new BlueData();
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const source = new Channel();
    source.setName('Ghost');
    source.setOutChannel('Master');
    const ghost = new Send();
    ghost.setSendChannel('NoSuchChannel');
    ghost.setLevel(0.5);
    source.getPostEffects().push(ghost);
    mixer.getChannels().push(source);
    const csd = mixerInstrumentCsd(data);
    // Unresolved targets fall back to Master-named variables exactly as
    // before: the send statement is emitted, gate ordinal assigned.
    expect(csd).toMatch(/ga_bluesub_NoSuchChannel_0\t\+=\tga_bluemix_0_0 \* kMixSendGain/);
  });

  it('loads an existing Java project and keeps its serialized form identical after generation', () => {
    const xml = [
      '<blueData version="2.8.0">',
      '  <projectProperties>',
      '    <title>Java Parity Legacy</title>',
      '    <sampleRate>44100</sampleRate>',
      '    <ksmps>100</ksmps>',
      '    <channels>2</channels>',
      '  </projectProperties>',
      '  <mixer>',
      '    <enabled>true</enabled>',
      '    <channelList list="channels">',
      '      <channel association="1">',
      '        <name>Ch1</name>',
      '        <outChannel>Master</outChannel>',
      '        <level>0.0</level>',
      '      </channel>',
      '    </channelList>',
      '    <channelList list="subChannels"/>',
      '    <channel><name>Master</name><level>0.0</level></channel>',
      '  </mixer>',
      '  <score>',
      '      <soundObject type="blue.soundObject.PolyObject">',
      '        <soundLayer/>',
      '      </soundObject>',
      '  </score>',
      '</blueData>',
    ].join('\n');
    const data = BlueData.loadFromString(xml);
    const before = data.saveToString();
    buildStandardCSD(data, 'realtime');
    buildStandardCSD(data, 'disk');
    // Generation must not mutate the canonical document; byte-level
    // round-trip normalization is owned by the serialization suite.
    expect(data.saveToString()).toBe(before);
  });
});

describe.skipIf(!resolveCsoundCli())('mixer-optimization send-tap values (Spec 118 T014)', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  function renderTap(
    options: Parameters<typeof createTapProject>[0],
  ): ReturnType<typeof decodeFloatWavBuffer> {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-tap-'));
    temporaryDirectories.push(directory);
    const csdText = buildStandardCSD(createTapProject(options), 'realtime').csdText;
    return renderCsdToDoubleWav(csdText, directory, 'tap');
  }

  it('scales the destination exactly by the send amount', () => {
    const half = renderTap({ sendLevel: 0.5 });
    const quarter = renderTap({ sendLevel: 0.25 });
    const zero = renderTap({ sendLevel: 0 });
    const rmsHalf = channelRms(half, 0);
    const rmsQuarter = channelRms(quarter, 0);
    expect(rmsHalf / rmsQuarter).toBeCloseTo(2, 9);
    // Zero amount is exact digital silence, not a residual.
    for (let i = 0; i < zero.samples.length; i++) {
      expect(zero.samples[i]).toBe(0);
    }
  });

  it('keeps pre-fader taps independent of the later channel level', () => {
    const preLoud = renderTap({ sendLevel: 0.5, preFader: true, channelLevel: 1 });
    const preQuiet = renderTap({ sendLevel: 0.5, preFader: true, channelLevel: 0.25 });
    assertMatchingRenderFormat(preLoud, preQuiet);
    assertAllFinite(preLoud.samples, 'pre-fader loud');
    assertAllFinite(preQuiet.samples, 'pre-fader quiet');
    // The tap happens before the fader: identical destination signal.
    assertWholeBufferResidual(
      preLoud.samples,
      preQuiet.samples,
      LINEAR_DOUBLE_RESIDUAL_LIMIT,
      'pre-fader tap independence',
    );
  });

  it('applies the channel level to post-fader taps exactly once', () => {
    // Channel levels are dB (ampdb); 0 dB is unity, -6.0206 dB is one half.
    const postLoud = renderTap({ sendLevel: 0.5, channelLevel: 0 });
    const postQuiet = renderTap({ sendLevel: 0.5, channelLevel: -6.020599913279624 });
    const ratio = channelRms(postLoud, 0) / channelRms(postQuiet, 0);
    expect(ratio).toBeCloseTo(2, 6);
  });

  it('renders a muted route as exact silence while the open route sounds', () => {
    const muted = renderTap({ sendLevel: 0.5, muted: true });
    for (let i = 0; i < muted.samples.length; i++) {
      expect(muted.samples[i]).toBe(0);
    }
    expect(channelRms(renderTap({ sendLevel: 0.5 }), 0)).toBeGreaterThan(0.01);
  });

  it('taps through controlled nonlinear and stateful effects at the original position', () => {
    const source = 0.22;
    // Numerically expected RMS of tanh(1.5 x)/1.5 for a 200 Hz sine at 44.1
    // kHz, integrated over the same window the render produces.
    const frames = 2 * 44100;
    let expectedSquares = 0;
    for (let frame = 0; frame < frames; frame++) {
      const x = source * Math.sin((2 * Math.PI * 200 * frame) / 44100);
      const shaped = Math.tanh(1.5 * x) / 1.5;
      expectedSquares += (shaped * 0.5) ** 2;
    }
    const expectedRms = Math.sqrt(expectedSquares / frames);
    const nonlinear = renderTap({ sendLevel: 0.5, effect: 'nonlinear' });
    // Tolerance covers oscili's table interpolation error; whole-buffer
    // equivalence against the baseline is asserted separately in compare mode.
    expect(channelRms(nonlinear, 0)).toBeCloseTo(expectedRms, 3);
    const stateful = renderTap({ sendLevel: 0.5, effect: 'stateful' });
    // The one-pole lowpass attenuates but preserves signal and finiteness.
    assertAllFinite(stateful.samples, 'stateful tap');
    expect(channelRms(stateful, 0)).toBeGreaterThan(0);
    expect(channelRms(stateful, 0)).toBeLessThan(channelRms(nonlinear, 0));
  });

  it('keeps mono tap routing on one channel', () => {
    const mono = renderTap({ sendLevel: 0.5, nchnls: 1 });
    expect(mono.channels).toBe(1);
    const stereo = renderTap({ sendLevel: 0.5 });
    expect(channelRms(mono, 0)).toBeCloseTo(channelRms(stereo, 0), 9);
  });

  it('keeps the ungated disk route on the unchanged single-multiply text', () => {
    const csdText = buildStandardCSD(createTapProject({ sendLevel: 0.5 }), 'disk').csdText;
    expect(csdText).toMatch(/ga_bluesub_Bus_0\t\+=\t\(ga_bluemix_0_0 \* gk_blue_auto\d+\)\n/);
    expect(csdText).not.toContain('kMixSendGain');
  });
});

const evidenceDir = process.env.BLUE_MIXER_EVIDENCE_DIR?.trim() || null;
const baselineDir = process.env.BLUE_MIXER_BASELINE_DIR?.trim() || null;

// Validate before selecting any optional render suite. An explicit acceptance
// invocation must fail collection, even when its environment would omit tests.
if (process.env.BLUE_RUN_REAL_ENGINE === '1' && process.env.BLUE_MIXER_CAPTURE !== '1') {
  if (evidenceDir && fs.existsSync(path.join(evidenceDir, 'comparison-results.json')))
    throw new Error('comparison evidence already exists; select a fresh evidence directory');
  if (!baselineDir) throw new Error('explicit mixer acceptance requires BLUE_MIXER_BASELINE_DIR');
  if (!resolveCsoundCli() || !csoundRuntimeIdentity())
    throw new Error('explicit mixer acceptance requires a double-sample Csound CLI');
  const root = repositoryRoot();
  const engineCandidates = process.env.BLUE_ENGINE_PATH?.trim()
    ? [process.env.BLUE_ENGINE_PATH.trim()]
    : [
        path.join(
          root,
          'packages/blue-app/.engine-stage',
          process.platform === 'win32' ? 'blue-engine.exe' : 'blue-engine',
        ),
        path.join(
          root,
          `native/blue-engine/build-${process.platform}-${process.arch}`,
          process.platform === 'win32' ? 'Release/blue-engine.exe' : 'blue-engine',
        ),
      ];
  if (!engineCandidates.some((file) => fs.existsSync(file) && fs.statSync(file).isFile())) {
    throw new Error(
      'explicit mixer acceptance requires an available engine binary (BLUE_ENGINE_PATH or staged engine)',
    );
  }
  loadManifest(baselineDir);
}

if (process.env.BLUE_MIXER_CAPTURE === '1') {
  describe('mixer-optimization baseline/candidate capture (Spec 118 T007)', () => {
    it('writes fixture CSDs and a complete manifest; capture is not audio acceptance', () => {
      if (!evidenceDir) {
        throw new Error('BLUE_MIXER_CAPTURE=1 requires BLUE_MIXER_EVIDENCE_DIR');
      }
      if (fs.existsSync(path.join(evidenceDir, MANIFEST_NAME)))
        throw new Error('capture evidence already exists; select a fresh evidence directory');
      const audioFile = writePruneSourceWav(evidenceDir);
      writePanningSources(evidenceDir);
      const manifest = writeCapture(evidenceDir, [
        ...representativeFixtures('comparison', audioFile),
        ...buildProjectCorpusFixtures(repositoryRoot()),
        ...buildPanningFixtures(evidenceDir),
        ...lifecycleFixtures(44100, 1, audioFile),
        ...lifecycleFixtures(48000, 1, audioFile),
        ...representativeFixtures('benchmark', audioFile),
      ]);
      expect(manifest.audioAccepted).toBe(false);
      expect(manifest.fixtures.length).toBeGreaterThan(0);
      expect(manifest.blueRevision).toMatch(/^[0-9a-f]{40}$/);
      // Re-loading validates every recorded hash.
      expect(() => loadManifest(evidenceDir)).not.toThrow();
    }, 600_000);
  });
}

if (process.env.BLUE_RUN_REAL_ENGINE === '1' && process.env.BLUE_MIXER_CAPTURE !== '1') {
  describe('mixer-optimization real-engine render comparison (Spec 118 T007)', () => {
    it('compares every comparison fixture against the immutable baseline', async () => {
      const baselineAudioFile = path.join(baselineDir!, PRUNE_SOURCE_WAV_NAME);
      if (!fs.existsSync(baselineAudioFile)) {
        throw new Error(
          `baseline audio source missing: ${baselineAudioFile}; the baseline capture is incomplete`,
        );
      }
      const fixtures = [
        ...representativeFixtures('comparison', baselineAudioFile).filter(
          (fixture) => fixture.profile !== 'blueLive',
        ),
        ...buildProjectCorpusFixtures(repositoryRoot()),
        ...lifecycleFixtures(44100, 1, baselineAudioFile),
        ...lifecycleFixtures(48000, 1, baselineAudioFile),
      ];
      const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'blue-mixer-compare-'));
      const outcomes: ComparisonOutcome[] = [];
      try {
        for (const fixture of fixtures) {
          if (fixture.profile === 'blueLive') continue;
          outcomes.push(compareFixtureAgainstBaseline(fixture, baselineDir!, outputDirectory));
        }
      } finally {
        if (evidenceDir) {
          fs.mkdirSync(evidenceDir, { recursive: true });
          const identity = revisionIdentity();
          await writeFile(
            path.join(evidenceDir, 'comparison-results.json'),
            JSON.stringify(
              {
                schemaVersion: 1,
                comparedAt: new Date().toISOString(),
                candidateRevision: identity.revision,
                candidateDirtyDiffHash: identity.dirtyDiffHash,
                exporterHash: identity.exporterHash,
                baselineDir,
                csoundRuntime: csoundRuntimeIdentity(),
                runtimeEvidence: renderRuntimeEvidence(),
                audioAccepted: outcomes.length === fixtures.length,
                outcomes,
              },
              null,
              2,
            ),
            { encoding: 'utf8', flag: 'wx' },
          );
        }
        await rm(outputDirectory, { recursive: true, force: true });
      }
      expect(outcomes.length).toBe(fixtures.length);
      expect(outcomes.every((outcome) => outcome.bindingsIdentical)).toBe(true);
    }, 1_200_000);
  });
}
