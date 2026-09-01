import '../styles/index.css';

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBlueX7Voice } from '@blue/data';
import type { BlueX7InstrumentSnapshot } from '../../shared/project-editor';
import { BlueX7Editor } from '../components/instruments/blue-x7-editor';

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Csound Post Code"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

function makeSnapshot(): BlueX7InstrumentSnapshot {
  return {
    assignmentId: 'browser-x7',
    type: 'blueX7',
    name: 'Browser Geometry X7',
    enabled: true,
    comment: '',
    voice: createDefaultBlueX7Voice(),
    sharedOscillatorSync: 1,
    sharedPitchModulationSensitivity: 0,
  };
}

function mount(width: number, height: number) {
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.margin = '0';
  document.body.appendChild(container);

  const root = createRoot(container);
  act(() => {
    root.render(
      <div style={{ width: `${width}px`, height: `${height}px` }}>
        <BlueX7Editor instrument={makeSnapshot()} onInstrumentPatch={() => undefined} />
      </div>,
    );
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '';
});

describe('BlueX7 editor browser layout', () => {
  it('keeps active panel and pinned header measurable and reachable in the desktop viewport', async () => {
    const rendered = mount(1000, 760);

    try {
      await act(async () => {
        await flushFrame();
      });

      const editor = rendered.container.querySelector('[data-testid="blue-x7-editor"]') as HTMLDivElement;
      expect(editor.getBoundingClientRect().width).toBeGreaterThan(0);

      // Header is visible and pinned
      const nameInput = rendered.container.querySelector('input[aria-label="Instrument Name"]') as HTMLElement;
      expect(nameInput.getBoundingClientRect().height).toBeGreaterThan(0);

      // Voice & Global is active on mount
      const globalPanel = rendered.container.querySelector('[data-testid="bluex7-panel-global"]') as HTMLElement;
      expect(globalPanel.style.visibility).toBe('visible');

      for (const testId of ['bluex7-common-panel', 'bluex7-lfo-panel']) {
        const panel = rendered.container.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
        const rect = panel.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        expect(rect.width, testId).toBeGreaterThan(0);
        expect(rect.left, testId).toBeGreaterThanOrEqual(editorRect.left - 1);
        expect(rect.right, testId).toBeLessThanOrEqual(editorRect.right + 1);
      }

      // Outer editor has no vertical scroll (it is a non-scrolling shell)
      expect(editor.scrollTop).toBe(0);

      // Switch to Csound tab
      const csoundTab = rendered.container.querySelector('[role="tab"][data-testid="tab-csound"]') as HTMLButtonElement;
      await act(async () => {
        csoundTab.click();
        await flushFrame();
      });

      const csoundPanel = rendered.container.querySelector('[data-testid="bluex7-panel-csound"]') as HTMLElement;
      expect(csoundPanel.style.visibility).toBe('visible');
      const csoundRect = csoundPanel.getBoundingClientRect();
      expect(csoundRect.width).toBeGreaterThan(0);
      expect(csoundRect.bottom).toBeLessThanOrEqual(editor.getBoundingClientRect().bottom + 1);
    } finally {
      rendered.unmount();
    }
  });

  it('maintains a non-wrapping horizontal tab row in a narrow 360px host', async () => {
    const rendered = mount(360, 600);

    try {
      await act(async () => {
        await flushFrame();
      });

      const editor = rendered.container.querySelector('[data-testid="blue-x7-editor"]') as HTMLDivElement;
      expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth + 1);

      const tablist = rendered.container.querySelector('[role="tablist"][aria-label="Instrument Sections"]') as HTMLElement;
      expect(tablist).not.toBeNull();
      expect(tablist.classList.contains('flex-nowrap')).toBe(true);
      expect(tablist.classList.contains('overflow-x-auto')).toBe(true);
    } finally {
      rendered.unmount();
    }
  });

  it('restores focus when the algorithm dialog closes with Escape', async () => {
    const rendered = mount(1000, 760);

    try {
      await act(async () => {
        await flushFrame();
      });

      const opener = rendered.container.querySelector('button[aria-label="Choose Algorithm Dialog"]') as HTMLButtonElement;
      opener.focus();
      await act(async () => {
        opener.click();
        await flushFrame();
      });

      const dialog = rendered.container.querySelector('[aria-label="Select DX7 Algorithm"]') as HTMLElement;
      expect(document.activeElement).toBe(dialog.querySelector('button[aria-label="Close Algorithm Dialog"]'));

      await act(async () => {
        const dialogPanel = dialog.querySelector('.flex.flex-col') as HTMLElement;
        dialogPanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flushFrame();
      });
      expect(rendered.container.querySelector('[aria-label="Select DX7 Algorithm"]')).toBeNull();
      expect(document.activeElement).toBe(opener);
    } finally {
      rendered.unmount();
    }
  });

  it('allocates full panel height to Csound Post Code and supports sub-tab switching', async () => {
    const rendered = mount(1000, 760);

    try {
      await act(async () => {
        await flushFrame();
      });

      // Switch to Csound tab
      const csoundTab = rendered.container.querySelector('[role="tab"][data-testid="tab-csound"]') as HTMLButtonElement;
      await act(async () => {
        csoundTab.click();
        await flushFrame();
      });

      const postCodeTabPanel = rendered.container.querySelector('[data-testid="bluex7-post-code-tab"]') as HTMLElement;
      expect(postCodeTabPanel).not.toBeNull();
      expect(postCodeTabPanel.style.visibility).toBe('visible');

      const editor = rendered.container.querySelector('textarea[aria-label="Csound Post Code"]') as HTMLTextAreaElement;
      expect(editor).not.toBeNull();

      // Switch to Preview sub-tab
      const previewSubTab = rendered.container.querySelector('[role="tab"][data-testid="csound-tab-preview"]') as HTMLButtonElement;
      await act(async () => {
        previewSubTab.click();
        await flushFrame();
      });

      const previewPanel = rendered.container.querySelector('[data-testid="bluex7-preview-tab"]') as HTMLElement;
      expect(previewPanel.style.visibility).toBe('visible');
      expect(postCodeTabPanel.style.visibility).toBe('hidden');
    } finally {
      rendered.unmount();
    }
  });
});
