// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CommitNumberInput, {
  CommitNumberField,
  DraftNumberInput,
  LiveNumberInput,
} from '../components/CommitNumberInput';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function changeInputValue(input: HTMLInputElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('CommitNumberInput Contract & Regression (US1)', () => {
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

  describe('T004: Transient state-ownership boundary', () => {
    it('unmounting during dirty edit does not emit uncommitted draft', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={10} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '42');
      });

      expect(onChange).not.toHaveBeenCalled();

      // Component unmounts (e.g. user navigated away or switched selection)
      act(() => {
        root.unmount();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('caller owns persistence; component only notifies onChange on commit', () => {
      const mockProjectPatch = vi.fn();
      const onChange = (v: number) => {
        // Caller chooses when/if to patch project or keep in draft
        mockProjectPatch(v);
      };

      act(() => {
        root.render(<CommitNumberInput value={5} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '15');
      });

      expect(mockProjectPatch).not.toHaveBeenCalled();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      expect(mockProjectPatch).toHaveBeenCalledTimes(1);
      expect(mockProjectPatch).toHaveBeenCalledWith(15);
    });
  });

  describe('T007: Boundary and styling assertions', () => {
    it('applies cn() caller precedence on actual input', () => {
      act(() => {
        root.render(
          <CommitNumberInput value={10} onChange={() => {}} className="w-48 bg-red-500" />,
        );
      });

      const input = container.querySelector('input')!;
      const classList = input.className.split(/\s+/).filter(Boolean);
      expect(classList).toContain('w-48');
      expect(classList).not.toContain('w-20');
      expect(classList).toContain('bg-red-500');
    });

    it('uses text-role-body on the actual input', () => {
      act(() => {
        root.render(<CommitNumberInput value={10} onChange={() => {}} />);
      });

      const input = container.querySelector('input')!;
      expect(input.className).toContain('text-role-body');
    });

    it('CommitNumberField associates label with input', () => {
      act(() => {
        root.render(<CommitNumberField label="Test Label" value={10} onChange={() => {}} />);
      });

      const label = container.querySelector('label')!;
      expect(label.textContent).toBe('Test Label');
      const input = container.querySelector('input')!;
      expect(input).not.toBeNull();
    });

    it('renders native-like stepper widget with hover and focus-within visibility classes', () => {
      act(() => {
        root.render(<CommitNumberInput value={10} onChange={() => {}} />);
      });

      const stepperContainer = container.querySelector(
        'button[aria-label="Increase"]',
      )?.parentElement;
      expect(stepperContainer).not.toBeNull();
      const classList = stepperContainer!.className.split(/\s+/).filter(Boolean);

      expect(classList).toContain('opacity-0');
      expect(classList).toContain('pointer-events-none');
      expect(classList).toContain('group-hover:opacity-100');
      expect(classList).toContain('group-hover:pointer-events-auto');
      expect(classList).toContain('group-focus-within:opacity-100');
      expect(classList).toContain('group-focus-within:pointer-events-auto');
      expect(classList).toContain('bg-[#f1f1f1]');

      const increaseSvg = container.querySelector('button[aria-label="Increase"] svg polygon');
      const decreaseSvg = container.querySelector('button[aria-label="Decrease"] svg polygon');
      expect(increaseSvg).not.toBeNull();
      expect(decreaseSvg).not.toBeNull();

      const increaseBtn = container.querySelector(
        'button[aria-label="Increase"]',
      ) as HTMLButtonElement;
      expect(increaseBtn.className).toContain('hover:bg-[#d2d2d2]');
      expect(increaseBtn.className).toContain('text-[#505050]');
      expect(increaseBtn.className).not.toContain('hover:text-black');
    });

    it('hides stepper container when input is disabled or readOnly', () => {
      act(() => {
        root.render(<CommitNumberInput value={10} disabled={true} onChange={() => {}} />);
      });

      const stepperContainer = container.querySelector(
        'button[aria-label="Increase"]',
      )?.parentElement;
      expect(stepperContainer).not.toBeNull();
      expect(stepperContainer!.className.split(/\s+/)).toContain('hidden');
    });
  });

  describe('T008: Characterizing Enter/blur, Escape/blur, and immediate step behavior', () => {
    it('Enter followed by blur should notify onChange exactly once', () => {
      const history: number[] = [];
      const onChange = vi.fn((v: number) => {
        history.push(v);
      });

      act(() => {
        root.render(<CommitNumberInput value={10} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '25');
      });

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      // The baseline bug: Enter triggers commit(), then blur triggers commit() again
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(history).toEqual([25]);
    });

    it('Escape should cancel draft and NOT emit onChange during subsequent blur', () => {
      const history: number[] = [];
      const onChange = vi.fn((v: number) => {
        history.push(v);
      });

      act(() => {
        root.render(<CommitNumberInput value={10} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '99');
      });

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      // The baseline bug: Escape calls blur(), and onBlur commits '99' because localValue was not updated
      expect(onChange).not.toHaveBeenCalled();
      expect(history).toEqual([]);
      expect(input.value).toBe('10');
    });
  });

  describe('T009: JSDOM contract cases', () => {
    it('deferred typed drafts do not commit until Enter or blur', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={10} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '20');
      });

      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        input.blur();
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(20);
    });

    it('immediate explicit steps notify onChange immediately', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={1.0} step={0.1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1.1);
    });

    it('valid draft base selection: steps from current draft rather than accepted value', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={1} step={1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '5');
      });

      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      // Steps from draft 5 to 6, not from accepted 1 to 2
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(6);
      expect(input.value).toBe('6');
    });

    it('empty draft fallback steps from latest accepted value, not finish-time default', () => {
      const onChange = vi.fn();
      // Suppose finish-time default for empty string is 24 (like PlaybackSettings FPS)
      const resolveValue = (text: string) => {
        if (text.trim() === '') return 24;
        const n = parseInt(text, 10);
        return isNaN(n) ? 24 : n;
      };

      act(() => {
        root.render(
          <CommitNumberInput value={30} step={1} resolveValue={resolveValue} onChange={onChange} />,
        );
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '');
      });

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      // Steps from accepted 30 to 31, NOT from fallback 24 to 25
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(31);
      expect(input.value).toBe('31');
    });

    it('invalid draft fallback steps from latest accepted value', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={1} step={1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, 'xyz');
      });

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      // Steps from accepted 1 to 2
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(2);
      expect(input.value).toBe('2');
    });

    it('rapid steps before rerender emit multiple sequential updates', () => {
      const history: number[] = [];
      const onChange = vi.fn((v: number) => {
        history.push(v);
      });

      // Value stays fixed at 1.0 because parent rerender is not triggered
      act(() => {
        root.render(<CommitNumberInput value={1.0} step={0.1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledTimes(3);
      expect(history[0]).toBeCloseTo(1.1);
      expect(history[1]).toBeCloseTo(1.2);
      expect(history[2]).toBeCloseTo(1.3);
      expect(input.value).toBe('1.3');
    });

    it('bound no-ops emit nothing and do not interfere with subsequent typing', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={10} max={10} step={1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).not.toHaveBeenCalled();

      // Subsequent typing still works
      act(() => {
        changeInputValue(input, '8');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(8);
    });

    it('disabled and readOnly controls reject stepping and typing', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(
          <CommitNumberInput value={10} disabled={true} readOnly={true} onChange={onChange} />,
        );
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).not.toHaveBeenCalled();
      const increaseBtn = container.querySelector(
        'button[aria-label="Increase"]',
      ) as HTMLButtonElement;
      expect(increaseBtn.disabled).toBe(true);
    });

    it('external snapshot reconciliation preserves dirty draft when focused and updates when unfocused', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={10} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      expect(input.value).toBe('10');

      // Update value prop while unfocused -> updates display
      act(() => {
        root.render(<CommitNumberInput value={20} onChange={onChange} />);
      });
      expect(input.value).toBe('20');

      // Focus and type dirty text
      act(() => {
        input.focus();
        changeInputValue(input, '42');
      });
      expect(input.value).toBe('42');

      // External snapshot updates value prop while focused and dirty -> dirty draft is preserved!
      act(() => {
        root.render(<CommitNumberInput value={30} onChange={onChange} />);
      });
      expect(input.value).toBe('42');

      // On blur, commits dirty draft 42
      act(() => {
        input.blur();
      });
      expect(onChange).toHaveBeenCalledWith(42);
    });

    it('Escape returns to last accepted value after step and dirty typing', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={10} step={1} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      // Stepped to 11
      expect(onChange).toHaveBeenCalledWith(11);
      expect(input.value).toBe('11');

      // Now type dirty '99'
      act(() => {
        changeInputValue(input, '99');
      });

      // Press Escape
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      // Returns to last accepted 11
      expect(input.value).toBe('11');
      expect(onChange).toHaveBeenCalledTimes(1); // no second call
    });

    it('supports live mode: commits immediately on valid input', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<LiveNumberInput value={10} onChange={onChange} />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '15');
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(15);
    });

    it('supports draft mode: caller owns text and finish callbacks', () => {
      const onChange = vi.fn();
      const onFinish = vi.fn();
      act(() => {
        root.render(
          <DraftNumberInput
            value="10"
            stepBase={10}
            step={1}
            onChange={onChange}
            onFinish={onFinish}
          />,
        );
      });

      const input = container.querySelector('input')!;
      expect(input.value).toBe('10');

      // Typing in draft mode notifies text directly
      act(() => {
        changeInputValue(input, '20');
      });
      expect(onChange).toHaveBeenCalledWith('20');

      // Stepping in draft mode with stepBase 10
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith('11');
      expect(onFinish).toHaveBeenCalledWith('11');
    });
  });

  describe('T032: Shared draft, live, and key-ownership contract (US4)', () => {
    it('live mode with null value displays mixed placeholder and steps from stepBase', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(
          <LiveNumberInput
            value={null}
            placeholder="mixed"
            stepBase={0}
            step={1}
            onChange={onChange}
          />,
        );
      });

      const input = container.querySelector('input')!;
      expect(input.value).toBe('');
      expect(input.placeholder).toBe('mixed');

      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('live mode rejects domain violations, invokes onInvalid, and reverts on blur', () => {
      const onChange = vi.fn();
      const onInvalid = vi.fn();
      const resolveValue = (text: string) => {
        const n = parseInt(text, 10);
        if (Number.isNaN(n) || n < 1 || n > 10) return null;
        return n;
      };

      act(() => {
        root.render(
          <LiveNumberInput
            value={5}
            resolveValue={resolveValue}
            onChange={onChange}
            onInvalid={onInvalid}
          />,
        );
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        changeInputValue(input, '99');
      });

      expect(onInvalid).toHaveBeenCalledWith('99');
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        input.blur();
      });

      expect(input.value).toBe('5');
    });

    it('caller-owned draft bubbles Enter and Escape when finish callbacks are absent', () => {
      const parentEnterHandler = vi.fn();
      const parentEscapeHandler = vi.fn();

      const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') parentEnterHandler();
        if (e.key === 'Escape') parentEscapeHandler();
      };

      act(() => {
        root.render(
          <div onKeyDown={onKeyDown}>
            <DraftNumberInput value="42" stepBase={42} onChange={() => {}} />
          </div>,
        );
      });

      const input = container.querySelector('input')!;
      input.focus();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      expect(parentEnterHandler).toHaveBeenCalledTimes(1);

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(parentEscapeHandler).toHaveBeenCalledTimes(1);
    });

    it('field-owned draft finishes on Enter once and Escape cancels without finishing', () => {
      const onFinish = vi.fn();
      const onCancel = vi.fn();

      act(() => {
        root.render(
          <DraftNumberInput
            value="42"
            stepBase={42}
            onChange={() => {}}
            onFinish={onFinish}
            onCancel={onCancel}
          />,
        );
      });

      const input = container.querySelector('input')!;
      input.focus();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith('42');

      input.focus();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('draft mode rejects stepping when candidate fails resolveStep', () => {
      const onChange = vi.fn();
      const onFinish = vi.fn();
      const resolveStep = (text: string) => {
        const val = parseFloat(text);
        if (val > 10) return null; // cap at 10
        return val;
      };

      act(() => {
        root.render(
          <DraftNumberInput
            value="10"
            stepBase={10}
            step={1}
            resolveStep={resolveStep}
            onChange={onChange}
            onFinish={onFinish}
          />,
        );
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      // Stepping above 10 is rejected
      expect(onChange).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    });

    it('draft mode stepping followed by cancel isolates transaction', () => {
      let draft = '10';
      const onCommitTransaction = vi.fn();

      const DialogWrapper = () => {
        const [value, setValue] = React.useState(draft);
        return (
          <div>
            <DraftNumberInput value={value} stepBase={10} step={1} onChange={setValue} />
            <button
              onClick={() => {
                onCommitTransaction(Number(value));
              }}
            >
              OK
            </button>
            <button
              onClick={() => {
                // Cancel: do not commit
              }}
            >
              Cancel
            </button>
          </div>
        );
      };

      act(() => {
        root.render(<DialogWrapper />);
      });

      const input = container.querySelector('input')!;
      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      // Stepped to 11 in local draft
      expect(input.value).toBe('11');

      // User clicks Cancel
      const cancelBtn = container.querySelectorAll('button')[2]!; // index 0 & 1 are steppers, 2 is OK, 3 is Cancel
      const allBtns = Array.from(container.querySelectorAll('button'));
      const cancel = allBtns.find((b) => b.textContent === 'Cancel')!;
      act(() => {
        cancel.click();
      });

      // No transaction committed!
      expect(onCommitTransaction).not.toHaveBeenCalled();
    });

    it('safely no-ops native stepping if input is unmounted or lacks ownerDocument (T047)', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<CommitNumberInput value={10} step={1} onChange={onChange} />);
      });

      const increaseBtn = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Increase"]',
      )!;
      // Simulate input unmounting/disconnecting
      const input = container.querySelector('input')!;
      input.remove();

      act(() => {
        increaseBtn.click();
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
