// @vitest-environment jsdom

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

import { BlueX7TabList, type BlueX7TabItem } from '../components/instruments/blue-x7/tab-list';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlueX7 A11y, Keyboard Navigation & Responsive Layout', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onInstrumentPatch = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onInstrumentPatch.mockClear();
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
  });

  const createSnapshot = (): BlueX7InstrumentSnapshot => ({
    id: 'test-x7',
    assignmentId: '1',
    type: 'blueX7',
    name: 'A11y Test Instrument',
    comment: 'Testing accessibility and responsiveness',
    enabled: true,
    voice: createDefaultBlueX7Voice(),
  });

  it('provides accessible names and ARIA attributes for all controls and panels', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
    });

    // Inputs with accessible names
    expect(container?.querySelector('input[aria-label="Instrument Name"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Instrument Enabled"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Instrument Comment"]')).not.toBeNull();
    expect(container?.querySelector('button[aria-label="Import DX7 SysEx File"]')).not.toBeNull();
    expect(container?.querySelector('button[aria-label="Undo BlueX7 edit"]')).not.toBeNull();
    expect(container?.querySelector('button[aria-label="Redo BlueX7 edit"]')).not.toBeNull();

    // Common panel
    expect(container?.querySelector('[role="combobox"][aria-label="Algorithm"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Feedback"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Key Transpose"]')).not.toBeNull();

    // Operator tabs & enables
    for (let i = 1; i <= 6; i++) {
      expect(container?.querySelector(`button[aria-label="Select Operator ${i}"]`)).not.toBeNull();
      expect(container?.querySelector(`button[aria-label="Toggle Operator ${i}"]`)).not.toBeNull();
    }
  });

  it('supports modal focus trap and escape key restoration for Algorithm dialog', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
    });

    const openModalBtn = container?.querySelector('button[aria-label="Choose Algorithm Dialog"]') as HTMLButtonElement;
    expect(openModalBtn).not.toBeNull();

    act(() => {
      openModalBtn.focus();
      openModalBtn.click();
    });

    const dialog = document.body.querySelector('[role="dialog"][aria-label="Select DX7 Algorithm"]');
    expect(dialog).not.toBeNull();
    const closeButton = dialog?.querySelector('button[aria-label="Close Algorithm Dialog"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);

    const dialogPanel = dialog?.querySelector('.flex.flex-col') as HTMLElement;
    const footerCloseButton = dialog?.querySelector('button:not([aria-label])') as HTMLButtonElement;
    footerCloseButton.focus();
    act(() => {
      dialogPanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(closeButton);

    // Escape closes dialog
    act(() => {
      dialogPanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    const closedDialog = document.body.querySelector('[role="dialog"][aria-label="Select DX7 Algorithm"]');
    expect(closedDialog).toBeNull();
    expect(document.activeElement).toBe(openModalBtn);
  });

  it('renders within narrow 360px container without throwing or breaking layout', () => {
    const snapshot = createSnapshot();
    if (container) {
      container.style.width = '360px';
      container.style.height = '600px';
    }

    act(() => {
      root?.render(
        <div style={{ width: '360px', height: '600px', overflow: 'hidden' }}>
          <BlueX7Editor
            instrument={snapshot}
            onInstrumentPatch={onInstrumentPatch}
          />
        </div>,
      );
    });

    const editorRoot = container?.querySelector('[data-testid="blue-x7-editor"]');
    expect(editorRoot).not.toBeNull();
    expect(editorRoot?.classList.contains('overflow-hidden')).toBe(true);

    const activePanel = container?.querySelector('[data-testid="bluex7-panel-global"]');
    expect(activePanel).not.toBeNull();
    expect(activePanel?.classList.contains('overflow-y-auto')).toBe(true);
  });
});

describe('BlueX7TabList primitive contract', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onSelectTab = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onSelectTab.mockClear();
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
  });

  const testTabs: readonly BlueX7TabItem<string>[] = [
    { key: 'first', label: 'First Tab', ariaLabel: 'First Tab Label' },
    { key: 'second', label: 'Second Tab', ariaLabel: 'Second Tab Label' },
    { key: 'third', label: 'Third Tab', ariaLabel: 'Third Tab Label' },
  ];

  it('renders with role="tablist", aria-label, and proper tab roles/attributes', () => {
    act(() => {
      root?.render(
        <BlueX7TabList
          instanceId="test-inst"
          ariaLabel="Test Tab List"
          tabs={testTabs}
          activeTab="first"
          onSelectTab={onSelectTab}
        />,
      );
    });

    const tablist = container?.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    expect(tablist?.getAttribute('aria-label')).toBe('Test Tab List');

    const tabs = container?.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(3);

    // Tab 1: active
    expect(tabs?.[0].getAttribute('id')).toBe('test-inst-tab-first');
    expect(tabs?.[0].getAttribute('aria-controls')).toBe('test-inst-panel-first');
    expect(tabs?.[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs?.[0].getAttribute('tabindex')).toBe('0');

    // Tab 2: inactive
    expect(tabs?.[1].getAttribute('id')).toBe('test-inst-tab-second');
    expect(tabs?.[1].getAttribute('aria-controls')).toBe('test-inst-panel-second');
    expect(tabs?.[1].getAttribute('aria-selected')).toBe('false');
    expect(tabs?.[1].getAttribute('tabindex')).toBe('-1');

    // Tab 3: inactive
    expect(tabs?.[2].getAttribute('id')).toBe('test-inst-tab-third');
    expect(tabs?.[2].getAttribute('aria-controls')).toBe('test-inst-panel-third');
    expect(tabs?.[2].getAttribute('aria-selected')).toBe('false');
    expect(tabs?.[2].getAttribute('tabindex')).toBe('-1');
  });

  it('supports manual activation: arrow keys move roving focus with wraparound without triggering onSelectTab', () => {
    act(() => {
      root?.render(
        <BlueX7TabList
          instanceId="test-inst"
          ariaLabel="Test Tab List"
          tabs={testTabs}
          activeTab="first"
          onSelectTab={onSelectTab}
        />,
      );
    });

    const tabs = container?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs).toBeDefined();
    if (!tabs) return;

    // Initially first tab is focused (tabIndex=0)
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');

    // Press ArrowRight on first tab
    act(() => {
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    // onSelectTab should NOT be called (manual activation)
    expect(onSelectTab).not.toHaveBeenCalled();

    // Now second tab has roving tabIndex=0, first has -1
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(tabs[2].getAttribute('tabindex')).toBe('-1');

    // Press ArrowLeft on second tab -> moves back to first tab
    act(() => {
      tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(onSelectTab).not.toHaveBeenCalled();
    expect(tabs[0].getAttribute('tabindex')).toBe('0');

    // Press ArrowLeft on first tab -> wraps around to third tab
    act(() => {
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(onSelectTab).not.toHaveBeenCalled();
    expect(tabs[2].getAttribute('tabindex')).toBe('0');

    // Press ArrowRight on third tab -> wraps around to first tab
    act(() => {
      tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onSelectTab).not.toHaveBeenCalled();
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
  });

  it('activates focused tab on Enter, Space, and Click', () => {
    act(() => {
      root?.render(
        <BlueX7TabList
          instanceId="test-inst"
          ariaLabel="Test Tab List"
          tabs={testTabs}
          activeTab="first"
          onSelectTab={onSelectTab}
        />,
      );
    });

    const tabs = container?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (!tabs) return;

    // Move focus to second tab via ArrowRight
    act(() => {
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onSelectTab).not.toHaveBeenCalled();

    // Press Enter on second tab
    act(() => {
      tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onSelectTab).toHaveBeenCalledTimes(1);
    expect(onSelectTab).toHaveBeenCalledWith('second');

    // Move focus to third tab via ArrowRight
    act(() => {
      tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    // Press Space on third tab
    act(() => {
      tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(onSelectTab).toHaveBeenCalledTimes(2);
    expect(onSelectTab).toHaveBeenCalledWith('third');

    // Click on first tab
    act(() => {
      tabs[0].click();
    });
    expect(onSelectTab).toHaveBeenCalledTimes(3);
    expect(onSelectTab).toHaveBeenCalledWith('first');
  });
});

describe('BlueX7Editor — US1 Top-Level Tab/Panel ARIA & Layout Integration', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onInstrumentPatch = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onInstrumentPatch.mockClear();
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
  });

  const createSnapshot = (): BlueX7InstrumentSnapshot => ({
    id: 'test-x7',
    assignmentId: 'assign-42',
    type: 'blueX7',
    name: 'Tab A11y Instrument',
    comment: 'Testing tab accessibility',
    enabled: true,
    voice: createDefaultBlueX7Voice(),
  });

  it('connects top-level tabs to tabpanels via generated aria-controls and aria-labelledby', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
    });

    const tabKeys = ['global', 'operators', 'pitch', 'csound'];

    for (const key of tabKeys) {
      const tab = container?.querySelector(`[role="tab"][data-testid="tab-${key}"]`);
      expect(tab).not.toBeNull();
      const tabId = tab?.getAttribute('id');
      const panelId = tab?.getAttribute('aria-controls');
      expect(tabId).toBeTruthy();
      expect(panelId).toBeTruthy();

      const panel = container?.querySelector(`[role="tabpanel"][id="${panelId}"]`);
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute('aria-labelledby')).toBe(tabId);
    }
  });

  it('excludes inactive panels from accessibility and pointer events', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
    });

    const globalPanel = container?.querySelector('[data-testid="bluex7-panel-global"]') as HTMLElement;
    const operatorsPanel = container?.querySelector('[data-testid="bluex7-panel-operators"]') as HTMLElement;

    // Active panel
    expect(globalPanel.getAttribute('aria-hidden')).toBe('false');
    expect(globalPanel.style.visibility).toBe('visible');
    expect(globalPanel.classList.contains('pointer-events-none')).toBe(false);

    // Inactive panels and their nested sub-tabs
    expect(operatorsPanel.getAttribute('aria-hidden')).toBe('true');
    expect(operatorsPanel.style.visibility).toBe('hidden');
    expect(operatorsPanel.classList.contains('pointer-events-none')).toBe(true);

    const pitchPanel = container?.querySelector('[data-testid="bluex7-panel-pitch"]') as HTMLElement;
    expect(pitchPanel.getAttribute('aria-hidden')).toBe('true');
    expect(pitchPanel.style.visibility).toBe('hidden');
    expect(pitchPanel.classList.contains('pointer-events-none')).toBe(true);

    const csoundPanel = container?.querySelector('[data-testid="bluex7-panel-csound"]') as HTMLElement;
    expect(csoundPanel.getAttribute('aria-hidden')).toBe('true');
    expect(csoundPanel.style.visibility).toBe('hidden');
    expect(csoundPanel.classList.contains('pointer-events-none')).toBe(true);
  });

  it('maintains a one-row horizontal tablist with overflow-x-auto in narrow 360px host', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <div style={{ width: '360px', height: '600px' }}>
          <BlueX7Editor
            instrument={snapshot}
            onInstrumentPatch={onInstrumentPatch}
          />
        </div>,
      );
    });

    const tablist = container?.querySelector('[role="tablist"][aria-label="Instrument Sections"]');
    expect(tablist).not.toBeNull();
    expect(tablist?.classList.contains('overflow-x-auto')).toBe(true);
    expect(tablist?.classList.contains('flex-nowrap')).toBe(true);
  });

  it('exposes nested operator tablist ARIA relationships and roving focus', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
    });

    // Switch to Operators tab
    const operatorsTab = container?.querySelector('[role="tab"][data-testid="tab-operators"]') as HTMLButtonElement;
    act(() => {
      operatorsTab.click();
    });

    const opTablist = container?.querySelector('[role="tablist"][aria-label="Operator Selector"]');
    expect(opTablist).not.toBeNull();

    const opTabs = opTablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(opTabs).toHaveLength(6);

    // Op 1 selected
    expect(opTabs?.[0].getAttribute('aria-selected')).toBe('true');
    expect(opTabs?.[0].getAttribute('tabindex')).toBe('0');
    expect(opTabs?.[1].getAttribute('aria-selected')).toBe('false');
    expect(opTabs?.[1].getAttribute('tabindex')).toBe('-1');

    const op1PanelId = opTabs?.[0].getAttribute('aria-controls');
    expect(op1PanelId).toBeTruthy();

    const workstationPanel = container?.querySelector(`[role="tabpanel"][id="${op1PanelId}"]`);
    expect(workstationPanel).not.toBeNull();
    expect(workstationPanel?.getAttribute('aria-labelledby')).toBe(opTabs?.[0].getAttribute('id'));

    // Move focus to Op 2 via ArrowRight on Op 1
    if (opTabs) {
      act(() => {
        opTabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      expect(opTabs[0].getAttribute('tabindex')).toBe('-1');
      expect(opTabs[1].getAttribute('tabindex')).toBe('0');

      // Enter activates Op 2
      act(() => {
        opTabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(opTabs[1].getAttribute('aria-selected')).toBe('true');
      expect(opTabs[0].getAttribute('aria-selected')).toBe('false');
    }
  });
});
