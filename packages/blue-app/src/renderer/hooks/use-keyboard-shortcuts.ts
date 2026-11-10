import { useEffect } from 'react';
import { useProjectStore } from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';
import { isEventInsidePortalPopup, isNodeLike } from '../utils/cross-realm-dom';

interface ClosestElementTarget {
  closest: (selector: string) => Element | null;
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (
    !target ||
    typeof target !== 'object' ||
    typeof (target as Partial<ClosestElementTarget>).closest !== 'function'
  ) {
    return false;
  }

  return Boolean(
    (target as EventTarget & ClosestElementTarget).closest(
      [
        'input',
        'textarea',
        'select',
        '[contenteditable=""]',
        '[contenteditable="true"]',
        '.cm-editor',
        '.workbench-context-menu',
        '.selected-code-editor',
      ].join(','),
    ),
  );
}

export function getTargetDocument(target: EventTarget | null): Document | null {
  if (!target || typeof target !== 'object') {
    return typeof document !== 'undefined' ? document : null;
  }
  if ('ownerDocument' in target && (target as Node).ownerDocument) {
    return (target as Node).ownerDocument;
  }
  if ('documentElement' in target && typeof (target as Document).querySelector === 'function') {
    return target as Document;
  }
  if ('document' in target && (target as Window).document) {
    return (target as Window).document;
  }
  return typeof document !== 'undefined' ? document : null;
}

export function hasActiveModalInDocument(target: EventTarget | null): boolean {
  const doc = getTargetDocument(target);
  if (!doc || typeof doc.querySelector !== 'function') {
    return false;
  }
  try {
    return doc.querySelector('[aria-modal="true"], [role="alertdialog"]') !== null;
  } catch {
    return false;
  }
}

export const hasActiveModal = hasActiveModalInDocument;

export function isInsideModalOrPopup(target: EventTarget | null): boolean {
  if (isEventInsidePortalPopup(target)) {
    return true;
  }

  if (
    target &&
    typeof target === 'object' &&
    typeof (target as Partial<ClosestElementTarget>).closest === 'function'
  ) {
    try {
      const match = (target as EventTarget & ClosestElementTarget).closest(
        '[aria-modal="true"], [role="alertdialog"], [role="dialog"], [role="menu"], [role="menuitem"], [role="listbox"], [role="tooltip"], dialog',
      );
      if (match) return true;
    } catch {
      // Fall through to tree walk
    }
  }

  if (!isNodeLike(target)) {
    return false;
  }

  let node: Node | null = target as Node;
  while (node) {
    if (node.nodeType === 1) {
      const el = node as Element;
      const role = el.getAttribute?.('role');
      const ariaModal = el.getAttribute?.('aria-modal');
      const tag = el.tagName?.toLowerCase();
      if (
        role === 'alertdialog' ||
        role === 'dialog' ||
        role === 'menu' ||
        role === 'menuitem' ||
        role === 'listbox' ||
        role === 'tooltip' ||
        ariaModal === 'true' ||
        tag === 'dialog'
      ) {
        return true;
      }
    }
    node = node.parentNode;
  }

  return false;
}

export function useKeyboardShortcuts(): void {
  const loadProject = useProjectStore((s) => s.loadProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const saveProjectAs = useProjectStore((s) => s.saveProjectAs);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const stop = usePlaybackStore((s) => s.stop);
  const flushPatches = useProjectStore((s) => s.flushPendingPatches);
  const hasProject = useProjectStore((s) => s.filePath !== null);

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // 1. Honor already-handled/prevented events
      if (e.defaultPrevented) {
        return;
      }

      // 2. Document-wide modal check in target's host document:
      // If [aria-modal="true"] or [role="alertdialog"] is active, workspace shortcuts must not run.
      if (hasActiveModalInDocument(e.target)) {
        return;
      }

      // 3. Target popup / dialog ancestry check:
      // If target sits inside a modal, alertdialog, dialog, or popup surface (menu, listbox, tooltip),
      // the surface owns its keyboard interaction; workspace shortcuts must not run.
      if (isInsideModalOrPopup(e.target)) {
        return;
      }

      const meta = e.metaKey || e.ctrlKey;
      const editingText = isTextEditingTarget(e.target);

      if (e.code === 'Space' && !meta && !e.repeat && hasProject && !editingText) {
        e.preventDefault();
        await flushPatches();
        await togglePlay();
      }

      if (
        e.code === 'KeyF' &&
        meta &&
        e.shiftKey &&
        !e.altKey &&
        !e.repeat &&
        hasProject &&
        !editingText
      ) {
        e.preventDefault();
        usePlaybackStore.getState().toggleFollowPlayback();
      }

      if (e.code === 'Escape' && !meta && !editingText) {
        e.preventDefault();
        await stop();
      }

      if (e.code === 'KeyO' && meta) {
        e.preventDefault();
        await loadProject();
      }

      if (e.code === 'KeyS' && meta && hasProject) {
        e.preventDefault();
        if (e.shiftKey) {
          await saveProjectAs();
        } else {
          await saveProject();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasProject, loadProject, saveProject, saveProjectAs, togglePlay, stop, flushPatches]);
}
