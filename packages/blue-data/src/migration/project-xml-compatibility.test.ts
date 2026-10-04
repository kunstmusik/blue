import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Element } from '../serialization/xml-reader';
import { UpgradeManager } from './upgrade-manager';
import { readProjectXml } from '../blue-data/xml-policy';

describe('project XML migration composition', () => {
  it('P-210-230-COMPOSE transfers 0dbfs and root timing without losing code', () => {
    const xml = `<blueData version="2.0.0">
      <projectProperties/>
      <globalOrcSco><globalOrc>  ; retain\n0dbfs = 1\n  ; tail\n</globalOrc></globalOrcSco>
      <soundObject type="blue.soundObject.PolyObject"><name>Original synthetic root</name><pixelSecond>50</pixelSecond><snapEnabled>true</snapEnabled><snapValue>0.25</snapValue><timeDisplay>1</timeDisplay></soundObject>
    </blueData>`;
    const data = BlueData.loadFromString(xml);
    expect(data.getProjectProperties().zeroDbFS).toBe('1');
    expect(data.getProjectProperties().diskZeroDbFS).toBe('1');
    expect(data.getProjectProperties().useZeroDbFS).toBe(true);
    expect(data.getGlobalOrcSco().getGlobalOrc()).toBe('  ; retain\n  ; tail\n');
    expect(data.getScore().getTimeState().getZoomIterations()).toBe(-32);
    expect(data.getScore().getTimeState().isSnapEnabled()).toBe(true);
    expect(data.getScore().getTimeState().getSnapValue()).toBe('SIXTEENTH');
    expect(data.getScore()[0].getName()).toBe('Original synthetic root');
    const canonical = data.saveToString();
    expect(BlueData.loadFromString(canonical).saveToString()).toBe(canonical);
  });

  it('normalizes beta patterns once and leaves current containers alone', () => {
    const root = Element.parse(
      '<blueData version="2.3.0_beta1"><score><patternsLayerGroup><patternLayer/></patternsLayerGroup></score></blueData>',
    );
    const manager = UpgradeManager.getInstance();
    manager.performUpgrades(root);
    const group = root.getElement('score')!.getElement('patternsLayerGroup')!;
    expect(group.getElements('patternLayer').size).toBe(0);
    expect(group.getElement('patternLayers')!.getElements('patternLayer').size).toBe(1);
    manager.performUpgrades(root);
    expect(group.getElements('patternLayers').size).toBe(1);
    expect(group.getElement('patternLayers')!.getElements('patternLayer').size).toBe(1);
  });

  it('P-ROOT-CONTEXT-ORDER preserves legacy tempo regardless of sibling order', () => {
    const context = '<timeContext><tempo>120</tempo></timeContext>';
    for (const content of [`${context}<score/>`, `<score/>${context}`]) {
      const data = BlueData.loadFromString(`<blueData>${content}</blueData>`);
      expect(data.getScore().getTimeContext().getTempoMap().getTempo()).toBe(120);
    }
  });

  it('preserves supported content inside an old root PolyObject through canonical reopen', () => {
    const xml = `<blueData version="2.2.0">
      <soundObject type="blue.soundObject.PolyObject">
        <name>Legacy root</name>
        <soundLayer name="Layer">
          <soundObject type="blue.soundObject.GenericScore">
            <name>Nested score</name>
            <score>i1 0 2 440</score>
          </soundObject>
        </soundLayer>
      </soundObject>
    </blueData>`;

    const first = readProjectXml(xml, { kind: 'project', label: 'old-root.blue' });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
    const canonical = first.value.saveToString();
    expect(canonical).toContain('<score>i1 0 2 440</score>');
    expect(BlueData.loadFromString(canonical).saveToString()).toBe(canonical);
  });

  it.each(['2.3.0', '2.4.0'])('rejects an unconverted root PolyObject in version %s', (version) => {
    const result = readProjectXml(
      `<blueData version="${version}"><soundObject type="blue.soundObject.PolyObject"><soundLayer><soundObject type="blue.soundObject.GenericScore"><score>i1 0 2 440</score></soundObject></soundLayer></soundObject></blueData>`,
      { kind: 'project', label: `current-${version}.blue` },
    );
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0]).toMatchObject({
      source: { label: `current-${version}.blue` },
      path: '/blueData/soundObject[1]',
    });
  });

  it('rejects unexpected nested content while converting an old root PolyObject', () => {
    const result = readProjectXml(
      '<blueData version="2.2.0"><soundObject type="PolyObject"><soundLayer><future/></soundLayer></soundObject></blueData>',
      { kind: 'project', label: 'nested-unknown.blue' },
    );
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0]).toMatchObject({
      source: { label: 'nested-unknown.blue' },
      member: 'future',
    });
  });

  it('rejects a root PolyObject competing with Score after version-gated migrations', () => {
    const result = readProjectXml(
      '<blueData version="2.3.0"><score/><soundObject type="PolyObject"><soundLayer><soundObject type="GenericScore"><score>i1 0 1 440</score></soundObject></soundLayer></soundObject></blueData>',
      { kind: 'project', label: 'competing-root.blue' },
    );
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0]).toMatchObject({
      code: 'conflict',
      source: { label: 'competing-root.blue' },
      path: '/blueData/soundObject[1]',
    });
  });

  it.each([
    '<blueData><soundObject type="blue.soundObject.PolyObject"/><score/></blueData>',
    '<blueData><timeContext><tempo>120</tempo></timeContext><score><timeContext><tempo>90</tempo></timeContext></score></blueData>',
    '<blueData version="2.3.0_beta1"><score><patternsLayerGroup><patternLayer/><patternLayers><patternLayer/></patternLayers></patternsLayerGroup></score></blueData>',
    '<blueData version="2.0.0"><projectProperties><zeroDbFS>2</zeroDbFS></projectProperties><globalOrcSco><globalOrc>0dbfs = 1</globalOrc></globalOrcSco></blueData>',
  ])('rejects competing historical/current forms: %s', (xml) => {
    const result = readProjectXml(xml, { kind: 'project', label: 'conflict.blue' });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'conflict')).toBe(true);
    expect(result).not.toHaveProperty('value');
  });
});

