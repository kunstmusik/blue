import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import TimeBar from '../components/workbench/panels/score-object/editors/pianoroll/TimeBar';

it('renders project DF labels from local zero with the complete tempo map', () => {
  const context = {
    meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
    tempoEnabled: true,
    initialTempo: 60,
    sampleRate: 48000,
    smpteFrameRate: 29.97,
    smpteDropFrame: true,
    tempoPoints: [
      { beat: 0, tempo: 60, curveType: 'constant' as const },
      { beat: 30, tempo: 120, curveType: 'constant' as const },
    ],
  };
  const markup = renderToStaticMarkup(
    <TimeBar
      canvasWidth={91 * 2400}
      pixelSecond={2400}
      primaryTimeDisplay="SMPTE"
      secondaryTimeDisplay="BEATS"
      secondaryRulerEnabled={false}
      meters={context.meterEntries}
      initialTempo={60}
      sampleRate={48000}
      timeContext={context}
    />,
  );
  expect(markup).toContain('00:00:00;00');
  expect(markup).toContain('00:01:00;02');
  expect(markup).toContain(`left:${90.12 * 2400}px`);
  expect(markup).not.toContain('00:01:00;00');
});
