import { describe, expect, it } from 'vitest';
import { Element } from './serialization/xml-reader';
import { Arrangement } from './arrangement';
import { GenericInstrument } from './instruments/generic-instrument';
import { JavaScriptInstrument } from './instruments/javascript-instrument';
import { Tables } from './tables';
import { CompileData } from './compile-data';
import { Score } from './score/score';
import { TrackLayerGroup } from './score/track/track-layer-group';
import { Track } from './score/track/track';
import { Mixer } from './mixer/mixer';
import { Channel } from './mixer/channel';

class FtableInstrument extends GenericInstrument {
  override generateFTables(tables: unknown): void {
    if (tables instanceof Tables) {
      tables.setCompilationVariable('called', true);
    }
  }
}

describe('Arrangement', () => {
  it('round-trips Java-style instrument assignments with embedded instruments', () => {
    const xml = `<arrangement>
      <instrumentAssignment arrangementId="1" isEnabled="true">
        <instrument type="blue.orchestra.GenericInstrument">
          <name>Lead</name>
          <comment>lead comment</comment>
          <globalOrc/>
          <globalSco/>
          <instrumentText>aout oscili p4, p5</instrumentText>
          <opcodeList/>
        </instrument>
      </instrumentAssignment>
      <instrumentAssignment arrangementId="bus" isEnabled="false">
        <instrument type="blue.orchestra.JavaScriptInstrument">
          <name>Script</name>
          <comment>js comment</comment>
          <globalOrc/>
          <globalSco/>
          <instrumentText>instrument = "";</instrumentText>
          <opcodeList/>
        </instrument>
      </instrumentAssignment>
    </arrangement>`;

    const arrangement = Arrangement.loadFromXML(Element.parse(xml));
    expect(arrangement.size()).toBe(2);
    expect(arrangement.getInstrument(0)).toBeInstanceOf(GenericInstrument);
    expect(arrangement.getArrangement()[1].enabled).toBe(false);
    expect(arrangement.getInstrument(1)).toBeInstanceOf(JavaScriptInstrument);

    const savedXml = arrangement.saveAsXML().toXml();
    expect(savedXml).toContain('arrangementId="1"');
    expect(savedXml).toContain('isEnabled="false"');
    expect(savedXml).toContain('blue.orchestra.GenericInstrument');
    expect(savedXml).toContain('blue.orchestra.JavaScriptInstrument');
  });

  it('rejects unknown embedded instruments before constructing an arrangement', () => {
    expect(() =>
      Arrangement.loadFromXML(
        Element.parse(`<arrangement>
      <instrumentAssignment arrangementId="custom" isEnabled="true">
        <instrument type="vendor.orchestra.CustomInstrument"><name>Custom Lead</name></instrument>
      </instrumentAssignment>
    </arrangement>`),
      ),
    ).toThrow('Unsupported or missing instrument type');
  });

  it('supports replacement and assignment updates by arrangement id', () => {
    const arrangement = new Arrangement();
    const first = new GenericInstrument();
    first.setName('A');
    arrangement.addInstrument(first, '1');

    const replacement = new JavaScriptInstrument();
    replacement.setName('B');
    expect(arrangement.replaceInstrument('1', replacement)).toBe(true);
    expect(arrangement.getInstrumentById('1')).toBe(replacement);

    expect(
      arrangement.updateAssignment('1', {
        enabled: false,
        nextArrangementId: '2',
      }),
    ).toBe(true);
    expect(arrangement.getArrangement()[0].arrangementId).toBe('2');
    expect(arrangement.getArrangement()[0].enabled).toBe(false);
  });

  it('rejects blank and duplicate arrangement id updates', () => {
    const arrangement = new Arrangement();
    arrangement.addInstrument(new GenericInstrument(), '1');
    arrangement.addInstrument(new JavaScriptInstrument(), '2');

    expect(arrangement.updateAssignment('1', { nextArrangementId: '' })).toBe(false);
    expect(arrangement.getArrangement()[0].arrangementId).toBe('1');
    expect(arrangement.updateAssignment('1', { nextArrangementId: '2' })).toBe(false);
    expect(arrangement.getArrangement()[0].arrangementId).toBe('1');
  });

  it('removes disabled assignments before render generation', () => {
    const arrangement = new Arrangement();
    arrangement.addInstrument(new GenericInstrument(), '1');
    arrangement.addInstrument(new JavaScriptInstrument(), '2');
    arrangement.getArrangement()[0].enabled = false;

    arrangement.clearUnusedInstrAssignments();

    expect(arrangement.size()).toBe(1);
    expect(arrangement.getInstrumentId(0)).toBe('2');
  });

  it('generates global score text using compile-data source ids', () => {
    const arrangement = new Arrangement();
    const instr = new GenericInstrument();
    instr.setName('Global Sco');
    instr.setGlobalSco('i<INSTR_ID> 0 1');
    arrangement.addInstrument(instr, 'Bus');

    const compileData = new CompileData(arrangement, new Tables());
    compileData.addInstrSourceId(instr, '7');

    expect(arrangement.generateGlobalSco(compileData)).toContain('i7 0 1');
  });

  it('calls generateFTables on enabled instruments', () => {
    const arrangement = new Arrangement();
    arrangement.addInstrument(new FtableInstrument(), '1');

    const tables = new Tables();
    arrangement.generateFTables(tables);

    expect(tables.getCompilationVariable('called')).toBe(true);
  });
});

