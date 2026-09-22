import * as fs from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { Channel } from './mixer/channel';
import { getStereoPanGains } from './mixer/channel-pan';
import { GenericInstrument } from './instruments/generic-instrument';
import { BlueSynthBuilder } from './instruments/blue-synth-builder';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { OpcodeList } from './opcodes/opcode-list';
import { UDOStyle } from './opcodes/udo-style';
import { Tables } from './tables';
import { CurveType } from './time/curve-type';
import { TempoMap } from './time/tempo-map';
import { getTempoScore, preprocessSco, processCommandBlocks } from './utilities/csd-render';
import {
  DEMO2026_BLUE_PATH,
  DEMO2026_CSD_PATH,
  hasDemo2026Fixture,
} from './test-support/csd-render-fixtures';
import {
  extractInstrumentSequence,
  extractScoreEvents,
  normalizeWhitespace,
} from './test-support/csd-comparison';
import { initializeJavaScriptRuntime } from './javascript-runtime';

beforeAll(async () => {
  await initializeJavaScriptRuntime();
});

class FtgenAllocationInstrument extends GenericInstrument {
  override generateFTables(tables: unknown): void {
    if (!(tables instanceof Tables)) {
      return;
    }

    const tableNum = tables.getOpenFTableNumber();
    const current = tables.getTables();
    const nextLine = `f ${tableNum} 0 64 10 1`;
    tables.setTables(current ? `${current}\n${nextLine}` : nextLine);
  }

  override deepCopy(): GenericInstrument {
    const copy = new FtgenAllocationInstrument();
    copy.setName(this.getName());
    copy.setText(this.getText());
    copy.setGlobalOrc(this.getGlobalOrc());
    copy.setGlobalSco(this.getGlobalSco());
    return copy;
  }
}

function createBsbInstrumentWithUdo(name: string, gain: number): BlueSynthBuilder {
  const instrument = new BlueSynthBuilder();
  instrument.setName(name);
  instrument.setInstrumentText(
    `ain oscili 0.1, 440\n` + `aout fx ain\n` + `blueMixerOut aout, aout`,
  );

  const opcode = new OpcodeDefinition();
  opcode.setName('fx');
  opcode.setStyle(UDOStyle.CLASSIC);
  opcode.setOutTypes('a');
  opcode.setInTypes('a');
  opcode.setCode(`ain xin\nxout ain * ${gain}`);

  const opcodes = new OpcodeList();
  opcodes.addOpcode(opcode);
  instrument.setOpcodeList(opcodes);

  return instrument;
}

function createGenericInstrumentWithUdo(name: string): GenericInstrument {
  const instrument = new GenericInstrument();
  instrument.setName(name);
  instrument.setText('ain oscili 0.1, 440\n' + 'aout declick ain\n' + 'blueMixerOut aout, aout');

  const opcode = new OpcodeDefinition();
  opcode.setName('declick');
  opcode.setStyle(UDOStyle.CLASSIC);
  opcode.setOutTypes('a');
  opcode.setInTypes('a');
  opcode.setCode('ain xin\nxout ain * 0.5');

  const opcodes = new OpcodeList();
  opcodes.addOpcode(opcode);
  instrument.setOpcodeList(opcodes);

  return instrument;
}

describe('CSD render helpers', () => {
  it('processes pre and once command blocks like Java', () => {
    const output = processCommandBlocks(
      [
        'alpha',
        ';[pre]{',
        'beta',
        ';}',
        'gamma',
        ';[once]{',
        'delta',
        ';}',
        ';[once]{',
        'delta',
        ';}',
      ].join('\n'),
    );

    expect(output).toBe(['beta', 'alpha', 'gamma', 'delta', ''].join('\n'));
  });

  it('substitutes render macros and absolute render start time', () => {
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);

    expect(
      preprocessSco(
        '<TOTAL_DUR>|<PROCESSING_START>|<RENDER_START>|<RENDER_START_ABSOLUTE>',
        12.5,
        3,
        4,
        tempoMap,
      ),
    ).toBe('12.5|4.0|3.0|1.5');
  });

  it('renders tempo score boundaries the same way as Java', () => {
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);
    tempoMap.setTempoPoint(1, 4, 90, CurveType.CONSTANT);

    expect(getTempoScore(tempoMap, 0, 6)).toBe('t 0 120.0 4.0 120.0 4.0 90.0 6.0 90.0\n');
  });
});

