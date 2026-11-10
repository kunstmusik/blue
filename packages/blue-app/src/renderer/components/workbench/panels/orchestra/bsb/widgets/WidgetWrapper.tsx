import {
  registerHistoryEditorSettlement,
  settleHistoryEditors,
} from '../../../../../../lib/history-scope-router';
import { attachHostGesture } from '../../../../../../lib/host-gesture';
import { getProjectDocumentId, useProjectStore } from '../../../../../../stores/project-store';
import { BsbGestureAuthorityContext, dispatchBsbAction } from '../bsb-history';
import type { BsbInterfacePatchHandler } from '../bsb-history';
import React, { useContext, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import type { BsbWidgetNodeSnapshot } from '../../../../../../../shared/project-editor';
import type { BSBWidgetResizeMeta } from '../bsb-widget-meta';
import { getWidgetDisplaySize } from './utils';
import {
  PopoutContextMenuPortal,
  PopoutTooltipPortal,
  portalEventIsolationProps,
} from '../../../../../../hooks/host-portals';
import { cn } from '../../../../../../lib/cn';

const HANDLE_SIZE = 5;

interface WidgetWrapperProps {
  node: BsbWidgetNodeSnapshot;
  isSelected: boolean;
  editEnabled: boolean;
  onWidgetSelect: (id: string | null, shiftKey?: boolean) => void;
  children: React.ReactNode;
  autoSize?: boolean;
  onDoubleClick?: () => void;
  displayWidth?: number;
  displayHeight?: number;
  resizeMeta?: BSBWidgetResizeMeta;
  gridSnapEnabled?: boolean;
  gridSnapWidth?: number;
  gridSnapHeight?: number;
  onBsbInterfacePatch?: BsbInterfacePatchHandler;
  selectedWidgetIds?: Set<string>;
  getWidgetPosition?: (id: string) => { x: number; y: number } | undefined;
  onWidgetAction?: (action: string) => void;
}

function WidgetWrapper({
  node,
  isSelected,
  editEnabled,
  onWidgetSelect,
  children,
  autoSize = false,
  onDoubleClick,
  displayWidth,
  displayHeight,
  resizeMeta,
  gridSnapEnabled,
  gridSnapWidth,
  gridSnapHeight,
  onBsbInterfacePatch,
  selectedWidgetIds,
  getWidgetPosition,
  onWidgetAction,
}: WidgetWrapperProps): React.ReactElement {
  const editorAuthority = useContext(BsbGestureAuthorityContext);
  const currentNode = useRef(node);
  currentNode.current = node;
  const captureAuthority = (ids: readonly string[]) => {
    const ownerIsCurrent = editorAuthority?.(ids);
    const source = currentNode.current;
    const documentId = getProjectDocumentId();
    const sessionId = useProjectStore.getState().sessionId;
    return () =>
      getProjectDocumentId() === documentId &&
      useProjectStore.getState().sessionId === sessionId &&
      (ownerIsCurrent
        ? ownerIsCurrent()
        : currentNode.current.id === source.id &&
          currentNode.current.gestureTargetId === source.gestureTargetId);
  };
  const measuredSize = getWidgetDisplaySize(node);
  const w = displayWidth ?? measuredSize.width;
  const h = displayHeight ?? measuredSize.height;
  const widthResizeProperty = resizeMeta?.widthProperty ?? 'width';
  const heightResizeProperty = resizeMeta?.heightProperty ?? 'height';

  type MoveDragState = {
    isCurrent: () => boolean;
    hostWindow: Window;
    gestureId: string;
    begun: boolean;
    latest: MouseEvent | null;
    dispatch: BsbInterfacePatchHandler | undefined;
    originClientX: number;
    originClientY: number;
    positions: Map<string, { x: number; y: number }>;
  };

  const moveDragRef = useRef<MoveDragState | null>(null);
  const moveDisposerRef = useRef<(() => void) | null>(null);
  const unregisterMoveSettlementRef = useRef<(() => void) | null>(null);
  const hasDraggedRef = useRef(false);
  const moveParamsRef = useRef({
    gridSnapEnabled,
    gridSnapWidth,
    gridSnapHeight,
  });
  moveParamsRef.current = { gridSnapEnabled, gridSnapWidth, gridSnapHeight };

  const moveRafRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const applyMove = (phase: 'begin' | 'update' | 'end') => {
    const md = moveDragRef.current;
    if (!md) return;
    if (!md.isCurrent()) {
      discardMove();
      return;
    }
    if (!md.begun && !md.latest) return;
    const { gridSnapEnabled: snap, gridSnapWidth: gw, gridSnapHeight: gh } = moveParamsRef.current;
    let dx = 0;
    let dy = 0;
    if (md.latest) {
      dx = md.latest.clientX - md.originClientX;
      dy = md.latest.clientY - md.originClientY;
      if (snap && gw) dx = Math.round(dx / gw) * gw;
      if (snap && gh) dy = Math.round(dy / gh) * gh;
    }
    const minNx = Math.min(...[...md.positions.values()].map((pos) => pos.x + dx));
    const minNy = Math.min(...[...md.positions.values()].map((pos) => pos.y + dy));
    if (minNx < 0) dx -= minNx;
    if (minNy < 0) dy -= minNy;
    const positions = [...md.positions];
    positions.forEach(([id, startPos], index) => {
      md.dispatch?.(
        {
          type: 'updateWidgetProperties',
          widgetId: id,
          properties: { x: startPos.x + dx, y: startPos.y + dy },
        },
        {
          label: 'Move Blue Synth Builder Widgets',
          gestureId: md.gestureId,
          phase:
            phase === 'begin'
              ? index === 0
                ? 'begin'
                : 'update'
              : phase === 'end'
                ? index === positions.length - 1
                  ? 'end'
                  : 'update'
                : 'update',
        },
      );
    });
    md.begun = true;
  };

  const cleanupMove = () => {
    if (moveDisposerRef.current) {
      moveDisposerRef.current();
      moveDisposerRef.current = null;
    }
    if (unregisterMoveSettlementRef.current) {
      unregisterMoveSettlementRef.current();
      unregisterMoveSettlementRef.current = null;
    }
  };

  const discardMove = () => {
    const md = moveDragRef.current;
    moveDragRef.current = null;
    md?.hostWindow.cancelAnimationFrame(moveRafRef.current);
    cleanupMove();
    hasDraggedRef.current = false;
  };

  useEffect(() => {
    if (moveDragRef.current && !moveDragRef.current.isCurrent()) discardMove();
  });

  const settleMove = (hostWindow?: Window | null) => {
    const win = hostWindow ?? wrapperRef.current?.ownerDocument?.defaultView ?? window;
    win.cancelAnimationFrame(moveRafRef.current);
    const md = moveDragRef.current;
    if (md && !md.isCurrent()) {
      discardMove();
      return;
    }
    if (md) {
      if (md.latest && !md.begun) {
        applyMove('begin');
      }
      if (md.begun) {
        applyMove('end');
      }
      moveDragRef.current = null;
    }
    cleanupMove();
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 0);
    return useProjectStore?.getState?.()?.flushPendingPatches?.();
  };

  const cancelMove = (hostWindow?: Window | null) => {
    const win = hostWindow ?? wrapperRef.current?.ownerDocument?.defaultView ?? window;
    win.cancelAnimationFrame(moveRafRef.current);
    const md = moveDragRef.current;
    if (md && !md.isCurrent()) {
      discardMove();
      return;
    }
    if (md) {
      if (md.begun) {
        const positions = [...md.positions];
        positions.forEach(([id, startPos], index) => {
          md.dispatch?.(
            {
              type: 'updateWidgetProperties',
              widgetId: id,
              properties: { x: startPos.x, y: startPos.y },
            },
            {
              label: 'Move Blue Synth Builder Widgets',
              gestureId: md.gestureId,
              phase: index === positions.length - 1 ? 'cancel' : 'update',
            },
          );
        });
      }
      moveDragRef.current = null;
    }
    cleanupMove();
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 0);
    return useProjectStore?.getState?.()?.flushPendingPatches?.();
  };

  useEffect(() => {
    return () => {
      if (moveDragRef.current) {
        settleMove();
      }
    };
  }, []);

  const sizeStyle =
    autoSize && displayWidth === undefined && displayHeight === undefined
      ? {}
      : { width: w, height: h };

  const showHandles =
    editEnabled &&
    isSelected &&
    (selectedWidgetIds?.size ?? 0) <= 1 &&
    resizeMeta &&
    onBsbInterfacePatch &&
    (resizeMeta.canResizeWidth || resizeMeta.canResizeHeight);

  const tooltipText =
    !editEnabled && (node.properties?.comment as string)
      ? (node.properties.comment as string)
      : node.preservedOnly
        ? `[Preserved] ${node.objectName || node.type}`
        : undefined;

  const handleRemove = () => {
    if (isSelected) {
      if (onBsbInterfacePatch)
        dispatchBsbAction(
          onBsbInterfacePatch,
          [...(selectedWidgetIds ?? new Set<string>())].map((widgetId) => ({
            type: 'removeWidget',
            widgetId,
          })),
          'Remove Blue Synth Builder Widgets',
        );
      onWidgetSelect(null);
    }
  };

  const widgetDiv = (
    <div
      key={node.id}
      ref={wrapperRef}
      data-widget-id={node.id}
      data-widget-type={node.type}
      className={cn(
        'absolute cursor-default select-none',
        isSelected && editEnabled && 'ring-2 ring-blue-accent',
        node.preservedOnly && 'opacity-60',
      )}
      style={{
        left: node.x,
        top: node.y,
        ...sizeStyle,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (hasDraggedRef.current) return;
        if (editEnabled) onWidgetSelect(node.id, e.shiftKey);
      }}
      onMouseDown={(e) => {
        if (!editEnabled || !isSelected || e.button !== 0) return;
        e.stopPropagation();
        hasDraggedRef.current = false;
        const positions = new Map<string, { x: number; y: number }>();
        if (selectedWidgetIds && selectedWidgetIds.size > 1 && getWidgetPosition) {
          for (const id of selectedWidgetIds) {
            const pos = getWidgetPosition(id);
            if (pos) positions.set(id, { ...pos });
          }
        }
        if (positions.size === 0) {
          positions.set(node.id, { x: node.x, y: node.y });
        }
        const hostDocument = e.currentTarget.ownerDocument;
        const hostWindow = hostDocument?.defaultView ?? window;
        void settleHistoryEditors(hostDocument);

        if (moveDragRef.current) {
          settleMove(hostWindow);
        }

        const gestureId = crypto.randomUUID();
        moveDragRef.current = {
          isCurrent: captureAuthority([...positions.keys()]),
          hostWindow,
          gestureId,
          begun: false,
          latest: null,
          dispatch: onBsbInterfacePatch,
          originClientX: e.clientX,
          originClientY: e.clientY,
          positions,
        };

        unregisterMoveSettlementRef.current = registerHistoryEditorSettlement(hostDocument, () =>
          settleMove(hostWindow),
        );

        moveDisposerRef.current = attachHostGesture({
          host: hostDocument,
          kind: 'mouse',
          onMove: (moveEvent) => {
            const md = moveDragRef.current;
            if (!md) return;
            if (!md.isCurrent()) {
              discardMove();
              return;
            }
            hasDraggedRef.current = true;
            md.latest = moveEvent as MouseEvent;
            moveEvent.preventDefault();
            hostWindow.cancelAnimationFrame(moveRafRef.current);
            moveRafRef.current = hostWindow.requestAnimationFrame(() => {
              if (moveDragRef.current === md) applyMove(md.begun ? 'update' : 'begin');
            });
          },
          onRelease: (releaseEvent) => {
            if (moveDragRef.current?.latest) {
              moveDragRef.current.latest = releaseEvent as MouseEvent;
            }
            settleMove(hostWindow);
          },
          onBlur: () => {
            settleMove(hostWindow);
          },
          onEscape: () => {
            cancelMove(hostWindow);
          },
          onCancel: () => {
            cancelMove(hostWindow);
          },
        });
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
    >
      {children}
      {showHandles && resizeMeta!.canResizeWidth && (
        <>
          <ResizeHandle
            edge="right"
            containerW={w}
            containerH={h}
            nodeId={node.id}
            minSize={resizeMeta!.minWidth}
            propertyKey={widthResizeProperty}
            startValue={resolveResizeStartValue(node, widthResizeProperty, measuredSize.width)}
            gridSnapEnabled={gridSnapEnabled}
            gridSnapSize={gridSnapWidth}
            onPatch={onBsbInterfacePatch!}
            captureAuthority={() => captureAuthority([node.id])}
          />
          <ResizeHandle
            edge="left"
            containerW={w}
            containerH={h}
            nodeId={node.id}
            nodeX={node.x}
            minSize={resizeMeta!.minWidth}
            propertyKey={widthResizeProperty}
            startValue={resolveResizeStartValue(node, widthResizeProperty, measuredSize.width)}
            gridSnapEnabled={gridSnapEnabled}
            gridSnapSize={gridSnapWidth}
            onPatch={onBsbInterfacePatch!}
            captureAuthority={() => captureAuthority([node.id])}
          />
        </>
      )}
      {showHandles && resizeMeta!.canResizeHeight && (
        <>
          <ResizeHandle
            edge="bottom"
            containerW={w}
            containerH={h}
            nodeId={node.id}
            minSize={resizeMeta!.minHeight}
            propertyKey={heightResizeProperty}
            startValue={resolveResizeStartValue(node, heightResizeProperty, measuredSize.height)}
            gridSnapEnabled={gridSnapEnabled}
            gridSnapSize={gridSnapHeight}
            onPatch={onBsbInterfacePatch!}
            captureAuthority={() => captureAuthority([node.id])}
          />
          <ResizeHandle
            edge="top"
            containerW={w}
            containerH={h}
            nodeId={node.id}
            nodeY={node.y}
            minSize={resizeMeta!.minHeight}
            propertyKey={heightResizeProperty}
            startValue={resolveResizeStartValue(node, heightResizeProperty, measuredSize.height)}
            gridSnapEnabled={gridSnapEnabled}
            gridSnapSize={gridSnapHeight}
            onPatch={onBsbInterfacePatch!}
            captureAuthority={() => captureAuthority([node.id])}
          />
        </>
      )}
    </div>
  );

  const wrapped = tooltipText ? (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{widgetDiv}</Tooltip.Trigger>
      <PopoutTooltipPortal>
        <Tooltip.Content className="bsb-tooltip-content" sideOffset={4} side="top" align="center">
          {tooltipText}
          <Tooltip.Arrow className="bsb-tooltip-arrow" width={10} height={5} />
        </Tooltip.Content>
      </PopoutTooltipPortal>
    </Tooltip.Root>
  ) : (
    widgetDiv
  );

  if (!editEnabled) return wrapped;

  const hasSelection = isSelected && selectedWidgetIds && selectedWidgetIds.size > 0;
  const multiSelected = (selectedWidgetIds?.size ?? 0) >= 2;
  const singleGroupSelected = selectedWidgetIds?.size === 1 && node.type === 'BSBGroup';
  const canDistribute = (selectedWidgetIds?.size ?? 0) >= 3;

  const action = (a: string) => () => onWidgetAction?.(a);

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        if (open && !isSelected) onWidgetSelect(node.id);
      }}
    >
      <ContextMenu.Trigger asChild>{wrapped}</ContextMenu.Trigger>
      <PopoutContextMenuPortal>
        <ContextMenu.Content className="editor-context-menu" {...portalEventIsolationProps}>
          {hasSelection && (
            <>
              <ContextMenu.Item className="editor-context-menu__item" onSelect={handleRemove}>
                Remove{selectedWidgetIds!.size > 1 ? ` (${selectedWidgetIds!.size})` : ''}
              </ContextMenu.Item>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" onSelect={action('cut')}>
                Cut
              </ContextMenu.Item>
              <ContextMenu.Item className="editor-context-menu__item" onSelect={action('copy')}>
                Copy
              </ContextMenu.Item>
            </>
          )}
          {multiSelected && (
            <>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item
                className="editor-context-menu__item"
                onSelect={action('make-group')}
              >
                Make Group
              </ContextMenu.Item>
            </>
          )}
          {singleGroupSelected && (
            <ContextMenu.Item
              className="editor-context-menu__item"
              onSelect={action('break-group')}
            >
              Break Group
            </ContextMenu.Item>
          )}
          {multiSelected && (
            <>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger">
                  <span>Align</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </ContextMenu.SubTrigger>
                <PopoutContextMenuPortal>
                  <ContextMenu.SubContent
                    className="editor-context-menu"
                    {...portalEventIsolationProps}
                  >
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('align-left')}
                    >
                      Left
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('align-right')}
                    >
                      Right
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('align-top')}
                    >
                      Top
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('align-bottom')}
                    >
                      Bottom
                    </ContextMenu.Item>
                    <ContextMenu.Separator className="editor-context-menu__separator" />
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('align-center-h')}
                    >
                      Center Horizontal
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('align-center-v')}
                    >
                      Center Vertical
                    </ContextMenu.Item>
                  </ContextMenu.SubContent>
                </PopoutContextMenuPortal>
              </ContextMenu.Sub>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger
                  className="editor-context-menu__item editor-context-menu__subtrigger"
                  disabled={!canDistribute}
                >
                  <span>Distribute</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </ContextMenu.SubTrigger>
                <PopoutContextMenuPortal>
                  <ContextMenu.SubContent
                    className="editor-context-menu"
                    {...portalEventIsolationProps}
                  >
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('distribute-h')}
                    >
                      Horizontal
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="editor-context-menu__item"
                      onSelect={action('distribute-v')}
                    >
                      Vertical
                    </ContextMenu.Item>
                  </ContextMenu.SubContent>
                </PopoutContextMenuPortal>
              </ContextMenu.Sub>
            </>
          )}
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}

