import { describe, it, expect } from 'vite-plus/test';
import { LiveData } from './live-data';
import { LiveObject } from './live/live-object';
import { LiveObjectBins } from './live/live-object-bins';
import { Element } from './serialization/xml-reader';

describe('LiveData XML round-trip', () => {
  it('saves and loads default LiveData', () => {
    const original = new LiveData();
    const xml = original.saveAsXML().toXml();
    const parsed = Element.parse(xml);
    const loaded = LiveData.loadFromXML(parsed);

    expect(loaded.getCommandLine()).toBe(original.getCommandLine());
    expect(loaded.isCommandLineEnabled()).toBe(false);
    expect(loaded.isCommandLineOverride()).toBe(false);
    expect(loaded.getTempo()).toBe(60);
    expect(loaded.getRepeat()).toBe(4);
    expect(loaded.isRepeatEnabled()).toBe(false);
    expect(loaded.getLiveCodeText()).toBe('');
  });

  it('preserves all scalar fields through save/load', () => {
    const original = new LiveData();
    original.setCommandLine('csound -d -o dac -L stdin');
    original.setCommandLineEnabled(true);
    original.setCommandLineOverride(false);
    original.setTempo(120);
    original.setRepeat(8);
    original.setRepeatEnabled(true);
    original.setLiveCodeText('instr 1\naout oscili 0.5, 440\nout aout\nendin');

    const xml = original.saveAsXML().toXml();
    const parsed = Element.parse(xml);
    const loaded = LiveData.loadFromXML(parsed);

    expect(loaded.getCommandLine()).toBe('csound -d -o dac -L stdin');
    expect(loaded.isCommandLineEnabled()).toBe(true);
    expect(loaded.isCommandLineOverride()).toBe(false);
    expect(loaded.getTempo()).toBe(120);
    expect(loaded.getRepeat()).toBe(8);
    expect(loaded.isRepeatEnabled()).toBe(true);
    expect(loaded.getLiveCodeText()).toBe('instr 1\naout oscili 0.5, 440\nout aout\nendin');
  });

  it('preserves LiveObjectBins with live objects through save/load', () => {
    const original = new LiveData();
    const bins = new LiveObjectBins(2, 3);
    const obj1 = new LiveObject();
    obj1.setEnabled(true);
    obj1.setKeyTrigger(65);
    bins.setLiveObject(0, 0, obj1);
    const obj2 = new LiveObject();
    obj2.setEnabled(false);
    obj2.setMidiTrigger(60);
    bins.setLiveObject(1, 2, obj2);
    original.setLiveObjectBins(bins);

    const xml = original.saveAsXML().toXml();
    const parsed = Element.parse(xml);
    const loaded = LiveData.loadFromXML(parsed);
    const loadedBins = loaded.getLiveObjectBins();

    expect(loadedBins.getColumnCount()).toBe(2);
    expect(loadedBins.getRowCount()).toBe(3);
    expect(loadedBins.getLiveObject(0, 0)).not.toBeNull();
    expect(loadedBins.getLiveObject(0, 0)!.isEnabled()).toBe(true);
    expect(loadedBins.getLiveObject(0, 0)!.getKeyTrigger()).toBe(65);
    expect(loadedBins.getLiveObject(1, 2)).not.toBeNull();
    expect(loadedBins.getLiveObject(1, 2)!.getMidiTrigger()).toBe(60);
    expect(loadedBins.getLiveObject(1, 0)).toBeNull();
  });

  it('preserves LiveObjectSetList through save/load', () => {
    const original = new LiveData();
    const bins = new LiveObjectBins(1, 2);
    const obj1 = new LiveObject();
    obj1.setEnabled(true);
    bins.setLiveObject(0, 0, obj1);
    original.setLiveObjectBins(bins);

    const setList = original.getLiveObjectSets();
    setList.captureEnabledSet(bins, 'Set 1');

    const xml = original.saveAsXML().toXml();
    const parsed = Element.parse(xml);
    const loaded = LiveData.loadFromXML(parsed);

    expect(loaded.getLiveObjectSets().getSets()).toHaveLength(1);
    expect(loaded.getLiveObjectSets().getSets()[0].getName()).toBe('Set 1');
  });

  it('upgrades old-format soundObject/liveObject children into bins', () => {
    const xml = `<liveData>
      <commandLine>csound</commandLine>
      <soundObject type="GenericScore">
        <name>TestObj</name>
        <scoreText>i1 0 1</scoreText>
      </soundObject>
      <repeat>2</repeat>
      <tempo>90</tempo>
    </liveData>`;
    const parsed = Element.parse(xml);
    const loaded = LiveData.loadFromXML(parsed);

    expect(loaded.getTempo()).toBe(90);
    expect(loaded.getRepeat()).toBe(2);
    expect(loaded.getLiveObjectBins().getColumnCount()).toBe(1);
    expect(loaded.getLiveObjectBins().getRowCount()).toBe(1);
    expect(loaded.getLiveObjectBins().getLiveObject(0, 0)).not.toBeNull();
  });

  it('upgrades command-line when commandLineEnabled/Override are missing', () => {
    const xml = `<liveData>
      <commandLine>csound</commandLine>
    </liveData>`;
    const parsed = Element.parse(xml);
    const loaded = LiveData.loadFromXML(parsed);

    expect(loaded.isCommandLineEnabled()).toBe(true);
    expect(loaded.isCommandLineOverride()).toBe(true);
  });

  it('deep copies all fields independently', () => {
    const original = new LiveData();
    original.setTempo(140);
    original.setRepeat(16);
    original.setRepeatEnabled(true);
    original.setLiveCodeText('test code');
    const bins = new LiveObjectBins(1, 1);
    const obj = new LiveObject();
    obj.setEnabled(true);
    bins.setLiveObject(0, 0, obj);
    original.setLiveObjectBins(bins);

    const copy = original.deepCopy() as LiveData;

    copy.setTempo(80);
    copy.setLiveCodeText('changed');
    copy.getLiveObjectBins().getLiveObject(0, 0)!.setEnabled(false);

    expect(original.getTempo()).toBe(140);
    expect(original.getLiveCodeText()).toBe('test code');
    expect(original.getLiveObjectBins().getLiveObject(0, 0)!.isEnabled()).toBe(true);
  });

  it('handles null command line gracefully', () => {
    const ld = new LiveData();
    ld.setCommandLine(null as unknown as string);
    expect(ld.getCommandLine()).toBe('');
  });

  it('handles null liveCodeText gracefully', () => {
    const ld = new LiveData();
    ld.setLiveCodeText(null as unknown as string);
    expect(ld.getLiveCodeText()).toBe('');
  });
});
