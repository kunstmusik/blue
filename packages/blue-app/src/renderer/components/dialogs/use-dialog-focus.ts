import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface UseDialogFocusOptions {
  initialFocusSelector?: string;
  initialFocusElement?: HTMLElement | null;
}

/** Focus a control in a modal, trap Tab, and restore the opener on close. */
export function useDialogFocus(
  isOpen: boolean,
  onClose: () => void,
  options?: UseDialogFocusOptions,
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!isOpen) return undefined;

    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return undefined;

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // RequestAnimationFrame / immediate focus
    const initialSelector = optionsRef.current?.initialFocusSelector;
    const initialElement = optionsRef.current?.initialFocusElement;

    let targetControl: HTMLElement | null = null;
    if (initialElement && dialog.contains(initialElement)) {
      targetControl = initialElement;
    } else if (initialSelector) {
      targetControl = dialog.querySelector<HTMLElement>(initialSelector);
    }

    if (!targetControl) {
      targetControl = focusable()[0] ?? null;
    }

    if (targetControl) {
      targetControl.focus();
    } else {
      dialog.tabIndex = -1;
      dialog.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const active = document.activeElement;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  return dialogRef;
}
