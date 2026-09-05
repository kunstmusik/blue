import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '../lib/cn';

const BASE_INPUT_CLASS =
  'w-20 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 pr-6 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

interface NumberInputCommonProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'defaultValue' | 'type' | 'step' | 'min' | 'max' | 'onInvalid'
> {
  step?: number | 'any';
  min?: number;
  max?: number;
  className?: string;
  containerClassName?: string;
}

export interface CommitNumberInputProps extends NumberInputCommonProps {
  value: number;
  onChange: (v: number) => void;
  resolveValue?: (text: string) => number | null;
  onInvalid?: (text: string) => void;
}

export interface LiveNumberInputProps extends NumberInputCommonProps {
  value: number | null;
  stepBase?: number;
  onChange: (v: number) => void;
  resolveValue?: (text: string) => number | null;
  onInvalid?: (text: string) => void;
}

export interface DraftNumberInputProps extends NumberInputCommonProps {
  value: string;
  stepBase?: number;
  onChange: (text: string) => void;
  resolveStep?: (text: string) => number | null;
  onFinish?: (text: string) => void;
  onCancel?: () => void;
}

type NumberInputProps =
  | ({ mode: 'deferred' } & CommitNumberInputProps)
  | ({ mode: 'live' } & LiveNumberInputProps)
  | ({ mode: 'draft' } & DraftNumberInputProps);

function defaultResolveValue(text: string, min?: number, max?: number): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  let clamped = num;
  if (min !== undefined && Number.isFinite(min) && clamped < min) clamped = min;
  if (max !== undefined && Number.isFinite(max) && clamped > max) clamped = max;
  return clamped;
}

