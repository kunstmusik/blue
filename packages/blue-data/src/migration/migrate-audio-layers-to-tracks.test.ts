import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Element } from '../serialization/xml-reader';
import { migrateAudioLayersToTracks } from './migrate-audio-layers-to-tracks';

describe('migrateAudioLayersToTracks', () => {
  it('converts Java-style containers while preserving modeled fields and unknown siblings', () => {
    const root = Element.parse(`
      <blueData version="2.3.0">
        <score>
          <audioLayerGroup name="Java" uniqueId="group-java">
            <defaultHeightIndex>2</defaultHeightIndex>
            <unknownSibling value="keep"><nestedUnknown /></unknownSibling>
            <audioLayers>
              <audioLayer name="Clip" uniqueId="track-java" muted="true" solo="false">
                <audioClip><name>clip</name></audioClip>
                <parameterId>param-1</parameterId>
              </audioLayer>
            </audioLayers>
          </audioLayerGroup>
        </score>
      </blueData>
    `);

    expect(migrateAudioLayersToTracks(root)).toBe(true);
    const score = root.getElement('score')!;
    const group = score.getElement('trackLayerGroup')!;
    const tracks = group.getElement('tracks')!;
    const track = tracks.getElement('track')!;
    expect(group.getAttributeValue('uniqueId')).toBe('group-java');
    expect(track.getAttributeValue('uniqueId')).toBe('track-java');
    expect(track.hasElement('audioClip')).toBe(true);
    expect(track.hasElement('parameterId')).toBe(true);
    expect(track.getElements('noteProcessorChain').size).toBe(1);
    expect(group.hasElement('unknownSibling')).toBe(true);

    const migratedXml = root.toXml();
    expect(migrateAudioLayersToTracks(root)).toBe(false);
    expect(root.toXml()).toBe(migratedXml);
  });

  it('handles direct legacy layers and repairs missing or duplicate identities', () => {
    const root = Element.parse(`
      <blueData>
        <score>
          <trackLayerGroup uniqueId="already-used"><tracks><track uniqueId="canonical" /></tracks></trackLayerGroup>
          <audioLayerGroup>
            <audioLayer name="Direct A" uniqueId="canonical" />
            <unknownSibling />
            <layer name="Direct B" />
          </audioLayerGroup>
        </score>
      </blueData>
    `);

    expect(migrateAudioLayersToTracks(root)).toBe(true);
    const group = root.getElement('score')!.getElements('trackLayerGroup').toArray()[1]!;
    const tracks = group.getElement('tracks')!;
    const migratedTracks = tracks.getElements('track').toArray();
    expect(migratedTracks).toHaveLength(2);
    expect(new Set(migratedTracks.map((track) => track.getAttributeValue('uniqueId'))).size).toBe(2);
    expect(migratedTracks.every((track) => track.hasElement('noteProcessorChain'))).toBe(true);
    expect(group.hasElement('unknownSibling')).toBe(true);
  });

  it('merges transitional audioLayers into an existing tracks container', () => {
    const root = Element.parse(`
      <blueData>
        <score>
          <audioLayerGroup uniqueId="mixed-group">
            <tracks><track uniqueId="existing-track" /></tracks>
            <audioLayers>
              <audioLayer uniqueId="legacy-track"><unknownChild /></audioLayer>
            </audioLayers>
          </audioLayerGroup>
        </score>
      </blueData>
    `);

    expect(migrateAudioLayersToTracks(root)).toBe(true);
    const group = root.getElement('score')!.getElement('trackLayerGroup')!;
    expect(group.hasElement('audioLayers')).toBe(false);
    const tracks = group.getElement('tracks')!.getElements('track').toArray();
    expect(tracks).toHaveLength(2);
    expect(tracks[1]!.hasElement('unknownChild')).toBe(true);
  });

  it('loads historical XML into Track-only runtime data and saves canonical XML', () => {
    const data = BlueData.loadFromString(`
      <blueData version="2.3.0">
        <score>
          <timeContext />
          <timeState />
          <noteProcessorChain />
          <audioLayerGroup name="Legacy" uniqueId="legacy-group">
            <audioLayers>
              <audioLayer name="Legacy Track" uniqueId="legacy-track">
                <audioClip>
                  <name>clip</name>
                  <audioFile>fixture.wav</audioFile>
                  <numChannels>2</numChannels>
                  <audioDuration>1</audioDuration>
                  <fileStart>0</fileStart>
                  <startTime type="beats">0</startTime>
                  <subjectiveDuration type="beats">1</subjectiveDuration>
                  <fadeIn>0</fadeIn><fadeInType>LINEAR</fadeInType>
                  <fadeOut>0</fadeOut><fadeOutType>LINEAR</fadeOutType>
                  <looping>false</looping>
                </audioClip>
              </audioLayer>
            </audioLayers>
          </audioLayerGroup>
        </score>
      </blueData>
    `);

    const saved = data.saveToString();
    expect(saved).toContain('<trackLayerGroup');
    expect(saved).toContain('<track ');
    expect(saved).toContain('<audioClip>');
    expect(saved).not.toContain('audioLayerGroup');
    expect(saved).not.toContain('<audioLayers>');
    const reopened = BlueData.loadFromString(saved);
    expect(reopened.saveToString()).toBe(saved);
  });
});
