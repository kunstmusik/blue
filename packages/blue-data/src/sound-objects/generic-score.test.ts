import { describe, it, expect } from 'vite-plus/test';
import { GenericScore } from './generic-score';
import { Element } from '../serialization/xml-reader';

describe('GenericScore', () => {
  describe('default state', () => {
    it('has empty score text', () => {
      const gs = new GenericScore();
      expect(gs.getScoreText()).toBe('i1 0 2 3 4 5');
    });

    it('has default name GenericScore', () => {
      const gs = new GenericScore();
      expect(gs.getName()).toBe('GenericScore');
    });
  });

  describe('loadFromXML', () => {
    it('loads score from XML', () => {
      const xml = `<soundObject type="GenericScore">
        <name>My Score</name>
        <score>i1 0 1 440
i2 1 2 880</score>
      </soundObject>`;
      const elem = Element.parse(xml);
      const gs = GenericScore.loadFromXML(elem);
      expect(gs.getName()).toBe('My Score');
      expect(gs.getScoreText()).toBe('i1 0 1 440\ni2 1 2 880');
    });

    it('handles empty scoreText', () => {
      const xml = `<soundObject type="GenericScore">
        <name>Empty</name>
        <score></score>
      </soundObject>`;
      const elem = Element.parse(xml);
      const gs = GenericScore.loadFromXML(elem);
      expect(gs.getScoreText()).toBe('');
    });
  });

  describe('saveAsXML', () => {
    it('saves score in Java-compatible format', () => {
      const gs = new GenericScore();
      gs.setName('Test');
      gs.setScoreText('i1 0 1 440');

      const xml = gs.saveAsXML();
      expect(xml.getName()).toBe('soundObject');
      expect(xml.getAttribute('type')).toBe('blue.soundObject.GenericScore');
      expect(xml.getElement('score')?.getTextString()).toBe('i1 0 1 440');
    });
  });

  describe('round-trip', () => {
    it('preserves score text through save/load', () => {
      const original = new GenericScore();
      original.setName('Round Trip');
      original.setScoreText('i1 0 1 440\ni2 1 2 880');

      const xml = original.saveAsXML();
      const loaded = GenericScore.loadFromXML(xml);

      expect(loaded.getName()).toBe('Round Trip');
      expect(loaded.getScoreText()).toBe('i1 0 1 440\ni2 1 2 880');
    });
  });

  describe('deepCopy', () => {
    it('copies all fields', () => {
      const original = new GenericScore();
      original.setName('Original');
      original.setScoreText('i1 0 1 440');

      const copy = original.deepCopy();
      expect(copy.getName()).toBe('Original');
      expect((copy as GenericScore).getScoreText()).toBe('i1 0 1 440');
    });

    it('does not share mutable state', () => {
      const original = new GenericScore();
      original.setScoreText('Original');
      const copy = original.deepCopy() as GenericScore;
      copy.setScoreText('Modified');
      expect(original.getScoreText()).toBe('Original');
    });
  });
});
