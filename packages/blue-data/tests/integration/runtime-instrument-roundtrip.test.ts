import { describe, expect, it } from 'vitest';
import { Element } from '../../src/serialization/xml-reader';
import { GenericInstrument } from '../../src/instruments/generic-instrument';
import { JavaScriptInstrument } from '../../src/instruments/javascript-instrument';
import { PythonInstrument } from '../../src/instruments/python-instrument';
import {
  BlueX7,
  createDefaultBlueX7Voice,
  generateBlueX7Preview,
  getBlueX7BindingReport,
  getSysexType,
  formatBankSlotLabel,
} from '../../src/index';
import { assignParameterNames } from '../../src/automation/parameter-helper';
import { loadRuntimeBsbFixture } from './runtime-model-fixtures';
import { normalizeWhitespace } from './runtime-model-comparison';

describe('runtime instrument parity', () => {
  it('applies BSB replacements across instrument and global text', () => {
    const instrument = loadRuntimeBsbFixture();
    assignParameterNames(instrument.getParameters());

    expect(normalizeWhitespace(instrument.generateInstrument())).toContain(
      'aout oscili gk_blue_auto0, 440',
    );
    expect(normalizeWhitespace(instrument.generateGlobalOrc() ?? '')).toContain(
      'gk_runtime = gk_blue_auto0',
    );
    expect(normalizeWhitespace(instrument.generateGlobalSco() ?? '')).toContain(
      'i1 0 gk_blue_auto0',
    );
    expect(normalizeWhitespace(instrument.generateAlwaysOnInstrument() ?? '')).toContain(
      'aout oscili gk_blue_auto0, 220',
    );
  });

  it('preserves generic and deferred instrument payloads', () => {
    const genericXml = `<instrument type="blue.orchestra.GenericInstrument">
      <name>Generic Runtime</name>
      <comment>generic comment</comment>
      <globalOrc>gk = 1</globalOrc>
      <globalSco>i1 0 1</globalSco>
      <instrumentText>aout oscili 0.5, 440</instrumentText>
      <opcodeList/>
    </instrument>`;
    const generic = GenericInstrument.loadFromXML(Element.parse(genericXml));
    const genericSaved = generic.saveAsXML().toXml();
    const genericReloaded = GenericInstrument.loadFromXML(Element.parse(genericSaved));

    expect(genericReloaded.getText()).toBe('aout oscili 0.5, 440');
    expect(genericReloaded.getGlobalOrc()).toBe('gk = 1');
    expect(genericReloaded.getGlobalSco()).toBe('i1 0 1');

    const javascriptXml = `<instrument type="blue.orchestra.JavaScriptInstrument">
      <name>JS Runtime</name>
      <comment>js comment</comment>
      <globalOrc>gk = 2</globalOrc>
      <globalSco>i1 0 2</globalSco>
      <instrumentText>instrument = "aout oscili 1, 440";</instrumentText>
      <opcodeList/>
    </instrument>`;
    const javascript = JavaScriptInstrument.loadFromXML(Element.parse(javascriptXml));
    const javascriptReloaded = JavaScriptInstrument.loadFromXML(
      Element.parse(javascript.saveAsXML().toXml()),
    );
    expect(javascriptReloaded.getText()).toContain('aout oscili 1, 440');
    expect(javascriptReloaded.generateGlobalOrc()).toBe('gk = 2');
    expect(javascriptReloaded.generateGlobalSco()).toBe('i1 0 2');

    const pythonXml = `<instrument type="blue.orchestra.PythonInstrument">
      <name>Python Runtime</name>
      <comment>py comment</comment>
      <globalOrc>gk = 3</globalOrc>
      <globalSco>i1 0 3</globalSco>
      <instrumentText>instrument = "aout oscili 1, 440"</instrumentText>
      <opcodeList/>
    </instrument>`;
    const python = PythonInstrument.loadFromXML(Element.parse(pythonXml));
    const pythonReloaded = PythonInstrument.loadFromXML(Element.parse(python.saveAsXML().toXml()));
    expect(pythonReloaded.getText()).toContain('aout oscili 1, 440');
    expect(pythonReloaded.generateGlobalOrc()).toBe('gk = 3');
    expect(pythonReloaded.generateGlobalSco()).toBe('i1 0 3');

    const blueX7Xml = `<instrument type="blue.orchestra.BlueX7">
      <name>BlueX7 Runtime</name>
      <comment>bluex7 comment</comment>
      <customData>
        <nested>alpha</nested>
      </customData>
    </instrument>`;
    const blueX7 = BlueX7.loadFromXML(Element.parse(blueX7Xml));
    const blueX7Saved = blueX7.saveAsXML().toXml();

    expect(blueX7Saved).toContain('<customData>');
    expect(blueX7Saved).toContain('<nested>alpha</nested>');
  });

  it('exports BlueX7 preview and SysEx entry points from package index in a host-neutral manner', () => {
    expect(BlueX7).toBeDefined();
    expect(createDefaultBlueX7Voice).toBeTypeOf('function');
    expect(generateBlueX7Preview).toBeTypeOf('function');
    expect(getBlueX7BindingReport).toBeTypeOf('function');
    expect(getSysexType).toBeTypeOf('function');
    expect(formatBankSlotLabel).toBeTypeOf('function');

    const voice = createDefaultBlueX7Voice();
    const preview = generateBlueX7Preview(voice, 'PackageTest');
    expect(preview.tables).toContain('; [BLUEX7] - START STATIC TABLES');
    expect(preview.body).toContain('aout =');
    expect(preview.bindings.emitted.length).toBeGreaterThan(0);
    expect(preview.bindings.notEmitted.length).toBeGreaterThan(0);
  });
});