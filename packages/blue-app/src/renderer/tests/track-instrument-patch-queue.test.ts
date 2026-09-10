import { describe, expect, it, vi } from 'vitest';
import {
  createInstrumentPatchBoundaryController,
  mergePendingInstrumentPatch,
  type InstrumentPatchBoundaryControllerDependencies,
} from '../components/track-instrument-editor/track-instrument-patch-queue';
import type { InstrumentPatch } from '../../shared/project-editor';

function makePatch(text: string): InstrumentPatch {
  return { instrumentText: text };
}

function makeDependencies(
  overrides: Partial<InstrumentPatchBoundaryControllerDependencies> = {},
): InstrumentPatchBoundaryControllerDependencies & {
  acknowledgeBoundary: ReturnType<typeof vi.fn>;
  drainPrefix: ReturnType<typeof vi.fn>;
} {
  return {
    participantContextId: 'ctx-track-editor',
    capturePendingPatches: vi.fn(() => [] as InstrumentPatch[]),
    drainPrefix: vi.fn().mockResolvedValue(undefined),
    acknowledgeBoundary: vi.fn(),
    getAcknowledgedRevision: vi.fn(() => 0),
    ...overrides,
  } as InstrumentPatchBoundaryControllerDependencies & {
    acknowledgeBoundary: ReturnType<typeof vi.fn>;
    drainPrefix: ReturnType<typeof vi.fn>;
  };
}

describe('Track instrument settlement boundary participant (T016)', () => {
  it('captures the pending prefix, drains it with the barrier id, and acknowledges zero outstanding', async () => {
    const dependencies = makeDependencies({
      capturePendingPatches: vi.fn(() => [makePatch('a'), makePatch('b')]),
      drainPrefix: vi.fn().mockResolvedValue(undefined),
      getAcknowledgedRevision: vi.fn(() => 7),
    });
    const controller = createInstrumentPatchBoundaryController(dependencies);

    await controller.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });

    expect(dependencies.drainPrefix).toHaveBeenCalledWith(
      [makePatch('a'), makePatch('b')],
      'barrier-1',
    );
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith({
      barrierId: 'barrier-1',
      contextId: 'ctx-track-editor',
      lastAcknowledgedRevision: 7,
      lastAcknowledgedSequence: 1,
      outstandingPrefixCount: 0,
    });
    expect(controller.isSettlementPaused()).toBe(true);
  });

  it('acknowledges an empty prefix without draining', async () => {
    const dependencies = makeDependencies({
      capturePendingPatches: vi.fn(() => [] as InstrumentPatch[]),
    });
    const controller = createInstrumentPatchBoundaryController(dependencies);

    await controller.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'save' });

    expect(dependencies.drainPrefix).not.toHaveBeenCalled();
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith({
      barrierId: 'barrier-1',
      contextId: 'ctx-track-editor',
      lastAcknowledgedRevision: 0,
      lastAcknowledgedSequence: 0,
      outstandingPrefixCount: 0,
    });
  });

  it('reports conflicting prefix work with a nonzero outstanding count', async () => {
    const reportError = vi.fn();
    const dependencies = makeDependencies({
      capturePendingPatches: vi.fn(() => [makePatch('a')]),
      drainPrefix: vi.fn().mockRejectedValue(new Error('stale instrument snapshot')),
      reportError,
    });
    const controller = createInstrumentPatchBoundaryController(dependencies);

    await controller.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });

    expect(reportError).toHaveBeenCalledWith(expect.any(Error));
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith({
      barrierId: 'barrier-1',
      contextId: 'ctx-track-editor',
      lastAcknowledgedRevision: 0,
      lastAcknowledgedSequence: 1,
      outstandingPrefixCount: 1,
    });
  });

  it('ignores a second prepare while a boundary is already active', async () => {
    let drainCount = 0;
    const dependencies = makeDependencies({
      capturePendingPatches: vi.fn(() => {
        drainCount += 1;
        return [makePatch(`a${drainCount}`)];
      }),
    });
    const controller = createInstrumentPatchBoundaryController(dependencies);

    const first = controller.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    await controller.handlePrepareBoundary({ barrierId: 'barrier-2', reason: 'save' });
    await first;

    expect(dependencies.capturePendingPatches).toHaveBeenCalledTimes(1);
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledTimes(1);
    expect(controller.isSettlementPaused()).toBe(true);
  });

  it('resumes on release for the active barrier and ignores stale barrier ids', async () => {
    const onReleased = vi.fn();
    const dependencies = makeDependencies({ onReleased });
    const controller = createInstrumentPatchBoundaryController(dependencies);

    await controller.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    controller.handleReleaseBoundary({ barrierId: 'barrier-stale', status: 'ready' });
    expect(controller.isSettlementPaused()).toBe(true);
    expect(onReleased).not.toHaveBeenCalled();

    controller.handleReleaseBoundary({ barrierId: 'barrier-1', status: 'ready' });
    expect(controller.isSettlementPaused()).toBe(false);
    expect(onReleased).toHaveBeenCalledTimes(1);
  });
});

