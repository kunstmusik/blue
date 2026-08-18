import { useEffect } from 'react';
import { useProjectStore } from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';

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
    (target as ClosestElementTarget).closest(
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
      const meta = e.metaKey || e.ctrlKey;
      const editingText = isTextEditingTarget(e.target);

      if (e.code === 'Space' && !meta && !e.repeat && hasProject && !editingText) {
        e.preventDefault();
        await flushPatches();
        await togglePlay();
      }

      if (e.code === 'KeyF' && !meta && !e.altKey && !e.shiftKey && !e.repeat && hasProject && !editingText) {
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
