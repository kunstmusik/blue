import { useCallback, useEffect, useState } from 'react';
import {
  getLibraryTransferSourceType,
  type LibraryExactTransferTarget,
  type LibraryType,
} from '../../../shared/unified-library';
import { useLibraryStore } from '../../stores/library-store';
import { BLUE_LIBRARY_DRAG_MIME, readLibraryDragDescriptor, readLibraryDragSource } from './library-drag-drop';

function targetLibraryType(target: LibraryExactTransferTarget): LibraryType {
  if (target.kind === 'orchestra' || target.kind === 'trackInstrument') return 'instrument';
  if (target.kind === 'projectUdo') return 'udo';
  if (target.kind === 'effectChain') return 'effect';
  return 'soundObject';
}

export function useLibraryDropTarget(target: LibraryExactTransferTarget, enabled = true) {
  const [active, setActive] = useState(false);
  const [feedback, setFeedback] = useState('');
  const transferToProject = useLibraryStore((state) => state.transferToProject);
  const cancelTransfer = useLibraryStore((state) => state.cancelTransfer);
  const clipboard = useLibraryStore((state) => state.clipboard);

  const expectedType = targetLibraryType(target);
  const clipboardCompatible = enabled && clipboard
    ? getLibraryTransferSourceType(clipboard.source) === expectedType
    : false;

  useEffect(() => {
    const clearActiveDropTarget = () => setActive(false);
    window.addEventListener('drop', clearActiveDropTarget, true);
    window.addEventListener('dragend', clearActiveDropTarget, true);
    return () => {
      window.removeEventListener('drop', clearActiveDropTarget, true);
      window.removeEventListener('dragend', clearActiveDropTarget, true);
    };
  }, []);

  const paste = useCallback(async () => {
    if (!enabled || !clipboard) return;
    if (!clipboardCompatible) {
      setFeedback(`Paste unavailable: this destination accepts ${expectedType} Library items.`);
      return;
    }
    const transferred = await transferToProject({ kind: 'clipboard', source: clipboard.source }, target);
    setFeedback(transferred
      ? 'Library transfer accepted.'
      : (useLibraryStore.getState().error ?? 'Library transfer was rejected.'));
  }, [clipboard, clipboardCompatible, enabled, expectedType, target, transferToProject]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!enabled) return;
    if (!event.dataTransfer.types.includes(BLUE_LIBRARY_DRAG_MIME)) return;
    event.preventDefault();
    const descriptor = readLibraryDragDescriptor(event.dataTransfer);
    if (descriptor && descriptor.libraryType !== expectedType) {
      event.dataTransfer.dropEffect = 'none';
      setActive(false);
      setFeedback(`Invalid drop: this destination accepts ${expectedType} Library items.`);
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    setActive(true);
    setFeedback('Compatible Library insertion point.');
    const scroller = event.currentTarget.closest('[data-library-autoscroll]');
    if (scroller instanceof HTMLElement) {
      const rect = scroller.getBoundingClientRect();
      if (event.clientY < rect.top + 24) scroller.scrollTop -= 16;
      else if (event.clientY > rect.bottom - 24) scroller.scrollTop += 16;
    }
  }, [enabled, expectedType]);

  const onDrop = useCallback(async (event: React.DragEvent<HTMLElement>) => {
    if (!enabled) return;
    const descriptor = readLibraryDragDescriptor(event.dataTransfer);
    if (descriptor && descriptor.libraryType !== expectedType) {
      event.preventDefault();
      setActive(false);
      setFeedback(`Invalid drop: this destination accepts ${expectedType} Library items.`);
      return;
    }
    const source = readLibraryDragSource(event.dataTransfer);
    if (!source) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setActive(false);
    const transferred = await transferToProject(source, target);
    setFeedback(transferred
      ? 'Library transfer accepted.'
      : (useLibraryStore.getState().error ?? 'Library transfer was rejected.'));
  }, [enabled, expectedType, target, transferToProject]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (enabled && (event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'v' && clipboard) {
      event.preventDefault();
      event.stopPropagation();
      void paste();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setActive(false);
      cancelTransfer();
      setFeedback('Library transfer cancelled.');
    }
  }, [cancelTransfer, clipboard, enabled, paste]);

  return {
    active: enabled && active,
    canPaste: Boolean(clipboardCompatible),
    feedback,
    paste,
    dropProps: {
      onDragOver,
      onDragEnter: onDragOver,
      onDragLeave: () => setActive(false),
      onDrop,
      onKeyDown,
    },
  };
}
