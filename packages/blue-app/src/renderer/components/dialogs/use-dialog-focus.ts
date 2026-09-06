import { useEffect, useRef } from 'react';
import { containsNode, isNodeLike } from '../../utils/cross-realm-dom';
import { useHostDocument } from '../../hooks/use-host-document';

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
  const hostDoc = useHostDocument();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!isOpen) return undefined;

    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const ownerDoc = hostDoc ?? dialog.ownerDocument ?? document;
    const activeEl = ownerDoc.activeElement ?? document.activeElement;
    const previousFocus =
      isNodeLike(activeEl) && typeof (activeEl as HTMLElement).focus === 'function'
        ? (activeEl as HTMLElement)
        : null;

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // RequestAnimationFrame / immediate focus
    const initialSelector = optionsRef.current?.initialFocusSelector;
    const initialElement = optionsRef.current?.initialFocusElement;

    let targetControl: HTMLElement | null = null;
    if (initialElement && containsNode(dialog, initialElement)) {
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
      if (
        event.key === 'Escape' &&
        (event.target === dialog || !containsNode(dialog, event.target as Node))
      ) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        dialog.tabIndex = -1;
        dialog.focus();
        return;
      }

      if (controls.length === 1) {
        event.preventDefault();
        controls[0].focus();
        return;
      }

      const active = ownerDoc.activeElement;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (active === first || !containsNode(dialog, active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !containsNode(dialog, active))) {
        event.preventDefault();
        first.focus();
      }
    };

    const hostWindow = ownerDoc.defaultView ?? window;
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    hostWindow?.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      hostWindow?.removeEventListener('keydown', handleWindowKeyDown);
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  return dialogRef;
}
