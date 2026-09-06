// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rendererToastOptions } from '../lib/toast-styles';
import MidiSettings from '../components/settings/MidiSettings';
import RealtimeRenderSettings from '../components/settings/RealtimeRenderSettings';
import LiveSpaceTab from '../components/workbench/panels/blue-live/LiveSpaceTab';
import ReplConsolePanel from '../components/workbench/panels/repl-console/ReplConsolePanel';
import PatternLayerHeader from '../components/workbench/panels/score/PatternLayerHeader';
import { useMidiInputStore } from '../stores/midi-input-store';
import { useBlueLiveStore } from '../stores/blue-live-store';
import { useProjectStore } from '../stores/project-store';
import { createDefaultRealtimeRenderSettings } from '../../shared/program-settings';
import type { PatternLayerSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Status Accessibility & Non-Color Cues (US4)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('Shared toast styling and semantic options (T045)', () => {
    it('defines toastOptions with governed semantic CSS variables and status classes', () => {
      expect(rendererToastOptions).toBeDefined();
      expect(rendererToastOptions.style).toBeDefined();
      expect(rendererToastOptions.style?.background).toContain('var(--color-app-surface)');
      expect(rendererToastOptions.style?.border).toContain('var(--color-app-border)');
      expect(rendererToastOptions.style?.color).toContain('var(--color-app-text-bright)');
      expect(rendererToastOptions.classNames?.toast).toBeDefined();
    });
  });

  describe('MIDI Settings status indications (T046)', () => {
    it('renders phase status badge with live region and non-color cue', () => {
      useMidiInputStore.setState({
        snapshot: {
          instanceId: 'test-instance',
          revision: 1,
          phase: 'ready',
          devices: [],
          message: null,
          updatedAt: 0,
        },
        draftMidiInput: {
          devices: [],
        },
      });

      act(() => {
        root.render(<MidiSettings />);
      });

      const liveRegion = container.querySelector('[role="status"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite');

      const badge = container.querySelector('span.rounded-full');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('ready');
      expect(badge?.textContent).toMatch(/[✓●⚠]/);
    });

    it('renders connection status in device table with readable text and non-color cues', () => {
      useMidiInputStore.setState({
        snapshot: {
          instanceId: 'test-instance',
          revision: 2,
          phase: 'ready',
          devices: [
            {
              id: 'dev-1',
              name: 'KeyLab Essential',
              manufacturer: 'Arturia',
              version: '1.0',
              enabled: true,
              availability: 'available',
              connection: 'connected',
              lastError: '',
            },
          ],
          message: null,
          updatedAt: 0,
        },
        draftMidiInput: {
          devices: [
            {
              id: 'dev-1',
              name: 'KeyLab Essential',
              manufacturer: 'Arturia',
              version: '1.0',
              enabled: true,
            },
          ],
        },
      });

      act(() => {
        root.render(<MidiSettings />);
      });

      const statusCell = container.querySelector('td span.rounded-full');
      expect(statusCell).not.toBeNull();
      expect(statusCell?.textContent).toContain('connected');
      expect(statusCell?.textContent).toMatch(/[✓●⚠]/);
    });
  });

  describe('Realtime Render Settings probe status (T046)', () => {
    const defaultSettings = createDefaultRealtimeRenderSettings('darwin');

    it('renders probe status with role="status", aria-live="polite", and visible non-color cues', async () => {
      (window as unknown as { blueAPI: unknown }).blueAPI = {
        probeEngineRuntime: vi.fn().mockResolvedValue({
          ok: true,
          message: 'Engine operational',
          selection: { source: 'bundled', executablePath: '/bin/blue-engine' },
          report: null,
        }),
        queryCsoundIo: vi.fn().mockResolvedValue(null),
      };

      act(() => {
        root.render(
          <RealtimeRenderSettings
            settings={defaultSettings}
            enginePath="blue-engine"
            onChange={vi.fn()}
            onEnginePathChange={vi.fn()}
          />,
        );
      });

      const checkButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((btn) =>
        btn.textContent?.includes('Check Engine'),
      )!;
      await act(async () => {
        checkButton.click();
        await new Promise((r) => setTimeout(r, 0));
      });

      const statusBox = container.querySelector('[data-testid="probe-status"]');
      expect(statusBox).not.toBeNull();
      expect(statusBox?.getAttribute('aria-live')).toBe('polite');
      expect(statusBox?.textContent).toContain('Engine operational');
      expect(statusBox?.textContent).toMatch(/[✓]|Success/);
    });

    it('renders error probe status with visible warning cue', async () => {
      (window as unknown as { blueAPI: unknown }).blueAPI = {
        probeEngineRuntime: vi.fn().mockResolvedValue({
          ok: false,
          message: 'Csound library not found',
          selection: null,
          report: null,
        }),
        queryCsoundIo: vi.fn().mockResolvedValue(null),
      };

      act(() => {
        root.render(
          <RealtimeRenderSettings
            settings={defaultSettings}
            enginePath="blue-engine"
            onChange={vi.fn()}
            onEnginePathChange={vi.fn()}
          />,
        );
      });

      const checkButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((btn) =>
        btn.textContent?.includes('Check Engine'),
      )!;
      await act(async () => {
        checkButton.click();
        await new Promise((r) => setTimeout(r, 0));
      });

      const statusBox = container.querySelector('[data-testid="probe-status"]');
      expect(statusBox).not.toBeNull();
      expect(statusBox?.getAttribute('aria-live')).toBe('polite');
      expect(statusBox?.textContent).toContain('Csound library not found');
      expect(statusBox?.textContent).toMatch(/[⚠]|Error/);
    });
  });

  describe('Live Space trigger feedback status (T047)', () => {
    it('exposes role="status", aria-live="polite", and non-color cues for trigger status', () => {
      useProjectStore.setState({
        loaded: true,
        blueLive: {
          bins: {
            columns: 2,
            rows: 2,
            cells: [
              [null, null],
              [null, null],
            ],
          },
          sets: [],
          tempo: 120,
          repeat: 1,
          repeatEnabled: false,
        } as unknown as ReturnType<typeof useProjectStore.getState>['blueLive'],
      });
      useBlueLiveStore.setState({
        running: true,
        trigger: {
          status: 'error',
          token: 1,
          message: 'Failed to compile cell code',
        },
      });

      act(() => {
        root.render(<LiveSpaceTab />);
      });

      const status = container.querySelector('[role="status"]');
      expect(status).not.toBeNull();
      expect(status?.getAttribute('aria-live')).toBe('polite');
      expect(status?.textContent).toContain('Failed to compile cell code');
      expect(status?.textContent).toMatch(/[⚠]|Error/);
    });
  });

  describe('REPL Console status and output formatting (T047)', () => {
    it('provides status indication with role="status" and non-color cue in header', async () => {
      (window as unknown as { blueAPI: unknown }).blueAPI = {
        openReplConsole: vi.fn().mockResolvedValue({
          project: { sessionId: 'test', label: 'Test Project', loaded: true },
          runtime: 'ready',
          error: null,
        }),
      };

      await act(async () => {
        root.render(<ReplConsolePanel language="javascript" />);
        await new Promise((r) => setTimeout(r, 10));
      });

      const status = container.querySelector('[role="status"]');
      expect(status).not.toBeNull();
      expect(status?.getAttribute('aria-live')).toBe('polite');
      expect(status?.textContent).toMatch(/[●✓]|Connected|Ready/);
    });
  });

  describe('Score Mute and Solo toggles without color alone (T048)', () => {
    const mockLayer: PatternLayerSnapshot = {
      layerId: 'layer-1',
      name: 'Synth Track',
      muted: true,
      solo: false,
      height: 60,
      backgroundColor: -65536,
      items: [],
      activeCellIndices: [],
      sourceObject: {
        objectId: 'obj-1',
        name: 'Pattern Source',
        soundObjects: [],
      } as unknown as PatternLayerSnapshot['sourceObject'],
    };

    const headerProps = {
      groupId: 'group-1',
      layerIndex: 0,
      layerCount: 1,
    };

    it('PatternLayerHeader Mute button has aria-pressed, distinct label, and visible glyph', () => {
      act(() => {
        root.render(<PatternLayerHeader layer={mockLayer} {...headerProps} />);
      });

      const muteBtn = container.querySelector<HTMLButtonElement>(
        'button[title="Mute pattern layer"]',
      )!;
      expect(muteBtn).not.toBeNull();
      expect(muteBtn.getAttribute('aria-pressed')).toBe('true');
      expect(muteBtn.getAttribute('aria-label')).toBe('Unmute pattern layer Synth Track');
      expect(muteBtn.textContent?.trim()).toBe('M');
      expect(muteBtn.className).toContain('bg-app-warning');
      expect(muteBtn.className).toContain('text-app-warning-foreground');

      const soloBtn = container.querySelector<HTMLButtonElement>(
        'button[title="Solo pattern layer"]',
      )!;
      expect(soloBtn).not.toBeNull();
      expect(soloBtn.getAttribute('aria-pressed')).toBe('false');
      expect(soloBtn.getAttribute('aria-label')).toBe('Solo pattern layer Synth Track');
      expect(soloBtn.textContent?.trim()).toBe('S');
      expect(soloBtn.className).toContain('bg-transparent');
    });

    it('Mute and Solo buttons provide distinct active/inactive visual cues and focus indicators', () => {
      act(() => {
        root.render(
          <PatternLayerHeader
            layer={{
              ...mockLayer,
              muted: false,
              solo: true,
            }}
            {...headerProps}
          />,
        );
      });

      const muteBtn = container.querySelector<HTMLButtonElement>(
        'button[title="Mute pattern layer"]',
      )!;
      const soloBtn = container.querySelector<HTMLButtonElement>(
        'button[title="Solo pattern layer"]',
      )!;

      // Inactive Mute: hollow, transparent background, aria-pressed false
      expect(muteBtn.getAttribute('aria-pressed')).toBe('false');
      expect(muteBtn.className).toContain('bg-transparent');
      expect(muteBtn.className).toContain('text-app-text-muted');
      expect(muteBtn.className).toContain('focus-visible:ring-app-focus');

      // Active Solo: solid fill, high contrast text, aria-pressed true
      expect(soloBtn.getAttribute('aria-pressed')).toBe('true');
      expect(soloBtn.className).toContain('bg-app-success');
      expect(soloBtn.className).toContain('text-app-success-foreground');
      expect(soloBtn.className).toContain('focus-visible:ring-app-focus');
    });
  });
});
