import { describe, expect, it } from 'vitest';
import { readProjectXml } from './xml-policy';
import { ClojureProjectData, ClojureLibraryEntry } from '../plugins/clojure-project-data';
import { BlueData } from '../blue-data';

const source = { kind: 'project' as const, label: 'sections.blue' };

describe('project section acceptance', () => {
  it.each([
    '<pluginData><future/></pluginData>',
    '<pluginData><blueDataObject bdoType="unknown"/></pluginData>',
    '<pluginData><blueDataObject bdoType="blue.clojure.project.ClojureProjectData"><future/></blueDataObject></pluginData>',
    '<pluginData><blueDataObject bdoType="blue.clojure.project.ClojureProjectData"/><blueDataObject bdoType="blue.clojure.project.ClojureProjectData"/></pluginData>',
    '<pluginData><blueDataObject bdoType="blue.clojure.project.ClojureProjectData"><clojureLibraryEntry><coordinates future="yes">org/lib</coordinates></clojureLibraryEntry></blueDataObject></pluginData>',
    '<midiInputProcessor><keyMapping>UNKNOWN</keyMapping></midiInputProcessor>',
    '<midiInputProcessor><velMapping>UNKNOWN</velMapping></midiInputProcessor>',
    '<midiInputProcessor><pitchConstant future="yes">x</pitchConstant></midiInputProcessor>',
    '<midiInputProcessor><scale><baseFrequency>0</baseFrequency></scale></midiInputProcessor>',
    '<midiInputProcessor><scale><octave>2junk</octave></scale></midiInputProcessor>',
    '<midiInputProcessor><scale><ratios/></scale></midiInputProcessor>',
    '<midiInputProcessor><scale><ratios><ratio>-1</ratio></ratios></scale></midiInputProcessor>',
  ])('rejects unsupported section grammar %s with the project source', (section) => {
    const result = readProjectXml(`<blueData>${section}</blueData>`, source);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0].source.label).toBe('sections.blue');
    expect(result.diagnostics[0].path).toMatch(/^\/blueData\//);
  });

  it('isolates supported plugin payload input, getter, output and history copies', () => {
    const project = new BlueData();
    const plugin = new ClojureProjectData();
    const entry = new ClojureLibraryEntry();
    entry.setDependencyCoordinates('org/lib');
    plugin.addLibraryEntry(entry);
    project.setClojureProjectData(plugin);
    entry.setDependencyCoordinates('changed');
    project
      .getPluginDataXml()[0]
      .getElement('clojureLibraryEntry')!
      .getElement('coordinates')!
      .setText('getter');
    project
      .saveAsXML()
      .getElement('pluginData')!
      .getElement('blueDataObject')!
      .getElement('clojureLibraryEntry')!
      .getElement('coordinates')!
      .setText('output');
    const copy = project.historyCopy();
    project.setClojureProjectData(null);
    expect(copy.getClojureProjectData()!.getLibraryEntries()[0].getDependencyCoordinates()).toBe(
      'org/lib',
    );
  });
});

describe('Live project acceptance', () => {
  it.each([
    '<liveData><tempo>0</tempo></liveData>',
    '<liveData><repeat>4junk</repeat></liveData>',
    '<liveData><liveObjectBins columns="1" rows="2"><bin><null/></bin></liveObjectBins></liveData>',
    '<liveData><liveObjectBins columns="1" rows="1"><bin><null/><null/></bin></liveObjectBins></liveData>',
    '<liveData><liveObjectBins columns="1junk" rows="1"><bin><null/></bin></liveObjectBins></liveData>',
    '<liveData><liveObjectBins columns="1" rows="1"><bin><future/></bin></liveObjectBins></liveData>',
    '<liveData><liveObjectBins columns="1" rows="1"><bin><null future="yes"/></bin></liveObjectBins></liveData>',
    '<liveData><liveObject uniqueId=""/></liveData>',
    '<liveData><liveObject><midiTrigger>128</midiTrigger></liveObject></liveData>',
    '<liveData><liveObject><soundObject type="future"/></liveObject></liveData>',
    '<liveData><liveObject uniqueId="same"/><liveObject uniqueId="same"/></liveData>',
    '<liveData><liveObject uniqueId="old"/><liveObjectBins columns="1" rows="1"><bin><liveObject uniqueId="new"/></bin></liveObjectBins></liveData>',
    '<liveData><liveObjectSetList><liveObjectSet><liveObjectRef> </liveObjectRef></liveObjectSet></liveObjectSetList></liveData>',
  ])('rejects malformed or ambiguous Live state %s', (section) => {
    const result = readProjectXml(`<blueData>${section}</blueData>`, source);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0].source.label).toBe('sections.blue');
  });

  it('reports unresolved set IDs without losing ordered references on save', () => {
    const result = readProjectXml(
      '<blueData><liveData><liveObject uniqueId="present"/><liveObjectSetList><liveObjectSet name="A"><liveObjectRef>missing</liveObjectRef><liveObjectRef>present</liveObjectRef></liveObjectSet></liveObjectSetList></liveData></blueData>',
      source,
    );
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toMatchObject([
      { code: 'P-LIVE-UNRESOLVED-REF', severity: 'warning', value: 'missing' },
    ]);
    if (!result.ok) throw new Error('expected accepted Live state');
    expect(result.value.getLiveData().getLiveObjectSets().getSets()[0].getLiveObjectIds()).toEqual([
      'missing',
      'present',
    ]);
    const reopened = readProjectXml(result.value.saveToString(), source);
    expect(reopened.ok).toBe(true);
    expect(reopened.diagnostics[0].value).toBe('missing');
  });
});

describe('arrangement acceptance', () => {
  it.each([
    '<arrangement><future/></arrangement>',
    '<arrangement><instrumentAssignment arrangementId="1"/></arrangement>',
    '<arrangement><instrumentAssignment arrangementId="1" id="1"><instrument type="blue.orchestra.GenericInstrument"/></instrumentAssignment></arrangement>',
    '<arrangement><instrumentAssignment arrangementId="1" isEnabled="true" enabled="true"><instrument type="blue.orchestra.GenericInstrument"/></instrumentAssignment></arrangement>',
    '<arrangement><instrumentAssignment arrangementId="1" isEnabled="yes"><instrument type="blue.orchestra.GenericInstrument"/></instrumentAssignment></arrangement>',
    '<arrangement><instrumentAssignment arrangementId="1"><instrument type="example.GenericInstrument"/></instrumentAssignment></arrangement>',
    '<arrangement><instrumentAssignment arrangementId="1"><instrument type="blue.orchestra.GenericInstrument"><future/></instrument></instrumentAssignment></arrangement>',
  ])('rejects incomplete, ambiguous or unsupported assignments %s', (section) => {
    const result = readProjectXml(`<blueData>${section}</blueData>`, source);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0].source).toEqual(source);
  });
});
