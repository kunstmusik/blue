import { type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { portalEventIsolationProps } from '../../hooks/host-portals';
import type { HostSurfaceSession } from './use-host-surface';

interface HostSurfacePortalProps {
  session: HostSurfaceSession;
  className?: string;
  style?: CSSProperties;
  /** Accessibility role; `menu`/`tooltip` values also exempt the surface's
   * targets in ancestor capture handlers via `isEventInsidePortalPopup`. */
  role?: string;
  /** false for informational surfaces (tooltips, readouts) that must never
   * take pointer input (spec Story 2.4). Default true. */
  interactive?: boolean;
  children: ReactNode;
}

/**
 * Renders a host-surface session's content into the hosting document's body
 * at the session's computed placement. Mounts hidden while the first
 * placement is being measured, keeps oversized content internally scrollable
 * (FR-003), and isolates its events from React ancestors behind it (FR-007).
 */
export function HostSurfacePortal({
  session,
  className,
  style,
  role,
  interactive = true,
  children,
}: HostSurfacePortalProps): React.ReactElement | null {
  const container = session.hostDocument?.body ?? null;
  if (!container || session.phase === 'closed') {
    return null;
  }
  const placement = session.placement;
  const positioned: CSSProperties = {
    position: 'fixed',
    left: placement?.left ?? 0,
    top: placement?.top ?? 0,
    maxHeight: placement?.maxHeight ?? undefined,
    overflowY: 'auto',
    pointerEvents: interactive ? undefined : 'none',
    visibility: session.phase === 'open' ? undefined : 'hidden',
  };
  return createPortal(
    <div
      ref={session.setSurfaceElement}
      role={role}
      data-host-surface="true"
      data-placement={placement?.placement}
      className={className}
      style={{ ...positioned, ...style }}
      {...portalEventIsolationProps}
    >
      {children}
    </div>,
    container,
  );
}
