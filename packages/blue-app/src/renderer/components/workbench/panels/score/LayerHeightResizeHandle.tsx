import React, { useCallback, useRef, useState } from 'react';
import { cn } from '../../../../lib/cn';
import { MIN_LAYER_HEIGHT, MAX_LAYER_HEIGHT } from './layer-selection-utils';

export interface LayerHeightResizeHandleProps {
  groupId: string;
  layerIndex: number;
  layerSelectionId: string;
  layerName: string;
  currentHeight: number;
  isActive?: boolean;
  activeHeight?: number;
  isSelected?: boolean;
  selectedCount?: number;
  onStartResize: (params: {
    clientY: number;
    groupId: string;
    layerIndex: number;
    layerSelectionId: string;
    hostWindow: Window;
  }) => { ok?: boolean } | void;
  onUpdateResize?: (clientY: number) => void;
  onCommitResize?: (clientY: number) => void;
  onCancelResize?: () => void;
  onKeyboardResize?: (newHeight: number, hostDocument: Document) => void;
}

export const LayerHeightResizeHandle: React.FC<LayerHeightResizeHandleProps> = ({
  groupId,
  layerIndex,
  layerSelectionId,
  layerName,
  currentHeight,
  isActive = false,
  activeHeight,
  isSelected = false,
  selectedCount = 1,
  onStartResize,
  onUpdateResize,
  onCommitResize,
  onCancelResize,
  onKeyboardResize,
}) => {
  const [isPointerDown, setIsPointerDown] = useState(false);
  const releaseDispositionRef = useRef<'commit' | 'cancel' | null>(null);

  const displayHeight = isActive && activeHeight !== undefined ? activeHeight : currentHeight;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      const hostWindow = e.currentTarget.ownerDocument.defaultView ?? window;

      const result = onStartResize({
        clientY: e.clientY,
        groupId,
        layerIndex,
        layerSelectionId,
        hostWindow,
      });
      if (result && result.ok === false) return;

      releaseDispositionRef.current = null;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignored if pointer capture not supported
      }

      setIsPointerDown(true);
    },
    [groupId, layerIndex, layerSelectionId, onStartResize],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDown) return;
      e.stopPropagation();
      onUpdateResize?.(e.clientY);
    },
    [isPointerDown, onUpdateResize],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDown) return;
      e.stopPropagation();
      releaseDispositionRef.current = 'commit';
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
      }
      setIsPointerDown(false);
      onCommitResize?.(e.clientY);
    },
    [isPointerDown, onCommitResize],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDown) return;
      e.stopPropagation();
      releaseDispositionRef.current = 'cancel';
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
      }
      setIsPointerDown(false);
      onCancelResize?.();
    },
    [isPointerDown, onCancelResize],
  );

  const handleLostPointerCapture = useCallback(() => {
    if (!isPointerDown) return;
    const disposition = releaseDispositionRef.current;
    releaseDispositionRef.current = null;
    setIsPointerDown(false);
    if (disposition === 'commit' || disposition === 'cancel') return;
    onCancelResize?.();
  }, [isPointerDown, onCancelResize]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onKeyboardResize) return;
      const dispatchKeyboardResize = (newHeight: number) =>
        onKeyboardResize(newHeight, e.currentTarget.ownerDocument);
      const editableHeight = Math.max(MIN_LAYER_HEIGHT, Math.min(MAX_LAYER_HEIGHT, currentHeight));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 10 : 1;
        const next = Math.min(MAX_LAYER_HEIGHT, editableHeight + step);
        dispatchKeyboardResize(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 10 : 1;
        const next = Math.max(MIN_LAYER_HEIGHT, editableHeight - step);
        dispatchKeyboardResize(next);
      } else if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        dispatchKeyboardResize(MIN_LAYER_HEIGHT);
      } else if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        dispatchKeyboardResize(MAX_LAYER_HEIGHT);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          }),
        );
      }
    },
    [currentHeight, onKeyboardResize],
  );

  const selectedScope = isSelected && selectedCount > 1;
  const scopeText = selectedScope ? `Selected Layers (${selectedCount})` : 'This Layer';
  const tooltipText = selectedScope
    ? `Resize ${selectedCount} selected layers`
    : `Resize height for ${layerName} (${currentHeight}px)`;
  const accessibleLabel = `${scopeText}: resize height for ${layerName}`;

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label={accessibleLabel}
      aria-valuenow={displayHeight}
      aria-valuemin={MIN_LAYER_HEIGHT}
      aria-valuemax={MAX_LAYER_HEIGHT}
      aria-valuetext={`${displayHeight} pixels; ${scopeText}; allowed ${MIN_LAYER_HEIGHT} to ${MAX_LAYER_HEIGHT} pixels`}
      title={isActive ? `${scopeText} · ${displayHeight}px` : tooltipText}
      data-layer-resize-handle="true"
      data-group-id={groupId}
      data-layer-index={layerIndex}
      data-layer-selection-id={layerSelectionId}
      className={cn(
        'absolute bottom-0 left-0 right-0 z-20 cursor-row-resize select-none',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-app-focus',
      )}
      style={{ height: 4 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onKeyDown={handleKeyDown}
    />
  );
};
