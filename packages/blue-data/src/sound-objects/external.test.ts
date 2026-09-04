import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { External, setExternalCommandExecutor, getExternalCommandExecutor } from './external';
import { ExternalCommandExecutor } from './external';
import { Element } from '../serialization/xml-reader';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';

describe('External', () => {
  describe('default state', () => {
    it('has empty commandLine and text', () => {
      const ext = new External();
      expect(ext.getCommandLine()).toBe('');
      expect(ext.getText()).toBe('');
      expect(ext.getSyntaxType()).toBe('Python');
    });

    it('has default name External', () => {
      const ext = new External();
      expect(ext.getName()).toBe('External');
    });

    it('has default backgroundColor', () => {
      const ext = new External();
      expect(ext.getBackgroundColor()).toBe(0x404040);
    });
  });

  describe('loadFromXML', () => {
    it('loads all fields from XML', () => {
      const xml = `<soundObject type="blue.soundObject.External">
        <name>My External</name>
        <text>print("hello")</text>
        <commandLine>python $infile</commandLine>
        <syntaxType>Python</syntaxType>
      </soundObject>`;
      const elem = Element.parse(xml);
      const ext = External.loadFromXML(elem);
      expect(ext.getName()).toBe('My External');
      expect(ext.getText()).toBe('print("hello")');
      expect(ext.getCommandLine()).toBe('python $infile');
      expect(ext.getSyntaxType()).toBe('Python');
    });

    it('handles missing optional fields', () => {
      const xml = `<soundObject type="blue.soundObject.External">
        <name>Minimal</name>
      </soundObject>`;
      const elem = Element.parse(xml);
      const ext = External.loadFromXML(elem);
      expect(ext.getText()).toBe('');
      expect(ext.getCommandLine()).toBe('');
      expect(ext.getSyntaxType()).toBe('Python');
    });
  });

  describe('saveAsXML', () => {
    it('saves all fields in Java-compatible format', () => {
      const ext = new External();
      ext.setName('Test');
      ext.setText('print("hello")');
      ext.setCommandLine('python $infile');

      const xml = ext.saveAsXML();
      expect(xml.getName()).toBe('soundObject');
      expect(xml.getAttribute('type')).toBe('blue.soundObject.External');
      expect(xml.getElement('text')?.getTextString()).toBe('print("hello")');
      expect(xml.getElement('commandLine')?.getTextString()).toBe('python $infile');
      expect(xml.getElement('syntaxType')?.getTextString()).toBe('Python');
    });
  });

  describe('round-trip', () => {
    it('preserves all fields through save/load', () => {
      const original = new External();
      original.setName('Round Trip');
      original.setText('body text');
      original.setCommandLine('cmd $infile');
      original.setSyntaxType('Ruby');

      const xml = original.saveAsXML();
      const loaded = External.loadFromXML(xml);

      expect(loaded.getName()).toBe('Round Trip');
      expect(loaded.getText()).toBe('body text');
      expect(loaded.getCommandLine()).toBe('cmd $infile');
      expect(loaded.getSyntaxType()).toBe('Ruby');
    });
  });

  describe('deepCopy', () => {
    it('copies all fields', () => {
      const original = new External();
      original.setName('Original');
      original.setText('some text');
      original.setCommandLine('some command');

      const copy = original.deepCopy() as External;
      expect(copy.getName()).toBe('Original');
      expect(copy.getText()).toBe('some text');
      expect(copy.getCommandLine()).toBe('some command');
    });

    it('does not share mutable state', () => {
      const original = new External();
      original.setText('original');
      original.setCommandLine('cmd1');
      const copy = original.deepCopy() as External;
      copy.setText('modified');
      copy.setCommandLine('cmd2');
      expect(original.getText()).toBe('original');
      expect(original.getCommandLine()).toBe('cmd1');
    });
  });

  describe('generateForCSD', () => {
    let prevExecutor: ExternalCommandExecutor | null;

    beforeEach(() => {
      prevExecutor = getExternalCommandExecutor();
    });

    afterEach(() => {
      setExternalCommandExecutor(prevExecutor);
    });

    it('returns empty NoteList when commandLine and text are empty', () => {
      const ext = new External();
      const ctx = new TimeContext();
      const result = ext.generateForCSD(ctx, new CompileData(), 0, 0);
      expect(result.size).toBe(0);
    });

    it('returns empty NoteList when no executor is registered', () => {
      const ext = new External();
      ext.setText('code');
      ext.setCommandLine('cmd');
      setExternalCommandExecutor(null);

      const ctx = new TimeContext();
      const result = ext.generateForCSD(ctx, new CompileData(), 0, 0);
      expect(result.size).toBe(0);
    });

    it('calls executor and returns parsed notes', () => {
      const ext = new External();
      ext.setText('code');
      ext.setCommandLine('cmd');

      const mockExecutor: ExternalCommandExecutor = {
        execute(cmdLine, textBody, projectDir) {
          expect(cmdLine).toBe('cmd');
          expect(textBody).toBe('code');
          expect(projectDir).toBeNull();
          return 'i1 0 1 440\ni2 1 2 880';
        },
      };
      setExternalCommandExecutor(mockExecutor);

      const ctx = new TimeContext();
      const result = ext.generateForCSD(ctx, new CompileData(), 0, 0);
      expect(result.size).toBe(2);
    });

    it('applies note processors to generated notes', () => {
      const ext = new External();
      ext.setText('code');
      ext.setCommandLine('cmd');

      const mockExecutor: ExternalCommandExecutor = {
        execute() {
          return 'i1 0 2 440';
        },
      };
      setExternalCommandExecutor(mockExecutor);

      const ctx = new TimeContext();
      const result = ext.generateForCSD(ctx, new CompileData(), 0, 0);
      expect(result.size).toBe(1);
    });

    it('returns empty NoteList on executor error', () => {
      const ext = new External();
      ext.setText('code');
      ext.setCommandLine('cmd');

      const mockExecutor: ExternalCommandExecutor = {
        execute() {
          throw new Error('execution failed');
        },
      };
      setExternalCommandExecutor(mockExecutor);

      const ctx = new TimeContext();
      const result = ext.generateForCSD(ctx, new CompileData(), 0, 0);
      expect(result.size).toBe(0);
    });
  });

  describe('executor registration', () => {
    afterEach(() => {
      setExternalCommandExecutor(null);
    });

    it('allows setting and getting executor', () => {
      const mock: ExternalCommandExecutor = {
        execute() {
          return '';
        },
      };
      setExternalCommandExecutor(mock);
      expect(getExternalCommandExecutor()).toBe(mock);
    });

    it('allows clearing executor', () => {
      const mock: ExternalCommandExecutor = {
        execute() {
          return '';
        },
      };
      setExternalCommandExecutor(mock);
      setExternalCommandExecutor(null);
      expect(getExternalCommandExecutor()).toBeNull();
    });
  });
});
