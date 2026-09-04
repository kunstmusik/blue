// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ColorPickerButton from '../components/ColorPicker';
import ScoreObjectBar from '../components/workbench/panels/score/bar-renderers/ScoreObjectBar';
import CommitNumberInput from '../components/workbench/panels/score-object/editors/jmask/CommitNumberInput';
import { ToolbarDisplayCard } from '../components/menu-bar/ToolbarDisplays';
import { BlueX7TabList } from '../components/instruments/blue-x7/tab-list';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Caller className precedence in shared components (US1)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  describe('ColorPickerButton', () => {
    it('allows caller utility to override base utility', () => {
      act(() => {
        root.render(
          <ColorPickerButton value="#ff0000" onChange={() => {}} className="cursor-default" />,
        );
      });
      const btn = container.querySelector('button')!;
      const classList = btn.className.split(/\s+/).filter(Boolean);
      expect(classList).toContain('cursor-default');
      expect(classList).not.toContain('cursor-pointer');
    });

    it('renders clean class list with no caller className', () => {
      act(() => {
        root.render(<ColorPickerButton value="#ff0000" onChange={() => {}} />);
      });
      const btn = container.querySelector('button')!;
      expect(btn.className).toBe('cursor-pointer h-6 w-7 rounded border border-app-border');
      expect(btn.className).not.toContain('undefined');
    });
  });

  describe('ScoreObjectBar', () => {
    it('allows caller utility to override base utility', () => {
      act(() => {
        root.render(
          <ScoreObjectBar
            left={0}
            width={100}
            barHeight={24}
            selected={false}
            backgroundColor={0xff0000}
            className="overflow-visible relative"
          />,
        );
      });
      const el = container.firstElementChild as HTMLElement;
      const classList = el.className.split(/\s+/).filter(Boolean);
      expect(classList).toContain('overflow-visible');
      expect(classList).not.toContain('overflow-hidden');
      expect(classList).toContain('relative');
      expect(classList).not.toContain('absolute');
    });

    it('renders clean class list with no caller className', () => {
      act(() => {
        root.render(
          <ScoreObjectBar
            left={0}
            width={100}
            barHeight={24}
            selected={false}
            backgroundColor={0xff0000}
          />,
        );
      });
      const el = container.firstElementChild as HTMLElement;
      expect(el.className).toBe('absolute overflow-hidden');
    });
  });

  describe('CommitNumberInput', () => {
    it('allows caller utility to override base utility', () => {
      act(() => {
        root.render(<CommitNumberInput value={10} onChange={() => {}} className="w-32" />);
      });
      const input = container.querySelector('input')!;
      const classList = input.className.split(/\s+/).filter(Boolean);
      expect(classList).toContain('w-32');
      expect(classList).not.toContain('w-20');
    });

    it('renders clean class list with no caller className', () => {
      act(() => {
        root.render(<CommitNumberInput value={10} onChange={() => {}} />);
      });
      const input = container.querySelector('input')!;
      expect(input.className).not.toMatch(/\s{2,}/);
      expect(input.className.trim()).toBe(input.className);
    });
  });

  describe('ToolbarDisplayCard', () => {
    it('resolves conflicting utility overrides', () => {
      act(() => {
        root.render(
          <ToolbarDisplayCard title="Test" className="p-2 p-4">
            <span>content</span>
          </ToolbarDisplayCard>,
        );
      });
      const section = container.querySelector('section')!;
      const classList = section.className.split(/\s+/).filter(Boolean);
      expect(classList).toContain('toolbar-display-card');
      expect(classList).toContain('p-4');
      expect(classList).not.toContain('p-2');
    });

    it('renders clean class list with no caller className', () => {
      act(() => {
        root.render(
          <ToolbarDisplayCard title="Test">
            <span>content</span>
          </ToolbarDisplayCard>,
        );
      });
      const section = container.querySelector('section')!;
      expect(section.className).toBe('toolbar-display-card');
    });
  });

  describe('BlueX7TabList', () => {
    const tabs = [{ key: 'tab1', label: 'Tab 1' }];

    it('allows caller utility to override base utility', () => {
      act(() => {
        root.render(
          <BlueX7TabList
            ariaLabel="Test tabs"
            tabs={tabs}
            activeTab="tab1"
            onSelectTab={() => {}}
            className="items-start"
          />,
        );
      });
      const el = container.querySelector('[role="tablist"]')!;
      const classList = el.className.split(/\s+/).filter(Boolean);
      expect(classList).toContain('items-start');
      expect(classList).not.toContain('items-center');
    });

    it('renders clean class list with no caller className', () => {
      act(() => {
        root.render(
          <BlueX7TabList
            ariaLabel="Test tabs"
            tabs={tabs}
            activeTab="tab1"
            onSelectTab={() => {}}
          />,
        );
      });
      const el = container.querySelector('[role="tablist"]')!;
      expect(el.className).not.toContain('undefined');
      expect(el.className).not.toMatch(/\s{2,}/);
      expect(el.className.trim()).toBe(el.className);
    });
  });
});