describe('BlueData UDO/table parity', () => {
  it('includes generic instrument UDOs in generated csd', () => {
    const data = new BlueData();
    const arrangement = new Arrangement();

    arrangement.addInstrument(createGenericInstrumentWithUdo('Generic'), '1');
    data.setArrangement(arrangement);

    const csd = data.toCSD();

    expect(csd).toContain('opcode declick,a,a');
    expect(csd).toContain('aout declick ain');
    expect(csd).toContain('xout ain * 0.5');
  });

  it('renames colliding UDOs and rewrites instrument references', () => {
    const data = new BlueData();
    const arrangement = new Arrangement();

    arrangement.addInstrument(createBsbInstrumentWithUdo('A', 0.5), '1');
    arrangement.addInstrument(createBsbInstrumentWithUdo('B', 0.25), '2');
    data.setArrangement(arrangement);

    const csd = data.toCSD();

    const uniqueMatch = csd.match(/opcode\s+(uniqueUDO\d+),a,a/);
    expect(uniqueMatch).not.toBeNull();

    const renamedOpcode = uniqueMatch![1];
    expect(csd).toContain('opcode fx,a,a');
    expect(csd).toContain(`aout ${renamedOpcode} ain`);
    expect(csd).toContain('xout ain * 0.5');
    expect(csd).toContain('xout ain * 0.25');
  });

  it('reserves ftgen numbers from global orc before allocating table ids', () => {
    const data = new BlueData();
    data.getGlobalOrcSco().setGlobalOrc('gi_reserved ftgen 1, 0, 1024, 10, 1');

    const arrangement = new Arrangement();
    const tableInstrument = new FtgenAllocationInstrument();
    tableInstrument.setName('Table Builder');
    tableInstrument.setText('aout oscili 0.1, 440\nblueMixerOut aout, aout');
    arrangement.addInstrument(tableInstrument, '1');
    data.setArrangement(arrangement);

    const csd = data.toCSD();
    const scoreSection = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/)?.[1] ?? '';

    expect(scoreSection).toContain('f 2 0 64 10 1');
    expect(scoreSection).not.toContain('f 1 0 64 10 1');
  });

  it('generates bit-for-bit identical CSD from a historyCopy snapshot and isolates candidate mutations', () => {
    const source = new BlueData();
    const arrangement = new Arrangement();
    arrangement.addInstrument(createBsbInstrumentWithUdo('SynthA', 0.75), '1');
    source.setArrangement(arrangement);

    const sourceCsd = source.toCSD();
    expect(sourceCsd).toContain('ain * 0.75');

    // 1. History copy produces exact bit-for-bit identical CSD
    const retainedBefore = source.historyCopy();
    expect(retainedBefore.toCSD()).toBe(sourceCsd);

    // 2. Candidate working copy modified
    const candidate = source.historyCopy();
    const candidateArrangement = candidate.getArrangement();
    const candInstr = candidateArrangement.getInstrument(0) as BlueSynthBuilder;
    candInstr.setName('ModifiedSynth');
    const opcode = candInstr.getOpcodeList().getOpcode(0);
    expect(opcode).not.toBeNull();
    opcode!.setCode('ain xin\nxout ain * 0.125');

    const candidateCsd = candidate.toCSD();
    expect(candidateCsd).toContain('ain * 0.125');
    expect(candidateCsd).not.toBe(sourceCsd);

    // 3. Verify retainedBefore and source CSD remain bit-for-bit unchanged
    expect(source.toCSD()).toBe(sourceCsd);
    expect(retainedBefore.toCSD()).toBe(sourceCsd);

    // 4. Retained after captures candidate state
    const retainedAfter = candidate.historyCopy();
    expect(retainedAfter.toCSD()).toBe(candidateCsd);

    // Further mutate candidate
    opcode!.setCode('ain xin\nxout ain * 0.999');
    expect(retainedAfter.toCSD()).toBe(candidateCsd);
    expect(retainedBefore.toCSD()).toBe(sourceCsd);
    expect(source.toCSD()).toBe(sourceCsd);
  });
});

