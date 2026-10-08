import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Tree, type TreeApi } from 'react-arborist';
import type { DragDropManager } from 'dnd-core';
import { acquireTreeDndManager } from './tree-dnd-domain';

/**
 * Application adapter around React Arborist (SPEC 084).
 *
 * Every interactive Arborist tree in the app must render `BlueTree` instead
 * of importing Arborist's `Tree` directly. `BlueTree` resolves the `Document`
 * that owns its rendered DOM, obtains that document's coordinated drag
 * manager, and only then mounts Arborist with it — guaranteeing one HTML5
 * backend per document no matter how many trees coexist. Callers keep the
 * ordinary Arborist props and tree ref; manager/backend wiring is owned here.
 */
export type BlueTreeProps<T> = Omit<
  React.ComponentProps<typeof Tree<T>>,
  'dndManager' | 'dndBackend' | 'dndRootElement' | 'ref'
>;

interface BoundDomain {
  document: Document;
  manager: DragDropManager;
}

function BlueTreeImpl<T>(
  props: BlueTreeProps<T>,
  ref: React.ForwardedRef<TreeApi<T>>,
): ReactElement | null {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const [domain, setDomain] = useState<BoundDomain | null>(null);

  const bind = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    const doc = hostRef.current?.ownerDocument ?? null;
    const manager = doc ? acquireTreeDndManager(doc) : null;

    setDomain((current) =>
      manager && current?.manager === manager
        ? current
        : manager
          ? { document: doc!, manager }
          : null,
    );
    if (!manager || !doc) {
      return;
    }

    // Dockview adopts live panel DOM into popout documents without remounting
    // React. Watching the bound document re-resolves ownership when the host
    // element is reparented into another document.
    const ObserverCtor = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (typeof ObserverCtor !== 'function') {
      return;
    }

    const observer = new ObserverCtor(() => {
      if (hostRef.current?.ownerDocument === doc) {
        return;
      }
      bind();
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    observerRef.current = observer;
  }, []);

  useEffect(() => {
    bind();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [bind]);

  const setTreeRef = useCallback(
    (tree: TreeApi<T> | null | undefined) => {
      if (typeof ref === 'function') return ref(tree ?? null);
      if (ref) ref.current = tree ?? null;
    },
    [ref],
  );

  return (
    <div ref={hostRef} className="contents">
      {domain ? <Tree<T> {...props} ref={setTreeRef} dndManager={domain.manager} /> : null}
    </div>
  );
}

export const BlueTree = forwardRef(BlueTreeImpl) as <T>(
  props: BlueTreeProps<T> & { ref?: React.ForwardedRef<TreeApi<T>> },
) => ReactElement | null;

export type { TreeApi } from 'react-arborist';
