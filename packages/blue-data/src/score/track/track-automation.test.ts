import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { BlueX7 } from '../../instruments/blue-x7';
import { Track } from './track';

describe('Track automation', () => {
  it('persists parameterId children in XML', () => {
    const layer = new Track();
    layer.setName('Track 1');
    layer.getAutomationParameters().addParameterId('paramX');
    layer.getAutomationParameters().addParameterId('paramY');

    const xml = layer.saveAsXML();
    const reloaded = Track.loadFromXML(Element.parse(xml.toXml()));

    expect(reloaded.getAutomationParameters().getIds()).toEqual(['paramX', 'paramY']);
  });

  it('deep copies automation parameter ids', () => {
    const layer = new Track();
    layer.setName('Original');
    layer.getAutomationParameters().addParameterId('p1');

    const copy = new Track(layer);
    copy.getAutomationParameters().addParameterId('p2');

    expect(layer.getAutomationParameters().getIds()).toEqual(['p1']);
    expect(copy.getAutomationParameters().getIds()).toEqual(['p1', 'p2']);
  });

  it('loads a Track without parameterId children', () => {
    const xml = `<track name="Empty" muted="false" solo="false" heightIndex="0" uniqueId="test-uid"/>`;
    const layer = Track.loadFromXML(Element.parse(xml));
    expect(layer.getAutomationParameters().getIds()).toEqual([]);
  });

  it('persists selectedIndex through round-trip', () => {
    const layer = new Track();
    layer.setName('Layer');
    layer.getAutomationParameters().addParameterId('a');
    layer.getAutomationParameters().addParameterId('b');
    layer.getAutomationParameters().setSelectedIndex(1);

    const reloaded = Track.loadFromXML(Element.parse(layer.saveAsXML().toXml()));
    expect(reloaded.getAutomationParameters().getSelectedIndex()).toBe(1);
  });

  it('keeps a Track-owned BlueX7 assignment bound to its persisted Parameter id', () => {
    const layer = new Track();
    const source = new BlueX7();
    source.setEnabled(true);
    layer.setInstrument(source);
    const instrument = layer.getInstrument() as BlueX7;
    const parameter = instrument
      .getParameters()
      .find((candidate) => candidate.getName() === 'common.algorithm')!;
    layer.getAutomationParameters().addParameterId(parameter.getUniqueId());

    const reopened = Track.loadFromXML(Element.parse(layer.saveAsXML().toXml()));
    const reopenedInstrument = reopened.getInstrument() as BlueX7;
    const reopenedParameter = reopenedInstrument
      .getParameters()
      .find((candidate) => candidate.getName() === 'common.algorithm')!;

    expect(reopenedParameter.getUniqueId()).toBe(parameter.getUniqueId());
    expect(reopened.getAutomationParameters().getIds()).toEqual([reopenedParameter.getUniqueId()]);
  });

  it('remaps BlueX7 assignments to regenerated ids when a Track is deep-copied', () => {
    const sourceTrack = new Track();
    sourceTrack.setInstrument(new BlueX7());
    const sourceInstrument = sourceTrack.getInstrument() as BlueX7;
    const sourceParameter = sourceInstrument
      .getParameters()
      .find((candidate) => candidate.getName() === 'common.feedback')!;
    sourceParameter.setAutomationEnabled(true);
    sourceParameter.setPoints([
      { time: 0, value: 1 },
      { time: 4, value: 7 },
    ]);
    sourceTrack.getAutomationParameters().addParameterId(sourceParameter.getUniqueId());
    sourceTrack.getAutomationParameters().addParameterId('unrelated-project-parameter');
    sourceTrack.getAutomationParameters().setSelectedParameter(sourceParameter.getUniqueId());

    const copiedTrack = sourceTrack.deepCopy();
    const copiedInstrument = copiedTrack.getInstrument() as BlueX7;
    const copiedParameter = copiedInstrument
      .getParameters()
      .find((candidate) => candidate.getName() === 'common.feedback')!;

    expect(copiedParameter.getUniqueId()).not.toBe(sourceParameter.getUniqueId());
    expect(copiedParameter.getPoints()).toEqual(sourceParameter.getPoints());
    expect(copiedTrack.getAutomationParameters().getIds()).toContain(copiedParameter.getUniqueId());
    expect(copiedTrack.getAutomationParameters().getIds()).not.toContain(
      sourceParameter.getUniqueId(),
    );
    expect(copiedTrack.getAutomationParameters().getIds()).toContain('unrelated-project-parameter');
    expect(copiedTrack.getAutomationParameters().getSelectedId()).toBe(
      copiedParameter.getUniqueId(),
    );
  });
});
