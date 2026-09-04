import { describe, expect, it } from 'vitest';
import { TimeBase } from '../../shared/time-base';
import {
  buildSelectionDisplayState,
  type ToolbarSelectionTransportSnapshot,
} from '../components/menu-bar/toolbar-formatters';

function createSelectionTransport(
  renderStartTime: number,
  renderEndTime: number,
): ToolbarSelectionTransportSnapshot {
  return {
    renderStartTime,
    renderEndTime,
    tempoMap: {
      enabled: false,
      points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
    },
    meterMap: {
      entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
    },
    smpteFrameRate: 24,
    sampleRate: 44100,
  };
}

describe('toolbar selection formatter', () => {
  it('treats the Java no-selection sentinel as an empty selection', () => {
    expect(buildSelectionDisplayState(createSelectionTransport(8, -1), TimeBase.BEATS)).toEqual({
      startText: '—',
      endText: '—',
      durationText: '—',
      hasSelection: false,
    });
  });

  it('does not display a stale end value when a point click clears the range', () => {
    expect(buildSelectionDisplayState(createSelectionTransport(8, 0), TimeBase.BEATS)).toEqual({
      startText: '—',
      endText: '—',
      durationText: '—',
      hasSelection: false,
    });
  });

  it('formats ordered render ranges with duration', () => {
    expect(buildSelectionDisplayState(createSelectionTransport(8, 12), TimeBase.BEATS)).toEqual({
      startText: '8.00',
      endText: '12.00',
      durationText: '4.00',
      hasSelection: true,
    });
  });
});
