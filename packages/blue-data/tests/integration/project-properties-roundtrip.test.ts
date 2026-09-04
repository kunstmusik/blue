import { describe, expect, it } from 'vitest';
import { Element } from '../../src/serialization/xml-reader';
import { ProjectProperties } from '../../src/project-properties';

describe('ProjectProperties Java-compatible round-trip', () => {
  it('preserves built-in project property fields and legacy aliases', () => {
    const props = new ProjectProperties();
    props.title = 'Project Title';
    props.author = 'Project Author';
    props.notes = 'Project notes';
    props.sampleRate = '48000';
    props.ksmps = '32';
    props.channels = '4';
    props.useZeroDbFS = true;
    props.zeroDbFS = '65536';
    props.diskSampleRate = '96000';
    props.diskKsmps = '128';
    props.diskChannels = '8';
    props.diskUseZeroDbFS = true;
    props.diskZeroDbFS = '32768';
    props.useAudioOut = false;
    props.useAudioIn = true;
    props.useMidiIn = true;
    props.useMidiOut = false;
    props.noteAmpsEnabled = false;
    props.outOfRangeEnabled = false;
    props.warningsEnabled = false;
    props.benchmarkEnabled = false;
    props.advancedSettings = '-odac -d';
    props.completeOverride = true;
    props.fileName = 'render.wav';
    props.askOnRender = true;
    props.diskNoteAmpsEnabled = false;
    props.diskOutOfRangeEnabled = false;
    props.diskWarningsEnabled = false;
    props.diskBenchmarkEnabled = false;
    props.diskAdvancedSettings = '-odac';
    props.diskCompleteOverride = true;
    props.diskAlwaysRenderEntireProject = true;
    props.mediaFolder = 'media';
    props.copyToMediaFileOnImport = false;
    props.commandLine = '-odac -d -m128';
    props.diskCommandLine = '-odac -d -n';
    props.oFormat = 'wav';
    props.audioOutput = 'dac';

    const xml = props.saveAsXML();
    const reloaded = ProjectProperties.loadFromXML(xml);

    expect(reloaded.title).toBe(props.title);
    expect(reloaded.author).toBe(props.author);
    expect(reloaded.notes).toBe(props.notes);
    expect(reloaded.sampleRate).toBe(props.sampleRate);
    expect(reloaded.ksmps).toBe(props.ksmps);
    expect(reloaded.channels).toBe(props.channels);
    expect(reloaded.nchnls).toBe(props.channels);
    expect(reloaded.useZeroDbFS).toBe(props.useZeroDbFS);
    expect(reloaded.zeroDbFS).toBe(props.zeroDbFS);
    expect(reloaded.diskSampleRate).toBe(props.diskSampleRate);
    expect(reloaded.diskKsmps).toBe(props.diskKsmps);
    expect(reloaded.diskChannels).toBe(props.diskChannels);
    expect(reloaded.diskUseZeroDbFS).toBe(props.diskUseZeroDbFS);
    expect(reloaded.diskZeroDbFS).toBe(props.diskZeroDbFS);
    expect(reloaded.useAudioOut).toBe(props.useAudioOut);
    expect(reloaded.useAudioIn).toBe(props.useAudioIn);
    expect(reloaded.useMidiIn).toBe(props.useMidiIn);
    expect(reloaded.useMidiOut).toBe(props.useMidiOut);
    expect(reloaded.noteAmpsEnabled).toBe(props.noteAmpsEnabled);
    expect(reloaded.outOfRangeEnabled).toBe(props.outOfRangeEnabled);
    expect(reloaded.warningsEnabled).toBe(props.warningsEnabled);
    expect(reloaded.benchmarkEnabled).toBe(props.benchmarkEnabled);
    expect(reloaded.advancedSettings).toBe(props.advancedSettings);
    expect(reloaded.completeOverride).toBe(props.completeOverride);
    expect(reloaded.fileName).toBe(props.fileName);
    expect(reloaded.askOnRender).toBe(props.askOnRender);
    expect(reloaded.diskNoteAmpsEnabled).toBe(props.diskNoteAmpsEnabled);
    expect(reloaded.diskOutOfRangeEnabled).toBe(props.diskOutOfRangeEnabled);
    expect(reloaded.diskWarningsEnabled).toBe(props.diskWarningsEnabled);
    expect(reloaded.diskBenchmarkEnabled).toBe(props.diskBenchmarkEnabled);
    expect(reloaded.diskAdvancedSettings).toBe(props.diskAdvancedSettings);
    expect(reloaded.diskCompleteOverride).toBe(props.diskCompleteOverride);
    expect(reloaded.diskAlwaysRenderEntireProject).toBe(props.diskAlwaysRenderEntireProject);
    expect(reloaded.mediaFolder).toBe(props.mediaFolder);
    expect(reloaded.copyToMediaFileOnImport).toBe(props.copyToMediaFileOnImport);
    expect(reloaded.commandLine).toBe(props.commandLine);
    expect(reloaded.diskCommandLine).toBe(props.diskCommandLine);
    expect(reloaded.oFormat).toBe(props.oFormat);
    expect(reloaded.audioOutput).toBe(props.audioOutput);

    const xmlText = xml.toXml();
    expect(xmlText).toContain('<channels>4</channels>');
    expect(xmlText).toContain('<diskChannels>8</diskChannels>');
    expect(xmlText).not.toContain('<nchnls>4</nchnls>');
  });

  it('preserves command-line migration fields', () => {
    const xml = Element.parse(`<?xml version="1.0" encoding="UTF-8"?>
<projectProperties>
  <title>Legacy</title>
  <channels>3</channels>
  <commandLine>-odac -d</commandLine>
  <diskCommandLine>-odac -n</diskCommandLine>
</projectProperties>`);

    const reloaded = ProjectProperties.loadFromXML(xml);

    expect(reloaded.title).toBe('Legacy');
    expect(reloaded.channels).toBe('3');
    expect(reloaded.nchnls).toBe('3');
    expect(reloaded.commandLine).toBe('-odac -d');
    expect(reloaded.diskCommandLine).toBe('-odac -n');
  });
});
