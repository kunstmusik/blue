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
  it('keeps every panel measurable and reachable in the desktop viewport', async () => {
    const rendered = mount(1000, 760);

    try {
      await act(async () => {
        await flushFrame();
      });

      const editor = rendered.container.querySelector('[data-testid="blue-x7-editor"]') as HTMLDivElement;
      expect(editor.getBoundingClientRect().width).toBeGreaterThan(0);

      for (const testId of [
        'bluex7-common-panel',
        'bluex7-lfo-panel',
        'bluex7-operator-panel',
        'bluex7-peg-panel',
        'bluex7-csound-panel',
      ]) {
        const panel = rendered.container.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
        const rect = panel.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        expect(rect.width, testId).toBeGreaterThan(0);
        expect(rect.left, testId).toBeGreaterThanOrEqual(editorRect.left - 1);
        expect(rect.right, testId).toBeLessThanOrEqual(editorRect.right + 1);
      }

      editor.scrollTop = editor.scrollHeight;
      await act(async () => {
        await flushFrame();
      });
      const csoundRect = (rendered.container.querySelector('[data-testid="bluex7-csound-panel"]') as HTMLElement).getBoundingClientRect();
      expect(csoundRect.bottom).toBeLessThanOrEqual(editor.getBoundingClientRect().bottom + 1);
    } finally {
      rendered.unmount();
    }
  });

  it('does not introduce horizontal overflow in a narrow host', async () => {
    if (window.innerWidth > 500) return;
    const rendered = mount(360, 600);

    try {
      await act(async () => {
        await flushFrame();
      });

      const editor = rendered.container.querySelector('[data-testid="blue-x7-editor"]') as HTMLDivElement;
      expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth + 1);
      const pms = rendered.container.querySelector('#bluex7-shared-pms') as HTMLInputElement;
      expect(pms.getBoundingClientRect().right).toBeLessThanOrEqual(editor.getBoundingClientRect().right + 1);
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
});
