import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { Track } from './track/track';
import { TrackLayerGroup } from './track/track-layer-group';
import { PatternLayer } from './patterns/pattern-layer';
import { PatternsLayerGroup } from './patterns/patterns-layer-group';
import { PatternData } from './patterns/pattern-data';
import { AudioClip } from './audio/audio-clip';
import { SoundLayer } from '../sound-objects/sound-layer';
import '../sound-objects/sound-object-registry';

describe('timeline owner acceptance', () => {
  it.each([
    [Track.loadFromXML, '<track future="x"/>'],
    [Track.loadFromXML, '<track muted="yes"/>'],
    [Track.loadFromXML, '<track heightIndex="0junk"/>'],
    [Track.loadFromXML, '<track customHeight="57px"/>'],
    [Track.loadFromXML, '<track><backgroundColor>1junk</backgroundColor></track>'],
    [
      Track.loadFromXML,
      '<track><instrument type="blue.orchestra.GenericInstrument"/><instrument type="blue.orchestra.GenericInstrument"/></track>',
    ],
    [Track.loadFromXML, '<track><soundObject type="blue.soundObject.PolyObject"/></track>'],
    [TrackLayerGroup.loadFromXML, '<trackLayerGroup><tracks><foreign/></tracks></trackLayerGroup>'],
    [
      TrackLayerGroup.loadFromXML,
      '<trackLayerGroup><defaultHeightIndex>0junk</defaultHeightIndex></trackLayerGroup>',
    ],
    [PatternLayer.loadFromXML, '<patternLayer solo="yes"/>'],
    [
      PatternLayer.loadFromXML,
      '<patternLayer><backgroundColor>NaN</backgroundColor></patternLayer>',
    ],
    [PatternLayer.loadFromXML, '<patternLayer><soundObject type="foreign"/></patternLayer>'],
    [
      PatternsLayerGroup.loadFromXML,
      '<patternsLayerGroup><patternBeatsLength>0</patternBeatsLength></patternsLayerGroup>',
    ],
    [
      PatternsLayerGroup.loadFromXML,
      '<patternsLayerGroup><patternLayers><foreign/></patternLayers></patternsLayerGroup>',
    ],
    [PatternData.loadFromXML, '<patternData>102</patternData>'],
    [PatternData.loadFromXML, '<patternData><foreign/></patternData>'],
    [AudioClip.loadFromXML, '<audioClip><fadeIn>-1</fadeIn></audioClip>'],
    [AudioClip.loadFromXML, '<audioClip><fadeInType>UNKNOWN</fadeInType></audioClip>'],
    [AudioClip.loadFromXML, '<audioClip><numChannels>2junk</numChannels></audioClip>'],
    [AudioClip.loadFromXML, '<audioClip><start>1</start><startTime>2</startTime></audioClip>'],
    [AudioClip.loadFromXML, '<audioClip future="x"/>'],
    [SoundLayer.loadFromXML, '<soundLayer><future/></soundLayer>'],
  ])('rejects malformed timeline XML %#', (load, xml) => {
    expect(() => load(Element.parse(xml))).toThrow();
  });

  it('serializes a compact pattern without changing canonical vector size', () => {
    const data = new PatternData();
    data.setPattern(32, true);
    data.setPattern(32, false);
    const before = data.getPatterns();
    expect(data.saveAsXML().getTextString()).toHaveLength(16);
    expect(data.getPatterns()).toEqual(before);
  });
});