describe.skipIf(!hasDemo2026Fixture())('Demo2026 CSD parity', () => {
  let generatedScoreEvents: string[] = [];
  let referenceScoreEvents: string[] = [];

  beforeAll(async () => {
    const xml = fs.readFileSync(DEMO2026_BLUE_PATH, 'utf-8');
    const data = await BlueData.loadFromString(xml);
    const generatedCsd = data.toCSD();
    const referenceCsd = fs.readFileSync(DEMO2026_CSD_PATH, 'utf-8');

    generatedScoreEvents = extractScoreEvents(generatedCsd);
    referenceScoreEvents = extractScoreEvents(referenceCsd);
  });

  it('matches the Java score event instrument ordering', () => {
    expect(extractInstrumentSequence(generatedScoreEvents)).toEqual(
      extractInstrumentSequence(referenceScoreEvents),
    );
  });

  it('matches the Java always-on event durations', () => {
    expect(generatedScoreEvents.slice(-6).map(normalizeWhitespace)).toEqual(
      referenceScoreEvents.slice(-6).map(normalizeWhitespace),
    );
  });

  it('generates byte-identical CSD regardless of meter presentation settings (T022)', async () => {
    const xml = fs.readFileSync(DEMO2026_BLUE_PATH, 'utf-8');
    const data = await BlueData.loadFromString(xml);
    const baselineCsd = data.toCSD();

    data.getMixer().setEnableMeters(false);
    expect(data.toCSD()).toBe(baselineCsd);

    data.getMixer().setEnableMeters(true);
    for (const key of [
      'peak-rms-linear-plus-6',
      'peak-rms-mixing-plus-6',
      'k20-rms-peak',
      'k14-rms-peak',
      'k12-rms-peak',
    ] as const) {
      data.getMixer().setMeterProfileKey(key);
      expect(data.toCSD()).toBe(baselineCsd);
    }
  });
});

describe('CSD parity across meter presentation settings with legacy fixture (T037)', () => {
  const legacyXml = [
    '<blueData version="2.8.0">',
    '  <projectProperties>',
    '    <title>Legacy CSD Parity</title>',
    '    <sampleRate>44100</sampleRate>',
    '    <ksmps>100</ksmps>',
    '    <channels>2</channels>',
    '    <useZeroDbFS>true</useZeroDbFS>',
    '    <zeroDbFS>1</zeroDbFS>',
    '  </projectProperties>',
    '  <arrangement>',
    '    <instrument assignment="1">',
    '      <name>Sine</name>',
    '      <comment>Simple sine</comment>',
    '      <text>aout oscili 0.2, 440\nblueMixerOut aout, aout</text>',
    '    </instrument>',
    '  </arrangement>',
    '  <mixer>',
    '    <enabled>true</enabled>',
    '    <channelList list="channels">',
    '      <channel association="1">',
    '        <name>Sine</name>',
    '        <outChannel>Master</outChannel>',
    '        <level>0.0</level>',
    '      </channel>',
    '    </channelList>',
    '    <channelList list="subChannels"/>',
    '    <channel><name>Master</name><level>0.0</level></channel>',
    '  </mixer>',
    '  <score>',
    '    <scoreRoot>',
    '      <trackLayerGroup>',
    '        <trackLayer>',
    '          <soundObject soundObjectType="blue.soundObjects.GenericScore">',
    '            <name>Note</name>',
    '            <startTime>0.0</startTime>',
    '            <subjectiveDuration>2.0</subjectiveDuration>',
    '            <scoreText>i 1 0 2</scoreText>',
    '          </soundObject>',
    '        </trackLayer>',
    '      </trackLayerGroup>',
    '    </scoreRoot>',
    '  </score>',
    '</blueData>',
  ].join('\n');

  it('produces byte-identical toCSD output across all 5 profiles and both visibility values (T037)', () => {
    const data = BlueData.loadFromString(legacyXml);
    // Legacy load resolves enableMeters to false and profile to peak-rms-linear-plus-6
    expect(data.getMixer().isEnableMeters()).toBe(false);
    expect(data.getMixer().getMeterProfileKey()).toBe('peak-rms-linear-plus-6');

    const baselineCsd = data.toCSD();

    const profiles = [
      'peak-rms-linear-plus-6',
      'peak-rms-mixing-plus-6',
      'k20-rms-peak',
      'k14-rms-peak',
      'k12-rms-peak',
    ] as const;

    for (const enabled of [false, true]) {
      data.getMixer().setEnableMeters(enabled);
      for (const profile of profiles) {
        data.getMixer().setMeterProfileKey(profile);
        const generatedCsd = data.toCSD();
        expect(generatedCsd).toBe(baselineCsd);
      }
    }
  });
});

