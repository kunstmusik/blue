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
  TuningProcessor,
} from '@blue/data';
import type { DiskRenderSettingsSnapshot } from '../shared/program-settings';
import { planVettedMcpDiskCommand } from './disk-render-command';
import { developmentEnginePath, EngineRuntimeService } from './engine-runtime';
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
    const libClip = new AudioClip();
    audioClipData.getSoundObjectLibrary().addObject(libClip);
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

  function createTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-mcp-render-test-'));
    tempDirs.push(dir);
    return dir;
  }

  it('renders an eligible sine project through the confined runner with zero staging residue', async () => {
    const root = createTempDir();
    const canonicalRoot = fs.realpathSync(root);
    const data = createSineProject();
    let capturedRequest: ConfinedCsoundRunRequest | null = null;

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
          capturedRequest = req;
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
    expect(capturedRequest?.args).toContain('--format=wav:short');
    expect(capturedRequest?.args).toContain('-+msg_color=false');
    expect(capturedRequest?.args).not.toContain('-o');
    expect(capturedRequest?.csdText).toContain('<CsoundSynthesizer>');
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
      fs.symlinkSync(swappedDir, approvedDir);

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
    const archKey = `${process.platform}-${process.arch}`;
    const fakeEngine = path.join(fakeRepo, 'native', 'blue-engine', 'dist', archKey, 'blue-engine');
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
        executableName: 'blue-engine',
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
          fs.symlinkSync(decoy, dir);
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
                features: ['csound-probe-v1', 'csound-performance-v1', 'csound-confined-render-v2'],
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
                      '--output-name',
                      request.outputFilename,
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

  it.for(['moved root', 'replaced staging', 'replaced WAV', 'late collision', 'publish'] as const)(
    'runs native no-replace publication without Csound for %s',
    (scenario, context) => {
      if (!fs.existsSync(stagedEngine) && process.env.BLUE_REQUIRE_NATIVE_RENDER_TESTS !== '1') {
        context.skip('No staged Blue Engine is available.');
      }
      const parent = createTempDir();
      const root = path.join(parent, 'approved 音');
      const stage = path.join(parent, 'stage é');
      fs.mkdirSync(root);
      fs.mkdirSync(stage);
      const wav = path.join(stage, 'render.wav');
      const rendered = Buffer.alloc(44).fill('test');
      fs.writeFileSync(wav, rendered);
      const rootStat = fs.statSync(root, { bigint: true });
      const stageStat = fs.statSync(stage, { bigint: true });
      const wavStat = fs.statSync(wav, { bigint: true });
      const target = path.join(root, 'audio.wav');
      if (scenario === 'moved root') {
        fs.renameSync(root, path.join(parent, 'moved-root'));
        fs.mkdirSync(root);
      } else if (scenario === 'replaced staging') {
        fs.renameSync(stage, path.join(parent, 'moved-stage'));
        fs.mkdirSync(stage);
        fs.writeFileSync(wav, 'unrelated WAV');
      } else if (scenario === 'replaced WAV') {
        fs.renameSync(wav, path.join(stage, 'original.wav'));
        fs.writeFileSync(wav, 'unrelated WAV');
      } else if (scenario === 'late collision') {
        fs.writeFileSync(target, 'keep existing audio');
      }
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
          '--',
          stage,
          String(stageStat.dev),
          String(stageStat.ino),
          String(wavStat.ino),
        ],
        { encoding: 'utf8', windowsHide: true },
      );
      expect(result.error).toBeUndefined();
      if (scenario === 'publish') {
        expect(result.status, result.stderr).toBe(0);
        expect(fs.readFileSync(target)).toEqual(rendered);
      } else {
        expect(result.status).toBeGreaterThan(0);
        if (scenario === 'late collision') {
          expect(fs.readFileSync(target, 'utf8')).toBe('keep existing audio');
        } else {
          expect(fs.existsSync(target)).toBe(false);
        }
        if (scenario === 'replaced staging' || scenario === 'replaced WAV') {
          expect(fs.readFileSync(wav, 'utf8')).toBe('unrelated WAV');
        }
      }
    },
  );

  it('renders a sine WAV and fences a stale destination at the publication callback', async (context) => {
    const runtime = new EngineRuntimeService({
      isPackaged: false,
      resourcesPath: workspaceRoot,
      repoRoot: workspaceRoot,
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
    ) => {
      expect(authorizedRoot.ok).toBe(true);
      if (!authorizedRoot.ok) throw new Error(authorizedRoot.message);
      try {
        return await executeConfinedMcpRender({
          data,
          expectedReceipt: DEFAULT_RECEIPT,
          getCurrentReceipt: () => DEFAULT_RECEIPT,
          auth: makeAuth(),
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
  }, 30_000);
});