describe('project rate, panning, and reference migrations', () => {
  it('transfers a historical sample rate before deriving project timing', () => {
    const result = readProjectXml(
      '<blueData><timeContext><sampleRate>48000</sampleRate></timeContext></blueData>',
      { kind: 'project', label: 'rate.blue' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('rate transfer rejected');
    expect(result.value.getProjectProperties().sampleRate).toBe('48000');
    expect(result.value.getScore().getTimeContext().getSampleRate()).toBe(48000);
    expect(result.value.saveToString()).not.toContain(
      '<sampleRate>48000</sampleRate></timeContext>',
    );
  });

  it('reports safely omitted redundant sample rates and rejects conflicts', () => {
    const xml =
      '<blueData><projectProperties><sampleRate>48000</sampleRate></projectProperties><score><timeContext><sampleRate>48000</sampleRate></timeContext></score></blueData>';
    const result = readProjectXml(xml, { kind: 'project', label: 'rate.blue' });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toMatchObject([
      {
        code: 'P-CONTEXT-RATE',
        severity: 'warning',
        path: '/blueData/score[1]/timeContext[1]/sampleRate[1]',
      },
    ]);
    expect(() => BlueData.loadFromString(xml)).toThrow('report handler');
    expect(
      readProjectXml(
        xml.replace(
          '<sampleRate>48000</sampleRate></timeContext>',
          '<sampleRate>44100</sampleRate></timeContext>',
        ),
        { kind: 'project', label: 'rate.blue' },
      ).ok,
    ).toBe(false);
  });

  it('normalizes legacy panning and validates competing Mixer values before precedence', () => {
    const data = BlueData.loadFromString(
      '<blueData><score panningEnabled="true" panLawDb="-6" panOffCenterBoost="true"/></blueData>',
    );
    expect(data.getMixer().isPanningEnabled()).toBe(true);
    expect(data.getMixer().getPanLawDb()).toBe(-6);
    expect(data.saveAsXML().getElement('score')!.getAttribute('panningEnabled')).toBeNull();
    const result = readProjectXml(
      '<blueData><score panLawDb="-6"/><mixer panLawDb="-3"/></blueData>',
      { kind: 'project', label: 'pan.blue' },
    );
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toMatchObject([
      { code: 'P-PANNING-PRECEDENCE', severity: 'warning', value: '-6' },
    ]);
    if (result.ok) expect(result.value.getMixer().getPanLawDb()).toBe(-3);
    expect(
      readProjectXml('<blueData><score panLawDb="junk"/><mixer panLawDb="-3"/></blueData>', {
        kind: 'project',
        label: 'pan.blue',
      }).ok,
    ).toBe(false);
  });

  it('rejects persisted frame-rate conflicts instead of erasing them', () => {
    const result = readProjectXml(
      '<blueData><score><timeContext><smpteFrameRate>30</smpteFrameRate></timeContext><timeState><smpteFrameRate>24</smpteFrameRate></timeState></score></blueData>',
      { kind: 'project', label: 'fps.blue' },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('conflict');
  });
});

describe('historical instrument references', () => {
  const library =
    '<instrumentLibrary><instrumentCategory categoryName="Root" isRoot="true"><instrumentCategory categoryName="Synths" isRoot="false"><instrument type="blue.orchestra.GenericInstrument"><name>Original synth</name><instrumentText> a1 oscili 0.1, 440\n</instrumentText></instrument></instrumentCategory></instrumentCategory></instrumentLibrary>';
  it('resolves colon category indices without mutable aliases and omits the consumed library', () => {
    const result = readProjectXml(
      `<blueData>${library}<arrangement><instrumentAssignment arrangementId="1" instrumentId="0:0"/></arrangement></blueData>`,
      { kind: 'project', label: 'library.blue' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.getArrangement().getInstrumentById('1')!.getName()).toBe('Original synth');
    const saved = result.value.saveToString();
    expect(saved).not.toContain('<instrumentLibrary>');
    expect(saved).not.toContain('instrumentId=');
    expect(BlueData.loadFromString(saved).saveToString()).toBe(saved);
  });
  it.each(['0:2', 'missing', '0:0junk'])(
    'rejects invalid reference %s with its original path',
    (reference) => {
      const result = readProjectXml(
        `<blueData>${library}<arrangement><instrumentAssignment arrangementId="1" instrumentId="${reference}"/></arrangement></blueData>`,
        { kind: 'project', label: 'library.blue' },
      );
      expect(result.ok).toBe(false);
      expect(result.diagnostics[0].path).toBe(
        '/blueData/arrangement[1]/instrumentAssignment[1]/@instrumentId',
      );
    },
  );
});

describe('project graph content accountability', () => {
  it('rejects an unused named category alongside consumed instruments', () => {
    const xml =
      '<blueData><instrumentLibrary><instrumentCategory categoryName="Root" isRoot="true"><instrument type="blue.orchestra.GenericInstrument"/><instrumentCategory categoryName="Keep me"/></instrumentCategory></instrumentLibrary><arrangement><instrumentAssignment arrangementId="1" instrumentId="0"/></arrangement></blueData>';
    const result = readProjectXml(xml);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toContain('unaccounted categories');
  });
  it('rejects a category root flag inconsistent with its graph position', () => {
    expect(
      readProjectXml(
        '<blueData><instrumentLibrary><instrumentCategory categoryName="Root" isRoot="false"/></instrumentLibrary></blueData>',
      ).ok,
    ).toBe(false);
  });
  it('rejects malformed or conflicting legacy UDO representations regardless of order', () => {
    expect(
      readProjectXml(
        '<blueData><udo future="true">opcode test, a, 0\n a1 init 0\n xout a1\nendop</udo></blueData>',
      ).ok,
    ).toBe(false);
    const legacy = '<udo>opcode test, a, 0\n a1 init 0\n xout a1\nendop</udo>';
    for (const sections of [legacy + '<opcodeList/>', '<opcodeList/>' + legacy])
      expect(readProjectXml('<blueData>' + sections + '</blueData>').ok).toBe(false);
  });
});

it('preserves significant legacy UDO code and rejects orphan or incomplete text', () => {
  const body = '  /* retained multiline comment */\n  a1 init 0\n  xout a1\n';
  const report = readProjectXml(
    '<blueData><udo>opcode original, a, 0\n' + body + 'endop\n</udo></blueData>',
  );
  expect(report.ok).toBe(true);
  if (!report.ok) throw new Error(JSON.stringify(report.diagnostics));
  expect(report.value.getOpcodeList().getOpcode(0)!.getCode()).toBe(body);
  expect(
    BlueData.loadFromString(report.value.saveToString()).getOpcodeList().getOpcode(0)!.getCode(),
  ).toBe(body);
  for (const text of [
    'orphan code',
    'opcode original, a, 0\n a1 init 0\n',
    'opcode original, a, 0\nendop\nmeaningful trailing text',
  ])
    expect(readProjectXml('<blueData><udo>' + text + '</udo></blueData>').ok).toBe(false);
});