function computeDetachedStep(
  doc: Document,
  base: number,
  direction: 1 | -1,
  min: number | undefined,
  max: number | undefined,
  step: number | 'any',
  valueAttrBase?: number,
): number | null {
  try {
    const detached = doc.createElement('input');
    detached.type = 'number';
    if (min !== undefined && Number.isFinite(min)) {
      detached.min = String(min);
    }
    if (max !== undefined && Number.isFinite(max)) {
      detached.max = String(max);
    }
    if (step === 'any') {
      detached.step = '1';
      detached.setAttribute('value', String(base));
    } else {
      detached.step = String(step);
      if (valueAttrBase !== undefined && Number.isFinite(valueAttrBase)) {
        detached.setAttribute('value', String(valueAttrBase));
      }
    }
    detached.value = String(base);
    if (direction > 0) {
      detached.stepUp();
    } else {
      detached.stepDown();
    }
    const val = detached.valueAsNumber;
    if (Number.isFinite(val)) {
      return val;
    }
  } catch {
    // Impossible step or InvalidStateError
  }
  return null;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(props, forwardedRef) {
    const mode = props.mode;

    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(forwardedRef, () => inputRef.current!);

    // Extract component props so they are not spread onto native input
    const commonProps = props as unknown as NumberInputCommonProps;
    const {
      step = 0.1,
      min,
      max,
      className,
      containerClassName,
      disabled,
      readOnly,
      onFocus,
      onBlur,
      onKeyDown,
      ...restCommonProps
    } = commonProps;

    const restInputProps: React.InputHTMLAttributes<HTMLInputElement> = { ...restCommonProps };
    delete (restInputProps as Record<string, unknown>).mode;
    delete (restInputProps as Record<string, unknown>).value;
    delete (restInputProps as Record<string, unknown>).onChange;
    delete (restInputProps as Record<string, unknown>).stepBase;
    delete (restInputProps as Record<string, unknown>).resolveValue;
    delete (restInputProps as Record<string, unknown>).resolveStep;
    delete (restInputProps as Record<string, unknown>).onFinish;
    delete (restInputProps as Record<string, unknown>).onCancel;
    delete (restInputProps as Record<string, unknown>).onInvalid;

    // Track focused & dirty state
    const isFocusedRef = useRef(false);
    const isDirtyRef = useRef(false);

    // Synchronous latest accepted value
    const initialAccepted: number | null =
      mode === 'draft'
        ? ((props as DraftNumberInputProps).stepBase ??
          (Number.isFinite(Number((props as DraftNumberInputProps).value))
            ? Number((props as DraftNumberInputProps).value)
            : null))
        : mode === 'live'
          ? ((props as LiveNumberInputProps).value ??
            (props as LiveNumberInputProps).stepBase ??
            null)
          : (props as CommitNumberInputProps).value;

    const lastAcceptedRef = useRef<number | null>(initialAccepted);
    const valueAttributeStepBaseRef = useRef<number | undefined>(
      initialAccepted !== null && Number.isFinite(initialAccepted) ? initialAccepted : undefined,
    );

    // Local display value for deferred/live modes
    const initialDisplay: string =
      mode === 'draft'
        ? (props as DraftNumberInputProps).value
        : mode === 'live'
          ? (props as LiveNumberInputProps).value === null
            ? ''
            : String((props as LiveNumberInputProps).value)
          : String((props as CommitNumberInputProps).value);

    const [localValue, setLocalValue] = useState<string>(initialDisplay);

    // Keep latest props in ref for event handlers
    const latestPropsRef = useRef(props);
    latestPropsRef.current = props;
    const skipDraftBlurFinishRef = useRef(false);

    // External snapshot reconciliation
    useEffect(() => {
      if (mode === 'draft') {
        setLocalValue((props as DraftNumberInputProps).value);
        return;
      }

      if (mode === 'live') {
        const liveVal = (props as LiveNumberInputProps).value;
        const liveStepBase = (props as LiveNumberInputProps).stepBase;
        lastAcceptedRef.current = liveVal ?? liveStepBase ?? null;
        if (!isFocusedRef.current || !isDirtyRef.current) {
          setLocalValue(liveVal === null ? '' : String(liveVal));
        }
        return;
      }

      // mode === 'deferred'
      const defVal = (props as CommitNumberInputProps).value;
      lastAcceptedRef.current = defVal;
      if (!isFocusedRef.current || !isDirtyRef.current) {
        setLocalValue(String(defVal));
      }
    }, [mode, props.value, (props as LiveNumberInputProps).stepBase]);

    // Wheel event prevention while focused
    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;
      const preventWheel = (e: WheelEvent) => {
        if (el.ownerDocument.activeElement === el) {
          e.preventDefault();
        }
      };
      el.addEventListener('wheel', preventWheel, { passive: false });
      return () => el.removeEventListener('wheel', preventWheel);
    }, []);

    // Perform step operation
    const handleStep = useCallback(
      (direction: 1 | -1) => {
        const currentProps = latestPropsRef.current;
        if (currentProps.disabled || currentProps.readOnly) return;

        const input = inputRef.current;
        if (!input || !input.isConnected || !input.ownerDocument) return;
        const doc = input.ownerDocument;
        const currentMode = currentProps.mode;

        // 1. Determine base value (Rule 2: check raw text first)
        let chosenBase: number | null = null;

        // Determine raw text
        let rawText = '';
        if (currentMode === 'draft') {
          rawText = (currentProps as DraftNumberInputProps).value;
        } else {
          rawText = inputRef.current ? inputRef.current.value : localValue;
        }

        // Check if rawText is valid complete finite number
        const isBadInput = inputRef.current?.validity?.badInput ?? false;
        const trimmed = rawText.trim();

        if (!isBadInput && trimmed !== '' && Number.isFinite(Number(trimmed))) {
          if (currentMode === 'draft') {
            const draftProps = currentProps as DraftNumberInputProps;
            const res = draftProps.resolveStep
              ? draftProps.resolveStep(trimmed)
              : defaultResolveValue(trimmed, draftProps.min, draftProps.max);
            if (res !== null && Number.isFinite(res)) {
              chosenBase = res;
            }
          } else {
            const numProps = currentProps as CommitNumberInputProps | LiveNumberInputProps;
            const res = numProps.resolveValue
              ? numProps.resolveValue(trimmed)
              : defaultResolveValue(trimmed, numProps.min, numProps.max);
            if (res !== null && Number.isFinite(res)) {
              chosenBase = res;
            }
          }
        }

        // Fallback to latest accepted value or stepBase
        if (chosenBase === null) {
          if (lastAcceptedRef.current !== null && Number.isFinite(lastAcceptedRef.current)) {
            chosenBase = lastAcceptedRef.current;
          } else if (
            'stepBase' in currentProps &&
            currentProps.stepBase !== undefined &&
            Number.isFinite(currentProps.stepBase)
          ) {
            chosenBase = currentProps.stepBase;
          } else if (
            currentMode !== 'draft' &&
            (currentProps as CommitNumberInputProps).value !== null &&
            Number.isFinite((currentProps as CommitNumberInputProps).value)
          ) {
            chosenBase = (currentProps as CommitNumberInputProps).value;
          }
        }

        if (chosenBase === null || !Number.isFinite(chosenBase)) {
          return;
        }

        // 3 & 4. Compute detached step
        const candidate = computeDetachedStep(
          doc,
          chosenBase,
          direction,
          currentProps.min,
          currentProps.max,
          currentProps.step ?? 0.1,
          valueAttributeStepBaseRef.current,
        );

        if (candidate === null || !Number.isFinite(candidate)) {
          return;
        }

        // 5. Validate candidate under field policy
        let accepted: number | null = null;
        if (currentMode === 'draft') {
          const draftProps = currentProps as DraftNumberInputProps;
          accepted = draftProps.resolveStep
            ? draftProps.resolveStep(String(candidate))
            : defaultResolveValue(String(candidate), draftProps.min, draftProps.max);
        } else {
          const numProps = currentProps as CommitNumberInputProps | LiveNumberInputProps;
          accepted = numProps.resolveValue
            ? numProps.resolveValue(String(candidate))
            : defaultResolveValue(String(candidate), numProps.min, numProps.max);
        }

        if (accepted === null || !Number.isFinite(accepted)) {
          return;
        }

        // Bound no-op check
        if (accepted === chosenBase) {
          return;
        }

        // 6. Apply step immediately
        lastAcceptedRef.current = accepted;
        isDirtyRef.current = false;
        if (inputRef.current) {
          inputRef.current.value = String(accepted);
        }

        if (currentMode === 'draft') {
          const draftProps = currentProps as DraftNumberInputProps;
          draftProps.onChange(String(accepted));
          draftProps.onFinish?.(String(accepted));
        } else {
          setLocalValue(String(accepted));
          (currentProps as CommitNumberInputProps | LiveNumberInputProps).onChange(accepted);
        }
      },
      [localValue],
    );

    // Finish / Commit handler for blur / Enter in deferred mode
    const commitDeferred = useCallback(() => {
      if (!isDirtyRef.current) return;
      isDirtyRef.current = false;

      const currentProps = latestPropsRef.current as CommitNumberInputProps;
      const raw = localValue;
      const resolved = currentProps.resolveValue
        ? currentProps.resolveValue(raw)
        : defaultResolveValue(raw, currentProps.min, currentProps.max);

      if (resolved !== null && Number.isFinite(resolved)) {
        lastAcceptedRef.current = resolved;
        setLocalValue(String(resolved));
        currentProps.onChange(resolved);
      } else {
        currentProps.onInvalid?.(raw);
        setLocalValue(
          lastAcceptedRef.current !== null
            ? String(lastAcceptedRef.current)
            : String(currentProps.value),
        );
      }
    }, [localValue]);

    // Focus & Blur
    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        isFocusedRef.current = true;
        skipDraftBlurFinishRef.current = false;
        onFocus?.(e);
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        isFocusedRef.current = false;
        const currentProps = latestPropsRef.current;
        const currentMode = currentProps.mode;

        if (currentMode === 'deferred') {
          commitDeferred();
        } else if (currentMode === 'draft') {
          const draftProps = currentProps as DraftNumberInputProps;
          if (skipDraftBlurFinishRef.current) {
            skipDraftBlurFinishRef.current = false;
          } else {
            draftProps.onFinish?.(draftProps.value);
          }
        } else if (currentMode === 'live') {
          // Live mode: if invalid or dirty, revert display to accepted
          if (isDirtyRef.current) {
            isDirtyRef.current = false;
            setLocalValue(lastAcceptedRef.current !== null ? String(lastAcceptedRef.current) : '');
          }
        }

        onBlur?.(e);
      },
      [commitDeferred, onBlur],
    );

    // Input change handler
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      const currentProps = latestPropsRef.current;
      const currentMode = currentProps.mode;

      if (currentMode === 'draft') {
        (currentProps as DraftNumberInputProps).onChange(text);
        return;
      }

      isDirtyRef.current = true;
      setLocalValue(text);

      if (currentMode === 'live') {
        const liveProps = currentProps as LiveNumberInputProps;
        const resolved = liveProps.resolveValue
          ? liveProps.resolveValue(text)
          : defaultResolveValue(text, liveProps.min, liveProps.max);

        if (resolved !== null && Number.isFinite(resolved)) {
          lastAcceptedRef.current = resolved;
          isDirtyRef.current = false;
          liveProps.onChange(resolved);
        } else {
          liveProps.onInvalid?.(text);
        }
      }
    }, []);

    // KeyDown handler
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleStep(1);
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleStep(-1);
          return;
        }

        if (e.key === 'Enter') {
          const currentProps = latestPropsRef.current;
          const currentMode = currentProps.mode;
          if (currentMode === 'draft') {
            const onFinish = (currentProps as DraftNumberInputProps).onFinish;
            if (!onFinish) return;
            e.preventDefault();
            e.stopPropagation();
            skipDraftBlurFinishRef.current = true;
            onFinish((currentProps as DraftNumberInputProps).value);
          } else {
            e.preventDefault();
            if (currentMode === 'deferred') commitDeferred();
          }
          inputRef.current?.blur();
          return;
        }

        if (e.key === 'Escape') {
          const currentProps = latestPropsRef.current;
          const currentMode = currentProps.mode;
          if (currentMode === 'draft') {
            const onCancel = (currentProps as DraftNumberInputProps).onCancel;
            if (!onCancel) return;
            e.preventDefault();
            e.stopPropagation();
            skipDraftBlurFinishRef.current = true;
            onCancel();
          } else {
            e.preventDefault();
            isDirtyRef.current = false;
            const revertVal =
              lastAcceptedRef.current !== null
                ? lastAcceptedRef.current
                : currentMode === 'deferred'
                  ? (currentProps as CommitNumberInputProps).value
                  : null;
            setLocalValue(revertVal !== null ? String(revertVal) : '');
          }
          inputRef.current?.blur();
          return;
        }
      },
      [commitDeferred, handleStep, onKeyDown],
    );

    const inputValue: string =
      mode === 'draft' ? (props as DraftNumberInputProps).value : localValue;

    return (
      <div className={cn('group relative inline-flex items-center', containerClassName)}>
        <input
          ref={inputRef}
          type="number"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(BASE_INPUT_CLASS, className)}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          {...restInputProps}
        />
        <div
          className={cn(
            'absolute right-1 inset-y-0 my-auto flex h-4 w-[15px] flex-col overflow-hidden rounded-[2px] border border-black/15 bg-[#f1f1f1] shadow-xs transition-opacity duration-150',
            'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
            (disabled || readOnly) && 'hidden',
          )}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase"
            disabled={disabled || readOnly}
            className="flex flex-1 w-full items-center justify-center text-role-body text-[#505050] transition-colors hover:bg-[#d2d2d2] active:bg-[#b8b8b8] disabled:pointer-events-none disabled:opacity-30"
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleStep(1)}
          >
            <svg
              viewBox="0 0 8 5"
              className="h-[4px] w-[7px] fill-current"
              aria-hidden="true"
              focusable="false"
            >
              <polygon points="4,0.5 7.5,4.5 0.5,4.5" />
            </svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease"
            disabled={disabled || readOnly}
            className="flex flex-1 w-full items-center justify-center text-role-body text-[#505050] transition-colors hover:bg-[#d2d2d2] active:bg-[#b8b8b8] disabled:pointer-events-none disabled:opacity-30"
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleStep(-1)}
          >
            <svg
              viewBox="0 0 8 5"
              className="h-[4px] w-[7px] fill-current"
              aria-hidden="true"
              focusable="false"
            >
              <polygon points="0.5,0.5 7.5,0.5 4,4.5" />
            </svg>
          </button>
        </div>
      </div>
    );
  },
);

const CommitNumberInput = React.forwardRef<HTMLInputElement, CommitNumberInputProps>(
  function CommitNumberInput(props, forwardedRef) {
    return <NumberInput {...props} ref={forwardedRef} mode="deferred" />;
  },
);

export const LiveNumberInput = React.forwardRef<HTMLInputElement, LiveNumberInputProps>(
  function LiveNumberInput(props, forwardedRef) {
    return <NumberInput {...props} ref={forwardedRef} mode="live" />;
  },
);

export const DraftNumberInput = React.forwardRef<HTMLInputElement, DraftNumberInputProps>(
  function DraftNumberInput(props, forwardedRef) {
    return <NumberInput {...props} ref={forwardedRef} mode="draft" />;
  },
);

export default CommitNumberInput;

export function CommitNumberField(
  props: {
    label: string;
    id?: string;
  } & CommitNumberInputProps,
): React.ReactElement {
  const { label, id: explicitId, ...inputProps } = props;
  const generatedId = React.useId();
  const inputId = explicitId || generatedId;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className="shrink-0 text-role-body text-gray-300">
        {label}
      </label>
      <CommitNumberInput id={inputId} {...inputProps} />
    </div>
  );
}
