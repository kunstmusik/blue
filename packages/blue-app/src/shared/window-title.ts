import type { ProjectSaveState } from './project-history';

/**
 * Main-window title for the active project (spec 109). The state markers are
 * an intentional divergence from Java Blue's version-bearing title; the
 * basename (including extension) is display-only and never normalized for
 * identity or filesystem use.
 */
export function getWindowTitle(filePath: string | null, saveState: ProjectSaveState): string {
  if (saveState === 'none') {
    return 'Blue';
  }
  if (saveState === 'unsaved') {
    return 'Blue - New Project - [UNSAVED PROJECT]';
  }
  const fileName = filePath ? (filePath.split(/[\\/]/).pop() ?? filePath) : 'New Project';
  return saveState === 'modified' ? `Blue - ${fileName} - [modified]` : `Blue - ${fileName}`;
}