export default React.memo(WidgetWrapper);

function resolveResizeStartValue(
  node: BsbWidgetNodeSnapshot,
  propertyKey: string,
  fallback: number,
): number {
  const propertyValue = node.properties[propertyKey];
  if (typeof propertyValue === 'number') return propertyValue;
  if (propertyKey === 'width' && typeof node.width === 'number') return node.width;
  if (propertyKey === 'height' && typeof node.height === 'number') return node.height;
  return fallback;
}

interface ResizeHandleProps {
  edge: 'right' | 'bottom' | 'left' | 'top';
  containerW: number;
  containerH: number;
  nodeId: string;
  nodeX?: number;
  nodeY?: number;
  minSize: number;
  propertyKey: string;
  startValue: number;
  gridSnapEnabled?: boolean;
  gridSnapSize?: number;
  onPatch: BsbInterfacePatchHandler;
  captureAuthority: () => () => boolean;
}

function ResizeHandle({
  edge,
  containerW,
  containerH,
  nodeId,
  nodeX,
  nodeY,
  minSize,
  propertyKey,
  startValue,
  gridSnapEnabled,
  gridSnapSize,
  onPatch,
  captureAuthority,
}: ResizeHandleProps): React.ReactElement {
  const dragState = useRef<{
    isCurrent: () => boolean;
    hostWindow: Window;
    gestureId: string;
    begun: boolean;
    latest: MouseEvent | null;
    dispatch: BsbInterfacePatchHandler;
    startClient: number;
    startVal: number;
    startPos: number;
  } | null>(null);
  const resizeDisposerRef = useRef<(() => void) | null>(null);
  const unregisterResizeSettlementRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const paramsRef = useRef({
    nodeId,
    nodeX,
    nodeY,
    minSize,
    gridSnapEnabled,
    gridSnapSize,
    propertyKey,
  });
  paramsRef.current = { nodeId, nodeX, nodeY, minSize, gridSnapEnabled, gridSnapSize, propertyKey };
  const patchRef = useRef(onPatch);
  patchRef.current = onPatch;

  const isHorizontal = edge === 'right' || edge === 'left';

  const handleStyle: React.CSSProperties = (() => {
    switch (edge) {
      case 'right':
        return {
          position: 'absolute',
          right: 0,
          top: containerH / 2 - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          cursor: 'e-resize',
          zIndex: 20,
        };
      case 'left':
        return {
          position: 'absolute',
          left: 0,
          top: containerH / 2 - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          cursor: 'w-resize',
          zIndex: 20,
        };
      case 'bottom':
        return {
          position: 'absolute',
          bottom: 0,
          left: containerW / 2 - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          cursor: 's-resize',
          zIndex: 20,
        };
      case 'top':
        return {
          position: 'absolute',
          top: 0,
          left: containerW / 2 - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          cursor: 'n-resize',
          zIndex: 20,
        };
    }
  })();

  const handleRef = useRef<HTMLDivElement>(null);

  const applyResize = (phase: 'begin' | 'update' | 'end') => {
    const ds = dragState.current;
    if (!ds) return;
    if (!ds.isCurrent()) {
      discardResize();
      return;
    }
    if (!ds.begun && !ds.latest) return;
    const {
      nodeId: id,
      minSize: ms,
      gridSnapEnabled: snap,
      gridSnapSize: gs,
      propertyKey: pk,
    } = paramsRef.current;
    let delta = 0;
    if (ds.latest) {
      const client = isHorizontal ? ds.latest.clientX : ds.latest.clientY;
      delta = client - ds.startClient;
      if (snap && gs) delta = Math.round(delta / gs) * gs;
    }
    const properties: Record<string, unknown> = {};
    if (edge === 'right' || edge === 'bottom') {
      properties[pk] = Math.max(ms, ds.startVal + delta);
    } else {
      delta = Math.max(-ds.startPos, Math.min(delta, ds.startVal - ms));
      const newPos = ds.startPos + delta;
      properties[pk] = Math.max(ms, ds.startVal - delta);
      properties[isHorizontal ? 'x' : 'y'] = newPos;
    }
    ds.dispatch(
      { type: 'updateWidgetProperties', widgetId: id, properties },
      {
        label: 'Resize Blue Synth Builder Widget',
        gestureId: ds.gestureId,
        phase,
      },
    );
    ds.begun = true;
  };

  const cleanupResize = () => {
    if (resizeDisposerRef.current) {
      resizeDisposerRef.current();
      resizeDisposerRef.current = null;
    }
    if (unregisterResizeSettlementRef.current) {
      unregisterResizeSettlementRef.current();
      unregisterResizeSettlementRef.current = null;
    }
  };

  const discardResize = () => {
    const ds = dragState.current;
    dragState.current = null;
    ds?.hostWindow.cancelAnimationFrame(rafRef.current);
    cleanupResize();
  };

  useEffect(() => {
    if (dragState.current && !dragState.current.isCurrent()) discardResize();
  });

  const settleResize = (hostWindow?: Window | null) => {
    const win = hostWindow ?? handleRef.current?.ownerDocument?.defaultView ?? window;
    win.cancelAnimationFrame(rafRef.current);
    const ds = dragState.current;
    if (ds && !ds.isCurrent()) {
      discardResize();
      return;
    }
    if (ds) {
      if (ds.latest && !ds.begun) {
        applyResize('begin');
      }
      if (ds.begun) {
        applyResize('end');
      }
      dragState.current = null;
    }
    cleanupResize();
    return useProjectStore?.getState?.()?.flushPendingPatches?.();
  };

  const cancelResize = (hostWindow?: Window | null) => {
    const win = hostWindow ?? handleRef.current?.ownerDocument?.defaultView ?? window;
    win.cancelAnimationFrame(rafRef.current);
    const ds = dragState.current;
    if (ds && !ds.isCurrent()) {
      discardResize();
      return;
    }
    if (ds) {
      if (ds.begun) {
        const { nodeId: id, propertyKey: pk } = paramsRef.current;
        const properties: Record<string, unknown> = {
          [pk]: ds.startVal,
        };
        if (edge === 'left') {
          properties.x = ds.startPos;
        } else if (edge === 'top') {
          properties.y = ds.startPos;
        }
        ds.dispatch(
          { type: 'updateWidgetProperties', widgetId: id, properties },
          {
            label: 'Resize Blue Synth Builder Widget',
            gestureId: ds.gestureId,
            phase: 'cancel',
          },
        );
      }
      dragState.current = null;
    }
    cleanupResize();
    return useProjectStore?.getState?.()?.flushPendingPatches?.();
  };

  useEffect(() => {
    return () => {
      if (dragState.current) {
        settleResize();
      }
    };
  }, []);

  return (
    <div
      ref={handleRef}
      className="bsb-resize-handle"
      data-resize-edge={edge}
      style={{ ...handleStyle, backgroundColor: 'var(--color-app-focus)' }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button !== 0) return;
        const hostDocument = e.currentTarget.ownerDocument;
        const hostWindow = hostDocument?.defaultView ?? window;
        void settleHistoryEditors(hostDocument);

        if (dragState.current) {
          settleResize(hostWindow);
        }

        const gestureId = crypto.randomUUID();
        dragState.current = {
          isCurrent: captureAuthority(),
          hostWindow,
          gestureId,
          begun: false,
          latest: null,
          dispatch: patchRef.current,
          startClient: isHorizontal ? e.clientX : e.clientY,
          startVal: startValue,
          startPos: edge === 'left' ? (nodeX ?? 0) : edge === 'top' ? (nodeY ?? 0) : 0,
        };

        unregisterResizeSettlementRef.current = registerHistoryEditorSettlement(hostDocument, () =>
          settleResize(hostWindow),
        );

        resizeDisposerRef.current = attachHostGesture({
          host: hostDocument,
          kind: 'mouse',
          onMove: (moveEvent) => {
            const ds = dragState.current;
            if (!ds) return;
            if (!ds.isCurrent()) {
              discardResize();
              return;
            }
            ds.latest = moveEvent as MouseEvent;
            moveEvent.preventDefault();
            hostWindow.cancelAnimationFrame(rafRef.current);
            rafRef.current = hostWindow.requestAnimationFrame(() => {
              if (dragState.current === ds) applyResize(ds.begun ? 'update' : 'begin');
            });
          },
          onRelease: (releaseEvent) => {
            if (dragState.current?.latest) {
              dragState.current.latest = releaseEvent as MouseEvent;
            }
            settleResize(hostWindow);
          },
          onBlur: () => {
            settleResize(hostWindow);
          },
          onEscape: () => {
            cancelResize(hostWindow);
          },
          onCancel: () => {
            cancelResize(hostWindow);
          },
        });
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
