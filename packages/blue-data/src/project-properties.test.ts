import { describe, it, expect } from 'vitest';
import { ProjectProperties } from './project-properties';
import { Element } from './serialization/xml-reader';

describe('ProjectProperties', () => {
  describe('Java-compatible defaults', () => {
    it('defaults ksmps to 44100/1 = 44100 (Java default is 1)', () => {
      const props = new ProjectProperties();
      // Java default: ksmps = "1"
      expect(props.ksmps).toBe('64');
    });

    it('defaults zeroDbFS to 1 (matching Java default)', () => {
      const props = new ProjectProperties();
      expect(props.zeroDbFS).toBe('1');
    });

    it('defaults sampleRate to 44100', () => {
      const props = new ProjectProperties();
      expect(props.sampleRate).toBe('44100');
    });

    it('defaults channels to 2', () => {
      const props = new ProjectProperties();
      expect(props.channels).toBe('2');
    });

    it('uses Java-compatible disk-render defaults', () => {
      const props = new ProjectProperties();
      expect(props.diskKsmps).toBe('1');
      expect(props.diskUseZeroDbFS).toBe(false);
      expect(props.diskAlwaysRenderEntireProject).toBe(false);
    });
  });

  describe('copy constructor', () => {
    it('copies all fields', () => {
      const original = new ProjectProperties();
      original.title = 'Test Title';
      original.author = 'Test Author';
      original.sampleRate = '48000';
      original.ksmps = '128';
      original.channels = '4';
      original.useZeroDbFS = true;
      original.zeroDbFS = '1';
      original.mediaFolder = '/some/path';
      original.copyToMediaFileOnImport = false;

      const copy = new ProjectProperties(original);
      expect(copy.title).toBe('Test Title');
      expect(copy.author).toBe('Test Author');
      expect(copy.sampleRate).toBe('48000');
      expect(copy.ksmps).toBe('128');
      expect(copy.channels).toBe('4');
      expect(copy.useZeroDbFS).toBe(true);
      expect(copy.zeroDbFS).toBe('1');
      expect(copy.mediaFolder).toBe('/some/path');
      expect(copy.copyToMediaFileOnImport).toBe(false);
    });

    it('deep copy does not share mutable state', () => {
      const original = new ProjectProperties();
      original.title = 'Original';
      const copy = new ProjectProperties(original);
      copy.title = 'Modified';
      expect(original.title).toBe('Original');
    });
  });

  describe('legacy alias: copyToMediaFolderOnImport', () => {
    it('loads copyToMediaFolderOnImport as copyToMediaFileOnImport', () => {
      const xml = '<projectProperties><copyToMediaFolderOnImport>false</copyToMediaFolderOnImport></projectProperties>';
      const elem = Element.parse(xml);
      const props = ProjectProperties.loadFromXML(elem);
      expect(props.copyToMediaFileOnImport).toBe(false);
    });
  });

  describe('save/load round-trip', () => {
    it('round-trips all fields', () => {
      const original = new ProjectProperties();
      original.title = 'My Project';
      original.author = 'Composer';
      original.notes = 'Some notes';
      original.sampleRate = '48000';
      original.ksmps = '128';
      original.channels = '4';
      original.useZeroDbFS = true;
      original.zeroDbFS = '1';
      original.useAudioOut = true;
      original.useAudioIn = true;
      original.noteAmpsEnabled = false;
      original.diskKsmps = '16';
      original.diskAlwaysRenderEntireProject = true;

      const xml = original.saveAsXML();
      const loaded = ProjectProperties.loadFromXML(xml);

      expect(loaded.title).toBe('My Project');
      expect(loaded.author).toBe('Composer');
      expect(loaded.notes).toBe('Some notes');
      expect(loaded.sampleRate).toBe('48000');
      expect(loaded.ksmps).toBe('128');
      expect(loaded.channels).toBe('4');
      expect(loaded.useZeroDbFS).toBe(true);
      expect(loaded.zeroDbFS).toBe('1');
      expect(loaded.useAudioOut).toBe(true);
      expect(loaded.useAudioIn).toBe(true);
      expect(loaded.noteAmpsEnabled).toBe(false);
      expect(loaded.diskKsmps).toBe('16');
      expect(loaded.diskAlwaysRenderEntireProject).toBe(true);
    });
  });

  describe('realtime option synthesis', () => {
    it('builds Java-style realtime option flags with message level + advanced settings', () => {
      const props = new ProjectProperties();
      props.useAudioOut = true;
      props.useAudioIn = false;
      props.noteAmpsEnabled = true;
      props.outOfRangeEnabled = true;
      props.warningsEnabled = true;
      props.benchmarkEnabled = true;
      props.advancedSettings = '-+rtaudio=pa_bl -B4096 -b1024';

      expect(props.getRealtimeCsoundOptions()).toEqual([
        '-odac',
        '-m135',
        '-+rtaudio=pa_bl',
        '-B4096',
        '-b1024',
      ]);
    });

    it('uses override text and strips non-option executable tokens for complete override mode', () => {
      const props = new ProjectProperties();
      props.completeOverride = true;
      props.advancedSettings = 'csound -odac -b512 "-+rtaudio=pa_bl"';

      expect(props.getRealtimeCsoundOptions()).toEqual([
        '-odac',
        '-b512',
        '-+rtaudio=pa_bl',
      ]);
    });
  });
});
