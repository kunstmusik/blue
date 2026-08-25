import React, { useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import type { BsbWidgetNodeSnapshot, BsbInterfacePatch } from '../../../../../../../shared/project-editor';
import type { BSBWidgetResizeMeta } from '../bsb-widget-meta';
import { getWidgetDisplaySize } from './utils';
import { PopoutContextMenuPortal, PopoutTooltipPortal, portalEventIsolationProps } from '../../../../../../hooks/host-portals';

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
  onBsbInterfacePatch?: (patch: BsbInterfacePatch) => void;
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
  const measuredSize = getWidgetDisplaySize(node);
  const w = displayWidth ?? measuredSize.width;
  const h = displayHeight ?? measuredSize.height;
  const widthResizeProperty = resizeMeta?.widthProperty ?? 'width';
  const heightResizeProperty = resizeMeta?.heightProperty ?? 'height';

  type MoveDragState = {
    originClientX: number;
    originClientY: number;
    positions: Map<string, { x: number; y: number }>;
  };

  const moveDragRef = useRef<MoveDragState | null>(null);
  const hasDraggedRef = useRef(false);
  const moveParamsRef = useRef({ gridSnapEnabled, gridSnapWidth, gridSnapHeight, onBsbInterfacePatch });
  moveParamsRef.current = { gridSnapEnabled, gridSnapWidth, gridSnapHeight, onBsbInterfacePatch };

  const moveRafRef = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const md = moveDragRef.current;
      if (!md) return;
      hasDraggedRef.current = true;
      e.preventDefault();
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = requestAnimationFrame(() => {
        const md2 = moveDragRef.current;
        if (!md2) return;
        const { gridSnapEnabled: snap, gridSnapWidth: gw, gridSnapHeight: gh, onBsbInterfacePatch: patch } = moveParamsRef.current;
        let dx = e.clientX - md2.originClientX;
        let dy = e.clientY - md2.originClientY;
        if (snap && gw) dx = Math.round(dx / gw) * gw;
        if (snap && gh) dy = Math.round(dy / gh) * gh;

        // Clamp delta so no widget goes below 0
        let minNx = Infinity;
        let minNy = Infinity;
        for (const [, startPos] of md2.positions) {
          minNx = Math.min(minNx, startPos.x + dx);
          minNy = Math.min(minNy, startPos.y + dy);
        }
        if (minNx < 0) dx -= minNx;
        if (minNy < 0) dy -= minNy;

        for (const [id, startPos] of md2.positions) {
          const nx = startPos.x + dx;
          const ny = startPos.y + dy;
          patch?.({ type: 'updateWidgetProperties', widgetId: id, properties: { x: nx, y: ny } });
        }
      });
    };
    const onUp = () => {
      cancelAnimationFrame(moveRafRef.current);
      moveDragRef.current = null;
      // Clear hasDragged after a short delay so click handler can read it
      setTimeout(() => { hasDraggedRef.current = false; }, 0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(moveRafRef.current);
    };
  }, []);

  const sizeStyle = autoSize && displayWidth === undefined && displayHeight === undefined
    ? {}
    : { width: w, height: h };

  const showHandles = editEnabled && isSelected && (selectedWidgetIds?.size ?? 0) <= 1 && resizeMeta && onBsbInterfacePatch &&
    (resizeMeta.canResizeWidth || resizeMeta.canResizeHeight);

  const tooltipText =
    !editEnabled && (node.properties?.comment as string)
      ? (node.properties.comment as string)
      : node.preservedOnly
        ? `[Preserved] ${node.objectName || node.type}`
        : undefined;

  const handleRemove = () => {
    if (isSelected) {
      for (const id of selectedWidgetIds ?? new Set()) {
        onBsbInterfacePatch?.({ type: 'removeWidget', widgetId: id });
      }
      onWidgetSelect(null);
    }
  };

  const widgetDiv = (
    <div
      key={node.id}
      data-widget-id={node.id}
      data-widget-type={node.type}
      className={[
        'absolute cursor-default select-none',
        isSelected && editEnabled ? 'ring-2 ring-blue-accent' : '',
        node.preservedOnly ? 'opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
        moveDragRef.current = { originClientX: e.clientX, originClientY: e.clientY, positions };
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
    >
      {children}
      {showHandles && resizeMeta!.canResizeWidth && (
        <>
          <ResizeHandle edge="right" containerW={w} containerH={h} nodeId={node.id} minSize={resizeMeta!.minWidth} propertyKey={widthResizeProperty} startValue={resolveResizeStartValue(node, widthResizeProperty, measuredSize.width)} gridSnapEnabled={gridSnapEnabled} gridSnapSize={gridSnapWidth} onPatch={onBsbInterfacePatch!} />
          <ResizeHandle edge="left" containerW={w} containerH={h} nodeId={node.id} nodeX={node.x} minSize={resizeMeta!.minWidth} propertyKey={widthResizeProperty} startValue={resolveResizeStartValue(node, widthResizeProperty, measuredSize.width)} gridSnapEnabled={gridSnapEnabled} gridSnapSize={gridSnapWidth} onPatch={onBsbInterfacePatch!} />
        </>
      )}
      {showHandles && resizeMeta!.canResizeHeight && (
        <>
          <ResizeHandle edge="bottom" containerW={w} containerH={h} nodeId={node.id} minSize={resizeMeta!.minHeight} propertyKey={heightResizeProperty} startValue={resolveResizeStartValue(node, heightResizeProperty, measuredSize.height)} gridSnapEnabled={gridSnapEnabled} gridSnapSize={gridSnapHeight} onPatch={onBsbInterfacePatch!} />
          <ResizeHandle edge="top" containerW={w} containerH={h} nodeId={node.id} nodeY={node.y} minSize={resizeMeta!.minHeight} propertyKey={heightResizeProperty} startValue={resolveResizeStartValue(node, heightResizeProperty, measuredSize.height)} gridSnapEnabled={gridSnapEnabled} gridSnapSize={gridSnapHeight} onPatch={onBsbInterfacePatch!} />
        </>
      )}
    </div>
  );

  const wrapped = tooltipText ? (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {widgetDiv}
      </Tooltip.Trigger>
      <PopoutTooltipPortal>
        <Tooltip.Content
          className="bsb-tooltip-content"
          sideOffset={4}
          side="top"
          align="center"
        >
          {tooltipText}
          <Tooltip.Arrow className="bsb-tooltip-arrow" width={10} height={5} />
        </Tooltip.Content>
      </PopoutTooltipPortal>
    </Tooltip.Root>
  ) : widgetDiv;

  if (!editEnabled) return wrapped;

  const hasSelection = isSelected && selectedWidgetIds && selectedWidgetIds.size > 0;
  const multiSelected = (selectedWidgetIds?.size ?? 0) >= 2;
  const singleGroupSelected = selectedWidgetIds?.size === 1 && node.type === 'BSBGroup';
  const canDistribute = (selectedWidgetIds?.size ?? 0) >= 3;

  const action = (a: string) => () => onWidgetAction?.(a);

  return (
    <ContextMenu.Root onOpenChange={(open) => { if (open && !isSelected) onWidgetSelect(node.id); }}>
      <ContextMenu.Trigger asChild>
        {wrapped}
      </ContextMenu.Trigger>
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
              <ContextMenu.Item className="editor-context-menu__item" onSelect={action('make-group')}>
                Make Group
              </ContextMenu.Item>
            </>
          )}
          {singleGroupSelected && (
            <ContextMenu.Item className="editor-context-menu__item" onSelect={action('break-group')}>
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
                  <ContextMenu.SubContent className="editor-context-menu" {...portalEventIsolationProps}>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('align-left')}>Left</ContextMenu.Item>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('align-right')}>Right</ContextMenu.Item>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('align-top')}>Top</ContextMenu.Item>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('align-bottom')}>Bottom</ContextMenu.Item>
                    <ContextMenu.Separator className="editor-context-menu__separator" />
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('align-center-h')}>Center Horizontal</ContextMenu.Item>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('align-center-v')}>Center Vertical</ContextMenu.Item>
                  </ContextMenu.SubContent>
                </PopoutContextMenuPortal>
              </ContextMenu.Sub>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger" disabled={!canDistribute}>
                  <span>Distribute</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </ContextMenu.SubTrigger>
                <PopoutContextMenuPortal>
                  <ContextMenu.SubContent className="editor-context-menu" {...portalEventIsolationProps}>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('distribute-h')}>Horizontal</ContextMenu.Item>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={action('distribute-v')}>Vertical</ContextMenu.Item>
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
  onPatch: (patch: BsbInterfacePatch) => void;
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
}: ResizeHandleProps): React.ReactElement {
  const dragState = useRef<{ startClient: number; startVal: number; startPos: number } | null>(null);
  const rafRef = useRef(0);
  const paramsRef = useRef({ nodeId, nodeX, nodeY, minSize, gridSnapEnabled, gridSnapSize, propertyKey });
  paramsRef.current = { nodeId, nodeX, nodeY, minSize, gridSnapEnabled, gridSnapSize, propertyKey };
  const patchRef = useRef(onPatch);
  patchRef.current = onPatch;

  const isHorizontal = edge === 'right' || edge === 'left';

  const handleStyle: React.CSSProperties = (() => {
    switch (edge) {
      case 'right': return { position: 'absolute', right: 0, top: containerH / 2 - HANDLE_SIZE / 2, width: HANDLE_SIZE, height: HANDLE_SIZE, cursor: 'e-resize', zIndex: 20 };
      case 'left': return { position: 'absolute', left: 0, top: containerH / 2 - HANDLE_SIZE / 2, width: HANDLE_SIZE, height: HANDLE_SIZE, cursor: 'w-resize', zIndex: 20 };
      case 'bottom': return { position: 'absolute', bottom: 0, left: containerW / 2 - HANDLE_SIZE / 2, width: HANDLE_SIZE, height: HANDLE_SIZE, cursor: 's-resize', zIndex: 20 };
      case 'top': return { position: 'absolute', top: 0, left: containerW / 2 - HANDLE_SIZE / 2, width: HANDLE_SIZE, height: HANDLE_SIZE, cursor: 'n-resize', zIndex: 20 };
    }
  })();

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const ds2 = dragState.current;
        if (!ds2) return;
        const { nodeId: id, minSize: ms, gridSnapEnabled: snap, gridSnapSize: gs, propertyKey: pk } = paramsRef.current;
        const client = isHorizontal ? e.clientX : e.clientY;
        let delta = client - ds2.startClient;
        if (snap && gs) delta = Math.round(delta / gs) * gs;

        if (edge === 'right' || edge === 'bottom') {
          const newSize = Math.max(ms, ds2.startVal + delta);
          patchRef.current({ type: 'updateWidgetProperties', widgetId: id, properties: { [pk]: newSize } });
        } else {
          const newSize = Math.max(ms, ds2.startVal - delta);
          const newPos = ds2.startPos + delta;
          if (newPos >= 0) {
            patchRef.current({ type: 'updateWidgetProperties', widgetId: id, properties: { [pk]: newSize, [isHorizontal ? 'x' : 'y']: newPos } });
          }
        }
      });
    };
    const onMouseUp = () => {
      cancelAnimationFrame(rafRef.current);
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [edge, isHorizontal]);

  return (
    <div
      className="bsb-resize-handle"
      data-resize-edge={edge}
      style={{ ...handleStyle, backgroundColor: 'var(--color-app-focus)' }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        dragState.current = { startClient: isHorizontal ? e.clientX : e.clientY, startVal: startValue, startPos: edge === 'left' ? (nodeX ?? 0) : edge === 'top' ? (nodeY ?? 0) : 0 };
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
