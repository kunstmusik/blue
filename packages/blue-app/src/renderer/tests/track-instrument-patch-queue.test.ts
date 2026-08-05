import { describe, expect, it } from 'vitest';
import { mergePendingInstrumentPatch } from '../components/track-instrument-editor/track-instrument-patch-queue';

describe('Track instrument durable patch coalescing', () => {
  it('keeps only the latest scalar replacement value', () => {
    expect(mergePendingInstrumentPatch(
      { instrumentText: 'first' },
      { instrumentText: 'latest' },
    )).toEqual({ instrumentText: 'latest' });
  });

  it('merges consecutive property values for the same BSB widget', () => {
    expect(mergePendingInstrumentPatch(
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
    )).toEqual({
      bsbInterface: {
        type: 'updateWidgetProperties',
        widgetId: 'xy-pad',
        properties: { xValue: 0.25, yValue: 0.75 },
      },
    });
  });

  it('retains separate durable patches for different widgets', () => {
    expect(mergePendingInstrumentPatch(
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
    )).toBeNull();
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
    expect(mergePendingInstrumentPatch(first, {
      bsbInterface: { ...latest.bsbInterface, sliderIndex: 3 },
    })).toBeNull();
  });
});