describe('blueMixerOut conversion', () => {
  function orchestra(call: string, mixer: Mixer): string {
    const arrangement = new Arrangement();
    const instrument = new GenericInstrument();
    instrument.setText(call);
    arrangement.addInstrument(instrument, '1');
    return arrangement.generateOrchestra(new CompileData(arrangement, new Tables()), mixer);
  }

  it.each([
    'blueMixerOut asig, asig',
    'blueMixerOut(asig, asig)',
    'blueMixerOut (asig, asig) ; stereo output',
  ])('routes both call forms through the mixer: %s', (call) => {
    const result = orchestra(call, new Mixer());
    expect(result).toMatch(/ga_bluesub_Master_0\s*\+=\s*asig(?:\s|$)/);
    expect(result).toMatch(/ga_bluesub_Master_1\s*\+=\s*asig(?:\s|$)/);
  });

  it.each([
    ['blueMixerOut limit(asig, -1, 1), (asig * 0.5)', 'limit(asig, -1, 1)', '(asig * 0.5)'],
    ['blueMixerOut(limit(asig, -1, 1), (asig * 0.5))', 'limit(asig, -1, 1)', '(asig * 0.5)'],
    ['blueMixerOut (asig * 0.5), limit(asig, -1, 1)', '(asig * 0.5)', 'limit(asig, -1, 1)'],
    ['blueMixerOut(chnget:a("left,main;bus"), aR) // output', 'chnget:a("left,main;bus")', 'aR'],
  ])('keeps nested commas and parentheses within each output: %s', (call, first, second) => {
    const result = orchestra(call, new Mixer());
    const assignments = result.split('\n').map((line) => line.replace(/\s*\+=\s*/, ' += '));
    expect(assignments).toContain(`ga_bluesub_Master_0 += ${first}`);
    expect(assignments).toContain(`ga_bluesub_Master_1 += ${second}`);
  });

  it.each(['blueMixerOut "Reverb", aL, aR', 'blueMixerOut("Reverb", aL, aR)'])(
    'routes either form to a named bus: %s',
    (call) => {
      const mixer = new Mixer();
      const bus = new Channel();
      bus.setName('Reverb');
      mixer.getSubChannels().push(bus);
      const result = orchestra(call, mixer);
      expect(result).toMatch(/ga_bluesub_Reverb_0\s*\+=\s*aL/);
      expect(result).toMatch(/ga_bluesub_Reverb_1\s*\+=\s*aR/);
      expect(mixer.hasSubChannelDependencies()).toBe(true);
    },
  );

  it.each([
    'blueMixerOut aL, aR',
    'blueMixerOut(aL, aR)',
    'blueMixerOut "Reverb", aL, aR',
    'blueMixerOut("Reverb", aL, aR)',
  ])('emits direct Csound output when the mixer is disabled: %s', (call) => {
    const mixer = new Mixer();
    mixer.setEnabled(false);
    const result = orchestra(call, mixer);
    expect(result).toMatch(/outc\s+aL\s*,\s*aR/);
    expect(result).not.toContain('Reverb');
  });
});

describe('compile-once global orchestra seam (Spec 092)', () => {
  class CompileOnceInstrument extends GenericInstrument {
    readonly ownerIdentity: string;

    constructor(ownerIdentity: string) {
      super();
      this.setName(`CompileOnce ${ownerIdentity}`);
      this.ownerIdentity = ownerIdentity;
    }

    override generateGlobalOrc(compileData?: CompileData): string | null {
      if (!compileData) {
        return null;
      }
      const moduleKey = 'test.sharedModule';
      if (compileData.getCompilationVariable(moduleKey)) {
        return null;
      }
      compileData.setCompilationVariable(moduleKey, true);
      return '; SHARED MODULE';
    }
  }

  it('emits the shared module once across distinct instrument objects', () => {
    const arrangement = new Arrangement();
    arrangement.addInstrumentAtEnd(new CompileOnceInstrument('a'));
    arrangement.addInstrumentAtEnd(new CompileOnceInstrument('b'));

    const compileData = new CompileData(arrangement, new Tables(), true);
    const globalOrc = compileData.getArrangement().generateGlobalOrc(compileData);
    expect(globalOrc.match(/SHARED MODULE/g)).toHaveLength(1);
  });

  it('registers shared resources for arrangement and prepared Track instruments in one render', () => {
    const arrangement = new Arrangement();
    arrangement.addInstrumentAtEnd(new CompileOnceInstrument('a'));

    const score = new Score();
    const group = new TrackLayerGroup();
    const track = new Track();
    track.setInstrument(new CompileOnceInstrument('track-a'));
    group.push(track);
    score.push(group);

    const compileData = new CompileData(arrangement, new Tables(), true);
    score.prepareTrackInstruments(compileData);
    const globalOrc = compileData.getArrangement().generateGlobalOrc(compileData);
    expect(globalOrc.match(/SHARED MODULE/g)).toHaveLength(1);
    // the Track render instrument participates in the same render registry
    expect(compileData.getTrackInstrumentId(track.getUniqueId())).toBeDefined();
  });

  it('keeps render contexts independent: a new CompileData emits the module again', () => {
    const arrangement = new Arrangement();
    arrangement.addInstrumentAtEnd(new CompileOnceInstrument('a'));

    const first = new CompileData(arrangement, new Tables(), true);
    expect(first.getArrangement().generateGlobalOrc(first)).toContain('SHARED MODULE');

    const second = new CompileData(arrangement, new Tables(), true);
    expect(second.getCompilationVariable('test.sharedModule')).toBeUndefined();
    expect(second.getArrangement().generateGlobalOrc(second)).toContain('SHARED MODULE');
  });
});
