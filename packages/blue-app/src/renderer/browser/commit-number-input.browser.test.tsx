import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CommitNumberInput, { DraftNumberInput } from '../components/CommitNumberInput';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('CommitNumberInput Browser Native & Popout Tests (T006, T010)', () => {
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

  describe('T006: Owner-document and secondary-window realm fixture', () => {
    let iframe: HTMLIFrameElement;
    let iframeRoot: Root | null = null;
    let iframeContainer: HTMLDivElement | null = null;

    beforeEach(async () => {
      iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      // Wait for iframe document to be ready
      await new Promise((resolve) => setTimeout(resolve, 50));
      const iframeDoc = iframe.contentDocument!;
      iframeContainer = iframeDoc.createElement('div');
      iframeDoc.body.appendChild(iframeContainer);
      iframeRoot = createRoot(iframeContainer);
    });

    afterEach(() => {
      if (iframeRoot) {
        act(() => iframeRoot!.unmount());
      }
      iframe.remove();
    });

    it('creates detached step elements in the hosting ownerDocument, not main document', () => {
      const onChange = vi.fn();
      const iframeDoc = iframe.contentDocument!;
      const mainDocCreateElement = vi.spyOn(document, 'createElement');
      const iframeDocCreateElement = vi.spyOn(iframeDoc, 'createElement');

      act(() => {
        iframeRoot!.render(<CommitNumberInput value={10} step={1} onChange={onChange} />);
      });

      const input = iframeContainer!.querySelector('input')!;
      expect(input.ownerDocument).toBe(iframeDoc);
      expect(input.ownerDocument).not.toBe(document);

      // Verify that step button click functions inside secondary document
      const increaseBtn = iframeContainer!.querySelector<HTMLButtonElement>(
        'button[aria-label="Increase"]',
      );
      if (increaseBtn) {
        act(() => {
          increaseBtn.click();
        });
        expect(onChange).toHaveBeenCalledWith(11);
      }

      // Must have used iframeDoc.createElement('input'), never document.createElement('input')
      expect(iframeDocCreateElement).toHaveBeenCalledWith('input');
      expect(mainDocCreateElement).not.toHaveBeenCalledWith('input');
      mainDocCreateElement.mockRestore();
      iframeDocCreateElement.mockRestore();
    });
  });

  describe('T010: Browser event order, focus retention, and native stepping', () => {
    it('retains input focus when clicking Increase/Decrease buttons', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={10} step={1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      input.focus();
      expect(document.activeElement).toBe(input);

      const increaseBtn = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Increase"]',
      );
      if (increaseBtn) {
        // pointerdown on button prevents focus shift
        const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
        increaseBtn.dispatchEvent(pointerDown);
        expect(pointerDown.defaultPrevented).toBe(true);

        act(() => {
          increaseBtn.click();
        });

        // Input should still be active element
        expect(document.activeElement).toBe(input);
        expect(onChange).toHaveBeenCalledWith(11);
      }
    });

    it('steps immediately without needing blur on ArrowUp / ArrowDown', () => {
      const history: number[] = [];
      const onChange = vi.fn((v: number) => {
        history.push(v);
      });

      act(() => {
        root.render(<CommitNumberInput value={1.0} step={0.1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      input.focus();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(history[0]).toBeCloseTo(1.1);

      // Verify input did not blur
      expect(document.activeElement).toBe(input);
    });

    it('handles step="any" with 1-increment anchored at decimal value', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={1.25} step="any" onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith(2.25);
    });

    it('honors nonzero native step base (min=1, step=2 => 1->3->5)', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={1} min={1} step={2} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('keeps the initial value step base across repeated off-grid ArrowUp events', () => {
      const history: number[] = [];

      function Harness(): React.ReactElement {
        const [value, setValue] = React.useState(1.25);
        return (
          <CommitNumberInput
            value={value}
            step={0.5}
            onChange={(next) => {
              history.push(next);
              setValue(next);
            }}
          />
        );
      }

      act(() => {
        root.render(<Harness />);
      });

      const input = container.querySelector('input')!;
      input.focus();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      act(() => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, repeat: true }),
        );
      });
      act(() => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, repeat: true }),
        );
      });

      expect(history).toEqual([1.75, 2.25, 2.75]);
      expect(input.value).toBe('2.75');
    });

    it('draft mode button stepping updates text draft without losing focus', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<DraftNumberInput value="15" stepBase={15} step={1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      input.focus();
      expect(document.activeElement).toBe(input);

      const increaseBtn = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Increase"]',
      );
      expect(increaseBtn).not.toBeNull();
      act(() => {
        increaseBtn!.click();
      });

      expect(onChange).toHaveBeenCalledWith('16');
      expect(document.activeElement).toBe(input);
    });
  });
});
