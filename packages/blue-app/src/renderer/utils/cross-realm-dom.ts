/**
 * Realm-safe DOM membership checks.
 *
 * Dockview popout panels live in a separate OS window whose document uses a
 * different JS realm from this module, so `instanceof Node` fails for exactly
 * the nodes popup containment must recognize (portal children are created by
 * the container's own document). Structural duck-typing and pure tree walks
 * work across realms and documents.
 */

/** Structural Node check that works across JS realms (windows). */
export function isNodeLike(target: EventTarget | null): target is Node {
  return target != null
    && typeof (target as Node).nodeType === 'number'
    && typeof (target as Node).contains === 'function';
}

/** True when `target` is a node inside `container`'s subtree (inclusive). */
export function containsNode(
  container: Node | null | undefined,
  target: EventTarget | null,
): boolean {
  return isNodeLike(target) && container?.contains(target) === true;
}

/**
 * True when `target` sits inside a portaled popup surface (Radix menu or
 * popper content). Structural, so it works across realms.
 *
 * Capture-phase ancestor handlers (`onMouseDownCapture` etc.) run before any
 * bubble-phase stopPropagation guard a popup root can apply — the only way to
 * keep presses inside portaled menus from triggering ancestor behavior (focus
 * steals, audition stops) is to exempt these targets at the handler itself.
 */
export function isEventInsidePortalPopup(target: EventTarget | null): boolean {
  const el = target as Node | null;
  if (!isNodeLike(el)) return false;
  let node: Node | null = el;
  while (node) {
    if (node.nodeType === 1) {
      const name = (node as Element).getAttribute?.('role');
      if (name === 'menu' || name === 'menuitem' || name === 'dialog'
        || name === 'listbox' || name === 'tooltip') {
        return true;
      }
    }
    node = node.parentNode;
  }
  return false;
}
