import type { ReactNode } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Select from '@radix-ui/react-select';
import * as Tooltip from '@radix-ui/react-tooltip';
import { usePortalContainer } from './use-host-document';

type PortalSyntheticEvent = { isPropagationStopped: () => boolean };

const stopPortalReactTreePropagation = (event: PortalSyntheticEvent): void => {
  // React checks this method between listeners in its synthetic dispatch
  // queue. Marking only the synthetic event keeps it out of logical React
  // ancestors while allowing Radix's native document listeners to observe
  // pointerdown for outside-dismissal bookkeeping.
  event.isPropagationStopped = () => true;
};

/**
 * Prevent interactive portal events from continuing through the React tree
 * into pointer/mouse handlers owned by the surface behind the popup.
 * Capture-phase handlers run first and must separately exempt popup targets
 * with `isEventInsidePortalPopup`.
 */
export const portalEventIsolationProps = {
  onPointerDown: stopPortalReactTreePropagation,
  onPointerUp: stopPortalReactTreePropagation,
  onMouseDown: stopPortalReactTreePropagation,
  onMouseUp: stopPortalReactTreePropagation,
  onClick: stopPortalReactTreePropagation,
  onDoubleClick: stopPortalReactTreePropagation,
  onContextMenu: stopPortalReactTreePropagation,
};

/**
 * Radix portals bound to the panel's hosting window.
 *
 * Floating workbench panels live in a popout document while sharing this
 * renderer context; a bare `<X.Portal>` mounts into the main window's body,
 * rendering menus where the user cannot see or click them. These wrappers
 * resolve the container from `HostDocumentContext` so every portal inside
 * panel content lands in the correct window. Use them anywhere a Radix
 * `<X.Portal>` would appear inside workbench panel content.
 */

export function PopoutContextMenuPortal({ children }: { children?: ReactNode }) {
  const container = usePortalContainer();
  return <ContextMenu.Portal container={container}>{children}</ContextMenu.Portal>;
}

export function PopoutDropdownMenuPortal({ children }: { children?: ReactNode }) {
  const container = usePortalContainer();
  return <DropdownMenu.Portal container={container}>{children}</DropdownMenu.Portal>;
}

export function PopoutSelectPortal({ children }: { children?: ReactNode }) {
  const container = usePortalContainer();
  return <Select.Portal container={container}>{children}</Select.Portal>;
}

export function PopoutTooltipPortal({ children }: { children?: ReactNode }) {
  const container = usePortalContainer();
  return <Tooltip.Portal container={container}>{children}</Tooltip.Portal>;
}
