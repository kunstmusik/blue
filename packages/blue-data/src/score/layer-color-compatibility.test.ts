import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Element } from '../serialization/xml-reader';
import { DEFAULT_LAYER_COLOR } from './layers/layer-color';
import { PolyObject } from '../sound-objects/poly-object';

describe('Layer Color Compatibility & Legacy Project Load-Save (US4)', () => {
  it('opens a legacy project without layer colors, materializes neutral on layers, and leaves existing item colors untouched', () => {
    const legacyProjectXml = `
      <blueData version="3.0.0">
        <projectProperties>
          <title>Legacy Project</title>
          <author>Author</author>
          <commandLine></commandLine>
          <completeCommand></completeCommand>
        </projectProperties>
        <score>
          <timeContext>
            <timeBehavior>scale</timeBehavior>
            <tempo>120.0</tempo>
          </timeContext>
          <polyObject>
            <soundLayer name="Layer 1" muted="false" solo="false" heightIndex="0">
              <soundObject type="blue.soundObject.GenericScore">
                <name>Clip 1</name>
                <startTime>0.0</startTime>
                <subjectiveDuration>2.0</subjectiveDuration>
                <backgroundColor>-65536</backgroundColor>
                <scoreText>i1 0 2 60 0.5</scoreText>
              </soundObject>
            </soundLayer>
          </polyObject>
        </score>
      </blueData>
    `;

    const data = BlueData.loadFromString(legacyProjectXml);
    const score = data.getScore();
    const poly = Array.from(score)[0] as PolyObject;
    const layer = Array.from(poly)[0];
    const clip = layer[0];

    // Materialized neutral color on legacy layer
    expect(layer.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
    // Explicit legacy item color preserved
    expect(clip.getBackgroundColor()).toBe(-65536);

    // Save project XML
    const savedXml = data.saveAsXML();
    const savedLayerElem = savedXml.getElement('score')
      ?.getElement('soundObject')
      ?.getElement('soundLayer');

    expect(savedLayerElem).toBeDefined();
    // Materialized as concrete child on save
    expect(savedLayerElem!.getTextString('backgroundColor')).toBe(String(DEFAULT_LAYER_COLOR));
    // Clip color preserved on save
    const savedClipElem = savedLayerElem?.getElement('soundObject');
    expect(savedClipElem?.getTextString('backgroundColor')).toBe('-65536');
  });
});
