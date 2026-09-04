// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NodeRendererProps } from 'react-arborist';
import * as treeDndDomain from '../components/tree/tree-dnd-domain';
import { acquireTreeDndManager, hasActiveTreeDrag } from '../components/tree/tree-dnd-domain';
import { NativeTypes } from 'react-dnd-html5-backend';
import { BlueTree } from '../components/tree/BlueTree';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface TestNode {
  id: string;
  name: string;
}

const TREE_DATA: TestNode[] = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
];

function TestRow({ node, style, dragHandle }: NodeRendererProps<TestNode>): React.ReactElement {
  return (
    <div ref={dragHandle} style={style} data-testid={`tree-row-${node.data.name}`}>
      {node.data.name}
    </div>
  );
}

function renderTree(host: HTMLElement, data: TestNode[] = TREE_DATA): Root {
  const root = createRoot(host);
  act(() => {
    root.render(
      <BlueTree<TestNode>
        data={data}
        width={320}
        height={96}
        rowHeight={24}
        indent={16}
        idAccessor="id"
      >
        {TestRow}
      </BlueTree>,
    );
  });
  return root;
}

describe('tree drag ownership domain', () => {
  let host: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root!.unmount());
      root = null;
    }
    host.remove();
  });

  it('returns one shared manager per document', () => {
    const first = acquireTreeDndManager(document);
    const second = acquireTreeDndManager(document);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('keeps managers independent across documents', () => {
    const mainManager = acquireTreeDndManager(document);

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const popoutDocument = iframe.contentDocument!;
    const popoutManager = acquireTreeDndManager(popoutDocument);

    expect(popoutManager).not.toBeNull();
    expect(popoutManager).not.toBe(mainManager);

    const sourceId = popoutManager!.getRegistry().addSource('blue/test', {
      canDrag: () => true,
      isDragging: () => true,
      beginDrag: () => ({ kind: 'blue/test' }),
      endDrag: () => undefined,
    });
    popoutManager!.getActions().beginDrag([sourceId]);

    expect(hasActiveTreeDrag(popoutDocument)).toBe(true);
    expect(hasActiveTreeDrag(document)).toBe(false);

    popoutManager!.getActions().endDrag();
    popoutManager!.getRegistry().removeSource(sourceId);
    iframe.remove();
  });

  it('reports active drags for the document that owns them', () => {
    const manager = acquireTreeDndManager(document);
    expect(manager).not.toBeNull();
    expect(hasActiveTreeDrag(document)).toBe(false);

    const sourceId = manager!.getRegistry().addSource('blue/test', {
      canDrag: () => true,
      isDragging: () => true,
      beginDrag: () => ({ kind: 'blue/test' }),
      endDrag: () => undefined,
    });
    manager!.getActions().beginDrag([sourceId]);
    expect(hasActiveTreeDrag(document)).toBe(true);

    manager!.getActions().endDrag();
    manager!.getRegistry().removeSource(sourceId);
    expect(hasActiveTreeDrag(document)).toBe(false);
  });

  it('does not defer layout transitions for native drags that never end', () => {
    const manager = acquireTreeDndManager(document)!;

    // An external/native drag that is interrupted never receives dragend; the
    // monitor stays in its dragging state. It is not a participating tree
    // drag and must not wedge layout transitions.
    const nativeSourceId = manager.getRegistry().addSource(NativeTypes.FILE, {
      canDrag: () => true,
      isDragging: () => true,
      beginDrag: () => ({ files: [] }),
      endDrag: () => undefined,
    });
    manager.getActions().beginDrag([nativeSourceId]);

    expect(manager.getMonitor().isDragging()).toBe(true);
    expect(hasActiveTreeDrag(document)).toBe(false);

    manager.getActions().endDrag();
    manager.getRegistry().removeSource(nativeSourceId);
    expect(hasActiveTreeDrag(document)).toBe(false);
  });

  it('leaves trees unmounted for documents without a usable window', () => {
    const detached = document.implementation.createHTMLDocument('detached');
    expect(detached.defaultView).toBeNull();
    expect(acquireTreeDndManager(detached)).toBeNull();
  });

  it('keeps domain state transient by exporting only functions', () => {
    const exports = Object.values(treeDndDomain);
    expect(exports.length).toBeGreaterThan(0);
    for (const value of exports) {
      expect(typeof value).toBe('function');
    }
  });

  it('reuses the live document domain across remounts without a stale backend marker', async () => {
    const before = acquireTreeDndManager(document);

    root = renderTree(host);
    const during = acquireTreeDndManager(document);
    expect(during).toBe(before);

    await act(async () => root!.unmount());
    root = null;

    const after = acquireTreeDndManager(document);
    expect(after).toBe(before);

    const marker = (document as Document & { __isReactDndBackendSetUp?: unknown })
      .__isReactDndBackendSetUp;
    expect(marker).not.toBe(true);
  });

  it('mounts two coordinated trees in one document without a duplicate HTML5 backend', () => {
    const secondHost = document.createElement('div');
    document.body.appendChild(secondHost);
    try {
      root = renderTree(host);
      const secondRoot = renderTree(secondHost, [
        { id: 'gamma', name: 'Gamma' },
        { id: 'delta', name: 'Delta' },
      ]);

      expect(host.querySelectorAll('[data-testid^="tree-row-"]').length).toBe(2);
      expect(secondHost.querySelectorAll('[data-testid^="tree-row-"]').length).toBe(2);

      act(() => secondRoot.unmount());
    } finally {
      secondHost.remove();
    }
  });
});
