// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueX7, Element, createDefaultBlueX7Voice } from '@blue/data';
import { CsoundPanel } from '../components/instruments/blue-x7/csound-panel';

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Csound Post Code"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('CsoundPanel & Live Csound Preview', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onApplyPatch = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onApplyPatch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
    vi.useRealTimers();
  });

  it('renders post code editor tab and dispatches patches', () => {
    const voice = createDefaultBlueX7Voice();
    voice.csoundPostCode = 'blueMixerOut aout, aout';

    act(() => {
      root?.render(
        <CsoundPanel
          voice={voice}
          instrumentName="TestX7"
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const textarea = container?.querySelector('textarea[aria-label="Csound Post Code"]') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('blueMixerOut aout, aout');

    act(() => {
      setInputValue(textarea, 'outs aout, aout');
    });

    expect(onApplyPatch).toHaveBeenCalledWith('Edit Csound Post-Code', {
      type: 'setCsoundPostCode',
      text: 'outs aout, aout',
    });
  });

  it('renders live generated Csound preview on tab switch within debounce latency', async () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 5;

    act(() => {
      root?.render(
        <CsoundPanel
          voice={voice}
          instrumentName="FM_Lead"
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    // Switch to preview tab
    const previewTabBtn = container?.querySelector('button[aria-label="Csound Preview Tab"]') as HTMLButtonElement;
    act(() => {
      previewTabBtn.click();
    });

    // Advance debounce timer
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const tablesPreview = container?.querySelector('[data-testid="csound-tables-preview"]');
    const bodyPreview = container?.querySelector('[data-testid="csound-body-preview"]');

    // the modern renderer: static array target in the preview, with no live
    // transport ftable publication in the preview path
    expect(tablesPreview?.textContent).toBe('');
    expect(bodyPreview?.textContent).toContain(
      'iBlueX7MidiNote = (p4 < 15 ? ftom:i(cpspch:i(p4)) : ftom:i(p4))',
    );
    expect(bodyPreview?.textContent).toContain('aout = bluex7_voice(');
    expect(bodyPreview?.textContent).toContain('iBlueX7GateSeconds = abs(p3)');
    expect(bodyPreview?.textContent).not.toContain('tabw');
    expect(bodyPreview?.textContent).not.toContain('chnget');
  });

  it('renders truthful binding diagnostics report distinguishing emitted vs dormant parameters', () => {
    const voice = createDefaultBlueX7Voice();

    act(() => {
      root?.render(
        <CsoundPanel
          voice={voice}
          instrumentName="FM_Pad"
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const bindingsTabBtn = container?.querySelector('button[aria-label="Csound Bindings Tab"]') as HTMLButtonElement;
    act(() => {
      bindingsTabBtn.click();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const bindingsPanel = container?.querySelector('[data-testid="bluex7-bindings-tab"]');
    // every modern sound-relevant field is reported with its update class
    expect(bindingsPanel?.textContent).toContain('Emitted Synthesis Parameters');
    expect(bindingsPanel?.textContent).toContain('common.algorithm');
    expect(bindingsPanel?.textContent).toContain('[next-note]');
    expect(bindingsPanel?.textContent).toContain('common.oscillatorKeySync');
    expect(bindingsPanel?.textContent).toContain('lfo.sync');
    expect(bindingsPanel?.textContent).toContain('operator.1.outputLevel');
    expect(bindingsPanel?.textContent).toContain('pitchEnvelope.4.level');
    expect(bindingsPanel?.textContent).toContain('[active-note]');
    // legacy dormant-field claims are rejected: key transpose participates via
    // the direct-global voice-slot mapping and only nonsynthesized name bytes
    // are reported
    expect(bindingsPanel?.textContent).toContain('common.transpose');
    expect(bindingsPanel?.textContent).toContain('Not Synthesized (Outside Parameter Scope)');
    expect(bindingsPanel?.textContent).toContain('voice-name bytes');
    expect(bindingsPanel?.textContent).not.toContain('Dormant');
    expect(bindingsPanel?.textContent).not.toContain('not referenced in Pinkston ORC');
  });

  it('refreshes the preview after the final edit within the 500ms FR-018 budget', async () => {
    const initialVoice = createDefaultBlueX7Voice();
    initialVoice.csoundPostCode = 'blueMixerOut aout, aout';

    act(() => {
      root?.render(
        <CsoundPanel
          voice={initialVoice}
          instrumentName="FM_Lead"
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const previewTabBtn = container?.querySelector('button[aria-label="Csound Preview Tab"]') as HTMLButtonElement;
    act(() => {
      previewTabBtn.click();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const bodyPreview = () => container?.querySelector('[data-testid="csound-body-preview"]')?.textContent ?? '';
    expect(bodyPreview()).toContain('blueMixerOut aout, aout');

    // Final edit in the sequence: post code changes
    const editedVoice = createDefaultBlueX7Voice();
    editedVoice.csoundPostCode = 'outs aout * 0.5, aout * 0.5';
    act(() => {
      root?.render(
        <CsoundPanel
          voice={editedVoice}
          instrumentName="FM_Lead"
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    // Before the debounce elapses the preview must still show the previous
    // state (no stale flicker, no premature update)
    act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(bodyPreview()).toContain('blueMixerOut aout, aout');
    expect(bodyPreview()).not.toContain('outs aout * 0.5');

    // By 500ms after the final edit the preview must reflect it (FR-018)
    act(() => {
      vi.advanceTimersByTime(451);
    });
    expect(bodyPreview()).toContain('outs aout * 0.5, aout * 0.5');
    expect(bodyPreview()).not.toContain('blueMixerOut aout, aout');
  });

  it('reports modern active/next-note bindings after reopening a legacy fixture', () => {
    const fixture = readFileSync(
      join(__dirname, '../../../../blue-data/src/instruments/blue-x7/test-fixtures/java-default.blue.xml'),
      'utf8',
    );
    const migrated = BlueX7.loadFromXML(Element.parse(fixture));
    const reopened = BlueX7.loadFromXML(Element.parse(migrated.saveAsXML().toXml()));

    act(() => {
      root?.render(
        <CsoundPanel
          voice={reopened.getVoice()}
          instrumentName="Migrated_Java_X7"
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const previewTab = container?.querySelector('button[aria-label="Csound Preview Tab"]') as HTMLButtonElement;
    act(() => {
      previewTab.click();
      vi.advanceTimersByTime(100);
    });
    // Live values are exported through direct globals; the generated target
    // does not publish a per-voice transport table in the preview.
    expect(container?.querySelector('[data-testid="csound-tables-preview"]')?.textContent)
      .toBe('');
    expect(container?.querySelector('[data-testid="csound-body-preview"]')?.textContent)
      .toContain('bluex7_voice(');

    const bindingsTab = container?.querySelector('button[aria-label="Csound Bindings Tab"]') as HTMLButtonElement;
    act(() => {
      bindingsTab.click();
      vi.advanceTimersByTime(100);
    });
    const report = container?.querySelector('[data-testid="bluex7-bindings-tab"]')?.textContent ?? '';
    expect(report).toContain('[active-note]');
    expect(report).toContain('[next-note]');
    expect(report).not.toContain('stored-only');
    expect(report).not.toContain('Dormant');
  });
});
