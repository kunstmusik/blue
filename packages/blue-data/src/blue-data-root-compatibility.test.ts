import { describe, it, expect } from 'vitest';
import { BlueData } from './blue-data';
import { PolyObject } from './sound-objects/poly-object';
import { Element } from './serialization/xml-reader';
import { ClojureProjectData } from './plugins/clojure-project-data';

describe('BlueData root XML compatibility', () => {
  describe('loadFromString - root section preservation', () => {
    it('loads projectProperties', () => {
      const xml = `<blueData version="5.0.0">
        <projectProperties>
          <title>Test</title>
          <sampleRate>48000</sampleRate>
        </projectProperties>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getProjectProperties().title).toBe('Test');
      expect(data.getProjectProperties().sampleRate).toBe('48000');
    });

    it('loads scratchPadData', () => {
      const xml = `<blueData version="5.0.0">
        <scratchPadData>
          <scratchText>Hello</scratchText>
          <isWordWrapEnabled>false</isWordWrapEnabled>
        </scratchPadData>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getScratchPadData().getScratchText()).toBe('Hello');
    });

    it('loads markersList', () => {
      const xml = `<blueData version="5.0.0">
        <markersList>
          <marker name="A" time="1.5"/>
        </markersList>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const saved = data.getMarkersList().saveAsXML();
      const children = saved.getElements();
      let count = 0;
      while (children.hasMoreElements()) {
        children.next();
        count++;
      }
      expect(count).toBe(1);
    });

    it('loads midiInputProcessor', () => {
      const xml = `<blueData version="5.0.0">
        <midiInputProcessor>
          <keyMapping>MIDI</keyMapping>
          <pitchConstant>gk_pitch</pitchConstant>
        </midiInputProcessor>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getMidiInputProcessor().getKeyMapping()).toBe('MIDI');
      expect(data.getMidiInputProcessor().getPitchConstant()).toBe('gk_pitch');
    });

    it('loads noteProcessorChainMap', () => {
      const xml = `<blueData version="5.0.0">
        <noteProcessorChainMap>
          <noteProcessorChain name="chain1"/>
        </noteProcessorChainMap>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getNoteProcessorChainMap().getChainNames()).toContain('chain1');
    });

    it('preserves pluginData children', () => {
      const xml = `<blueData version="5.0.0">
        <pluginData>
          <customPlugin name="test"/>
        </pluginData>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const saved = data.saveAsXML();
      const pluginDataElem = saved.getElement('pluginData');
      expect(pluginDataElem).not.toBeNull();
      const children = pluginDataElem!.getElements();
      let count = 0;
      while (children.hasMoreElements()) {
        children.next();
        count++;
      }
      expect(count).toBe(1);
    });

    it('extracts typed clojure project data from pluginData', () => {
      const xml = `<blueData version="5.0.0">
        <pluginData>
          <blueDataObject bdoType="blue.clojure.project.ClojureProjectData">
            <clojureLibraryEntry>
              <coordinates>kunstmusik/score</coordinates>
              <version>0.3.0</version>
            </clojureLibraryEntry>
          </blueDataObject>
        </pluginData>
      </blueData>`;

      const data = BlueData.loadFromString(xml);
      const clojureProjectData = data.getClojureProjectData();

      expect(clojureProjectData).not.toBeNull();
      expect(clojureProjectData?.getLibraryEntries()[0].getDependencyCoordinates()).toBe(
        'kunstmusik/score',
      );
    });

    it('replaces typed clojure project data without dropping other plugin data', () => {
      const xml = `<blueData version="5.0.0">
        <pluginData>
          <customPlugin name="test"/>
        </pluginData>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const clojureProjectData = new ClojureProjectData();
      const saved = data.saveAsXML();

      expect(saved.getElement('pluginData')?.getElements().size).toBe(1);

      data.setClojureProjectData(clojureProjectData);

      const updated = data.saveAsXML();
      const pluginData = updated.getElement('pluginData');
      expect(pluginData?.getElements().size).toBe(2);
      expect(data.getClojureProjectData()).not.toBeNull();
    });

    it('loads legacy root udo into opcodeList', () => {
      const xml = `<blueData version="5.0.0">
        <udo>opcode testOpcode, aa, aa
  ain xin
  aout = ain
  xout aout
endop</udo>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getOpcodeList().size()).toBe(1);
      expect(data.getOpcodeList().getOpcode(0)?.getName()).toBe('testOpcode');
    });

    it('loads instrumentLibrary', () => {
      const xml = `<blueData version="5.0.0">
        <instrumentLibrary>
          <genericInstrument name="instr1"/>
        </instrumentLibrary>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getInstrumentLibrary()).not.toBeNull();
    });
  });

  describe('omitted mixer semantics', () => {
    it('disables mixer when mixer element is absent', () => {
      const xml = `<blueData version="5.0.0">
        <projectProperties/>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getMixer().isEnabled()).toBe(false);
    });

    it('keeps mixer enabled when mixer element is present', () => {
      const xml = `<blueData version="5.0.0">
        <mixer><enabled>true</enabled></mixer>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      expect(data.getMixer().isEnabled()).toBe(true);
    });
  });

  describe('render range semantics', () => {
    it('clears render end when render start reaches or passes it', () => {
      const data = new BlueData();
      data.setRenderStartTime(4);
      data.setRenderEndTime(12);

      data.setRenderStartTime(12);

      expect(data.getRenderStartTime()).toBe(12);
      expect(data.getRenderEndTime()).toBe(-1);
    });

    it('normalizes render end values at or before render start to the Java no-selection sentinel', () => {
      const data = new BlueData();
      data.setRenderStartTime(8);

      data.setRenderEndTime(0);

      expect(data.getRenderEndTime()).toBe(-1);
    });
  });

  describe('saveToString - Java-compatible ordering', () => {
    it('emits root sections in Java-compatible order', () => {
      const xml = `<blueData version="5.0.0">
        <projectProperties><title>Test</title></projectProperties>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const saved = data.saveAsXML();
      const childNames: string[] = [];
      const children = saved.getElements();
      while (children.hasMoreElements()) {
        childNames.push(children.next().getName());
      }
      // Java order: projectProperties, arrangement, mixer, tables,
      // soundObjectLibrary, globalOrcSco, opcodeList, liveData, score,
      // scratchPadData, noteProcessorChainMap, renderStartTime, renderEndTime,
      // markersList, loopRendering, midiInputProcessor, pluginData
      const expectedOrder = [
        'projectProperties',
        'arrangement',
        'mixer',
        'tables',
        'soundObjectLibrary',
        'globalOrcSco',
        'opcodeList',
        'liveData',
        'score',
        'scratchPadData',
        'noteProcessorChainMap',
        'renderStartTime',
        'renderEndTime',
        'markersList',
        'loopRendering',
        'midiInputProcessor',
        'pluginData',
      ];
      expect(childNames).toEqual(expectedOrder);
    });
  });

  describe('deepCopy - full root parity', () => {
    it('copies all root sections', () => {
      const xml = `<blueData version="5.0.0">
        <projectProperties><title>Test</title></projectProperties>
        <score>
          <timeState><smpteFrameRate>25</smpteFrameRate></timeState>
        </score>
        <scratchPadData><scratchText>Hello</scratchText></scratchPadData>
        <markersList/>
        <midiInputProcessor/>
        <noteProcessorChainMap/>
        <mixer><enabled>true</enabled></mixer>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const addedLayerGroup = new PolyObject(true);
      data.getScore().push(addedLayerGroup);
      const copy = data.deepCopy() as BlueData;

      expect(copy.getProjectProperties().title).toBe('Test');
      expect(copy.getScore().length).toBe(data.getScore().length);
      expect(copy.getScore()[copy.getScore().length - 1]).not.toBe(addedLayerGroup);
      expect(copy.getScore().getTimeState().getSmpteFrameRate()).toBe(25);
      expect(copy.getScratchPadData().getScratchText()).toBe('Hello');
      expect(copy.getMixer().isEnabled()).toBe(true);

      copy.getScore().getTimeState().setSmpteFrameRate(30);
      expect(data.getScore().getTimeState().getSmpteFrameRate()).toBe(25);
    });

    it('mutation of copy does not affect source', () => {
      const xml = `<blueData version="5.0.0">
        <projectProperties><title>Original</title></projectProperties>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const copy = data.deepCopy() as BlueData;
      copy.getProjectProperties().title = 'Modified';
      expect(data.getProjectProperties().title).toBe('Original');
    });
  });

  describe('round-trip - load/save/reload', () => {
    it('preserves root sections through round-trip', () => {
      const xml = `<blueData version="5.0.0">
        <projectProperties>
          <title>Round Trip Test</title>
          <author>Test Author</author>
          <sampleRate>48000</sampleRate>
        </projectProperties>
        <scratchPadData>
          <scratchText>Notes</scratchText>
        </scratchPadData>
        <midiInputProcessor>
          <keyMapping>MIDI</keyMapping>
        </midiInputProcessor>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const saved = data.saveToString();
      const reloaded = BlueData.loadFromString(saved);

      expect(reloaded.getProjectProperties().title).toBe('Round Trip Test');
      expect(reloaded.getProjectProperties().author).toBe('Test Author');
      expect(reloaded.getProjectProperties().sampleRate).toBe('48000');
      expect(reloaded.getScratchPadData().getScratchText()).toBe('Notes');
      expect(reloaded.getMidiInputProcessor().getKeyMapping()).toBe('MIDI');
    });

    it('preserves unknown pluginData and legacy XML structures through round-trip', () => {
      const xml = `<blueData version="5.0.0">
        <projectProperties>
          <title>Legacy XML Test</title>
        </projectProperties>
        <pluginData>
          <legacyEffectManager enabled="true">
            <effectId>echo-1</effectId>
          </legacyEffectManager>
          <parameterTimeManager version="1">
            <mapping name="cutoff" time="0.5"/>
          </parameterTimeManager>
        </pluginData>
      </blueData>`;
      const data = BlueData.loadFromString(xml);
      const saved = data.saveToString();
      const reloaded = BlueData.loadFromString(saved);

      expect(reloaded.getProjectProperties().title).toBe('Legacy XML Test');
      expect(saved).toContain('<legacyEffectManager enabled="true">');
      expect(saved).toContain('<effectId>echo-1</effectId>');
      expect(saved).toContain('<parameterTimeManager version="1">');
      expect(reloaded.saveToString()).toContain('<legacyEffectManager enabled="true">');
    });
  });
});
