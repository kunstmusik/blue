import { describe, expect, it } from 'vitest';

import { BlueData } from './blue-data';
import { FrozenSoundObject } from './sound-objects/frozen-sound-object';
import { GenericScore } from './sound-objects/generic-score';
import { PolyObject } from './sound-objects/poly-object';
import { TimeDuration } from './time/time-duration';
import { TimePosition } from './time/time-position';

import { AudioFile } from './sound-objects/audio-file';

describe('BlueData frozen SoundObject and AudioFile persistence', () => {
  it('preserves relative artifact metadata and nested source across a project save/reopen without transient fields', () => {
    const data = new BlueData();
    const source = new GenericScore();
    source.setName('Original Score');
    source.setStartTime(TimePosition.beats(4));
    source.setSubjectiveDuration(TimeDuration.beats(2));

    const frozen = new FrozenSoundObject();
    frozen.setName('F: Original Score');
    frozen.setFrozenSoundObject(source);
    frozen.setFrozenWaveFileName('freeze7.wav');
    frozen.setNumChannels(2);
    frozen.setStartTime(TimePosition.beats(4));
    frozen.setSubjectiveDuration(TimeDuration.beats(2));
    (data.getScore()[0] as PolyObject)[0].push(frozen);

    const xmlRoot = data.saveAsXML();
    xmlRoot.getElement('pluginData')?.addElement('unknownFeature').setText('keep-me');
    const xml = xmlRoot.toXml();
    expect(xml).not.toContain('artifactStatus');
    expect(xml).not.toContain('canSaveCopy');

    const reopened = BlueData.loadFromString(xml);
    const restored = (reopened.getScore()[0] as PolyObject)[0][0] as FrozenSoundObject;

    expect(restored).toBeInstanceOf(FrozenSoundObject);
    expect(restored.getFrozenWaveFileName()).toBe('freeze7.wav');
    expect(restored.getNumChannels()).toBe(2);
    expect(restored.getFrozenSoundObject()).toBeInstanceOf(GenericScore);
    expect(restored.getFrozenSoundObject()?.getName()).toBe('Original Score');
    expect(reopened.saveToString()).toContain('<unknownFeature>keep-me</unknownFeature>');
  });

  it('preserves AudioFile soundFileName and csoundPostCode without saving transient metadata fields', () => {
    const data = new BlueData();
    const af = new AudioFile();
    af.setName('Percussion');
    af.setSoundFileName('audio/snare.wav');
    af.setCsoundPostCode('aChannel1 = aChannel1 * 0.9');
    (data.getScore()[0] as PolyObject)[0].push(af);

    const xml = data.saveToString();
    const audioFileXml = xml.slice(xml.indexOf('<soundObject type="blue.soundObject.AudioFile">'));
    expect(audioFileXml).toContain('audio/snare.wav');
    expect(audioFileXml).toContain('aChannel1 = aChannel1 * 0.9');
    expect(audioFileXml).not.toContain('formatType');
    expect(audioFileXml).not.toContain('sampleRate');
    expect(audioFileXml).not.toContain('byteLength');
    expect(audioFileXml).not.toContain('channelVariables');

    const reopened = BlueData.loadFromString(xml);
    const restored = (reopened.getScore()[0] as PolyObject)[0][0] as AudioFile;

    expect(restored).toBeInstanceOf(AudioFile);
    expect(restored.getSoundFileName()).toBe('audio/snare.wav');
    expect(restored.getCsoundPostCode()).toBe('aChannel1 = aChannel1 * 0.9');
    expect(restored.getName()).toBe('Percussion');
  });
});
