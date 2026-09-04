import { describe, expect, it } from 'vitest';

import { ProjectProperties } from '@blue/data';

import {
  planDiskCommand,
  planFreezeCommand,
  getDiskMessageLevel,
  extractOutputFromCommand,
  tokenizeCommand,
} from './disk-render-command';
import type { DiskRenderSettingsSnapshot } from '../shared/program-settings';

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

describe('planDiskCommand — normal mode', () => {
  it('builds standard WAV:SHORT command with all default flags', () => {
    const plan = planDiskCommand({
      diskRender: createDefaultDiskRender(),
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: false,
    });

    expect(plan.mode).toBe('normal');
    expect(plan.outputPath).toBe('/tmp/out.wav');

    expect(plan.args).toContain('-+msg_color=false');
    expect(plan.args).toContain('--format=wav:short');
    expect(plan.args).toContain('-R');
    expect(plan.args).toContain('-d');
    expect(plan.args).toContain('-m135');
    expect(plan.args).toContain('-o');
    expect(plan.args[plan.args.length - 1]).toBe('/tmp/out.wav');
  });

  it('omits -K when savePeakInformation is true', () => {
    const dr = createDefaultDiskRender();
    dr.savePeakInformation = true;

    const plan = planDiskCommand({
      diskRender: dr,
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).not.toContain('-K');
  });

  it('adds -K when savePeakInformation is false', () => {
    const dr = createDefaultDiskRender();
    dr.savePeakInformation = false;

    const plan = planDiskCommand({
      diskRender: dr,
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).toContain('-K');
  });

  it('adds -Z when ditherOutput is true', () => {
    const dr = createDefaultDiskRender();
    dr.ditherOutput = true;

    const plan = planDiskCommand({
      diskRender: dr,
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).toContain('-Z');
  });

  it('omits -R when rewriteHeader is false', () => {
    const dr = createDefaultDiskRender();
    dr.rewriteHeader = false;

    const plan = planDiskCommand({
      diskRender: dr,
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).not.toContain('-R');
  });

  it('omits -d when displaysDisabled is false', () => {
    const dr = createDefaultDiskRender();
    dr.displaysDisabled = false;

    const plan = planDiskCommand({
      diskRender: dr,
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).not.toContain('-d');
  });
});

describe('planDiskCommand — format toggles', () => {
  it('omits --format when fileFormatEnabled is false', () => {
    const dr = createDefaultDiskRender();
    dr.fileFormatEnabled = false;

    const plan = planDiskCommand({
      diskRender: dr,
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args.find((a) => a.startsWith('--format'))).toBeUndefined();
  });

  it('includes format without sample when sampleFormatEnabled is false', () => {
    const dr = createDefaultDiskRender();
    dr.sampleFormatEnabled = false;

    const plan = planDiskCommand({
      diskRender: dr,
      props: new ProjectProperties(),
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).toContain('--format=wav');
    expect(plan.args.find((a) => a.startsWith('--format=wav:'))).toBeUndefined();
  });

  for (const fmt of ['WAV', 'AIFF', 'AU', 'RAW', 'IRCAM', 'W64', 'WAVEX', 'SD2', 'FLAC']) {
    it(`uses lowercased ${fmt} file format`, () => {
      const dr = createDefaultDiskRender();
      dr.fileFormat = fmt;
      dr.sampleFormatEnabled = false;

      const plan = planDiskCommand({
        diskRender: dr,
        props: new ProjectProperties(),
        outputFile: '/tmp/out.wav',
        messageColorsEnabled: true,
      });

      expect(plan.args).toContain(`--format=${fmt.toLowerCase()}`);
    });
  }

  for (const fmt of ['ALAW', 'ULAW', 'SCHAR', 'UCHAR', 'FLOAT', 'SHORT', 'LONG', '24BIT']) {
    it(`uses lowercased ${fmt} sample format as suffix`, () => {
      const dr = createDefaultDiskRender();
      dr.sampleFormat = fmt;

      const plan = planDiskCommand({
        diskRender: dr,
        props: new ProjectProperties(),
        outputFile: '/tmp/out.wav',
        messageColorsEnabled: true,
      });

      expect(plan.args).toContain(`--format=wav:${fmt.toLowerCase()}`);
    });
  }
});

describe('planDiskCommand — project message level', () => {
  it('computes message level bitmask from disk properties', () => {
    const props = new ProjectProperties();
    props.diskNoteAmpsEnabled = true;
    props.diskOutOfRangeEnabled = true;
    props.diskWarningsEnabled = true;
    props.diskBenchmarkEnabled = true;

    expect(getDiskMessageLevel(props)).toBe(135);

    props.diskBenchmarkEnabled = false;
    expect(getDiskMessageLevel(props)).toBe(7);

    props.diskNoteAmpsEnabled = false;
    expect(getDiskMessageLevel(props)).toBe(6);
  });

  it('includes the project message flag in args', () => {
    const props = new ProjectProperties();
    props.diskNoteAmpsEnabled = false;
    props.diskOutOfRangeEnabled = false;
    props.diskWarningsEnabled = false;
    props.diskBenchmarkEnabled = false;

    const plan = planDiskCommand({
      diskRender: createDefaultDiskRender(),
      props,
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).toContain('-m0');
  });
});

describe('planDiskCommand — advanced settings', () => {
  it('appends project diskAdvancedSettings tokens', () => {
    const props = new ProjectProperties();
    props.diskAdvancedSettings = '--env:MY_VAR=1 -b1024';
    const diskRender = createDefaultDiskRender();
    diskRender.advancedSettings = '--program-value-must-not-be-used';

    const plan = planDiskCommand({
      diskRender,
      props,
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    expect(plan.args).toContain('--env:MY_VAR=1');
    expect(plan.args).toContain('-b1024');
    expect(plan.args).not.toContain('--program-value-must-not-be-used');
  });

  it('appends advanced settings before -o', () => {
    const props = new ProjectProperties();
    props.diskAdvancedSettings = '-b1024';

    const plan = planDiskCommand({
      diskRender: createDefaultDiskRender(),
      props,
      outputFile: '/tmp/out.wav',
      messageColorsEnabled: true,
    });

    const advancedIdx = plan.args.indexOf('-b1024');
    const oIdx = plan.args.indexOf('-o');
    expect(advancedIdx).toBeGreaterThan(-1);
    expect(oIdx).toBeGreaterThan(advancedIdx);
  });
});

describe('planDiskCommand — complete override', () => {
  it('uses diskAdvancedSettings as the full command without normal flags', () => {
    const props = new ProjectProperties();
    props.diskCompleteOverride = true;
    props.diskAdvancedSettings = '--format=flac -m0 -omyfile.flac';

    const plan = planDiskCommand({
      diskRender: createDefaultDiskRender(),
      props,
      outputFile: '/tmp/ignored.wav',
      messageColorsEnabled: true,
    });

    expect(plan.mode).toBe('completeOverride');
    expect(plan.args).not.toContain('-R');
    expect(plan.args).not.toContain('-d');
    expect(plan.args).not.toContain('--format=wav:short');
    expect(plan.args).toContain('--format=flac');
    expect(plan.args).toContain('-m0');
    expect(plan.args).toContain('-omyfile.flac');
    expect(plan.outputPath).toBe('myfile.flac');
  });

  it('extracts output from tokens with -o prefix', () => {
    const args = ['-o', 'render.wav', '-m0'];
    expect(extractOutputFromCommand(args)).toBe('render.wav');
  });

  it('extracts output from combined -o token', () => {
    const args = ['-orender.wav'];
    expect(extractOutputFromCommand(args)).toBe('render.wav');
  });

  it('returns null when no output is identifiable', () => {
    const args = ['-m0', '-d'];
    expect(extractOutputFromCommand(args)).toBeNull();
  });

  it('normalizes quoted override output paths and requires an explicit output', () => {
    const props = new ProjectProperties();
    props.diskCompleteOverride = true;
    props.diskAdvancedSettings = '-o "renders/final mix.wav" -d';

    const plan = planDiskCommand({
      diskRender: createDefaultDiskRender(),
      props,
      outputFile: null,
      messageColorsEnabled: true,
    });

    expect(tokenizeCommand(props.diskAdvancedSettings)).toContain('renders/final mix.wav');
    expect(plan.outputPath).toBe('renders/final mix.wav');

    props.diskAdvancedSettings = '-d -m0';
    expect(() =>
      planDiskCommand({
        diskRender: createDefaultDiskRender(),
        props,
        outputFile: null,
        messageColorsEnabled: true,
      }),
    ).toThrow(/must include an output file/i);
  });
});

describe('planFreezeCommand', () => {
  it('builds freeze flags + output + csd path', () => {
    const plan = planFreezeCommand({
      freezeFlags: '-Wdo',
      outputFilePath: '/project/freeze0.wav',
      csdPath: '/tmp/tempCsd123.csd',
    });

    expect(plan.args).toEqual(['-Wdo', '/project/freeze0.wav', '/tmp/tempCsd123.csd']);
  });

  it('uses macOS freeze flags -Ado', () => {
    const plan = planFreezeCommand({
      freezeFlags: '-Ado',
      outputFilePath: '/project/freeze0.aif',
      csdPath: '/tmp/temp.csd',
    });

    expect(plan.args).toEqual(['-Ado', '/project/freeze0.aif', '/tmp/temp.csd']);
  });
});
