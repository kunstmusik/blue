import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Element } from '../serialization/xml-reader';
import { ProjectProperties } from '../project-properties';

describe('trackLayerMuteSoloMode XML compatibility (Spec 111 T062/T063)', () => {
  it('loads an absent projectProperties block as legacy Event, omitted on save', () => {
    const xml = [
      '<blueData version="2.8.0">',
      '  <mixer><enabled>true</enabled></mixer>',
      '</blueData>',
    ].join('\n');

    const data = BlueData.loadFromString(xml);
    const props = data.getProjectProperties();
    expect(props.trackLayerMuteSoloMode).toBe('event');
    expect(props.trackLayerMuteSoloModePresent).toBe(false);
    expect(props.trackLayerMuteSoloModeRaw).toBeNull();

    // The untouched omission stays omitted through save/reload.
    const saved = data.saveToString();
    expect(saved).not.toContain('trackLayerMuteSoloMode');
    const reloaded = BlueData.loadFromString(saved);
    expect(reloaded.getProjectProperties().trackLayerMuteSoloMode).toBe('event');
    expect(reloaded.getProjectProperties().trackLayerMuteSoloModePresent).toBe(false);
  });

  it('keeps the Audio default and presence for new projects', () => {
    const data = new BlueData();
    expect(data.getProjectProperties().trackLayerMuteSoloMode).toBe('audio');
    expect(data.getProjectProperties().trackLayerMuteSoloModePresent).toBe(true);
    expect(data.saveToString()).toContain('<trackLayerMuteSoloMode>audio</trackLayerMuteSoloMode>');
  });

  it('keeps an explicit mode element present through load/save/reload with an enabled mixer', () => {
    const xml = [
      '<blueData version="2.8.0">',
      '  <projectProperties><trackLayerMuteSoloMode>audio</trackLayerMuteSoloMode></projectProperties>',
      '  <mixer><enabled>true</enabled></mixer>',
      '</blueData>',
    ].join('\n');

    const data = BlueData.loadFromString(xml);
    expect(data.getProjectProperties().trackLayerMuteSoloMode).toBe('audio');
    expect(data.getProjectProperties().trackLayerMuteSoloModePresent).toBe(true);
    expect(data.getMixer().isEnabled()).toBe(true);

    const reloaded = BlueData.loadFromString(data.saveToString());
    expect(reloaded.getProjectProperties().trackLayerMuteSoloMode).toBe('audio');
    expect(reloaded.getProjectProperties().trackLayerMuteSoloModePresent).toBe(true);
  });

  it('restores raw provenance exactly through history apply and rollback', () => {
    // Loaded with an unsupported raw value.
    const props = ProjectProperties.loadFromXML(
      Element.parse(
        '<projectProperties><trackLayerMuteSoloMode>solo-all</trackLayerMuteSoloMode></projectProperties>',
      ),
    );
    expect(props.trackLayerMuteSoloModeRaw).toBe('solo-all');

    // An explicit Event edit replaces it even though the parsed mode is
    // already Event (T063: raw text must clear on explicit replacement).
    props.trackLayerMuteSoloMode = 'event';
    expect(props.trackLayerMuteSoloMode).toBe('event');
    expect(props.trackLayerMuteSoloModeRaw).toBeNull();
    expect(props.hasUnsupportedTrackLayerMuteSoloMode()).toBe(false);

    // Rolling back to the captured provenance reinstates the raw text.
    props.restoreTrackLayerMuteSoloMode('event', 'solo-all', true);
    expect(props.trackLayerMuteSoloModeRaw).toBe('solo-all');
    expect(props.hasUnsupportedTrackLayerMuteSoloMode()).toBe(true);
  });
});
