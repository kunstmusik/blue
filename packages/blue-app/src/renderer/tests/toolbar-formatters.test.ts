import { describe, expect, it } from 'vitest';
import { TimeBase } from '../../shared/time-base';
import {
  buildPlayheadDisplayState,
  buildSelectionDisplayState,
  type ToolbarPlayheadTransportSnapshot,
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
      visible: false,
      points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
    },
    meterMap: {
      entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
    },
    smpteFrameRate: 24,
    sampleRate: 44100,
  };
}

function createPlayheadTransport(renderStartTime = 0): ToolbarPlayheadTransportSnapshot {
  return {
    renderStartTime,
    tempoMap: {
      enabled: false,
      visible: false,
      points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
    },
    meterMap: {
      entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
    },
    smpteFrameRate: 24,
    sampleRate: 44100,
  };
}

const idlePlayback = {
  status: 'idle' as const,
  hasClock: false,
  elapsedSeconds: 0,
  source: 'idle-anchor' as const,
};

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

describe('toolbar playhead sync preferences', () => {
  it('resolves sync modes to the project ruler formats', () => {
    const playhead = buildPlayheadDisplayState(createPlayheadTransport(2.05), idlePlayback, {
      primaryMode: 'sync',
      secondaryMode: 'sync',
      syncPrimaryFormat: TimeBase.BBF,
      syncSecondaryFormat: TimeBase.TIME,
    });

    expect(playhead.primaryText).toBe('1.3.05');
    expect(playhead.secondaryText).toBe('0:02.050');
  });

  it('lets explicit modes win over the project ruler formats', () => {
    const playhead = buildPlayheadDisplayState(createPlayheadTransport(8), idlePlayback, {
      primaryMode: TimeBase.BBT,
      secondaryMode: 'off',
      syncPrimaryFormat: TimeBase.BBF,
      syncSecondaryFormat: TimeBase.TIME,
    });

    expect(playhead.primaryText).toBe('3.1.0');
    expect(playhead.secondaryText).toBeNull();
  });

  it('falls back to the built-in defaults when no project ruler formats are provided', () => {
    const playhead = buildPlayheadDisplayState(createPlayheadTransport(8), idlePlayback, {
      primaryMode: 'sync',
      secondaryMode: 'sync',
    });

    expect(playhead.primaryText).toBe('8.00');
    expect(playhead.secondaryText).toBe('0:08.000');
  });

  it('updates the synced readout when the project ruler format changes', () => {
    const transport = createPlayheadTransport(4.25);

    const beatsPlayhead = buildPlayheadDisplayState(transport, idlePlayback, {
      syncPrimaryFormat: TimeBase.BEATS,
    });
    expect(beatsPlayhead.primaryText).toBe('4.25');

    const bbfPlayhead = buildPlayheadDisplayState(transport, idlePlayback, {
      syncPrimaryFormat: TimeBase.BBF,
    });
    expect(bbfPlayhead.primaryText).toBe('2.1.25');
  });
});
