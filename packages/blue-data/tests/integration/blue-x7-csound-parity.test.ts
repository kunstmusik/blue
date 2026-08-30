import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { BlueData } from '../../src/blue-data';
import { BlueX7 } from '../../src/instruments/blue-x7';
import { BLUE_X7_PARAMETER_DESCRIPTORS } from '../../src/instruments/blue-x7/parameter-catalog';

/**
 * Modern-renderer multi-instance CSD regression against the checked-in
 * multi-BlueX7 TimewaveCanon example (Spec 092).
 *
 * The legacy golden-parity assertions against the Pinkston-derived Java CSD
 * were replaced intentionally: the modern msfa/Dexed-oriented renderer is a
 * documented sonic migration (FR-001, FR-028). This test now asserts the
 * modern structural contract on a real project with three BlueX7
 * arrangement instruments:
 * - the shared modern synthesis module is emitted exactly once;
 * - the legacy per-algorithm Pinkston bodies and static tables are gone;
 * - every BlueX7 owns the 151-Parameter catalog and reads direct compiled
 *   globals without a transport-table publication path;
 * - Blue host-boundary conventions (pitch conversion, post code, mixer
 *   accumulation) remain intact.
 */
describe('BlueX7 modern CSD generation — TimewaveCanon regression', () => {
  const bluePath = path.resolve(
    __dirname,
    '../../../../packages/blue-app/assets/examples/pieces/daveSeidel/02_timewaveCanon/TimewaveCanon.blue',
  );

  it('loads the multi-BlueX7 project and generates the modern CSD structure', () => {
    expect(fs.existsSync(bluePath)).toBe(true);

    const xmlContent = fs.readFileSync(bluePath, 'utf-8');
    const blueData = BlueData.loadFromString(xmlContent);
    const arrangement = blueData.getArrangement();

    // Verify the arrangement has 3 BlueX7 instruments
    const instr1 = arrangement.getInstrumentById('1');
    const instr2 = arrangement.getInstrumentById('2');
    const instr3 = arrangement.getInstrumentById('3');
    expect(instr1).toBeInstanceOf(BlueX7);
    expect(instr2).toBeInstanceOf(BlueX7);
    expect(instr3).toBeInstanceOf(BlueX7);

    // migration: loading legacy Java XML created the complete catalog per
    // instance without changing voice data
    for (const instr of [instr1, instr2, instr3] as BlueX7[]) {
      expect(instr.getParameters()).toHaveLength(151);
    }

    const generatedCsd = blueData.toDiskCSD();

    // The shared modern module is emitted exactly once per generated CSD.
    expect(generatedCsd.match(/opcode bluex7_voice\(/g)?.length).toBe(1);
    expect(generatedCsd.match(/opcode dx7_render_algorithm\(/g)?.length).toBe(1);
    expect(generatedCsd.match(/giBlueX7OutputCalibration init 0\.75/g)?.length).toBe(1);

    // The modern module is emitted once; live values are direct globals and
    // no BlueX7 transport table is published or read.
    expect(generatedCsd).not.toMatch(/f \d+ 0 256 -2 [^\n]+/g);
    expect(generatedCsd).not.toContain('tabw');
    expect(generatedCsd).not.toContain('chnget');

    // Host wrappers appear per instrument with the Blue pitch conversion and
    // direct-global voice targets.
    const wrappers = generatedCsd.match(/iBlueX7MidiNote = \(p4 < 15 \? ftom:i\(cpspch:i\(p4\)\) : ftom:i\(p4\)\)/g) ?? [];
    expect(wrappers.length).toBe(3);

    // No legacy Pinkston renderer remnants remain.
    for (const legacyMarker of [
      '; [BLUEX7] - START STATIC TABLES',
      'ifeed',
      'imap128',
      'dx701',
      'dx732',
    ]) {
      expect(generatedCsd).not.toContain(legacyMarker);
    }

    // Post code and mixer accumulation conventions remain intact: the saved
    // `blueMixerOut aout, aout` post code is expanded by the shared mixer
    // subsystem into per-channel accumulators fed from the module output.
    expect(generatedCsd).toContain('ga_bluemix_0_0 +=  aout');
    expect(generatedCsd).toContain('ga_bluemix_0_1 +=  aout');
    expect(generatedCsd).toContain('instr 1');
  }, 30000);
});
