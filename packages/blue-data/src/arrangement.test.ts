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

  it('supports replacement and assignment updates by arrangement id', () => {
    const arrangement = new Arrangement();
    const first = new GenericInstrument();
    first.setName('A');
    arrangement.addInstrument(first, '1');

    const replacement = new JavaScriptInstrument();
    replacement.setName('B');
    expect(arrangement.replaceInstrument('1', replacement)).toBe(true);
    expect(arrangement.getInstrumentById('1')).toBe(replacement);

    expect(arrangement.updateAssignment('1', {
      enabled: false,
      nextArrangementId: '2',
    })).toBe(true);
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
