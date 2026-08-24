import { useEffect } from 'react';

interface UseDocumentMouseDownOutsideOptions {
  enabled?: boolean;
  isInside: (target: EventTarget | null) => boolean;
  onMouseDownOutside: (event: MouseEvent) => void;
  /**
   * Document that owns the popup. Floating workbench panels live in a separate
   * popout document while sharing this renderer context, so dismissal must
   * listen on the document that actually contains the popup.
   */
  targetDocument?: Document | null;
}

export function useDocumentMouseDownOutside({
  enabled = true,
  isInside,
  onMouseDownOutside,
  targetDocument,
}: UseDocumentMouseDownOutsideOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const ownerDocument = targetDocument ?? document;

    const handleMouseDown = (event: MouseEvent) => {
      if (isInside(event.target)) {
        return;
      }

      onMouseDownOutside(event);
    };

    ownerDocument.addEventListener('mousedown', handleMouseDown);
    return () => ownerDocument.removeEventListener('mousedown', handleMouseDown);
  }, [enabled, isInside, onMouseDownOutside, targetDocument]);
}