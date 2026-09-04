/**
 * Typed options and anchor descriptors for the host-surface module.
 *
 * Contract: specs/090-host-floating-surfaces/contracts/host-surface-module.md
 * Data model: specs/090-host-floating-surfaces/data-model.md
 */

export type HostSurfaceKind = 'menu' | 'tooltip' | 'readout' | 'popover';

export type HostSurfaceDismissReason =
  | 'escape'
  | 'outside-pointer'
  | 'host-scroll'
  | 'host-unmount'
  | 'caller';

export interface HostSurfaceAnchorElement {
  type: 'element';
  /** Must live in the host document's realm (see cross-realm-dom.ts). */
  element: HTMLElement;
}

/**
 * Live rectangle in host-viewport client coordinates (SVG/canvas points).
 * `getRect` is re-read on every placement update so the surface follows
 * points that move during drags.
 */
export interface HostSurfaceAnchorRect {
  type: 'rect';
  getRect: () => HostAnchorRect;
}

/** Pointer coordinates in the host viewport (pointer-opened context menus). */
export interface HostSurfaceAnchorPoint {
  type: 'point';
  x: number;
  y: number;
}

export type HostSurfaceAnchor =
  | HostSurfaceAnchorElement
  | HostSurfaceAnchorRect
  | HostSurfaceAnchorPoint;

export interface HostAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width?: number;
  height?: number;
}

export type HostSurfaceSide = 'top' | 'bottom' | 'left' | 'right';

export interface HostSurfaceOptions {
  kind: HostSurfaceKind;
  /**
   * Explicit hosting document override. When provided (including `null`),
   * it replaces the panel-context document — for components whose host is
   * resolved from an anchor element's `ownerDocument` rather than the
   * surrounding panel (e.g. the color picker). Undefined = use
   * `useHostDocument()` context.
   */
  hostDocument?: Document | null;
  /** Space between anchor and surface. Default 8. */
  gap?: number;
  /** Space kept inside the host viewport. Default 8. */
  margin?: number;
  /** Cross-axis alignment relative to the anchor. Default 'start'. */
  align?: 'start' | 'center' | 'end';
  /** Preferred side. Default 'bottom' (readouts default to 'right'). */
  placement?: HostSurfaceSide;
  /**
   * Close instead of follow when the host viewport scrolls. Defaults to
   * true for 'menu', false for other kinds (spec FR-005). Scrolling inside
   * the surface's own content never dismisses.
   */
  closeOnHostScroll?: boolean;
  /** Called once when the surface dismisses for any reason. */
  onDismiss?: (reason: HostSurfaceDismissReason) => void;
}

export interface PlacementResult {
  left: number;
  top: number;
  /** Side actually used after collision flipping (exposed for styling/tests). */
  placement: HostSurfaceSide;
  /** Constrained max height when the surface exceeds available space (FR-003). */
  maxHeight: number | null;
}

export const DEFAULT_SURFACE_GAP = 8;
export const DEFAULT_SURFACE_MARGIN = 8;

export function surfaceCloseOnHostScrollByKind(kind: HostSurfaceKind, override?: boolean): boolean {
  return override ?? kind === 'menu';
}
