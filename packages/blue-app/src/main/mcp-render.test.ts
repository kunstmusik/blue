import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  AudioClip,
  AudioFile,
  BlueData,
  BlueSynthBuilder,
  Effect,
  Element,
  External,
  FrozenSoundObject,
  GenericInstrument,
  GenericScore,
  JavaScriptObject,
  OpcodeDefinition,
  PolyObject,
  ProjectProperties,
  PythonInstrument,
  PythonObject,
  PythonProcessor,
  TimeDuration,
  TimePosition,
  TrackLayer,
  TrackLayerGroup,
  TuningProcessor,
} from '@blue/data';
import type { DiskRenderSettingsSnapshot } from '../shared/program-settings';
import { planVettedMcpDiskCommand } from './disk-render-command';
import { developmentEnginePath, EngineRuntimeService } from './engine-runtime';
import { openMacRenderScratch, recoverMacRenderScratch } from './macos-render-scratch';
import type { McpAuthContext, McpDocumentReceipt } from './mcp-bridge';
import {
  captureAuthorizedRenderRoot,
  executeConfinedMcpRender,
  validateMcpWavFilename,
  verifyMcpRenderEligibility,
  type McpRenderFsSeam,
} from './mcp-render';
import type { ConfinedCsoundRunRequest } from './render-to-disk';

function createDefaultDiskRender(): DiskRenderSettingsSnapshot {
  return {
    csoundExecutable: 'csound',
    defaultSr: '44100',
    defaultKsmps: '1',
    defaultNchnls: '2',
    useZeroDbfs: true,
    zeroDbfs: '1',
    fileFormatEnabled: true,
    fileFormat: 'WAV',
    sampleFormatEnabled: true,
    sampleFormat: 'SHORT',
    savePeakInformation: true,
    ditherOutput: false,
    rewriteHeader: true,
    noteAmpsEnabled: true,
    outOfRangeEnabled: true,
    warningsEnabled: true,
    benchmarkEnabled: true,
    displaysDisabled: true,
    advancedSettings: '',
    renderMethod: '',
    externalPlayCommandEnabled: false,
    externalPlayCommand: 'command $outfile',
    externalOpenCommand: 'command $outfile',
  };
}

function createSineProject(options: { mixerEnabled?: boolean } = {}): BlueData {
  const data = new BlueData();
  data.getMixer().setEnabled(options.mixerEnabled ?? false);
  const instr = new GenericInstrument();
  instr.setName('Sine');
  instr.setText('a1 oscili 0.3, 440\nouts a1, a1');
  data.getArrangement().addInstrument(instr, '1');

  const score = new GenericScore();
  score.setName('Sine Note');
  score.setStartTime(TimePosition.beats(0));
  score.setSubjectiveDuration(TimeDuration.beats(2));
  score.setScoreText('i1 0 2');
  (data.getScore()[0] as PolyObject)[0]!.push(score);

  return data;
}

function makeAuth(overrides: Partial<McpAuthContext> = {}): McpAuthContext {
  return {
    listenerGeneration: 1,
    credentialEpoch: 1,
    accessMode: 'read-write',
    action: 'runtime',
    signal: new AbortController().signal,
    isAuthorized: () => true,
    ...overrides,
  };
}

const DEFAULT_RECEIPT: McpDocumentReceipt = {
  documentId: 'doc-1',
  revision: 1,
  stateId: 'state-1',
};

describe('planVettedMcpDiskCommand', () => {
  it('emits only vetted WAV flags and ignores diskRender.advancedSettings', () => {
    const diskRender = createDefaultDiskRender();
    diskRender.savePeakInformation = false;
    diskRender.ditherOutput = true;
    diskRender.advancedSettings = '--evil-flag';

    const props = new ProjectProperties();
    const plan = planVettedMcpDiskCommand({
      diskRender,
      props,
      outputFile: '/tmp/stage/render.wav',
      messageColorsEnabled: false,
    });

    expect(plan.mode).toBe('normal');
    expect(plan.args).toEqual([
      '-+msg_color=false',
      '--format=wav:short',
      '-K',
      '-Z',
      '-R',
      '-d',
      '-m135',
      '-o',
      '/tmp/stage/render.wav',
    ]);
    expect(plan.args).not.toContain('--evil-flag');
  });

  it('refuses diskCompleteOverride, diskAdvancedSettings, diskCommandLine, and non-WAV formats', () => {
    const diskRender = createDefaultDiskRender();

    const overrideProps = new ProjectProperties();
    overrideProps.diskCompleteOverride = true;
    expect(() =>
      planVettedMcpDiskCommand({
        diskRender,
        props: overrideProps,
        outputFile: '/tmp/out.wav',
        messageColorsEnabled: true,
      }),
    ).toThrow(/diskCompleteOverride/i);

    const advProps = new ProjectProperties();
    advProps.diskAdvancedSettings = '--env:FOO=1';
    expect(() =>
      planVettedMcpDiskCommand({
        diskRender,
        props: advProps,
        outputFile: '/tmp/out.wav',
        messageColorsEnabled: true,
      }),
    ).toThrow(/diskAdvancedSettings/i);

    const legacyCmdProps = new ProjectProperties();
    legacyCmdProps.diskCommandLine = '-W -o out.wav';
    expect(() =>
      planVettedMcpDiskCommand({
        diskRender,
        props: legacyCmdProps,
        outputFile: '/tmp/out.wav',
        messageColorsEnabled: true,
      }),
    ).toThrow(/diskCommandLine/i);

    const flacDiskRender = createDefaultDiskRender();
    flacDiskRender.fileFormat = 'FLAC';
    expect(() =>
      planVettedMcpDiskCommand({
        diskRender: flacDiskRender,
        props: new ProjectProperties(),
        outputFile: '/tmp/out.wav',
        messageColorsEnabled: true,
      }),
    ).toThrow(/WAV/i);
  });
});

describe('validateMcpWavFilename', () => {
  it('accepts valid single-leaf WAV filenames', () => {
    expect(validateMcpWavFilename('sine.wav')).toEqual({ ok: true, filename: 'sine.wav' });
    expect(validateMcpWavFilename('My Mix 01.WAV')).toEqual({
      ok: true,
      filename: 'My Mix 01.WAV',
    });
    expect(validateMcpWavFilename('take.1.wav')).toEqual({ ok: true, filename: 'take.1.wav' });
  });

  it.each([
    '',
    ' ',
    ' leading.wav',
    'trailing.wav ',
    '.wav',
    '.',
    '..',
    '../escape.wav',
    '..\\escape.wav',
    'sub/file.wav',
    'sub\\file.wav',
    'C:a.wav',
    'C:\\a.wav',
    '\\\\server\\share\\a.wav',
    'a.wav:ads',
    'a.wav:$DATA',
    'bad*name.wav',
    'bad?name.wav',
    'bad"name.wav',
    'bad<name.wav',
    'bad>name.wav',
    'bad|name.wav',
    'trailingdot.wav.',
    'null\0byte.wav',
    'note.mp3',
    'CON.wav',
    'nul.wav',
    'PRN.wav',
    'AUX.wav',
    'COM1.wav',
    'LPT9.WAV',
    'con.extra.wav',
    `${'a'.repeat(252)}.wav`,
  ])('rejects invalid or unsafe leaf filename %j', (candidate) => {
    expect(validateMcpWavFilename(candidate).ok).toBe(false);
  });
});

