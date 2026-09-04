import { describe, expect, it } from 'vitest';
import { BlueData, CurveType, Element, TempoMap, TempoPoint, TimeBase } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  createToolbarProjectTransportSnapshot,
} from '../../shared/project-editor';

function createTempoProject(): BlueData {
  const data = new BlueData();
  data.getScore().getTimeContext().getTempoMap().setEnabled(true);
  return data;
}

describe('Tempo map snapshot contract', () => {
  it('includes enabled, visible, and points in the snapshot', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.addTempoPoint(new TempoPoint(4, 120, CurveType.LINEAR));
    tempoMap.setVisible(true);

    const transport = createToolbarProjectTransportSnapshot(data);

    expect(transport.tempoMap.enabled).toBe(true);
    expect(transport.tempoMap.visible).toBe(true);
    expect(transport.tempoMap.points).toHaveLength(2);
    expect(transport.tempoMap.points[0]).toEqual({
      beat: 0,
      tempo: 60,
      curveType: 'constant',
      timeBase: TimeBase.BEATS,
    });
    expect(transport.tempoMap.points[1]).toEqual({
      beat: 4,
      tempo: 120,
      curveType: 'linear',
      timeBase: TimeBase.BEATS,
    });
  });

  it('snapshots a disabled invisible map correctly', () => {
    const data = new BlueData();
    const transport = createToolbarProjectTransportSnapshot(data);

    expect(transport.tempoMap.enabled).toBe(false);
    expect(transport.tempoMap.visible).toBe(false);
    expect(transport.tempoMap.points).toHaveLength(1);
  });

  it('project snapshot includes tempo map through transport', () => {
    const data = createTempoProject();
    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');

    expect(snapshot.transport.tempoMap.enabled).toBe(true);
    expect(snapshot.transport.tempoMap.visible).toBe(false);
    expect(snapshot.transport.tempoMap.points).toHaveLength(1);
  });
});

