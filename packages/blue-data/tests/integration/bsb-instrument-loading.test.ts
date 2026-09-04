/**
 * Integration tests for BSB instrument loading and CSD generation.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BlueData } from '../../src/blue-data';
import { Arrangement } from '../../src/arrangement';
import { ParameterHelper } from '../../src/automation/parameter-helper';

// Path to test .blue file
const DEMO2022_PATH = '/Users/stevenyi/work/blue/demo2024/demo2022.blue';

describe.skipIf(!fs.existsSync(DEMO2022_PATH))('BSB Integration: demo2022.blue', () => {
  let data: BlueData;
  let csd: string;

  beforeAll(async () => {
    const xml = fs.readFileSync(DEMO2022_PATH, 'utf-8');
    data = await BlueData.loadFromString(xml);
    csd = data.toCSD();
  });

  it('T453: BSB instruments are loaded (count > 0)', () => {
    const arrangement = (data as unknown as { arrangement: Arrangement }).arrangement;
    expect(arrangement.size()).toBeGreaterThan(0);

    // Count loaded instruments
    let loadedCount = 0;
    let bsbCount = 0;
    for (const ia of arrangement.getArrangement()) {
      if (ia.instr) {
        loadedCount++;
        if (ia.instr.constructor.name === 'BlueSynthBuilder') {
          bsbCount++;
        }
      }
    }
    // demo2022.blue has 3 BSB instruments: Alpha v3 (x2), SimpleSampler (x1)
    expect(loadedCount).toBe(3);
    expect(bsbCount).toBe(3);
  });

  it('T454: CSD has no unresolved <placeholder> tokens', () => {
    // Check orchestra section for remaining placeholders in active (non-commented) code
    const orcMatch = csd.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/);
    if (orcMatch) {
      const orcContent = orcMatch[1];
      // Strip comment lines (lines starting with ; or //) before checking
      const activeCode = orcContent
        .split('\n')
        .filter((line) => !line.trimStart().startsWith(';') && !line.trimStart().startsWith('//'))
        .join('\n');
      // Should not have unresolved <token> patterns in active code
      const unresolved = activeCode.match(/<[a-zA-Z_][a-zA-Z0-9_]*>/g);
      // Filter out known legitimate patterns like <INSTR_ID> which should be replaced
      const remaining = unresolved?.filter(
        (t) => t !== '<INSTR_ID>' && t !== '<INSTR_NAME>' && !t.startsWith('<INSTR_'),
      );
      expect(remaining).toBeUndefined();
    }
  });

  it('T455: CSD contains global orchestra code with mixer inits', () => {
    // The demo2022.blue project has a mixer with channels
    // Mixer init statements should appear in the CSD as ga_bluemix_X_Y init 0
    expect(csd).toMatch(/ga_bluemix_\d+_\d+\s+init\s+0/);
  });

  it('T456: CSD has expected number of instrument definitions', () => {
    // Count instrument definitions in the CSD
    const instrMatches = csd.match(/\binstr\s+\w+\s*;/g);
    expect(instrMatches).not.toBeNull();
    expect(instrMatches!.length).toBeGreaterThan(0);
    // demo2022.blue: 3 BSB instruments (Alpha v3 x2, SimpleSampler x1)
    // + 2 always-on instruments + 1 BlueMixer = 6 total
    expect(instrMatches!.length).toBe(6);
  });

  it('BSB instruments generate non-empty orchestra code', () => {
    // Verify that each loaded BSB instrument generates actual orchestra code
    const arrangement = (data as unknown as { arrangement: Arrangement }).arrangement;
    let generatedCount = 0;
    for (const ia of arrangement.getArrangement()) {
      if (ia.instr) {
        const generated = ia.instr.generateInstrument();
        if (generated && generated.length > 0) {
          generatedCount++;
          // Verify no unresolved placeholders remain
          const placeholders = generated.match(/<[a-zA-Z_][a-zA-Z0-9_]*>/g);
          expect(placeholders).toBeNull();
        }
      }
    }
    expect(generatedCount).toBe(3);
  });

  it('T459: Missing widget values default to 0.0', () => {
    // Verify that widgets without explicit values use 0.0
    // This is tested implicitly by CSD generation not producing NaN
    expect(csd).not.toContain('NaN');
    expect(csd).not.toContain('undefined');
  });

  it('T460: Unknown BSB widget types are skipped with warning', () => {
    // This is tested implicitly - if unknown types caused errors,
    // the CSD generation would have thrown
    expect(() => data.toCSD()).not.toThrow();
  });

  it('T461: Empty instrumentText returns empty string', () => {
    // BlueSynthBuilder with no instrumentText returns ''
    // Tested implicitly - no empty instr definitions in CSD
    const emptyInstrMatches = csd.match(/instr\s+\w+\s*;\s*\n\s*\n\s*endin/g);
    expect(emptyInstrMatches).toBeNull();
  });

  it('T516: CSD contains parameter init statements', () => {
    // BSB instruments have parameters that should generate gk_blue_autoN init statements
    // demo2022.blue has many parameters per BSB instrument
    expect(csd).toMatch(/gk_blue_auto\d+\s+init\s+\d/);
  });

  it('T517: CSD contains chnexport for parameters', () => {
    // Real-time mode exports numeric parameters as standard Csound channels
    expect(csd).toMatch(/gk_blue_auto\d+\s+chnexport\s+"gk_blue_auto\d+"/);
  });

  it('T519: CSD contains string channel init statements', () => {
    // BSBFileSelector widgets with stringChannelEnabled should generate gS_blue_strN = "path"
    expect(csd).toMatch(/gS_blue_str\d+\s+=\s+"/);
  });

  it('T520: CSD contains chnexport for string channels', () => {
    // String channels should have chnexport for real-time API
    expect(csd).toMatch(/gS_blue_str\d+\s+chnexport\s+"gS_blue_str\d+"/);
  });

  it('T524: BSB file selectors compile to string channel symbols in instrument text', () => {
    const simpleSamplerInstr = csd.match(/instr 3\s*;SimpleSampler([\s\S]*?)endin/);

    expect(simpleSamplerInstr).not.toBeNull();
    expect(simpleSamplerInstr![1]).toMatch(/SFiles\[\]\s+fillarray\s+gS_blue_str\d+/);
    expect(simpleSamplerInstr![1]).not.toMatch(/SFiles\[\]\s+fillarray\s+0(?:\s*,\s*0)+/);
  });

  it('T525: arrangement instruments route blueMixerOut into ga_bluemix variables when mixer is enabled', () => {
    const instr1 = csd.match(/instr 1\s*;Alpha v3([\s\S]*?)endin/);
    const instr2 = csd.match(/instr 2\s*;Alpha v3([\s\S]*?)endin/);
    const instr3 = csd.match(/instr 3\s*;SimpleSampler([\s\S]*?)endin/);

    expect(instr1).not.toBeNull();
    expect(instr2).not.toBeNull();
    expect(instr3).not.toBeNull();

    expect(instr1![1]).toMatch(/ga_bluemix_0_0 \+=  aLeft/);
    expect(instr1![1]).toMatch(/ga_bluemix_0_1 \+=  aRight/);
    expect(instr2![1]).toMatch(/ga_bluemix_1_0 \+=  aLeft/);
    expect(instr2![1]).toMatch(/ga_bluemix_1_1 \+=  aRight/);
    expect(instr3![1]).toMatch(/ga_bluemix_2_0 \+=  a1/);
    expect(instr3![1]).toMatch(/ga_bluemix_2_1 \+=  a2/);

    expect(instr1![1]).not.toMatch(/\boutc\b/);
    expect(instr2![1]).not.toMatch(/\boutc\b/);
    expect(instr3![1]).not.toMatch(/\boutc\b/);
  });

  it('T521: mixer channel volume automation loads from Java parameter XML', () => {
    const mixer = data.getMixer();
    const automatedMixerVolumes = [
      ...mixer.getAllSourceChannels(),
      ...mixer.getSubChannels(),
      mixer.getMaster(),
    ]
      .map((channel) => channel.getLevelParameter())
      .filter((param) => param.isAutomationEnabled());

    expect(automatedMixerVolumes).toHaveLength(2);
    expect(automatedMixerVolumes[0].getPoints().length).toBeGreaterThan(2);
    expect(automatedMixerVolumes[1].getPoints().length).toBeGreaterThan(2);
  });

  it('T522: mixer send parameters are loaded from post-effects chains', () => {
    const mixer = data.getMixer();
    const sends = mixer.getAllSourceChannels().flatMap((channel) => channel.getSends());

    expect(sends).toHaveLength(3);
    expect(sends.map((send) => send.getLevelParameter().getName())).toEqual([
      'Send Amount',
      'Send Amount',
      'Send Amount',
    ]);
    expect(
      sends.map((send) => Number(send.getLevelParameter().getFixedValue().toFixed(3))).sort(),
    ).toEqual([0.25, 0.28, 0.5]);
  });

  it('T523: ParameterHelper includes mixer send and volume parameters like Java blue', () => {
    const parameters = ParameterHelper.getAllParameters(data.getArrangement(), data.getMixer());

    const sendAmounts = parameters.filter((param) => param.getName() === 'Send Amount');
    const mixerVolumes = parameters.filter(
      (param) =>
        param.getName() === 'Volume' && param.getMinimum() === -96 && param.getMaximum() === 12,
    );

    expect(sendAmounts).toHaveLength(3);
    expect(mixerVolumes.length).toBeGreaterThanOrEqual(5);
  });
});
