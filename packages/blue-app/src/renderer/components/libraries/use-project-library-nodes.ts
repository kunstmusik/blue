import { useEffect, useState } from 'react';

import type {
  LibraryBrowseNode,
  LibraryScopeKind,
  LibraryType,
} from '../../../shared/unified-library';

type ProjectLibraryScope = Exclude<LibraryScopeKind, 'user'>;

export async function browseProjectLibraryNodes(
  scope: ProjectLibraryScope,
  libraryType: LibraryType,
  projectSessionId: number,
  isCancelled: () => boolean = () => false,
): Promise<LibraryBrowseNode[]> {
  const children: LibraryBrowseNode[] = [];
  const seen = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let contentRevision: number | undefined;
  do {
    const result = await window.blueAPI.browseLibraries({
      parent: { scope, libraryType, projectSessionId },
      cursor,
      limit: 500,
      ...(contentRevision === undefined ? {} : { expectedContentRevision: contentRevision }),
    });
    if (isCancelled()) return [];
    if (!result.ok) throw new Error(result.error.message);
    contentRevision ??= result.value.contentRevision;
    for (const child of result.value.children) {
      if (!seen.has(child.nodeId)) {
        seen.add(child.nodeId);
        children.push(child);
      }
    }
    const nextCursor = result.value.nextCursor ?? undefined;
    if (nextCursor && seenCursors.has(nextCursor)) {
      throw new Error('Project library browse returned a repeated cursor.');
    }
    if (nextCursor) seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);
  return children;
}

export function useProjectLibraryNodes(
  scope: ProjectLibraryScope,
  libraryType: LibraryType,
  projectSessionId: number | null,
  projectRevision: number,
): readonly LibraryBrowseNode[] {
  const [nodes, setNodes] = useState<readonly LibraryBrowseNode[]>([]);

  useEffect(() => {
    if (projectSessionId === null || !window.blueAPI?.browseLibraries) {
      setNodes([]);
      return;
    }
    let active = true;
    let refreshing = false;
    let requested = false;
    const refresh = async (): Promise<void> => {
      requested = true;
      if (refreshing) return;
      refreshing = true;
      try {
        while (active && requested) {
          requested = false;
          try {
            const next = await browseProjectLibraryNodes(
              scope,
              libraryType,
              projectSessionId,
              () => !active || requested,
            );
            if (active && !requested) setNodes(next);
          } catch {
            if (active && !requested) setNodes([]);
          }
        }
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const unsubscribe =
      window.blueAPI.onLibraryChanged?.(() => {
        void refresh();
      }) ?? (() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [libraryType, projectRevision, projectSessionId, scope]);

  return nodes;
}
