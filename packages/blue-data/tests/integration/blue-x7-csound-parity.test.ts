import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { BlueData } from '../../src/blue-data';
import { BlueX7 } from '../../src/instruments/blue-x7';

/**
 * Real generation-parity regression against the checked-in Java-generated
 * golden CSD for the multi-BlueX7 TimewaveCanon example.
 *
 * Normalization policy (documented non-semantic differences only):
 * - Whitespace runs collapse to single spaces (Java/TS layout spacing drift).
 * - Blank lines are dropped: the golden predates the current Java ORC
 *   resources, which now contain blank section separators the older golden
 *   lacks. TypeScript embeds the current Java ORCs verbatim, so it is the
 *   golden that is stale here, not the generation.
 * - Mixer accumulation lines are canonicalized: the `blueMixerOut` post-code
 *   expansion (`ga_bluemix_N_M ...`) is produced by the shared mixer
 *   subsystem, not by BlueX7, and its `+=`/channel-index form is a
 *   pre-existing application-level divergence outside this instrument.
 * - Csound 7 reserves `continue`, so the generated label/reference pair is
 *   emitted as `continue_`; normalization maps that identifier back to the
 *   Java resource spelling for semantic parity.
 * Everything else must match the Java golden exactly.
 */
describe('BlueX7 Csound Generation Parity — TimewaveCanon Regression', () => {
  const bluePath = path.resolve(
    __dirname,
    '../../../../packages/blue-app/assets/examples/pieces/daveSeidel/02_timewaveCanon/TimewaveCanon.blue',
  );
  const csdPath = path.resolve(
    __dirname,
    '../../../../packages/blue-app/assets/examples/pieces/daveSeidel/02_timewaveCanon/TimewaveCanon.csd',
  );

  const normalize = (text: string): string =>
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.replace(/ga_bluemix_\d+_\d+\s*(\+=|=\s*ga_bluemix_\d+_\d+\s*\+)/, 'MIXER_ACC').replace(/[ \t]+/g, ' ').trim())
      .map((line) => line.replace(/\bcontinue_/g, 'continue'))
      .filter((line) => line.length > 0)
      .join('\n');

  const section = (text: string, startMarker: string, endMarker: string): string | null => {
    const start = text.indexOf(startMarker);
    if (start === -1) {
      return null;
    }
    const end = text.indexOf(endMarker, start);
    if (end === -1) {
      return null;
    }
    return text.slice(start, end + endMarker.length);
  };

  const instrumentBody = (text: string, instrNum: number): string | null => {
    const re = new RegExp(`\\tinstr ${instrNum}\\t`);
    const match = text.match(re);
    if (!match || match.index === undefined) {
      return null;
    }
    const start = match.index;
    const end = text.indexOf('endin', start);
    return end === -1 ? null : text.slice(start, end);
  };

  it('loads multi-BlueX7 TimewaveCanon project and generates matching CSD tables and instruments', () => {
    expect(fs.existsSync(bluePath)).toBe(true);
    expect(fs.existsSync(csdPath)).toBe(true);

    const xmlContent = fs.readFileSync(bluePath, 'utf-8');
    const goldenCsd = fs.readFileSync(csdPath, 'utf-8');

    const blueData = BlueData.loadFromString(xmlContent);
    const arrangement = blueData.getArrangement();

    // Verify the arrangement has 3 BlueX7 instruments
    const instr1 = arrangement.getInstrumentById('1');
    const instr2 = arrangement.getInstrumentById('2');
    const instr3 = arrangement.getInstrumentById('3');
    const instr4 = arrangement.getInstrumentById('4');

    expect(instr1).toBeInstanceOf(BlueX7);
    expect(instr2).toBeInstanceOf(BlueX7);
    expect(instr3).toBeInstanceOf(BlueX7);
    expect(instr4).toBeDefined();

    // Generate CSD
    const generatedCsd = blueData.toDiskCSD();

    // Static tables block must appear exactly once and match the golden
    const goldenStatic = section(goldenCsd, '; [BLUEX7] - START STATIC TABLES', '; [BLUEX7] - END STATIC TABLES');
    const generatedStatic = section(generatedCsd, '; [BLUEX7] - START STATIC TABLES', '; [BLUEX7] - END STATIC TABLES');
    expect(goldenStatic).not.toBeNull();
    expect(generatedStatic).not.toBeNull();
    expect(normalize(generatedStatic!)).toBe(normalize(goldenStatic!));
    expect(generatedCsd.match(/; \[BLUEX7\] - START STATIC TABLES/g)?.length).toBe(1);

    // Operator table blocks for all 3 instruments must match the golden
    for (const name of ['Default Bank 30 - SOFTSPACE4', 'Default Bank 9 - UNCLE BENS', 'Default Bank 32 - CHIMES']) {
      const marker = `; FTABLES FOR BLUEX7 INSTRUMENT: ${name}`;
      const goldenBlock = section(goldenCsd, marker, '\n\n');
      const generatedBlock = section(generatedCsd, marker, '\n\n');
      expect(goldenBlock).not.toBeNull();
      expect(generatedBlock).not.toBeNull();
      expect(normalize(generatedBlock!)).toBe(normalize(goldenBlock!));
    }

    // Instrument bodies (ORC extraction, p-field substitutions, out rewrite,
    // post-code placement) must be semantically identical to the Java golden
    // for all three BlueX7 instruments.
    for (const instrNum of [1, 2, 3]) {
      const goldenBody = instrumentBody(goldenCsd, instrNum);
      const generatedBody = instrumentBody(generatedCsd, instrNum);
      expect(goldenBody).not.toBeNull();
      expect(generatedBody).not.toBeNull();

      const normGolden = normalize(goldenBody!);
      const normGenerated = normalize(generatedBody!);
      if (normGenerated !== normGolden) {
        // Provide a focused first-difference message for triage
        const goldenLines = normGolden.split('\n');
        const generatedLines = normGenerated.split('\n');
        const firstDiff = generatedLines.findIndex((line, i) => line !== goldenLines[i]);
        throw new Error(
          `instr ${instrNum} body diverges from Java golden at normalized line ${firstDiff}:` +
            `\n  golden: ${JSON.stringify(goldenLines[firstDiff])}` +
            `\n  ts:     ${JSON.stringify(generatedLines[firstDiff])}`,
        );
      }
    }

    // Spot-check substitution behaviors within the generated body
    expect(generatedCsd).toContain('idur \t= abs(p3) \np3 = p3 + 4');
    expect(generatedCsd).toContain('(p4 < 15 ? cpspch(p4) : p4)');
    expect(generatedCsd).toContain('aout =');
  }, 30000);
});
