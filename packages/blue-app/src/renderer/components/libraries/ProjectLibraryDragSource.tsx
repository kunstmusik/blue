import { cloneElement, forwardRef, useCallback, useRef, type ReactElement } from 'react';

import type { LibraryBrowseNode, LibraryDragDescriptor } from '../../../shared/unified-library';
import {
  beginLibraryNodeDrag,
  cancelLibraryNodeDrag,
  writeLibraryDragDescriptor,
} from './library-drag-drop';

interface ProjectLibraryDragSourceProps extends React.HTMLAttributes<HTMLElement> {
  readonly node: LibraryBrowseNode | null;
  readonly children: ReactElement<React.HTMLAttributes<HTMLElement>>;
}

export const ProjectLibraryDragSource = forwardRef<HTMLElement, ProjectLibraryDragSourceProps>(function ProjectLibraryDragSource({
  node,
  children,
  ...forwardedProps
}, forwardedRef): React.ReactElement {
  const descriptorRef = useRef<LibraryDragDescriptor | null>(null);
  const prepare = useCallback(() => {
    if (!descriptorRef.current && node) descriptorRef.current = beginLibraryNodeDrag(node);
  }, [node]);

  const {
    draggable: forwardedDraggable,
    onDragEnd: forwardedDragEnd,
    onDragStart: forwardedDragStart,
    onMouseEnter: forwardedMouseEnter,
    onPointerDown: forwardedPointerDown,
    ...restForwardedProps
  } = forwardedProps;

  return cloneElement(children, {
    ...restForwardedProps,
    ref: forwardedRef,
    draggable: Boolean(node) || Boolean(forwardedDraggable) || Boolean(children.props.draggable),
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      children.props.onPointerDown?.(event);
      forwardedPointerDown?.(event);
      prepare();
    },
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onMouseEnter?.(event);
      forwardedMouseEnter?.(event);
      prepare();
    },
    onDragStart: (event: React.DragEvent<HTMLElement>) => {
      children.props.onDragStart?.(event);
      forwardedDragStart?.(event);
      if (event.defaultPrevented) return;
      if (!node) return;
      const descriptor = descriptorRef.current;
      if (!descriptor) {
        event.preventDefault();
        prepare();
        return;
      }
      writeLibraryDragDescriptor(event.dataTransfer, descriptor);
    },
    onDragEnd: (event: React.DragEvent<HTMLElement>) => {
      children.props.onDragEnd?.(event);
      forwardedDragEnd?.(event);
      const descriptor = descriptorRef.current;
      if (event.dataTransfer.dropEffect === 'move') {
        void cancelLibraryNodeDrag(descriptor);
      } else if (event.dataTransfer.dropEffect === 'none') {
        window.setTimeout(() => { void cancelLibraryNodeDrag(descriptor); }, 5_000);
      }
      descriptorRef.current = null;
    },
  });
});