describe('Track instrument durable patch coalescing', () => {
  it('keeps only the latest scalar replacement value', () => {
    expect(
      mergePendingInstrumentPatch({ instrumentText: 'first' }, { instrumentText: 'latest' }),
    ).toEqual({ instrumentText: 'latest' });
  });

  it('merges consecutive property values for the same BSB widget', () => {
    expect(
      mergePendingInstrumentPatch(
        {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'xy-pad',
            properties: { xValue: 0.25 },
          },
        },
        {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'xy-pad',
            properties: { yValue: 0.75 },
          },
        },
      ),
    ).toEqual({
      bsbInterface: {
        type: 'updateWidgetProperties',
        widgetId: 'xy-pad',
        properties: { xValue: 0.25, yValue: 0.75 },
      },
    });
  });

  it('retains separate durable patches for different widgets', () => {
    expect(
      mergePendingInstrumentPatch(
        {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'gain',
            properties: { value: 0.25 },
          },
        },
        {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'frequency',
            properties: { value: 0.75 },
          },
        },
      ),
    ).toBeNull();
  });

  it('coalesces slider-bank values only for the same widget and index', () => {
    const first = {
      bsbInterface: {
        type: 'updateSliderBankValue' as const,
        widgetId: 'bank',
        sliderIndex: 2,
        value: 0.25,
      },
    };
    const latest = {
      bsbInterface: {
        type: 'updateSliderBankValue' as const,
        widgetId: 'bank',
        sliderIndex: 2,
        value: 0.75,
      },
    };

    expect(mergePendingInstrumentPatch(first, latest)).toEqual(latest);
    expect(
      mergePendingInstrumentPatch(first, {
        bsbInterface: { ...latest.bsbInterface, sliderIndex: 3 },
      }),
    ).toBeNull();
  });

  describe('BlueX7 patch coalescing', () => {
    it('coalesces same common field and retains distinct common fields', () => {
      const first = {
        blueX7: {
          type: 'setCommonField' as const,
          field: 'algorithm' as const,
          value: 12,
        },
      };
      const latest = {
        blueX7: {
          type: 'setCommonField' as const,
          field: 'algorithm' as const,
          value: 19,
        },
      };
      expect(mergePendingInstrumentPatch(first, latest)).toEqual(latest);

      const differentField = {
        blueX7: {
          type: 'setCommonField' as const,
          field: 'feedback' as const,
          value: 4,
        },
      };
      expect(mergePendingInstrumentPatch(first, differentField)).toBeNull();
    });

    it('coalesces operator enabled flags for the same operator only', () => {
      const first = {
        blueX7: {
          type: 'setOperatorEnabled' as const,
          operatorIndex: 2,
          enabled: false,
        },
      };
      const latest = {
        blueX7: {
          type: 'setOperatorEnabled' as const,
          operatorIndex: 2,
          enabled: true,
        },
      };
      expect(mergePendingInstrumentPatch(first, latest)).toEqual(latest);

      const differentOp = {
        blueX7: {
          type: 'setOperatorEnabled' as const,
          operatorIndex: 3,
          enabled: true,
        },
      };
      expect(mergePendingInstrumentPatch(first, differentOp)).toBeNull();
    });

    it('coalesces operator fields for the same operator and field only', () => {
      const first = {
        blueX7: {
          type: 'setOperatorField' as const,
          operatorIndex: 1,
          field: 'outputLevel' as const,
          value: 40,
        },
      };
      const latest = {
        blueX7: {
          type: 'setOperatorField' as const,
          operatorIndex: 1,
          field: 'outputLevel' as const,
          value: 65,
        },
      };
      expect(mergePendingInstrumentPatch(first, latest)).toEqual(latest);

      const differentField = {
        blueX7: {
          type: 'setOperatorField' as const,
          operatorIndex: 1,
          field: 'freqCoarse' as const,
          value: 2,
        },
      };
      expect(mergePendingInstrumentPatch(first, differentField)).toBeNull();

      const differentOp = {
        blueX7: {
          type: 'setOperatorField' as const,
          operatorIndex: 2,
          field: 'outputLevel' as const,
          value: 65,
        },
      };
      expect(mergePendingInstrumentPatch(first, differentOp)).toBeNull();
    });

    it('coalesces envelope points for matching operator and stage only', () => {
      const first = {
        blueX7: {
          type: 'setOperatorEnvelopePoint' as const,
          operatorIndex: 0,
          stageIndex: 1,
          point: { rate: 50, level: 30 },
        },
      };
      const latest = {
        blueX7: {
          type: 'setOperatorEnvelopePoint' as const,
          operatorIndex: 0,
          stageIndex: 1,
          point: { rate: 60, level: 40 },
        },
      };
      expect(mergePendingInstrumentPatch(first, latest)).toEqual(latest);

      const differentStage = {
        blueX7: {
          type: 'setOperatorEnvelopePoint' as const,
          operatorIndex: 0,
          stageIndex: 2,
          point: { rate: 60, level: 40 },
        },
      };
      expect(mergePendingInstrumentPatch(first, differentStage)).toBeNull();
    });

    it('coalesces shared sync, shared PMS, csoundPostCode, and replaceVoice', () => {
      const sync1 = { blueX7: { type: 'setSharedOscillatorSync' as const, value: 0 } };
      const sync2 = { blueX7: { type: 'setSharedOscillatorSync' as const, value: 1 } };
      expect(mergePendingInstrumentPatch(sync1, sync2)).toEqual(sync2);

      const pms1 = { blueX7: { type: 'setSharedPitchModulationSensitivity' as const, value: 2 } };
      const pms2 = { blueX7: { type: 'setSharedPitchModulationSensitivity' as const, value: 6 } };
      expect(mergePendingInstrumentPatch(pms1, pms2)).toEqual(pms2);

      const code1 = { blueX7: { type: 'setCsoundPostCode' as const, text: 'outs aout, aout' } };
      const code2 = {
        blueX7: { type: 'setCsoundPostCode' as const, text: 'blueMixerOut aout, aout' },
      };
      expect(mergePendingInstrumentPatch(code1, code2)).toEqual(code2);
    });
  });
});
