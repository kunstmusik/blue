import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Element } from '../serialization/xml-reader';
import { ProjectProperties } from '../project-properties';
import { hasLegacyMixerStateAtLoad } from './xml-policy';

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

  it('marks legacy provenance only when the mode property is omitted (T070)', () => {
    const activeFlags =
      '<channelList list="channels"><channel><name>Legacy</name><muted>true</muted></channel></channelList>';

    // Omitted mode + active flags: a genuine legacy project -> notice fires.
    const legacy = BlueData.loadFromString(
      `<blueData version="2.8.0"><mixer><enabled>true</enabled>${activeFlags}</mixer></blueData>`,
    );
    expect(legacy.getProjectProperties().trackLayerMuteSoloModePresent).toBe(false);
    expect(hasLegacyMixerStateAtLoad(legacy)).toBe(true);

    // Explicitly persisted mode + active flags: the document already knew
    // its flags were audible; it is not mislabeled as legacy after save/reload.
    const modern = BlueData.loadFromString(
      `<blueData version="2.8.0">` +
        `<projectProperties><trackLayerMuteSoloMode>audio</trackLayerMuteSoloMode></projectProperties>` +
        `<mixer><enabled>true</enabled>${activeFlags}</mixer></blueData>`,
    );
    expect(modern.getProjectProperties().trackLayerMuteSoloModePresent).toBe(true);
    expect(hasLegacyMixerStateAtLoad(modern)).toBe(false);
    // Survives a save/reload round trip.
    expect(hasLegacyMixerStateAtLoad(BlueData.loadFromString(modern.saveToString()))).toBe(false);
  });

  it('never marks master-solo-only or flag-free documents as legacy (T070)', () => {
    const masterSolo = BlueData.loadFromString(
      '<blueData version="2.8.0"><mixer><enabled>true</enabled><channel><name>Master</name><solo>true</solo></channel></mixer></blueData>',
    );
    expect(hasLegacyMixerStateAtLoad(masterSolo)).toBe(false);

    const clean = BlueData.loadFromString('<blueData version="2.8.0"></blueData>');
    expect(hasLegacyMixerStateAtLoad(clean)).toBe(false);
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
