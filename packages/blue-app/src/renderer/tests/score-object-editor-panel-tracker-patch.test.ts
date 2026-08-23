import { describe, expect, it } from 'vitest';
import { BlueData, PolyObject, SoundLayer, Track, TrackerObject } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createScoreObjectEditorDocument,
  type ScoreObjectEditorTargetSnapshot,
} from '../../shared/project-editor';
import { applyPatchToDocument } from '../components/workbench/panels/score-object/score-object-document-reducer';

function makeTimelineTarget(): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'TrackerObject',
    editorObjectType: 'TrackerObject',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function makeTrackerHarness(trackCount: number, steps: number) {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const tracker = new TrackerObject();
  tracker.getTracks().setSteps(steps);
  for (let i = 0; i < trackCount; i++) {
    tracker.getTracks().addTrack(new Track());
  }
  layer.push(tracker);
  poly.push(layer);
  data.getScore().push(poly);

  const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget() });
  if (!doc || doc.editor.kind !== 'tracker') {
    throw new Error('Expected tracker editor document');
  }
  return { data, doc, tracker };
}

function makeTrackerDocument(trackCount: number, steps: number) {
  return makeTrackerHarness(trackCount, steps).doc;
}

describe('ScoreObjectEditorPanel tracker optimistic patching', () => {
  it('round-trips tracker keyboard toolbar state through the canonical object', () => {
    const { data, doc } = makeTrackerHarness(1, 8);

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { showNoteNames: true, octave: 3 },
      },
    })).toBe(true);

    const refreshed = createScoreObjectEditorDocument(data, { target: doc.target });
    expect(refreshed?.editor.kind).toBe('tracker');
    if (refreshed?.editor.kind !== 'tracker') return;
    expect(refreshed.editor.showNoteNames).toBe(true);
    expect(refreshed.editor.octave).toBe(3);
  });

  it('adds tracker defaults for a new track (pch/db columns)', () => {
    const doc = makeTrackerDocument(1, 8);
    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { addTrack: true },
    });

    expect(next.editor.kind).toBe('tracker');
    if (next.editor.kind !== 'tracker') return;

    expect(next.editor.tracks).toHaveLength(2);
    expect(next.editor.tracks[1]?.columns.map((col) => ({ name: col.name, type: col.type }))).toEqual([
      { name: 'pch', type: 0 },
      { name: 'db', type: 4 },
    ]);
    expect(next.editor.tracks[1]?.columns[1]?.rangeMax).toBe(90);
    expect(next.editor.rows[0]?.['track-1-status']).toBe('');
    expect(next.editor.rows[0]?.['track-1-col-0']).toBe('');
    expect(next.editor.rows[0]?.['track-1-col-1']).toBe('');
  });

  it('writes tracker cell updates to the current status/data keys', () => {
    const doc = makeTrackerDocument(1, 8);
    const withStatus = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: -1, stepIndex: 0, value: '-' } },
    });
    const withValue = applyPatchToDocument(withStatus, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.07' } },
    });

    expect(withValue.editor.kind).toBe('tracker');
    if (withValue.editor.kind !== 'tracker') return;

    expect(withValue.editor.rows[0]?.['track-0-status']).toBe('');
    expect(withValue.editor.rows[0]?.['track-0-col-0']).toBe('8.07');
    expect(withValue.editor.rows[0]?.['track-0']).toBeUndefined();
  });

  it('seeds defaults for first entry on an inactive row when no prior active note exists', () => {
    const doc = makeTrackerDocument(1, 8);
    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: 1, stepIndex: 2, value: '75' } },
    });

    expect(next.editor.kind).toBe('tracker');
    if (next.editor.kind !== 'tracker') return;

    expect(next.editor.rows[2]?.['track-0-status']).toBe('');
    expect(next.editor.rows[2]?.['track-0-col-0']).toBe('8.00');
    expect(next.editor.rows[2]?.['track-0-col-1']).toBe('75');
  });

  it('copies previous active note values before applying first entry on an inactive row', () => {
    const doc = makeTrackerDocument(1, 8);
    const withPrevious = applyPatchToDocument(
      applyPatchToDocument(doc, {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.05' } },
      }),
      {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 1, stepIndex: 0, value: '82' } },
      },
    );

    const next = applyPatchToDocument(withPrevious, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: 1, stepIndex: 1, value: '71' } },
    });

    expect(next.editor.kind).toBe('tracker');
    if (next.editor.kind !== 'tracker') return;

    expect(next.editor.rows[1]?.['track-0-status']).toBe('');
    expect(next.editor.rows[1]?.['track-0-col-0']).toBe('8.05');
    expect(next.editor.rows[1]?.['track-0-col-1']).toBe('71');
  });

  it('preserves last valid value for invalid edits and blocks data writes on OFF notes', () => {
    const doc = makeTrackerDocument(1, 8);
    const withValue = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.09' } },
    });
    const invalid = applyPatchToDocument(withValue, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: 'invalid' } },
    });
    const withOff = applyPatchToDocument(invalid, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: -1, stepIndex: 1, value: 'OFF' } },
    });
    const blocked = applyPatchToDocument(withOff, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 1, value: '8.11' } },
    });

    expect(blocked.editor.kind).toBe('tracker');
    if (blocked.editor.kind !== 'tracker') return;

    expect(blocked.editor.rows[0]?.['track-0-col-0']).toBe('8.09');
    expect(blocked.editor.rows[1]?.['track-0-status']).toBe('OFF');
    expect(blocked.editor.rows[1]?.['track-0-col-0']).toBe('');
  });

  it('applies clear/duplicate and note-off tracker actions with Java parity semantics', () => {
    const doc = makeTrackerDocument(1, 8);
    const withBaseNote = applyPatchToDocument(
      applyPatchToDocument(doc, {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.05' } },
      }),
      {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 1, stepIndex: 0, value: '82' } },
      },
    );

    const duplicated = applyPatchToDocument(withBaseNote, {
      type: 'updateTypeSpecificEditor',
      target: withBaseNote.target,
      patch: { trackerAction: { type: 'clearOrDuplicate', trackIndex: 0, stepIndex: 1, columnIndex: 0 } },
    });
    const cleared = applyPatchToDocument(duplicated, {
      type: 'updateTypeSpecificEditor',
      target: duplicated.target,
      patch: { trackerAction: { type: 'clearOrDuplicate', trackIndex: 0, stepIndex: 1, columnIndex: 0 } },
    });
    const setOff = applyPatchToDocument(cleared, {
      type: 'updateTypeSpecificEditor',
      target: cleared.target,
      patch: { trackerAction: { type: 'setNoteOff', trackIndex: 0, stepIndex: 1, columnIndex: 0 } },
    });
    const clearedOff = applyPatchToDocument(setOff, {
      type: 'updateTypeSpecificEditor',
      target: setOff.target,
      patch: { trackerAction: { type: 'clearOrDuplicate', trackIndex: 0, stepIndex: 1, columnIndex: 0 } },
    });

    expect(duplicated.editor.kind).toBe('tracker');
    expect(cleared.editor.kind).toBe('tracker');
    expect(setOff.editor.kind).toBe('tracker');
    expect(clearedOff.editor.kind).toBe('tracker');
    if (
      duplicated.editor.kind !== 'tracker'
      || cleared.editor.kind !== 'tracker'
      || setOff.editor.kind !== 'tracker'
      || clearedOff.editor.kind !== 'tracker'
    ) return;

    expect(duplicated.editor.rows[1]?.['track-0-col-0']).toBe('8.05');
    expect(duplicated.editor.rows[1]?.['track-0-col-1']).toBe('82');
    expect(cleared.editor.rows[1]?.['track-0-col-0']).toBe('');
    expect(cleared.editor.rows[1]?.['track-0-col-1']).toBe('');
    expect(setOff.editor.rows[1]?.['track-0-status']).toBe('OFF');
    expect(setOff.editor.rows[1]?.['track-0-col-0']).toBe('');
    expect(setOff.editor.rows[1]?.['track-0-col-1']).toBe('');
    expect(clearedOff.editor.rows[1]?.['track-0-status']).toBe('');
  });

  it('allows keyboard setNoteValue action to overwrite OFF rows using prior/default note seeding', () => {
    const doc = makeTrackerDocument(1, 8);
    const withPrevious = applyPatchToDocument(
      applyPatchToDocument(doc, {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.03' } },
      }),
      {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 1, stepIndex: 0, value: '76' } },
      },
    );
    const withOff = applyPatchToDocument(withPrevious, {
      type: 'updateTypeSpecificEditor',
      target: withPrevious.target,
      patch: { trackerAction: { type: 'setNoteOff', trackIndex: 0, stepIndex: 1, columnIndex: 1 } },
    });
    const fromPrevious = applyPatchToDocument(withOff, {
      type: 'updateTypeSpecificEditor',
      target: withOff.target,
      patch: {
        trackerAction: {
          type: 'setNoteValue',
          trackIndex: 0,
          stepIndex: 1,
          columnIndex: 1,
          noteBuffer: [[{ tied: false, off: false, fields: ['70'] }]],
        },
      },
    });

    const noPreviousDoc = makeTrackerDocument(1, 8);
    const offNoPrevious = applyPatchToDocument(noPreviousDoc, {
      type: 'updateTypeSpecificEditor',
      target: noPreviousDoc.target,
      patch: { trackerAction: { type: 'setNoteOff', trackIndex: 0, stepIndex: 2, columnIndex: 1 } },
    });
    const fromDefaults = applyPatchToDocument(offNoPrevious, {
      type: 'updateTypeSpecificEditor',
      target: offNoPrevious.target,
      patch: {
        trackerAction: {
          type: 'setNoteValue',
          trackIndex: 0,
          stepIndex: 2,
          columnIndex: 1,
          noteBuffer: [[{ tied: false, off: false, fields: ['75'] }]],
        },
      },
    });

    expect(fromPrevious.editor.kind).toBe('tracker');
    expect(fromDefaults.editor.kind).toBe('tracker');
    if (fromPrevious.editor.kind !== 'tracker' || fromDefaults.editor.kind !== 'tracker') return;

    expect(fromPrevious.editor.rows[1]?.['track-0-status']).toBe('');
    expect(fromPrevious.editor.rows[1]?.['track-0-col-0']).toBe('8.03');
    expect(fromPrevious.editor.rows[1]?.['track-0-col-1']).toBe('70');
    expect(fromDefaults.editor.rows[2]?.['track-0-status']).toBe('');
    expect(fromDefaults.editor.rows[2]?.['track-0-col-0']).toBe('8.00');
    expect(fromDefaults.editor.rows[2]?.['track-0-col-1']).toBe('75');
  });

  it('keeps tracker column config and value mapping in sync on track property updates', () => {
    const doc = makeTrackerDocument(1, 8);
    const withValues = applyPatchToDocument(
      applyPatchToDocument(doc, {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.05' } },
      }),
      {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 1, stepIndex: 0, value: '78' } },
      },
    );

    if (withValues.editor.kind !== 'tracker') return;
    const originalCols = withValues.editor.tracks[0]!.columns;
    const dbCol = { ...originalCols[1]!, sourceIndex: 1 };
    const pchCol = { ...originalCols[0]!, sourceIndex: 0 };

    const updated = applyPatchToDocument(withValues, {
      type: 'updateTypeSpecificEditor',
      target: withValues.target,
      patch: {
        updateTrackProperties: {
          trackIndex: 0,
          name: 'Track 1',
          instrumentId: '1',
          noteTemplate: 'i <INSTR_ID> <START> <DUR> <pch> <db>',
          columns: [dbCol, pchCol],
        },
      },
    });

    expect(updated.editor.kind).toBe('tracker');
    if (updated.editor.kind !== 'tracker') return;

    expect(updated.editor.tracks[0]?.columns[0]?.type).toBe(4);
    expect(updated.editor.tracks[0]?.columns[1]?.type).toBe(0);
    expect(updated.editor.rows[0]?.['track-0-col-0']).toBe('78');
    expect(updated.editor.rows[0]?.['track-0-col-1']).toBe('8.05');
  });

  it('does not reuse prior values for brand new columns during reorder updates', () => {
    const doc = makeTrackerDocument(1, 8);
    const withValues = applyPatchToDocument(
      applyPatchToDocument(doc, {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.03' } },
      }),
      {
        type: 'updateTypeSpecificEditor',
        target: doc.target,
        patch: { updateTrackCell: { trackIndex: 0, columnIndex: 1, stepIndex: 0, value: '70' } },
      },
    );

    if (withValues.editor.kind !== 'tracker') return;
    const [pchCol, dbCol] = withValues.editor.tracks[0]!.columns;
    const newCol = {
      ...dbCol,
      name: 'gate',
      rangeMin: 0,
      rangeMax: 1,
      usingRange: true,
      sourceIndex: null as null,
    };

    const updated = applyPatchToDocument(withValues, {
      type: 'updateTypeSpecificEditor',
      target: withValues.target,
      patch: {
        updateTrackProperties: {
          trackIndex: 0,
          name: 'Track 1',
          instrumentId: '1',
          noteTemplate: 'i <INSTR_ID> <START> <DUR> <pch> <db> <gate>',
          columns: [newCol, { ...pchCol, sourceIndex: 0 }, { ...dbCol, sourceIndex: 1 }],
        },
      },
    });

    expect(updated.editor.kind).toBe('tracker');
    if (updated.editor.kind !== 'tracker') return;

    expect(updated.editor.rows[0]?.['track-0-col-0']).toBe('');
    expect(updated.editor.rows[0]?.['track-0-col-1']).toBe('8.03');
    expect(updated.editor.rows[0]?.['track-0-col-2']).toBe('70');
  });
});