describe('Tempo map patch validation and application', () => {
  it('setTempoEnabled toggles the canonical tempo map', () => {
    const data = new BlueData();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    expect(tempoMap.isEnabled()).toBe(false);

    const changed = applyProjectDocumentPatch(data, {
      transport: { tempoMapPatch: { type: 'setTempoEnabled', enabled: true } },
    });

    expect(changed).toBe(true);
    expect(tempoMap.isEnabled()).toBe(true);
  });

  it('setTempoVisible toggles visibility', () => {
    const data = new BlueData();

    applyProjectDocumentPatch(data, {
      transport: { tempoMapPatch: { type: 'setTempoVisible', visible: true } },
    });

    expect(data.getScore().getTimeContext().getTempoMap().isVisible()).toBe(true);
  });

  it('addTempoPoint adds a new point to the canonical map', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();

    applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: {
          type: 'addTempoPoint',
          point: { beat: 4, tempo: 120, curveType: 'constant' },
        },
      },
    });

    expect(tempoMap.size()).toBe(2);
    expect(tempoMap.getBeat(1)).toBe(4);
    expect(tempoMap.getTempo(1)).toBe(120);
    expect(tempoMap.getCurveType(1)).toBe(CurveType.CONSTANT);
  });

  it('addTempoPoint rejects duplicate beats', () => {
    const data = createTempoProject();

    const changed = applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: {
          type: 'addTempoPoint',
          point: { beat: 0, tempo: 100, curveType: 'constant' },
        },
      },
    });

    expect(changed).toBe(false);
    expect(data.getScore().getTimeContext().getTempoMap().size()).toBe(1);
  });

  it('updateTempoPoint updates beat, tempo, and curve type', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));

    applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: {
          type: 'updateTempoPoint',
          index: 1,
          patch: { beat: 8, tempo: 90, curveType: 'linear' },
        },
      },
    });

    expect(tempoMap.getBeat(1)).toBe(8);
    expect(tempoMap.getTempo(1)).toBe(90);
    expect(tempoMap.getCurveType(1)).toBe(CurveType.LINEAR);
  });

  it('updateTempoPoint rejects moving the time-zero point away from beat 0', () => {
    const data = createTempoProject();

    const changed = applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: { type: 'updateTempoPoint', index: 0, patch: { beat: 1 } },
      },
    });

    expect(changed).toBe(false);
  });

  it('updateTempoPoint rejects crossing neighbors', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));
    tempoMap.addTempoPoint(new TempoPoint(8, 90, CurveType.CONSTANT));

    const changed = applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: { type: 'updateTempoPoint', index: 1, patch: { beat: 9 } },
      },
    });

    expect(changed).toBe(false);
  });

  it('setTempoCurveType changes the curve type of a point', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));

    applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: { type: 'setTempoCurveType', index: 1, curveType: 'linear' },
      },
    });

    expect(tempoMap.getCurveType(1)).toBe(CurveType.LINEAR);
  });

  it('removeTempoPoint removes a non-first point', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));

    applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: { type: 'removeTempoPoint', index: 1 },
      },
    });

    expect(tempoMap.size()).toBe(1);
  });

  it('removeTempoPoint rejects removing the time-zero point', () => {
    const data = createTempoProject();

    const changed = applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: { type: 'removeTempoPoint', index: 0 },
      },
    });

    expect(changed).toBe(false);
    expect(data.getScore().getTimeContext().getTempoMap().size()).toBe(1);
  });

  it('replaceTempoMap replaces the entire canonical map', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();

    applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: {
          type: 'replaceTempoMap',
          map: {
            enabled: true,
            visible: true,
            points: [
              { beat: 0, tempo: 72, curveType: 'constant' },
              { beat: 4, tempo: 120, curveType: 'linear' },
              { beat: 8, tempo: 90, curveType: 'constant' },
            ],
          },
        },
      },
    });

    expect(tempoMap.isEnabled()).toBe(true);
    expect(tempoMap.isVisible()).toBe(true);
    expect(tempoMap.size()).toBe(3);
    expect(tempoMap.getTempo(0)).toBe(72);
    expect(tempoMap.getTempo(1)).toBe(120);
    expect(tempoMap.getTempo(2)).toBe(90);
    expect(tempoMap.getCurveType(1)).toBe(CurveType.LINEAR);
  });

  it('replaceTempoMap preserves tempo point time bases', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();

    applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: {
          type: 'replaceTempoMap',
          map: {
            enabled: true,
            visible: true,
            points: [
              { beat: 0, tempo: 72, curveType: 'constant', timeBase: 'BEATS' },
              { beat: 4, tempo: 120, curveType: 'linear', timeBase: 'BBF' },
            ],
          },
        },
      },
    });

    expect(tempoMap.size()).toBe(2);
    expect(tempoMap.getBeat(1)).toBeCloseTo(4, 6);
    expect(tempoMap.getPoint(1).position.getTimeBase()).toBe(TimeBase.BBF);

    const transport = createToolbarProjectTransportSnapshot(data);
    expect(transport.tempoMap.points[1]).toMatchObject({
      beat: 4,
      tempo: 120,
      curveType: 'linear',
      timeBase: TimeBase.BBF,
    });
  });

  it('replaceTempoMap rejects invalid maps', () => {
    const data = createTempoProject();

    const changed = applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: {
          type: 'replaceTempoMap',
          map: {
            enabled: true,
            visible: false,
            points: [],
          },
        },
      },
    });

    expect(changed).toBe(false);
  });

  it('replaceTempoMap rejects maps with first point not at beat 0', () => {
    const data = createTempoProject();

    const changed = applyProjectDocumentPatch(data, {
      transport: {
        tempoMapPatch: {
          type: 'replaceTempoMap',
          map: {
            enabled: true,
            visible: false,
            points: [{ beat: 1, tempo: 60, curveType: 'constant' }],
          },
        },
      },
    });

    expect(changed).toBe(false);
  });
});

describe('Tempo map patch round-trips through save/load', () => {
  it('persists enabled, visible, and points through XML', () => {
    const data = createTempoProject();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.setVisible(true);
    tempoMap.addTempoPoint(new TempoPoint(4, 120, CurveType.LINEAR));

    const xml = tempoMap.saveAsXML().toXml();
    const reloaded = TempoMap.loadFromXML(Element.parse(xml));

    expect(reloaded.isEnabled()).toBe(true);
    expect(reloaded.isVisible()).toBe(true);
    expect(reloaded.size()).toBe(2);
    expect(reloaded.getTempo(0)).toBe(60);
    expect(reloaded.getTempo(1)).toBe(120);
    expect(reloaded.getCurveType(1)).toBe(CurveType.LINEAR);
  });
});
