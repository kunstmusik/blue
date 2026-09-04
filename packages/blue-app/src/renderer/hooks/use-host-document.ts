import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Document of the window that visually hosts the current panel's content.
 *
 * - `undefined` (no provider): caller is outside panel content. Panel-hosted
 *   popups MUST treat this as "no host" rather than assuming the main window.
 * - `null`: no real DOM environment (tests/SSR); popup surfaces render nothing.
 * - A `Document`: docked panels get the main window document; floated panels
 *   get their popout window's document.
 */
export const HostDocumentContext = createContext<Document | null | undefined>(undefined);

interface UseHostDocumentOptions {
  /**
   * Main-window-only chrome (toolbars, settings) may fall back to the global
   * document when no provider exists. Panel content MUST NOT enable this.
   */
  fallbackToGlobal?: boolean;
}

/** Resolves the hosting document for the calling component. */
export function useHostDocument(options: UseHostDocumentOptions = {}): Document | null {
  const { fallbackToGlobal = false } = options;
  const hostDocument = useContext(HostDocumentContext);
  if (hostDocument === undefined) {
    if (!fallbackToGlobal || typeof document === 'undefined') {
      return null;
    }
    return document;
  }
  return hostDocument;
}

/**
 * Body element of the hosting document, for Radix `<X.Portal container={…}>`.
 *
 * Falls back to the global document body ONLY when no provider exists at all
 * (`undefined` context): such a caller is not inside any panel shell —
 * workbench chrome or standalone tests — which render in the main window.
 * Panel-hosted callers always receive their true hosting window from the
 * DockviewPanel provider; an explicit null provider (no-DOM) still yields null.
 */
export function usePortalContainer(): HTMLElement | null {
  const hostDocument = useHostDocument({ fallbackToGlobal: true });
  return hostDocument?.body ?? null;
}

/**
 * Resolves the hosting document for a panel shell node, staying correct when
 * dockview floats a group: floating ADOPTS the mounted DOM into the popout
 * window's document without a React remount, so resolution re-runs on the
 * panel api's location-change event and on first interaction within the shell
 * (capture phase — ahead of bubble-phase popup handlers in the same gesture).
 */
export function useShellHostDocument(
  ref: { current: HTMLElement | null },
  subscribeLocationChange?: (cb: () => void) => { dispose: () => void },
): Document | null {
  const [hostDocument, setHostDocument] = useState<Document | null>(null);
  useEffect(() => {
    const resolve = () => {
      const doc = ref.current?.ownerDocument ?? null;
      setHostDocument((prev) => (prev === doc ? prev : doc));
    };
    resolve();
    const disposable = subscribeLocationChange?.(() => resolve());
    const shell = ref.current;
    shell?.addEventListener('pointerdown', resolve, true);
    shell?.addEventListener('contextmenu', resolve, true);
    shell?.addEventListener('focusin', resolve, true);
    return () => {
      disposable?.dispose();
      shell?.removeEventListener('pointerdown', resolve, true);
      shell?.removeEventListener('contextmenu', resolve, true);
      shell?.removeEventListener('focusin', resolve, true);
    };
  }, [ref, subscribeLocationChange]);
  return hostDocument;
}
