import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { createSoundObject } from './sound-object-registry';
import { ObjectBuilder } from './object-builder';
import './register-sound-object-types';

describe('ObjectBuilder', () => {
  it('loads legacy external configuration and preserves it on save', () => {
    const xml = Element.parse(`
      <soundObject type="blue.soundObject.ObjectBuilder" editEnabled="false">
        <subjectiveDuration>4.0</subjectiveDuration>
        <startTime>1.0</startTime>
        <name>Legacy ObjectBuilder</name>
        <backgroundColor>-12566464</backgroundColor>
        <timeBehavior>0</timeBehavior>
        <noteProcessorChain/>
        <code>score = &quot;i1 0 1 440&quot;</code>
        <commandLine>python $infile</commandLine>
        <isExternal>true</isExternal>
        <graphicInterface editEnabled="true">
          <gridSettings>
            <width>10</width>
            <height>10</height>
            <gridStyle>NONE</gridStyle>
            <snapGridEnabled>false</snapGridEnabled>
          </gridSettings>
        </graphicInterface>
        <presetGroup name="Presets" currentPresetModified="false"/>
      </soundObject>
    `);

    const objectBuilder = ObjectBuilder.loadFromXML(xml);

    expect(objectBuilder.getLanguageType()).toBe('EXTERNAL');
    expect(objectBuilder.isEditEnabled()).toBe(false);
    expect(objectBuilder.getCommandLine()).toBe('python $infile');

    const saved = objectBuilder.saveAsXML();
    expect(saved.getAttribute('type')).toBe('blue.soundObject.ObjectBuilder');
    expect(saved.getAttribute('editEnabled')).toBe('false');
    expect(saved.getTextString('commandLine')).toBe('python $infile');
    expect(saved.getTextString('languageType')).toBe('EXTERNAL');
  });

  it('deep copies non-python language settings and code', () => {
    const objectBuilder = new ObjectBuilder();
    objectBuilder.setCode('score = "i1 0 1 440"');
    objectBuilder.setCommandLine('cmask $infile $outfile');
    objectBuilder.setLanguageType('EXTERNAL');
    objectBuilder.setEditEnabled(false);

    const copy = objectBuilder.deepCopy() as ObjectBuilder;

    expect(copy).not.toBe(objectBuilder);
    expect(copy.getCode()).toBe('score = "i1 0 1 440"');
    expect(copy.getCommandLine()).toBe('cmask $infile $outfile');
    expect(copy.getLanguageType()).toBe('EXTERNAL');
    expect(copy.isEditEnabled()).toBe(false);
  });

  it('registers a sound-object factory', () => {
    const created = createSoundObject('ObjectBuilder');

    expect(created).toBeInstanceOf(ObjectBuilder);
  });
});