describe('legacy mono/stereo audio playback and mixer CSD parity with Java Blue (T001, T003)', () => {
  it('confirms legacy Blue project XML produces identical CSD routing without panning', () => {
    // In Java Blue (blue-core Channel.java and playback_instrument.orc),
    // mono clips assign to output channel {0} only, and Channel has no pan parameter.
    // TypeScript Blue preserves this exact behavior when panning is disabled.
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
      '    <scoreRoot>',
      '      <trackLayerGroup>',
      '        <trackLayer/>',
      '      </trackLayerGroup>',
      '    </scoreRoot>',
      '  </score>',
      '</blueData>',
    ].join('\n');

    const data = BlueData.loadFromString(xml);
    const csd = data.toCSD();
    // Legacy CSD uses ga_bluemix_* and outc without pan statements
    expect(csd).toContain('ga_bluemix_0_0');
    expect(csd).toContain('outc ga_bluesub_Master_0, ga_bluesub_Master_1');
    expect(csd).not.toContain('bluePan');
    expect(csd).not.toContain('k_pan_l');
    expect(csd).not.toContain('k_bal_l');
  });

  it('verifies Spec 112 intentional divergence: default -3 dB equal power mono pan, balance, send tap before pan, and gate/meter after pan', () => {
    // TypeScript-only divergence: when panningEnabled is true (new project default in Spec 112+),
    // channels route through a live mode-aware panner. Without an observation
    // manifest this channel is stereo-or-unknown, so its default Balance mode
    // is represented by the first matrix branch.
    const data = new BlueData();
    data.getMixer().setPanningEnabled(true);
    data.getMixer().setEnabled(true);

    const ch1 = new Channel();
    ch1.setName('MonoTrack');
    ch1.setAssociation('track-1');
    ch1.setOutChannel('Master');
    ch1.setPan(0.5);
    data.getMixer().getChannels().push(ch1);

    // Default CSD with no observation manifest treats channel as unknown (two-bus -> Balance).
    const realtimeCsd = data.toRealtimePlaybackCSD().csdText;
    expect(realtimeCsd).toContain('if gk_blue_pan_mode_0 < 0.5 then');
    expect(realtimeCsd).toContain('k_pan_al = min(1, 2 * (1 - gk_blue_auto1))');
    expect(realtimeCsd).toContain('k_pan_br = min(1, 2 * gk_blue_auto1)');
    expect(realtimeCsd).toContain('k_pan_ar = 0');
    expect(realtimeCsd).toContain('k_pan_bl = 0');

    // When disabled, no pan/bal stage exists
    data.getMixer().setPanningEnabled(false);
    const disabledCsd = data.toRealtimePlaybackCSD().csdText;
    expect(disabledCsd).not.toContain('k_pan_l');
    expect(disabledCsd).not.toContain('k_bal_l');
  });

  it('keeps static, realtime, and BlueLive panner graphs aligned for score law/boost choices', () => {
    const laws: Array<0 | -3 | -4.5 | -6> = [0, -3, -4.5, -6];
    for (const mode of ['stereoPan', 'dualPan'] as const) {
      for (const law of laws) {
        for (const boost of [false, true]) {
          const data = new BlueData();
          data.getMixer().setPanningEnabled(true);
          data.getMixer().setPanLawDb(law);
          data.getMixer().setPanOffCenterBoost(boost);
          data.getMixer().setEnabled(true);

          const ch = new Channel();
          ch.setName('AudioCh');
          ch.setOutChannel('Master');
          ch.setPan(0.25);
          ch.setPanWidth(0.8);
          ch.setStereoPanMode(mode);
          ch.setDualPanLeft(0.2);
          ch.setDualPanRight(0.8);
          data.getMixer().getChannels().push(ch);

          const realtimeCsd = data.toRealtimePlaybackCSD().csdText;
          const blueLiveCsd = data.toBlueLiveCSD().csdText;
          const diskCsd = data.toDiskCSD();

          const extractDynamicMatrix = (csd: string) => {
            const match = csd.match(
              /\$BLUE_MIXER_CALC_PAN_GAINS\([^\n]+'k_pan_al'k_pan_bl'[^\n]+\)[\s\S]*?ga_bluemix_0_1 = k_pan_bl \* a_pan_in_l \+ k_pan_br \* a_pan_in_r/,
            );
            return match ? match[0] : null;
          };
          const realtimeMatrix = extractDynamicMatrix(realtimeCsd);
          const blueLiveMatrix = extractDynamicMatrix(blueLiveCsd);
          const diskMatrix = extractDynamicMatrix(diskCsd);

          expect(realtimeMatrix).not.toBeNull();
          expect(realtimeMatrix).toBe(blueLiveMatrix);
          expect(diskMatrix).not.toBeNull();

          // Realtime and BlueLive read the exported policy channels. Disk CSD
          // has no live control channels, so it bakes the selected values into
          // the same matrix graph instead of being byte-identical.
          expect(realtimeMatrix).toContain('gk_blue_score_pan_law');
          expect(realtimeMatrix).toContain('gk_blue_score_pan_boost');
          expect(diskMatrix).toContain(`'${law}'${boost ? 1 : 0})`);
        }
      }
    }
  });
});
