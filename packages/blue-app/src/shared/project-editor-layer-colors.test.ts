import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYER_COLOR, GenericScore, TimeDuration, TimePosition } from '@blue/data';
import { applyProjectDocumentPatch, type ProjectDocumentPatch } from './project-editor';
import { createTestProjectWithLayers } from './project-editor-layer-color-test-utils';

describe('Project Editor Layer Colors Canonical Bridge', () => {
  describe('Layer-only color updates via updateLayerState', () => {
    it('updates SoundLayer color and does not change existing score objects', () => {
      const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
      const existingObj = soundLayer[0];
      const priorItemColor = existingObj.getBackgroundColor();

      const patch: ProjectDocumentPatch = {
        projectSessionId: 0,
        projectRevision: 0,
        score: {
          type: 'updateLayerState',
          groupId: polyGroupId,
          layerIndex: 0,
          patch: {
            backgroundColor: 0x0000ff, // Blue
          },
        },
      };

      const result = applyProjectDocumentPatch(data, patch);
      expect(result).toBe(true);
      expect(soundLayer.getBackgroundColor()).toBe(-16776961);
      // Existing item color remains untouched
      expect(existingObj.getBackgroundColor()).toBe(priorItemColor);
    });

    it('updates Track color and does not change existing track items', () => {
      const { data, track, trackGroupId } = createTestProjectWithLayers();
      const existingItem = track[0];
      const priorItemColor = existingItem.getBackgroundColor();

      const patch: ProjectDocumentPatch = {
        projectSessionId: 0,
        projectRevision: 0,
        score: {
          type: 'updateLayerState',
          groupId: trackGroupId,
          layerIndex: 0,
          patch: {
            backgroundColor: 0x00ff00, // Green
          },
        },
      };

      const result = applyProjectDocumentPatch(data, patch);
      expect(result).toBe(true);
      expect(track.getBackgroundColor()).toBe(-16711936);
      expect(existingItem.getBackgroundColor()).toBe(priorItemColor);
    });

    it('updates PatternLayer color and does not change existing source object', () => {
      const { data, patternLayer, patternGroupId } = createTestProjectWithLayers();
      const sourceObj = patternLayer.getSoundObject();
      const priorSourceColor = sourceObj.getBackgroundColor();

      const patch: ProjectDocumentPatch = {
        projectSessionId: 0,
        projectRevision: 0,
        score: {
          type: 'updateLayerState',
          groupId: patternGroupId,
          layerIndex: 0,
          patch: {
            backgroundColor: 0xff0000, // Red
          },
        },
      };

      const result = applyProjectDocumentPatch(data, patch);
      expect(result).toBe(true);
      expect(patternLayer.getBackgroundColor()).toBe(-65536);
      expect(sourceObj.getBackgroundColor()).toBe(priorSourceColor);
    });

    it('rejects invalid color inputs without mutating the layer', () => {
      const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
      soundLayer.setBackgroundColor(0x123456);
      const priorColor = soundLayer.getBackgroundColor();

      for (const invalidColor of [NaN, Infinity, 1.5, 4294967296, -2147483649]) {
        const patch: ProjectDocumentPatch = {
          projectSessionId: 0,
          projectRevision: 0,
          score: {
            type: 'updateLayerState',
            groupId: polyGroupId,
            layerIndex: 0,
            patch: {
              backgroundColor: invalidColor,
            },
          },
        };

        const result = applyProjectDocumentPatch(data, patch);
        expect(result).toBe(false);
        expect(soundLayer.getBackgroundColor()).toBe(priorColor);
      }
    });
  });

  describe('Destination-layer defaulting for new items', () => {
    it('gives a genuinely new ordinary score object the destination SoundLayer color when color is omitted', () => {
      const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
      soundLayer.setBackgroundColor(0x00ff00); // Green: -16711936

      const patch: ProjectDocumentPatch = {
        projectSessionId: 0,
        projectRevision: 0,
        score: {
          type: 'addScoreObjects',
          groupId: polyGroupId,
          objects: [
            {
              layerIndex: 0,
              objectType: 'GenericScore',
              name: 'Brand New Score Object',
              startBeats: 4,
              durationBeats: 2,
            },
          ],
        },
      };

      const result = applyProjectDocumentPatch(data, patch);
      expect(result).toBe(true);
      expect(soundLayer.length).toBe(2);
      const newItem = soundLayer[1];
      expect(newItem.getName()).toBe('Brand New Score Object');
      expect(newItem.getBackgroundColor()).toBe(-16711936);
    });

    it('preserves explicit color when provided for a new ordinary score object', () => {
      const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
      soundLayer.setBackgroundColor(0x00ff00); // Green

      const patch: ProjectDocumentPatch = {
        projectSessionId: 0,
        projectRevision: 0,
        score: {
          type: 'addScoreObjects',
          groupId: polyGroupId,
          objects: [
            {
              layerIndex: 0,
              objectType: 'GenericScore',
              name: 'Explicit Color Score Object',
              startBeats: 4,
              durationBeats: 2,
              backgroundColor: -16776961, // Blue
            },
          ],
        },
      };

      const result = applyProjectDocumentPatch(data, patch);
      expect(result).toBe(true);
      const newItem = soundLayer[1];
      expect(newItem.getBackgroundColor()).toBe(-16776961);
    });

    it('gives a genuinely new track item the destination Track color when color is omitted', () => {
      const { data, track, trackGroupId } = createTestProjectWithLayers();
      track.setBackgroundColor(0xff0000); // Red: -65536

      const patch: ProjectDocumentPatch = {
        projectSessionId: 0,
        projectRevision: 0,
        score: {
          type: 'addTrackItem',
          track: {
            rootGroupId: trackGroupId,
            trackId: track.getUniqueId(),
            projectSessionId: 0,
            projectRevision: 0,
          },
          startBeats: 4,
          item: {
            objectType: 'GenericScore',
            name: 'New Track Score Item',
            durationBeats: 2,
          },
        },
      };

      const result = applyProjectDocumentPatch(data, patch, {
        projectSessionId: 0,
        projectRevision: 0,
      });
      expect(result).toBe(true);
      expect(track.length).toBe(2);
      const newItem = track[1];
      expect(newItem.getName()).toBe('New Track Score Item');
      expect(newItem.getBackgroundColor()).toBe(-65536);
    });

    it('preserves serialized item color when backgroundColor is omitted from transfer payload', () => {
      const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
      soundLayer.setBackgroundColor(0x00ff00); // Green

      const existingSource = new GenericScore();
      existingSource.setName('Serialized Source');
      existingSource.setBackgroundColor(0x123456);
      const serializedXml = existingSource.saveAsXML().toXml();

      const patch: ProjectDocumentPatch = {
        projectSessionId: 0,
        projectRevision: 0,
        score: {
          type: 'addScoreObjects',
          groupId: polyGroupId,
          objects: [
            {
              layerIndex: 0,
              objectType: 'GenericScore',
              name: 'Restored Object',
              startBeats: 8,
              durationBeats: 2,
              serializedXml,
              // backgroundColor is intentionally omitted
            },
          ],
        },
      };

      const result = applyProjectDocumentPatch(data, patch);
      expect(result).toBe(true);
      const restored = soundLayer[soundLayer.length - 1];
      expect(restored.getBackgroundColor()).toBe(0x123456);
    });
  });
});
