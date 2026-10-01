// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import TimeUnitEditor from '../components/workbench/panels/score-object/TimeUnitEditor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it('keeps a skipped DF label visible with feedback and no durable commit', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onCommit = vi.fn();
  try {
    act(() =>
      root.render(
        <TimeUnitEditor
          valueBeats={60.065}
          timeBase="SMPTE"
          durationMode={false}
          timeContext={{
            meterEntries: [],
            tempoEnabled: false,
            initialTempo: 60,
            sampleRate: 44100,
            smpteFrameRate: 29.97,
            smpteDropFrame: true,
          }}
          onCommit={onCommit}
        />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('00:01:00;02');
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onCommit).not.toHaveBeenCalled();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        '00:01:00;00',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('00:01:00;00');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('counting mode');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
