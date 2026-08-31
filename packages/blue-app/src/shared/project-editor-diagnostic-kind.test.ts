import { describe, expect, it } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  BlueX7,
  GenericInstrument,
  Instrument,
  TrackLayerGroup,
} from '@blue/data';
import {
  getTrackInstrumentDiagnosticKind,
  type TrackInstrumentEditorRequest,
} from './project-editor';

class UnsupportedInstrument extends Instrument {
  generateInstrument(): string {
    return '';
  }

  deepCopy(): Instrument {
    return new UnsupportedInstrument();
  }

  saveAsXML(): never {
    throw new Error('Unsupported test instrument has no XML representation.');
  }
}

function createTrackProject(): {
  data: BlueData;
  request: TrackInstrumentEditorRequest;
  track: ReturnType<TrackLayerGroup['newLayerAt']>;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const group = new TrackLayerGroup();
  group.setUniqueId('diagnostic-group');
  const track = group.newLayerAt(0);
  track.setUniqueId('diagnostic-track');
  data.getScore().push(group);
  return {
    data,
    request: {
      track: {
        rootGroupId: 'diagnostic-group',
        trackId: 'diagnostic-track',
        projectSessionId: 1,
        projectRevision: 0,
      },
    },
    track,
  };
}

describe('Track instrument diagnostic kind lookup', () => {
  it.each([
    [new GenericInstrument(), 'generic'],
    [new BlueSynthBuilder(), 'blue-synth-builder'],
    [new BlueX7(), 'blue-x7'],
  ] as const)('maps %s without constructing an editor snapshot', (instrument, expected) => {
    const { data, request, track } = createTrackProject();
    track.setInstrument(instrument);

    expect(getTrackInstrumentDiagnosticKind(data, request)).toBe(expected);
  });

  it('returns null for a missing Track target', () => {
    const { data, request } = createTrackProject();

    expect(getTrackInstrumentDiagnosticKind(data, {
      track: { ...request.track, trackId: 'missing-track' },
    })).toBeNull();
  });

  it('returns null for an unsupported instrument class', () => {
    const { data, request, track } = createTrackProject();
    track.setInstrument(new UnsupportedInstrument());

    expect(getTrackInstrumentDiagnosticKind(data, request)).toBeNull();
  });
});