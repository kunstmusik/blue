import { describe, expect, it } from 'vitest';
import { Element } from '../../src/serialization/xml-reader';
import { BlueSynthBuilder } from '../../src/instruments/blue-synth-builder';
import { Mixer } from '../../src/mixer/mixer';
import { TimeContext } from '../../src/time/time-context';
import {
  createRuntimeTimeContextXml,
  loadRuntimeBsbFixture,
  loadRuntimeMixerFixture,
} from './runtime-model-fixtures';
import { expectEquivalentXml } from './runtime-model-comparison';

describe('runtime-model round-trips', () => {
  it('keeps BSB parameter aliases and canonicalizes the save format', () => {
    const instrument = loadRuntimeBsbFixture();

    expect(instrument.getParameters()).toHaveLength(1);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<parameterList>');
    expect(savedXml).not.toContain('<bsbParameterList>');

    const reloaded = BlueSynthBuilder.loadFromXML(Element.parse(savedXml));
    expect(reloaded.getParameters()).toHaveLength(1);
    expect(reloaded.getGraphicInterface().getGridSettings().gridStyle).toBe('LINE');
  });

  it('keeps mixer master and extra render time through save/load', () => {
    const mixer = loadRuntimeMixerFixture();
    const savedXml = mixer.saveAsXML().toXml();
    const reloaded = Mixer.loadFromXML(Element.parse(savedXml));

    expect(savedXml).toContain('list="channels"');
    expect(savedXml).toContain('list="subChannels"');
    expect(savedXml).toContain('<extraRenderTime>3.5</extraRenderTime>');
    expect(reloaded.getMaster().getName()).toBe('Master');
    expect(reloaded.getExtraRenderTime()).toBeCloseTo(3.5, 6);
    expect(reloaded.getChannels()).toHaveLength(1);
    expect(reloaded.getSubChannels()).toHaveLength(1);
  });

  it('keeps TimeContext tempo, meter, and SMPTE state through save/load', () => {
    const context = TimeContext.loadFromXML(Element.parse(createRuntimeTimeContextXml()));
    const savedXml = context.saveAsXML().toXml();
    const reloaded = TimeContext.loadFromXML(Element.parse(savedXml));

    expectEquivalentXml(savedXml, createRuntimeTimeContextXml());
    expect(reloaded.hasSameMusicalContext(context)).toBe(true);
    expect(reloaded.getSmpteFrameRate()).toBe(context.getSmpteFrameRate());
  });
});
