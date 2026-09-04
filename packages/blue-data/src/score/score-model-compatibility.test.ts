import { describe, it, expect } from 'vitest';
import '../sound-objects/register-sound-object-types';
import { Score } from './score';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { GenericScore } from '../sound-objects/generic-score';
import { PatternObject } from '../sound-objects/pattern-object';
import { TrackerObject } from '../sound-objects/tracker-object';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TimeDuration } from '../time/time-duration';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { AudioClip } from './audio/audio-clip';
import { TimePosition } from '../time/time-position';
import { TimeContext } from '../time/time-context';

function createSingleNoteScore(instr: number): GenericScore {
  const score = new GenericScore();
  score.setScoreText(`i${instr} 0 1 440`);
  score.setSubjectiveDuration(TimeDuration.beats(1));
  return score;
}

describe('Score model compatibility', () => {
  describe('default score', () => {
    it('has one root PolyObject layer group', () => {
      const score = new Score();
      expect(score.length).toBe(1);
      expect(score[0]).toBeInstanceOf(PolyObject);
      expect((score[0] as PolyObject).getName()).toBe('SoundObject Layer Group');
    });

    it('root PolyObject has one default SoundLayer', () => {
      const score = new Score();
      const root = score[0] as PolyObject;
      expect(root.length).toBe(1);
      expect(root[0]).toBeInstanceOf(SoundLayer);
    });

    it('has default time context', () => {
      const score = new Score();
      expect(score.getTimeContext()).toBeDefined();
      expect(score.getTimeContext().getTempoMap().getTempo()).toBe(60);
    });
  });

  describe('loadFromXML', () => {
    it('loads polyObject elements', () => {
      const xml = `<score>
        <polyObject type="PolyObject" name="Test">
          <soundLayer name="Layer 1">
            <soundObject type="GenericScore">
              <name>Score 1</name>
              <scoreText>i1 0 1 440</scoreText>
            </soundObject>
          </soundLayer>
        </polyObject>
      </score>`;
      const elem = Element.parse(xml);
      const score = Score.loadFromXML(elem);
      expect(score.length).toBe(1);
    });

    it('loads soundObject with PolyObject type', () => {
      const xml = `<score>
        <soundObject type="PolyObject" name="Legacy">
          <soundLayer name="Layer 1">
            <soundObject type="GenericScore">
              <name>Score 1</name>
              <scoreText>i1 0 1 440</scoreText>
            </soundObject>
          </soundLayer>
        </soundObject>
      </score>`;
      const elem = Element.parse(xml);
      const score = Score.loadFromXML(elem);
      expect(score.length).toBe(1);
    });

    it('loads soundObject with Java fully-qualified PolyObject type', () => {
      const xml = `<score>
        <soundObject type="blue.soundObject.PolyObject" name="Java Poly">
          <startTime type="BEATS"><csoundBeats>0.0</csoundBeats></startTime>
          <subjectiveDuration type="BEATS"><csoundBeats>4.0</csoundBeats></subjectiveDuration>
          <name>Java Poly</name>
          <backgroundColor>-16777216</backgroundColor>
          <soundLayer name="Layer 1">
            <soundObject type="blue.soundObject.GenericScore">
              <name>Score 1</name>
              <scoreText>i1 0 1 440</scoreText>
            </soundObject>
          </soundLayer>
        </soundObject>
      </score>`;
      const elem = Element.parse(xml);
      const score = Score.loadFromXML(elem);
      expect(score.length).toBe(1);
      expect((score[0] as PolyObject).getName()).toBe('Java Poly');
    });

    it('forces top-level PolyObject layer groups to TimeBehavior.NONE when loading legacy score XML', () => {
      const xml = `<score>
        <soundObject type="blue.soundObject.PolyObject" name="Legacy Root">
          <startTime type="BEATS"><csoundBeats>0.0</csoundBeats></startTime>
          <subjectiveDuration type="BEATS"><csoundBeats>2.0</csoundBeats></subjectiveDuration>
          <name>Legacy Root</name>
          <backgroundColor>-16777216</backgroundColor>
          <timeBehavior>0</timeBehavior>
          <soundLayer name="Layer 1">
            <soundObject type="blue.soundObject.GenericScore">
              <startTime type="BEATS"><csoundBeats>0.0</csoundBeats></startTime>
              <subjectiveDuration type="BEATS"><csoundBeats>4.0</csoundBeats></subjectiveDuration>
              <name>Score 1</name>
              <backgroundColor>-16777216</backgroundColor>
              <timeBehavior>2</timeBehavior>
              <scoreText>i1 0 1 440
i1 2 1 440</scoreText>
            </soundObject>
          </soundLayer>
        </soundObject>
      </score>`;
      const elem = Element.parse(xml);
      const score = Score.loadFromXML(elem);

      expect((score[0] as PolyObject).getTimeBehavior()).toBe(TimeBehavior.NONE);

      const notes = score.generateForCSD(new CompileData(), 0, -1);
      expect([...notes].map((note) => note.getStartTime())).toEqual([0, 2]);
    });

    it('loads nested GenericScore with Java full class name', () => {
      const xml = `<score>
        <polyObject type="PolyObject" name="Test">
          <soundLayer name="Layer 1">
            <soundObject type="blue.soundObject.GenericScore">
              <name>Score 1</name>
              <scoreText>i1 0 1 440</scoreText>
            </soundObject>
          </soundLayer>
        </polyObject>
      </score>`;
      const elem = Element.parse(xml);
      const score = Score.loadFromXML(elem);
      expect(score.length).toBe(1);
    });

    it('loads Java-qualified nested sound objects through PolyObject dispatch', () => {
      const xml = `<soundObject type="blue.soundObject.PolyObject" name="Test">
        <soundLayer name="Layer 1">
          <soundObject type="blue.soundObject.PatternObject">
            <name>Pattern</name>
            <beats>8</beats>
            <subDivisions>2</subDivisions>
            <patterns/>
          </soundObject>
          <soundObject type="blue.soundObject.TrackerObject">
            <name>Tracker</name>
            <stepsPerBeat>2</stepsPerBeat>
            <trackList>
              <steps>4</steps>
              <track>
                <name>Track 1</name>
                <noteTemplate>i &lt;INSTR_ID&gt; &lt;START&gt; &lt;DUR&gt;</noteTemplate>
                <instrumentId>7</instrumentId>
                <columns/>
                <trackerNotes/>
              </track>
            </trackList>
          </soundObject>
        </soundLayer>
      </soundObject>`;
      const poly = PolyObject.loadFromXML(Element.parse(xml));

      expect(poly.length).toBe(1);
      expect(poly[0].length).toBe(2);
      expect(poly[0][0]).toBeInstanceOf(PatternObject);
      expect((poly[0][0] as PatternObject).getBeats()).toBe(8);
      expect(poly[0][1]).toBeInstanceOf(TrackerObject);
      expect((poly[0][1] as TrackerObject).getTracks().getTrack(0)?.getInstrumentId()).toBe('7');
    });

    it('loads patternsLayerGroup', () => {
      const xml = `<score>
        <patternsLayerGroup name="Patterns">
          <patternBeatsLength>4</patternBeatsLength>
          <patternLayers>
            <patternLayer name="P1">
              <soundObject type="GenericScore">
                <name>Pattern Score</name>
                <scoreText>i1 0 1 440</scoreText>
              </soundObject>
              <patternData/>
            </patternLayer>
          </patternLayers>
        </patternsLayerGroup>
      </score>`;
      const elem = Element.parse(xml);
      const score = Score.loadFromXML(elem);
      expect(score.length).toBe(1);
    });
  });

  describe('saveAsXML', () => {
    it('saves polyObject elements', () => {
      const score = new Score();
      const poly = new PolyObject(false);
      poly.setName('Test Poly');
      const layer = new SoundLayer();
      layer.setName('Layer 1');
      const gs = new GenericScore();
      gs.setName('Score 1');
      gs.setScoreText('i1 0 1 440');
      layer.push(gs);
      poly.push(layer);
      score.push(poly);

      const xml = score.saveAsXML();
      expect(xml.getName()).toBe('score');
      const children = xml.getElements();
      let found = false;
      while (children.hasMoreElements()) {
        const child = children.next();
        if (child.getName() === 'soundObject' && child.getAttribute('type') === 'blue.soundObject.PolyObject') {
          found = true;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('deepCopy', () => {
    it('copies nested score tree', () => {
      const score = new Score();
      const poly = new PolyObject(false);
      poly.setName('Original');
      const layer = new SoundLayer();
      layer.setName('Layer 1');
      const gs = new GenericScore();
      gs.setName('Score 1');
      layer.push(gs);
      poly.push(layer);
      score.push(poly);

      const copy = new Score(score);
      expect(copy.length).toBe(2);

      (copy[1] as PolyObject).setName('Modified');
      expect((score[1] as PolyObject).getName()).toBe('Original');
    });
  });

  describe('generateForCSD render window', () => {
    it('filters root PolyObject notes after the render end', () => {
      const score = new Score();
      score.length = 0;

      const poly = new PolyObject(true);
      const layer = new SoundLayer();
      const gs = new GenericScore();
      gs.setSubjectiveDuration(TimeDuration.beats(16));
      gs.setScoreText('i1 0 1 440\ni1 8 1 440\ni1 12 1 440');
      layer.push(gs);
      poly.push(layer);
      score.push(poly);

      const notes = score.generateForCSD(new CompileData(), 0, 10);

      const startTimes = [...notes].map((note) => note.getStartTime());
      expect(startTimes).toHaveLength(2);
      expect(Math.max(...startTimes)).toBeLessThanOrEqual(10);
    });

    it('skips muted SoundLayers when no solo layer exists', () => {
      const score = new Score();
      score.length = 0;

      const poly = new PolyObject(true);

      const activeLayer = new SoundLayer();
      activeLayer.push(createSingleNoteScore(1));

      const mutedLayer = new SoundLayer();
      mutedLayer.setMuted(true);
      mutedLayer.push(createSingleNoteScore(2));

      poly.push(activeLayer);
      poly.push(mutedLayer);
      score.push(poly);

      const notes = score.generateForCSD(new CompileData(), 0, -1);

      expect([...notes].map((note) => note.getPField(1))).toEqual(['1']);
    });

    it('renders only solo-enabled SoundLayers in a root PolyObject', () => {
      const score = new Score();
      score.length = 0;

      const poly = new PolyObject(true);

      const normalLayer = new SoundLayer();
      normalLayer.push(createSingleNoteScore(1));

      const soloLayer = new SoundLayer();
      soloLayer.setSolo(true);
      soloLayer.push(createSingleNoteScore(2));

      const mutedSoloLayer = new SoundLayer();
      mutedSoloLayer.setSolo(true);
      mutedSoloLayer.setMuted(true);
      mutedSoloLayer.push(createSingleNoteScore(3));

      poly.push(normalLayer);
      poly.push(soloLayer);
      poly.push(mutedSoloLayer);
      score.push(poly);

      const notes = score.generateForCSD(new CompileData(), 0, -1);

      expect([...notes].map((note) => note.getPField(1))).toEqual(['2']);
    });

    it('uses local solo state for nested PolyObjects rendered as sound objects', () => {
      const score = new Score();
      score.length = 0;

      const root = new PolyObject(true);
      const rootLayer = new SoundLayer();

      const nested = new PolyObject(false);
      nested.setTimeBehavior(TimeBehavior.NONE);
      nested.setSubjectiveDuration(TimeDuration.beats(4));

      const nestedNormalLayer = new SoundLayer();
      nestedNormalLayer.push(createSingleNoteScore(1));

      const nestedSoloLayer = new SoundLayer();
      nestedSoloLayer.setSolo(true);
      nestedSoloLayer.push(createSingleNoteScore(2));

      nested.push(nestedNormalLayer);
      nested.push(nestedSoloLayer);
      rootLayer.push(nested);
      root.push(rootLayer);
      score.push(root);

      const notes = score.generateForCSD(new CompileData(), 0, -1);

      expect([...notes].map((note) => note.getPField(1))).toEqual(['2']);
    });
  });

  describe('Layer and Item Color XML Compatibility (US4)', () => {
    it('produces XML with Java Blue-readable concrete item backgroundColor while containing layer-level backgroundColor', () => {
      const poly = new PolyObject();
      const layer = new SoundLayer();
      layer.setBackgroundColor(-65536);

      const sObj = new GenericScore();
      sObj.setName('TestClip');
      sObj.setBackgroundColor(-16711936);
      layer.push(sObj);
      poly.push(layer);

      const xml = poly.saveAsXML();
      const layerElem = xml.getElement('soundLayer')!;
      expect(layerElem.getTextString('backgroundColor')).toBe('-65536');

      const sObjElem = layerElem.getElement('soundObject')!;
      expect(sObjElem.getTextString('backgroundColor')).toBe('-16711936');
    });
  });

  describe('ScoreObject mutation, resizing, copying, and observation without listeners', () => {
    it('mutates and observes GenericScore properties without listeners', () => {
      const gs = new GenericScore();
      gs.setName('Test Score');
      gs.setStartTime(TimePosition.beats(2));
      gs.setSubjectiveDuration(TimeDuration.beats(4));
      gs.setBackgroundColor(-16777216);
      gs.setRepeatPoint(TimeDuration.beats(2));
      gs.setTimeBehavior(TimeBehavior.SCALE);

      const context = new TimeContext();

      expect(gs.getName()).toBe('Test Score');
      expect(gs.getStartTime().toBeats(context)).toBe(2);
      expect(gs.getSubjectiveDuration().toBeats(context)).toBe(4);
      expect(gs.getBackgroundColor()).toBe(-16777216);
      expect(gs.getRepeatPoint()?.toBeats(context)).toBe(2);
      expect(gs.getTimeBehavior()).toBe(TimeBehavior.SCALE);

      const copy = gs.deepCopy() as GenericScore;
      expect(copy.getName()).toBe('Test Score');
      expect(copy.getStartTime().toBeats(context)).toBe(2);
      expect(copy.getSubjectiveDuration().toBeats(context)).toBe(4);
      expect(copy.getBackgroundColor()).toBe(-16777216);
      expect(copy.getRepeatPoint()?.toBeats(context)).toBe(2);
      expect(copy.getTimeBehavior()).toBe(TimeBehavior.SCALE);

      copy.setName('Copy Score');
      expect(gs.getName()).toBe('Test Score');
      expect(copy.getName()).toBe('Copy Score');
    });

    it('mutates, resizes, and copies AudioClip properties without listeners', () => {
      const context = new TimeContext();
      const clip = new AudioClip();
      clip.setName('Sample');
      clip.setStartTime(TimePosition.beats(1));
      clip.setSubjectiveDuration(TimeDuration.beats(3));
      clip.setBackgroundColor(0xff0000);

      expect(clip.getName()).toBe('Sample');
      expect(clip.getStartTime().toBeats(context)).toBe(1);
      expect(clip.getSubjectiveDuration().toBeats(context)).toBe(3);
      expect(clip.getBackgroundColor()).toBe(0xff0000);

      clip.resizeRight(context, 6);
      expect(clip.getSubjectiveDuration().toBeats(context)).toBe(5);

      clip.resizeLeft(context, 0);
      expect(clip.getStartTime().toBeats(context)).toBe(0);
      expect(clip.getSubjectiveDuration().toBeats(context)).toBe(6);

      const copy = AudioClip.copyFrom(clip);
      expect(copy.getName()).toBe('Sample');
      expect(copy.getStartTime().toBeats(context)).toBe(0);
      expect(copy.getSubjectiveDuration().toBeats(context)).toBe(6);
      expect(copy.getBackgroundColor()).toBe(0xff0000);

      copy.setName('Copied Clip');
      expect(clip.getName()).toBe('Sample');
      expect(copy.getName()).toBe('Copied Clip');
    });
  });
});
