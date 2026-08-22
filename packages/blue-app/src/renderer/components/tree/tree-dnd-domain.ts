import { createDragDropManager, type DragDropManager } from 'dnd-core';
import { HTML5Backend, NativeTypes } from 'react-dnd-html5-backend';

/**
 * Tree drag ownership domain (SPEC 084).
 *
 * Exactly one React DnD manager — with an HTML5 backend rooted at the
 * document itself — owns every participating tree rendered into a given DOM
 * `Document`. React Arborist creates its own backend per `Tree` by default;
 * two of those on one document make the HTML5 backend throw
 * "Cannot have two HTML5 backends at the same time."
 *
 * Managers are keyed weakly by `Document` so Dockview popouts and any other
 * secondary window receive an independent ownership domain, and so a closed
 * document's domain can be collected with it. Setup/teardown of the HTML5
 * backend is driven by dnd-core's handler ref-count, which keeps the
 * `__isReactDndBackendSetUp` root marker accurate as trees mount and unmount.
 * All state here is renderer-session state and is never serialized.
 */

interface TreeDndDomain {
  manager: DragDropManager;
}

const documentDomains = new WeakMap<Document, TreeDndDomain>();

/**
 * Monitor item types produced by native/external drags (files, URLs, plain
 * text dragged from outside React DnD). These drags are not participating
 * tree drags, and an interrupted native drag can leave the monitor stuck in
 * its dragging state without a `dragend`, so they must never defer layout
 * transitions.
 */
const NATIVE_DRAG_ITEM_TYPES = new Set<string>([
  NativeTypes.FILE,
  NativeTypes.URL,
  NativeTypes.TEXT,
  NativeTypes.HTML,
]);

function isUsableDocument(document: Document): boolean {
  const view = document.defaultView;
  return Boolean(view) && view!.closed !== true;
}

/**
 * Returns the coordinated drag manager for `document`, creating it on first
 * use. Returns `null` when the document has no usable window (detached or
 * closed); callers must leave their trees unmounted in that case rather than
 * binding handlers to some other document's root.
 */
export function acquireTreeDndManager(document: Document): DragDropManager | null {
  if (!isUsableDocument(document)) {
    return null;
  }

  const existing = documentDomains.get(document);
  if (existing) {
    return existing.manager;
  }

  const domain: TreeDndDomain = {
    manager: createDragDropManager(HTML5Backend, document.defaultView, {
      rootElement: document,
    }),
  };
  documentDomains.set(document, domain);
  return domain.manager;
}

/**
 * Whether a participating tree drag is currently active in `document`.
 * Used to defer auxiliary layout transitions while a drag owns the document.
 * Native/external drags are deliberately not reported: they are not tree
 * drags, and one that never receives its end event must not wedge every
 * layout transition into a silent deferral.
 */
export function hasActiveTreeDrag(document: Document): boolean {
  const domain = documentDomains.get(document);
  if (!domain) {
    return false;
  }

  try {
    const monitor = domain.manager.getMonitor();
    if (!monitor.isDragging()) {
      return false;
    }
    return !NATIVE_DRAG_ITEM_TYPES.has(String(monitor.getItemType()));
  } catch {
    return false;
  }
}