describe('verifyMcpRenderEligibility', () => {
  it('admits eligible sine projects with mixer disabled and default mixer enabled', () => {
    for (const mixerEnabled of [false, true]) {
      const data = createSineProject({ mixerEnabled });
      const csd = data.toDiskCSD(undefined, null);
      const res = verifyMcpRenderEligibility(data, csd, createDefaultDiskRender());
      expect(res).toMatchObject({ ok: true });
    }
  });

  it('refuses unvetted opcodes (fout, system, ftsave, diskin2, chnset, OSClisten)', () => {
    for (const badBody of [
      'a1 oscili 0.3, 440\nfout "out.wav", 1, a1\nouts a1, a1',
      'a1 oscili 0.3, 440\nfout 1, 1, a1\nouts a1, a1',
      'ires system 1, 1\nouts 0, 0',
      'ftsave "x", 0, 1\nouts 0, 0',
      'a1 diskin2 1, 1\nouts a1, a1',
      'chnset 1, "k1"\nouts 0, 0',
      'k1 OSClisten 0, "/x", "f", k1\nouts 0, 0',
    ]) {
      const data = createSineProject();
      (data.getArrangement().getInstrumentById('1') as GenericInstrument).setText(badBody);
      const csd = data.toDiskCSD(undefined, null);
      const res = verifyMcpRenderEligibility(data, csd, createDefaultDiskRender());
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNSUPPORTED_CONTENT');
    }
  });

  it('refuses preprocessor directives, string literals, and unsafe score GEN routines', () => {
    const includeData = createSineProject();
    (includeData.getArrangement().getInstrumentById('1') as GenericInstrument).setText(
      '#include "/etc/passwd"\na1 oscili 0.3, 440\nouts a1, a1',
    );
    expect(
      verifyMcpRenderEligibility(
        includeData,
        includeData.toDiskCSD(undefined, null),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const defineData = createSineProject();
    (defineData.getArrangement().getInstrumentById('1') as GenericInstrument).setText(
      '#define EVIL #fout#\na1 oscili 0.3, 440\nouts a1, a1',
    );
    expect(
      verifyMcpRenderEligibility(
        defineData,
        defineData.toDiskCSD(undefined, null),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const gen1Data = createSineProject();
    gen1Data.getTableSet().setTables('f1 0 0 1 0 0 0');
    expect(
      verifyMcpRenderEligibility(
        gen1Data,
        gen1Data.toDiskCSD(undefined, null),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    // Tampered CSD text with string literal or <CsOptions> flags is also rejected
    const cleanData = createSineProject();
    const cleanCsd = cleanData.toDiskCSD(undefined, null);
    expect(
      verifyMcpRenderEligibility(
        cleanData,
        cleanCsd.replace(
          '<CsInstruments>',
          '<CsOptions>-o /tmp/hijack.wav</CsOptions>\n<CsInstruments>',
        ),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    expect(
      verifyMcpRenderEligibility(
        cleanData,
        cleanCsd.replace('i1\t0.0\t2', 'i"evil" 0 1'),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    // Safe GEN 10 table passes
    const gen10Data = createSineProject();
    gen10Data.getTableSet().setTables('f1 0 4096 10 1');
    expect(
      verifyMcpRenderEligibility(
        gen10Data,
        gen10Data.toDiskCSD(undefined, null),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: true });
  });

  it.each([
    [
      'unexpected section',
      (csd: string) =>
        csd.replace('</CsScore>', '</CsScore>\n<CsFileB filename="extra.dat">\nAA==\n</CsFileB>'),
    ],
    ['malformed boundary', (csd: string) => csd.replace('</CsScore>', '</CsScore >')],
    ['second wrapper', (csd: string) => csd + '\n<CsoundSynthesizer>\n</CsoundSynthesizer>'],
    [
      'active text outside a section',
      (csd: string) => csd.replace('<CsScore>', 'unexpected\n<CsScore>'),
    ],
    [
      'unexpected section attributes',
      (csd: string) => csd.replace('<CsScore>', '<CsScore bin="external">'),
    ],
  ])('refuses a generated CSD with %s', (_label, change) => {
    const data = createSineProject();
    const csd = change(data.toDiskCSD(undefined, null));
    expect(verifyMcpRenderEligibility(data, csd, createDefaultDiskRender())).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
    });
  });

  it('refuses disk overrides, non-GenericInstrument, scripted/audio objects, UDOs, and mixer effects', () => {
    const overrideData = createSineProject();
    overrideData.getProjectProperties().diskCompleteOverride = true;
    expect(
      verifyMcpRenderEligibility(
        overrideData,
        overrideData.toDiskCSD(undefined, null),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const advData = createSineProject();
    advData.getProjectProperties().diskAdvancedSettings = '-b1024';
    expect(
      verifyMcpRenderEligibility(
        advData,
        advData.toDiskCSD(undefined, null),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const bsbData = createSineProject();
    bsbData.getArrangement().addInstrument(new BlueSynthBuilder(), '2');
    expect(
      verifyMcpRenderEligibility(
        bsbData,
        bsbData.toDiskCSD(undefined, null),
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const pyInstrData = createSineProject();
    pyInstrData.getArrangement().addInstrument(new PythonInstrument(), '2');
    expect(
      verifyMcpRenderEligibility(
        pyInstrData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'EXECUTION_REQUIRED' });

    const audioFileData = createSineProject();
    (audioFileData.getScore()[0] as PolyObject)[0]!.push(new AudioFile());
    expect(
      verifyMcpRenderEligibility(
        audioFileData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const frozenData = createSineProject();
    (frozenData.getScore()[0] as PolyObject)[0]!.push(new FrozenSoundObject());
    expect(
      verifyMcpRenderEligibility(
        frozenData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const libScriptData = createSineProject();
    libScriptData.getSoundObjectLibrary().addObject(new JavaScriptObject());
    expect(
      verifyMcpRenderEligibility(
        libScriptData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'EXECUTION_REQUIRED' });

    const liveScriptData = createSineProject();
    const liveObj = liveScriptData.getLiveData().getLiveObjectBins().getLiveObject(0, 0);
    if (liveObj) {
      liveObj.setSoundObject(new PythonObject());
    } else {
      (liveScriptData.getScore()[0] as PolyObject)[0]!.push(new External());
    }
    expect(
      verifyMcpRenderEligibility(
        liveScriptData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'EXECUTION_REQUIRED' });

    const tuningData = createSineProject();
    const tuningXml = new Element('noteProcessor');
    tuningXml.setAttribute('type', 'blue.noteProcessor.TuningProcessor');
    tuningXml.addElement('pfield').setText('4');
    tuningXml.addElement('scale').setText('just.scl');
    const tuning = TuningProcessor.loadFromXML(tuningXml);
    (tuningData.getScore()[0] as PolyObject)[0]!.getNoteProcessorChain().addProcessor(tuning);
    expect(
      verifyMcpRenderEligibility(
        tuningData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const pyProcData = createSineProject();
    (pyProcData.getScore()[0] as PolyObject)[0]!
      .getNoteProcessorChain()
      .addProcessor(new PythonProcessor());
    expect(
      verifyMcpRenderEligibility(
        pyProcData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'EXECUTION_REQUIRED' });

    const udoData = createSineProject();
    const udo = new OpcodeDefinition();
    udo.setName('myUdo');
    udo.setCode('xout 0');
    udoData.getOpcodeList().addOpcode(udo);
    expect(
      verifyMcpRenderEligibility(
        udoData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const effectData = createSineProject({ mixerEnabled: true });
    const effect = new Effect();
    effect.setCode('fout "leak.wav", 1, ain1\naout1 = ain1');
    effectData.getMixer().getMaster().getPreEffects().push(effect);
    expect(
      verifyMcpRenderEligibility(
        effectData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });

    const audioClipData = createSineProject();
    audioClipData.getMixer().setPanningEnabled(true);
    const track = new TrackLayer();
    track.push(new AudioClip());
    const tracks = new TrackLayerGroup();
    tracks.push(track);
    audioClipData.getScore().push(tracks);
    expect(
      verifyMcpRenderEligibility(
        audioClipData,
        '<CsoundSynthesizer></CsoundSynthesizer>',
        createDefaultDiskRender(),
      ),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });
  });
});

describe('executeConfinedMcpRender', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(parent = os.tmpdir()): string {
    const dir = fs.mkdtempSync(path.join(parent, 'blue-mcp-render-test-'));
    tempDirs.push(dir);
    return dir;
  }

  it('renders an eligible sine project through the confined runner with zero staging residue', async () => {
    const root = createTempDir();
    const canonicalRoot = fs.realpathSync(root);
    const data = createSineProject();
    const captured: { request?: ConfinedCsoundRunRequest } = {};

    const result = await executeConfinedMcpRender({
      data,
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: root,
      filename: 'sine-out.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: false,
      executionSeam: {
        runCsound: vi.fn(),
        runConfinedCsound: async (req) => {
          captured.request = req;
          const gate = req.beforeLaunch?.();
          if (gate && !gate.ok) {
            return {
              exitCode: -1,
              stderr: gate.message,
              errorCode: gate.code,
              cancelled: gate.code === 'CANCELLED',
            };
          }
          fs.writeFileSync(path.join(req.rootPath, req.outputFilename), 'RIFF-WAV-BYTES');
          return { exitCode: 0, stderr: '' };
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        outputPath: path.join(canonicalRoot, 'sine-out.wav'),
        receipt: DEFAULT_RECEIPT,
      },
    });
    expect(fs.readFileSync(path.join(canonicalRoot, 'sine-out.wav'), 'utf8')).toBe(
      'RIFF-WAV-BYTES',
    );
    expect(fs.readdirSync(canonicalRoot)).toEqual(['sine-out.wav']);
    expect(captured.request?.args).toContain('--format=wav:short');
    expect(captured.request?.args).toContain('-+msg_color=false');
    expect(captured.request?.args).not.toContain('-o');
    expect(captured.request?.csdText).toContain('<CsoundSynthesizer>');
  });

  it('rejects active lines from project metadata before native launch', async () => {
    const data = createSineProject();
    data.getProjectProperties().title = 'Sine\nunexpected active text';
    const root = createTempDir();
    const runConfinedCsound = vi.fn();
    const result = await executeConfinedMcpRender({
      data,
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: root,
      filename: 'sine.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      executionSeam: { runCsound: vi.fn(), runConfinedCsound },
    });
    expect(result).toMatchObject({ ok: false, code: 'UNSUPPORTED_CONTENT' });
    expect(runConfinedCsound).not.toHaveBeenCalled();
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('rejects existing output files before invoking Csound and never overwrites', async () => {
    const root = createTempDir();
    const existing = path.join(root, 'existing.wav');
    fs.writeFileSync(existing, 'ORIGINAL');
    const runConfinedCsound = vi.fn();

    const result = await executeConfinedMcpRender({
      data: createSineProject(),
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: root,
      filename: 'existing.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      executionSeam: { runCsound: vi.fn(), runConfinedCsound },
    });

    expect(result).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    expect(runConfinedCsound).not.toHaveBeenCalled();
    expect(fs.readFileSync(existing, 'utf8')).toBe('ORIGINAL');
  });

  it('rejects traversal, Windows reserved names, inaccessible roots, and missing confined runner', async () => {
    const root = createTempDir();
    const runConfinedCsound = vi.fn();

    for (const badName of [
      '../evil.wav',
      'sub/evil.wav',
      'CON.wav',
      'nul.wav',
      'C:a.wav',
      'a.wav:ads',
    ]) {
      const res = await executeConfinedMcpRender({
        data: createSineProject(),
        expectedReceipt: DEFAULT_RECEIPT,
        getCurrentReceipt: () => DEFAULT_RECEIPT,
        auth: makeAuth(),
        nativeRoot: root,
        filename: badName,
        diskRender: createDefaultDiskRender(),
        messageColorsEnabled: true,
        executionSeam: { runCsound: vi.fn(), runConfinedCsound },
      });
      expect(res).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    }
    expect(runConfinedCsound).not.toHaveBeenCalled();

    const missingRootRes = await executeConfinedMcpRender({
      data: createSineProject(),
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: path.join(root, 'does-not-exist'),
      filename: 'out.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      executionSeam: { runCsound: vi.fn(), runConfinedCsound },
    });
    expect(missingRootRes).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    expect(runConfinedCsound).not.toHaveBeenCalled();

    const unsupportedPlatformRes = await executeConfinedMcpRender({
      data: createSineProject(),
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: root,
      filename: 'out.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      platform: 'freebsd',
      executionSeam: { runCsound: vi.fn(), runConfinedCsound },
    });
    expect(unsupportedPlatformRes).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    expect(runConfinedCsound).not.toHaveBeenCalled();

    const missingRunnerRes = await executeConfinedMcpRender({
      data: createSineProject(),
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: root,
      filename: 'out.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      executionSeam: { runCsound: vi.fn() },
    });
    expect(missingRunnerRes).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });

    const nonZeroRes = await executeConfinedMcpRender({
      data: createSineProject(),
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: root,
      filename: 'fail.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      executionSeam: {
        runCsound: vi.fn(),
        runConfinedCsound: async () => ({ exitCode: 1, stderr: 'csound failed' }),
      },
    });
    expect(nonZeroRes).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('refuses directory changes during approval and at native engine launch without spawning Csound (T061, T063)', async () => {
    // 1. Directory replaced between folder selection capture and user approval confirmation -> never dispatches
    const parent = createTempDir();
    const approvedDir = path.join(parent, 'approved');
    const swappedDir = path.join(parent, 'swapped');
    fs.mkdirSync(approvedDir);
    fs.mkdirSync(swappedDir);

    const captured = captureAuthorizedRenderRoot(approvedDir);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;

    try {
      fs.renameSync(approvedDir, path.join(parent, 'approved.moved'));
      fs.symlinkSync(swappedDir, approvedDir, process.platform === 'win32' ? 'junction' : 'dir');

      const runConfinedCsound = vi.fn();
      const res = await executeConfinedMcpRender({
        data: createSineProject(),
        expectedReceipt: DEFAULT_RECEIPT,
        getCurrentReceipt: () => DEFAULT_RECEIPT,
        auth: makeAuth(),
        nativeRoot: approvedDir,
        authorizedRoot: captured.value,
        filename: 'during-approval.wav',
        diskRender: createDefaultDiskRender(),
        messageColorsEnabled: true,
        executionSeam: { runCsound: vi.fn(), runConfinedCsound },
      });

      expect(res).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
      expect(runConfinedCsound).not.toHaveBeenCalled();
      expect(fs.readdirSync(swappedDir)).toEqual([]);
    } finally {
      captured.value.dispose();
    }

    // 2. Directory change, access downgrade, receipt conflict, and cancellation while EngineRuntimeService.probe() is pending -> never launches Csound
    const fakeRepo = createTempDir();
    const fakeEngine = developmentEnginePath(fakeRepo, process.platform, process.arch);
    fs.mkdirSync(path.dirname(fakeEngine), { recursive: true });
    const fakeEngineBytes = Buffer.from('stub-engine');
    fs.writeFileSync(fakeEngine, fakeEngineBytes);
    fs.chmodSync(fakeEngine, 0o755);
    fs.writeFileSync(
      path.join(path.dirname(fakeEngine), 'artifact.json'),
      JSON.stringify({
        schemaVersion: 1,
        protocolVersion: 2,
        platform: process.platform,
        arch: process.arch,
        executableName: path.basename(fakeEngine),
        sha256: createHash('sha256').update(fakeEngineBytes).digest('hex'),
      }),
    );
    const fakeLib = path.join(fakeRepo, 'libcsound.dylib');
    fs.writeFileSync(fakeLib, 'stub-csound');

    const scenarios: Array<{
      label: string;
      expectedCode: string;
      mutateDuringProbe: (ctx: {
        dir: string;
        moved: string;
        decoy: string;
        revoke: () => void;
        advanceReceipt: () => void;
        cancel: () => void;
      }) => void;
    }> = [
      {
        label: 'directory replaced before launch',
        expectedCode: 'OUTPUT_REJECTED',
        mutateDuringProbe: ({ dir, moved, decoy }) => {
          fs.renameSync(dir, moved);
          fs.symlinkSync(decoy, dir, process.platform === 'win32' ? 'junction' : 'dir');
        },
      },
      {
        label: 'access revoked before launch',
        expectedCode: 'ACCESS_DENIED',
        mutateDuringProbe: ({ revoke }) => revoke(),
      },
      {
        label: 'project receipt changed before launch',
        expectedCode: 'CONFLICT',
        mutateDuringProbe: ({ advanceReceipt }) => advanceReceipt(),
      },
      {
        label: 'request cancelled before launch',
        expectedCode: 'CANCELLED',
        mutateDuringProbe: ({ cancel }) => cancel(),
      },
    ];

    for (const scenario of scenarios) {
      const scenarioParent = createTempDir();
      const dir = path.join(scenarioParent, 'target');
      const moved = path.join(scenarioParent, 'target.moved');
      const decoy = path.join(scenarioParent, 'decoy');
      fs.mkdirSync(dir);
      fs.mkdirSync(decoy);

      let authorized = true;
      let receipt: McpDocumentReceipt = DEFAULT_RECEIPT;
      const controller = new AbortController();
      const runExecutionProcess = vi.fn();

      const runtime = new EngineRuntimeService({
        isPackaged: false,
        resourcesPath: fakeRepo,
        repoRoot: fakeRepo,
        getSettingsEnginePath: () => '',
        getCsoundLibraryPath: () => fakeLib,
        runProbeProcess: async () => {
          scenario.mutateDuringProbe({
            dir,
            moved,
            decoy,
            revoke: () => {
              authorized = false;
            },
            advanceReceipt: () => {
              receipt = { ...DEFAULT_RECEIPT, revision: 2, stateId: 'state-2' };
            },
            cancel: () => {
              controller.abort();
            },
          });
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              schemaVersion: 1,
              engine: {
                schemaVersion: 1,
                engineVersion: '0.1.0',
                protocolVersion: 2,
                sourceRevision: 'test',
                features: ['csound-probe-v1', 'csound-performance-v1', 'csound-confined-render-v5'],
              },
              csound: {
                status: 'ready',
                requestedPath: fakeLib,
                loadedPath: fakeLib,
                versionRaw: 7000,
                major: 7,
                minor: 0,
                patch: 0,
                supportedMajors: [7],
                missingSymbols: [],
                message: 'ready',
              },
              ready: true,
            }),
            stderr: '',
            timedOut: false,
          };
        },
        runExecutionProcess,
      });

      const capturedScenarioRoot = captureAuthorizedRenderRoot(dir);
      expect(capturedScenarioRoot.ok, scenario.label).toBe(true);
      if (!capturedScenarioRoot.ok) continue;

      try {
        const res = await executeConfinedMcpRender({
          data: createSineProject(),
          expectedReceipt: DEFAULT_RECEIPT,
          getCurrentReceipt: () => receipt,
          auth: makeAuth({
            isAuthorized: () => authorized,
            signal: controller.signal,
          }),
          nativeRoot: dir,
          authorizedRoot: capturedScenarioRoot.value,
          filename: 'launch-check.wav',
          diskRender: createDefaultDiskRender(),
          messageColorsEnabled: true,
          executionSeam: {
            runCsound: vi.fn(),
            runConfinedCsound: async (request) => {
              const execRes = await runtime.executeCsound(
                {
                  kind: 'confined-render',
                  operationId: 'test-launch-fence',
                  rootPath: request.rootPath,
                  rootDev: request.rootDev,
                  rootIno: request.rootIno,
                  outputFilename: request.outputFilename,
                  csdText: request.csdText,
                  args: request.args,
                  csoundLibraryPath: fakeLib,
                },
                {
                  signal: controller.signal,
                  beforeLaunch: request.beforeLaunch,
                },
              );
              return {
                exitCode: execRes.exitCode ?? -1,
                stderr: execRes.stderr || execRes.message,
                stdout: execRes.stdout,
                cancelled: execRes.state === 'cancelled',
                errorCode: execRes.errorCode,
                message: execRes.message,
              };
            },
          },
        });

        expect(res, scenario.label).toMatchObject({ ok: false, code: scenario.expectedCode });
        expect(runExecutionProcess, scenario.label).not.toHaveBeenCalled();
        expect(fs.readdirSync(decoy), scenario.label).toEqual([]);
      } finally {
        capturedScenarioRoot.value.dispose();
      }
    }
  });

  it('fails closed when anchored containment is unavailable or native engine rejects Windows/POSIX link', async () => {
    const runUnproven = vi.fn();
    const unprovenRes = await executeConfinedMcpRender({
      data: createSineProject(),
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: createTempDir(),
      filename: 'unproven.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      fsSeam: {
        supportsAnchoredContainment: false,
        realpathSync: fs.realpathSync,
        lstatSync: fs.lstatSync,
        openSync: fs.openSync,
        fstatSync: fs.fstatSync,
        closeSync: fs.closeSync,
      },
      executionSeam: { runCsound: vi.fn(), runConfinedCsound: runUnproven },
    });
    expect(unprovenRes).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    expect(runUnproven).not.toHaveBeenCalled();

    const fsSeam: McpRenderFsSeam = {
      realpathSync: () => 'C:\\Users\\Ada\\Project',
      lstatSync: (p) => {
        if (p === 'C:\\Users\\Ada\\Project') {
          return {
            isDirectory: () => true,
            isFile: () => false,
            isSymbolicLink: () => false,
            dev: 1,
            ino: 42,
          };
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      },
      openSync: () => 1,
      fstatSync: () => ({
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        dev: 1,
        ino: 42,
      }),
      closeSync: vi.fn(),
    };

    const winDenied = await executeConfinedMcpRender({
      data: createSineProject(),
      expectedReceipt: DEFAULT_RECEIPT,
      getCurrentReceipt: () => DEFAULT_RECEIPT,
      auth: makeAuth(),
      nativeRoot: 'C:\\Users\\Ada\\Project',
      filename: 'out.wav',
      diskRender: createDefaultDiskRender(),
      messageColorsEnabled: true,
      platform: 'win32',
      fsSeam,
      executionSeam: {
        runCsound: vi.fn(),
        runConfinedCsound: async () => ({
          exitCode: 72,
          stderr: 'CONFINED_FILESYSTEM_UNSUPPORTED: Destination volume does not support hard links',
        }),
      },
    });
    expect(winDenied).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });

    // Deterministic native blue-engine --run-confined-render verification (does not require external Csound)
    const workspaceRoot = path.resolve(__dirname, '../../../..');
    const devEnginePath = path.join(
      workspaceRoot,
      'native',
      'blue-engine',
      'dist',
      `${process.platform}-${process.arch}`,
      process.platform === 'win32' ? 'blue-engine.exe' : 'blue-engine',
    );
    if (fs.existsSync(devEnginePath)) {
      const nativeDir = createTempDir();
      const canonicalNativeDir = fs.realpathSync(nativeDir);
      const runRes = await executeConfinedMcpRender({
        data: createSineProject(),
        expectedReceipt: DEFAULT_RECEIPT,
        getCurrentReceipt: () => DEFAULT_RECEIPT,
        auth: makeAuth(),
        nativeRoot: nativeDir,
        filename: 'mismatch.wav',
        diskRender: createDefaultDiskRender(),
        messageColorsEnabled: false,
        executionSeam: {
          runCsound: vi.fn(),
          runConfinedCsound: async (request) => {
            try {
              const out = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
                (resolve) => {
                  const child = execFile(
                    devEnginePath,
                    [
                      '--run-confined-render',
                      '--root-dir',
                      request.rootPath,
                      '--root-dev',
                      request.rootDev,
                      '--root-ino',
                      // Intentionally mismatch expected inode inside native blue-engine
                      `${BigInt(request.rootIno) + 1n}`,
                      '--wav-dev',
                      request.rootDev,
                      '--wav-ino',
                      '1',
                      '--',
                      ...request.args,
                    ],
                    { encoding: 'utf8' },
                    (error, stdout, stderr) => {
                      const code =
                        error && typeof (error as { code?: unknown }).code === 'number'
                          ? ((error as { code: number }).code ?? 1)
                          : error
                            ? 1
                            : 0;
                      resolve({ stdout, stderr, exitCode: code });
                    },
                  );
                  child.stdin?.end(request.csdText, 'utf8');
                },
              );
              return { exitCode: out.exitCode, stdout: out.stdout, stderr: out.stderr };
            } catch (error) {
              return {
                exitCode: 1,
                stderr: error instanceof Error ? error.message : String(error),
              };
            }
          },
        },
      });
      expect(runRes).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
      expect((runRes as { message?: string }).message).toContain('CONFINED_ROOT_MISMATCH');
      expect(fs.readdirSync(canonicalNativeDir)).toEqual([]);
    }
  });

  const workspaceRoot = path.resolve(__dirname, '../../../..');
  const stagedEngine = developmentEnginePath(workspaceRoot, process.platform, process.arch);

  it.skipIf(process.platform === 'linux')(
    'allocates native staging only in the approved directory and refuses a collision (T075)',
    (context) => {
      if (!fs.existsSync(stagedEngine) && process.env.BLUE_REQUIRE_NATIVE_RENDER_TESTS !== '1') {
        context.skip('No staged Blue Engine is available.');
      }
      const root = fs.realpathSync(createTempDir());
      const identity = fs.statSync(root, { bigint: true });
      const leaf = process.platform === 'darwin' ? 'blue-mcp-test.wav' : 'blue-mcp-test';
      const allocation = (ino: bigint) =>
        spawnSync(
          stagedEngine,
          [
            '--allocate-confined-staging',
            '--root-dir',
            root,
            '--root-dev',
            String(identity.dev),
            '--root-ino',
            String(ino),
            '--output-name',
            leaf,
            ...(process.platform === 'darwin'
              ? ['--', '00000000-0000-0000-0000-000000000000']
              : []),
          ],
          { encoding: 'utf8', windowsHide: true },
        );
      expect(allocation(identity.ino + 1n).status).toBe(70);
      expect(fs.readdirSync(root)).toEqual([]);
      const created = allocation(identity.ino);
      expect(created.status, created.stderr).toBe(0);
      const entry = fs.lstatSync(path.join(root, leaf), { bigint: true });
      expect(created.stdout.trim()).toBe(`${entry.dev} ${entry.ino}`);
      expect(allocation(identity.ino).status).toBe(73);
      expect(fs.lstatSync(path.join(root, leaf), { bigint: true }).ino).toBe(entry.ino);
    },
  );

  const createNativeStagedWav = (
    parent: string,
    payload: Buffer,
    options: { keepLinkedOnPosix?: boolean } = {},
  ): {
    wavFd: number;
    wavDev: bigint;
    wavIno: bigint;
    stageDir?: string;
    wavPath?: string;
    dispose: () => void;
  } => {
    const canonicalParent = fs.realpathSync(parent);
    if (process.platform === 'linux' && !options.keepLinkedOnPosix) {
      const oTmpfile = (fs.constants.O_DIRECTORY ?? 0) | 0o20000000;
      const wavFd = fs.openSync(canonicalParent, fs.constants.O_RDWR | oTmpfile, 0o600);
      fs.writeSync(wavFd, payload);
      const stat = fs.fstatSync(wavFd, { bigint: true });
      return {
        wavFd,
        wavDev: stat.dev,
        wavIno: stat.ino,
        dispose: () => {
          try {
            fs.closeSync(wavFd);
          } catch {
            // Ignore close failure.
          }
        },
      };
    }
    const stageDir = path.join(canonicalParent, 'stage é');
    fs.mkdirSync(stageDir);
    const wavPath = path.join(stageDir, 'render.wav');
    const wavFd = fs.openSync(
      wavPath,
      fs.constants.O_RDWR |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        (fs.constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    fs.writeSync(wavFd, payload);
    const wavStat = fs.fstatSync(wavFd, { bigint: true });
    return {
      wavFd,
      wavDev: wavStat.dev,
      wavIno: wavStat.ino,
      stageDir: process.platform === 'win32' || options.keepLinkedOnPosix ? stageDir : undefined,
      wavPath: process.platform === 'win32' || options.keepLinkedOnPosix ? wavPath : undefined,
      dispose: () => {
        try {
          fs.closeSync(wavFd);
        } catch {
          // Ignore close failure.
        }
      },
    };
  };

  it.for([
    'moved root',
    'wrong wav identity',
    'short wav',
    'linked WAV refused on Linux',
    'replaced WAV path on windows',
    'late collision',
    'publish',
  ] as const)('runs native no-replace publication without Csound for %s', (scenario, context) => {
    if (!fs.existsSync(stagedEngine) && process.env.BLUE_REQUIRE_NATIVE_RENDER_TESTS !== '1') {
      context.skip('No staged Blue Engine is available.');
    }
    if (scenario === 'linked WAV refused on Linux' && process.platform !== 'linux') {
      context.skip('Linux requires an anonymous descriptor.');
    }
    if (scenario === 'replaced WAV path on windows' && process.platform !== 'win32') {
      context.skip('Windows handle-bound path replacement scenario runs on Windows.');
    }
    const parent = fs.realpathSync(createTempDir());
    const root = path.join(parent, 'approved 音');
    fs.mkdirSync(root);
    const rendered = Buffer.alloc(scenario === 'short wav' ? 12 : 44).fill('test');
    const staged = createNativeStagedWav(parent, rendered, {
      keepLinkedOnPosix: scenario === 'linked WAV refused on Linux',
    });
    try {
      const rootStat = fs.statSync(root, { bigint: true });
      const target = path.join(root, 'audio.wav');
      if (scenario === 'moved root') {
        fs.renameSync(root, path.join(parent, 'moved-root'));
        fs.mkdirSync(root);
      } else if (scenario === 'late collision') {
        fs.writeFileSync(target, 'keep existing audio');
      } else if (scenario === 'replaced WAV path on windows' && staged.wavPath && staged.stageDir) {
        fs.renameSync(staged.wavPath, path.join(staged.stageDir, 'moved-owned.wav'));
        fs.writeFileSync(staged.wavPath, 'unrelated WAV');
      }
      const expectedWavIno = scenario === 'wrong wav identity' ? staged.wavIno + 1n : staged.wavIno;
      const result = spawnSync(
        stagedEngine,
        [
          '--publish-confined-render',
          '--root-dir',
          root,
          '--root-dev',
          String(rootStat.dev),
          '--root-ino',
          String(rootStat.ino),
          '--output-name',
          'audio.wav',
          '--wav-dev',
          String(staged.wavDev),
          '--wav-ino',
          String(expectedWavIno),
        ],
        { encoding: 'utf8', windowsHide: true, stdio: [staged.wavFd, 'ignore', 'pipe'] },
      );
      expect(result.error).toBeUndefined();
      if (scenario === 'publish' || scenario === 'replaced WAV path on windows') {
        expect(result.status, result.stderr).toBe(0);
        expect(fs.readFileSync(target)).toEqual(rendered);
        if (scenario === 'replaced WAV path on windows' && staged.wavPath) {
          expect(fs.readFileSync(staged.wavPath, 'utf8')).toBe('unrelated WAV');
        }
      } else {
        expect(result.status).toBeGreaterThan(0);
        if (scenario === 'late collision') {
          expect(fs.readFileSync(target, 'utf8')).toBe('keep existing audio');
        } else {
          expect(fs.existsSync(target)).toBe(false);
        }
      }
    } finally {
      staged.dispose();
    }
  });

  it.for([
    'owned cleanup',
    'replaced staging dir',
    'replaced WAV entry',
    'wrong wav identity',
    'unrelated entry preserved',
    'symlink staging refused',
  ] as const)(
    'enforces ownership-bound native staging cleanup without Csound for %s (T073)',
    (scenario, context) => {
      if (!fs.existsSync(stagedEngine) && process.env.BLUE_REQUIRE_NATIVE_RENDER_TESTS !== '1') {
        context.skip('No staged Blue Engine is available.');
      }
      if (scenario === 'symlink staging refused' && process.platform === 'win32') {
        context.skip('POSIX directory symlink test runs on POSIX hosts.');
      }
      const parent = fs.realpathSync(createTempDir());
      const stage = path.join(parent, 'stage é');
      fs.mkdirSync(stage);
      const stageStat = fs.lstatSync(stage, { bigint: true });
      const wavPath = path.join(stage, 'render.wav');
      const wavFd = fs.openSync(
        wavPath,
        fs.constants.O_RDWR |
          fs.constants.O_CREAT |
          fs.constants.O_EXCL |
          (fs.constants.O_NOFOLLOW ?? 0),
        0o600,
      );
      fs.writeSync(wavFd, Buffer.alloc(44).fill('x'));
      const wavStat = fs.fstatSync(wavFd, { bigint: true });
      const victimDir = path.join(parent, 'victim-empty');
      let wavClosed = false;
      const closeWav = () => {
        if (wavClosed) return;
        wavClosed = true;
        fs.closeSync(wavFd);
      };

      try {
        if (scenario === 'replaced staging dir') {
          if (process.platform === 'win32') {
            // Release wavFd before renaming the directory on Windows to simulate a swapped dir before dir cleanup.
            closeWav();
            fs.renameSync(stage, path.join(parent, 'moved-stage'));
            fs.mkdirSync(stage);
          } else {
            fs.renameSync(stage, path.join(parent, 'moved-stage'));
            fs.mkdirSync(stage);
            fs.writeFileSync(path.join(stage, 'keep.txt'), 'replacement');
          }
        } else if (scenario === 'replaced WAV entry') {
          fs.renameSync(wavPath, path.join(stage, 'moved-owned.wav'));
          fs.writeFileSync(wavPath, 'unrelated victim');
        } else if (scenario === 'unrelated entry preserved') {
          fs.writeFileSync(path.join(stage, 'keep.txt'), 'preserve me');
        } else if (scenario === 'symlink staging refused') {
          fs.mkdirSync(victimDir);
          fs.renameSync(stage, path.join(parent, 'moved-stage'));
          fs.symlinkSync(victimDir, stage);
        }

        const requestedWavIno = scenario === 'wrong wav identity' ? wavStat.ino + 1n : wavStat.ino;

        if (process.platform === 'win32') {
          if (scenario !== 'replaced staging dir') {
            const wavCleanup = spawnSync(
              stagedEngine,
              [
                '--cleanup-confined-render',
                '--wav-dev',
                String(wavStat.dev),
                '--wav-ino',
                String(requestedWavIno),
              ],
              { encoding: 'utf8', windowsHide: true, stdio: [wavFd, 'ignore', 'pipe'] },
            );
            closeWav();
            if (scenario === 'wrong wav identity') {
              expect(wavCleanup.status).toBe(70);
              expect(fs.existsSync(wavPath)).toBe(true);
            } else {
              expect(wavCleanup.status, wavCleanup.stderr).toBe(0);
              if (scenario === 'replaced WAV entry') {
                // Owned handle (moved-owned.wav) deleted; victim at render.wav preserved.
                expect(fs.existsSync(path.join(stage, 'moved-owned.wav'))).toBe(false);
                expect(fs.readFileSync(wavPath, 'utf8')).toBe('unrelated victim');
              } else {
                expect(fs.existsSync(wavPath)).toBe(false);
              }
            }
          }
          const dirCleanup = spawnSync(
            stagedEngine,
            [
              '--cleanup-confined-render',
              '--root-dir',
              stage,
              '--root-dev',
              String(stageStat.dev),
              '--root-ino',
              String(stageStat.ino),
            ],
            { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
          );
          if (scenario === 'owned cleanup') {
            expect(dirCleanup.status, dirCleanup.stderr).toBe(0);
            expect(fs.existsSync(stage)).toBe(false);
          } else if (scenario === 'replaced staging dir') {
            expect(dirCleanup.status).toBe(70);
            expect(fs.existsSync(stage)).toBe(true);
          } else {
            expect(dirCleanup.status).toBe(74);
            expect(fs.existsSync(stage)).toBe(true);
            if (scenario === 'unrelated entry preserved') {
              expect(fs.readFileSync(path.join(stage, 'keep.txt'), 'utf8')).toBe('preserve me');
            }
          }
        } else {
          const cleanup = spawnSync(
            stagedEngine,
            [
              '--cleanup-confined-render',
              '--root-dir',
              stage,
              '--root-dev',
              String(stageStat.dev),
              '--root-ino',
              String(stageStat.ino),
              '--output-name',
              'render.wav',
              '--wav-dev',
              String(wavStat.dev),
              '--wav-ino',
              String(requestedWavIno),
            ],
            { encoding: 'utf8', windowsHide: true, stdio: [wavFd, 'ignore', 'pipe'] },
          );
          expect(cleanup.status, cleanup.stderr).toBe(72);
          expect(fs.fstatSync(wavFd, { bigint: true }).nlink).toBe(1n);
          expect(fs.existsSync(stage)).toBe(true);
        }
      } finally {
        closeWav();
      }
    },
  );

  it('renders a sine WAV and fences a stale destination at the publication callback', async (context) => {
    const scratchProfile = createTempDir();
    const runtime = new EngineRuntimeService({
      isPackaged: false,
      resourcesPath: workspaceRoot,
      repoRoot: workspaceRoot,
      scratchProfile,
      getSettingsEnginePath: () => '',
    });
    const probe = await runtime.probe();
    if (!probe.ok || !probe.report?.ready) {
      context.skip(`Csound sine coverage unavailable: ${probe.message}`);
      return;
    }

    const runWithRealEngine = async (
      nativeRoot: string,
      filename: string,
      data: BlueData,
      authorizedRoot: ReturnType<typeof captureAuthorizedRenderRoot>,
      atPublication?: () => void,
      signal = new AbortController().signal,
    ) => {
      expect(authorizedRoot.ok).toBe(true);
      if (!authorizedRoot.ok) throw new Error(authorizedRoot.message);
      try {
        return await executeConfinedMcpRender({
          data,
          expectedReceipt: DEFAULT_RECEIPT,
          getCurrentReceipt: () => DEFAULT_RECEIPT,
          auth: makeAuth({ signal }),
          nativeRoot,
          authorizedRoot: authorizedRoot.value,
          filename,
          diskRender: createDefaultDiskRender(),
          messageColorsEnabled: false,
          executionSeam: {
            runCsound: vi.fn(),
            runConfinedCsound: async (request) => {
              const execRes = await runtime.executeCsound(
                {
                  kind: 'confined-render',
                  operationId: `native-confined-${Date.now()}`,
                  rootPath: request.rootPath,
                  rootDev: request.rootDev,
                  rootIno: request.rootIno,
                  outputFilename: request.outputFilename,
                  csdText: request.csdText,
                  args: request.args,
                },
                {
                  signal,
                  beforeLaunch: request.beforeLaunch,
                  beforePublish: () => {
                    atPublication?.();
                    return request.beforePublish();
                  },
                },
              );
              return {
                exitCode: execRes.exitCode ?? -1,
                stderr: execRes.stderr || execRes.message,
                stdout: execRes.stdout,
                cancelled: execRes.state === 'cancelled',
                errorCode: execRes.errorCode,
                message: execRes.message,
              };
            },
          },
        });
      } finally {
        authorizedRoot.value.dispose();
      }
    };

    const isEngineStagingEntry = (entry: string) =>
      entry.startsWith('blue-mcp-render-') && !entry.startsWith('blue-mcp-render-test-');
    const stagingDirsBefore = new Set(fs.readdirSync(os.tmpdir()).filter(isEngineStagingEntry));

    // 1. Supported-platform real sine render produces RIFF/WAVE WAV with zero staging residue.
    const outDir = createTempDir();
    const canonicalOutDir = fs.realpathSync(outDir);
    const sineResult = await runWithRealEngine(
      outDir,
      'real-sine.wav',
      createSineProject(),
      captureAuthorizedRenderRoot(outDir),
    );
    expect(sineResult).toEqual({
      ok: true,
      value: {
        outputPath: path.join(canonicalOutDir, 'real-sine.wav'),
        receipt: DEFAULT_RECEIPT,
      },
    });
    const wavBytes = fs.readFileSync(path.join(canonicalOutDir, 'real-sine.wav'));
    expect(wavBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wavBytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(fs.readdirSync(canonicalOutDir)).toEqual(['real-sine.wav']);

    // Re-render to same filename refuses before Csound dispatch without overwriting.
    const noOverwrite = await runWithRealEngine(
      outDir,
      'real-sine.wav',
      createSineProject(),
      captureAuthorizedRenderRoot(outDir),
    );
    expect(noOverwrite).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    expect(fs.readFileSync(path.join(canonicalOutDir, 'real-sine.wav'))).toEqual(wavBytes);

    const crossVolumeRoot = process.env.BLUE_TEST_RENDER_VOLUME;
    if (crossVolumeRoot) {
      const crossOut = fs.realpathSync(createTempDir(crossVolumeRoot));
      expect(fs.statSync(crossOut).dev).not.toBe(fs.statSync(os.tmpdir()).dev);
      const crossResult = await runWithRealEngine(
        crossOut,
        'cross-volume.wav',
        createSineProject(),
        captureAuthorizedRenderRoot(crossOut),
      );
      expect(crossResult).toMatchObject({ ok: true });
      const finalWav = fs.readFileSync(path.join(crossOut, 'cross-volume.wav'));
      expect(finalWav).toEqual(wavBytes);
      const cancel = new AbortController();
      const cancelled = await runWithRealEngine(
        crossOut,
        'cancelled.wav',
        createSineProject(),
        captureAuthorizedRenderRoot(crossOut),
        () => cancel.abort(),
        cancel.signal,
      );
      expect(cancelled).toMatchObject({ ok: false, code: 'CANCELLED' });
      expect(fs.existsSync(path.join(crossOut, 'cancelled.wav'))).toBe(false);
      const residue = fs.readdirSync(crossOut).filter((name) => name !== 'cross-volume.wav');
      if (process.platform === 'darwin') {
        expect(residue).toHaveLength(1);
        expect(fs.statSync(path.join(crossOut, residue[0]!)).size).toBe(0);
        const root = fs.statSync(crossOut, { bigint: true });
        const abandoned = openMacRenderScratch(scratchProfile, crossOut, false, root)!;
        fs.writeSync(abandoned.wavFd, 'unpublished audio');
        fs.closeSync(abandoned.wavFd);
        recoverMacRenderScratch(scratchProfile, fs.realpathSync(os.tmpdir()));
        expect(fs.statSync(path.join(crossOut, residue[0]!)).size).toBe(0);
      } else {
        expect(residue).toEqual([]);
      }
    }

    const unsupportedVolume = process.env.BLUE_TEST_UNSUPPORTED_RENDER_VOLUME;
    if (unsupportedVolume) {
      const unsupportedOut = createTempDir(unsupportedVolume);
      const result = await runWithRealEngine(
        unsupportedOut,
        'unsupported.wav',
        createSineProject(),
        captureAuthorizedRenderRoot(unsupportedOut),
      );
      expect(result).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
      expect(fs.existsSync(path.join(unsupportedOut, 'unsupported.wav'))).toBe(false);
      expect(fs.readdirSync(unsupportedOut)).toEqual([]);
    }

    const unavailableVolume = process.env.BLUE_TEST_READONLY_RENDER_VOLUME;
    if (unavailableVolume) {
      expect(fs.statSync(unavailableVolume).dev).not.toBe(fs.statSync(os.tmpdir()).dev);
      const candidate = `blue-test-${Date.now()}.wav`;
      const refused = await runWithRealEngine(
        unavailableVolume,
        candidate,
        createSineProject(),
        captureAuthorizedRenderRoot(unavailableVolume),
      );
      expect(refused).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
      expect(fs.existsSync(path.join(unavailableVolume, candidate))).toBe(false);
    }

    const raceParent = createTempDir();
    const authorizedDir = path.join(raceParent, 'authorized');
    const movedDir = path.join(raceParent, 'authorized.moved');
    fs.mkdirSync(authorizedDir);
    const capturedRaceRoot = captureAuthorizedRenderRoot(authorizedDir);
    const atPublication = vi.fn(() => {
      fs.renameSync(authorizedDir, movedDir);
      fs.mkdirSync(authorizedDir);
      fs.writeFileSync(path.join(authorizedDir, 'unrelated.txt'), 'keep');
    });
    const raceResult = await runWithRealEngine(
      authorizedDir,
      'race-pub.wav',
      createSineProject(),
      capturedRaceRoot,
      atPublication,
    );
    expect(atPublication).toHaveBeenCalledOnce();
    expect(raceResult).toMatchObject({ ok: false, code: 'OUTPUT_REJECTED' });
    expect(fs.readdirSync(authorizedDir)).toEqual(['unrelated.txt']);
    expect(fs.readdirSync(movedDir)).toEqual([]);

    const stagingDirsAfter = fs
      .readdirSync(os.tmpdir())
      .filter((entry) => isEngineStagingEntry(entry) && !stagingDirsBefore.has(entry));
    expect(stagingDirsAfter).toEqual([]);
  }, 30_000);
});
