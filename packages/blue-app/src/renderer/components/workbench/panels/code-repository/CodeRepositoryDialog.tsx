import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import type { CodeRepositoryNode } from '@blue/data';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';
import CodeRepositoryTree from './CodeRepositoryTree';
import CodeRepositorySnippetEditor from './CodeRepositorySnippetEditor';
import type { CodeRepositoryDiagnostic, CodeRepositoryError } from '../../../../../shared/code-repository';

function createFreshNodeId(): string {
  return globalThis.crypto.randomUUID();
}

const PRIMARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-accent/20 px-4 py-1.5 text-role-body font-medium text-app-text hover:bg-app-accent/30 active:bg-app-accent/40 transition-colors disabled:opacity-40';
const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-role-body text-app-text transition-colors hover:bg-app-hover disabled:opacity-40';

interface CodeRepositoryDialogProps {
  readonly snapshot: {
    root: CodeRepositoryNode;
    contentRevision: number;
  } | null;
  readonly onClose: () => void;
  readonly onSave: (root: CodeRepositoryNode) => Promise<{ ok: true } | { ok: false; error: { message: string } }>;
  readonly onExport?: () => void;
  readonly onImport?: () => void | Promise<void>;
  /** Retry an interrupted/failed automatic migration without closing the editor. */
  readonly onRetry?: () => void | Promise<void>;
  /** Replaces the local draft after a successful import/recovery. */
  readonly draftResetToken?: number;
  readonly migrationDiagnostic?: CodeRepositoryDiagnostic;
  readonly conflict?: CodeRepositoryError | null;
  readonly onReloadConflict?: () => void;
  readonly newSnippetCode?: string;
}

function clone(root: CodeRepositoryNode): CodeRepositoryNode {
  return structuredClone(root);
}

function findNode(node: CodeRepositoryNode, id: string): CodeRepositoryNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function mutateNode(
  node: CodeRepositoryNode,
  id: string,
  mutate: (n: CodeRepositoryNode) => CodeRepositoryNode,
): CodeRepositoryNode {
  if (node.id === id) return mutate(node);
  if (!node.children) return node;
  let changed = false;
  const nextChildren = node.children.map((child) => {
    const next = mutateNode(child, id, mutate);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...node, children: nextChildren } : node;
}

function removeNode(node: CodeRepositoryNode, id: string): CodeRepositoryNode {
  if (!node.children) return node;
  const filtered = node.children.filter((child) => child.id !== id);
  if (filtered.length !== node.children.length) return { ...node, children: filtered };
  return {
    ...node,
    children: node.children.map((child) => removeNode(child, id)),
  };
}

/** Normalize sibling order to 0..n-1 after an edit. */
function normalizeOrders(root: CodeRepositoryNode): CodeRepositoryNode {
  const visit = (node: CodeRepositoryNode): CodeRepositoryNode => {
    if (!node.children || node.children.length === 0) return node;
    const renumbered = node.children.map((child, i) => ({
      ...child,
      order: i,
    }));
    return { ...node, children: renumbered.map(visit) };
  };
  return visit(root);
}

export default function CodeRepositoryDialog({
  snapshot,
  onClose,
  onSave,
  onExport,
  onImport,
  onRetry,
  draftResetToken = 0,
  migrationDiagnostic,
  conflict,
  onReloadConflict,
  newSnippetCode = '',
}: CodeRepositoryDialogProps): React.ReactElement | null {
  const [draft, setDraft] = useState<CodeRepositoryNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryingMigration, setRetryingMigration] = useState(false);
  const snapshotRef = useRef(snapshot);
  const draftRef = useRef<CodeRepositoryNode | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Adopt a newer canonical snapshot when the current draft is still clean.
  // This matters when a retry completes an interrupted migration while the
  // editor is already open; a dirty draft must remain untouched.
  useEffect(() => {
    const previousSnapshot = snapshotRef.current;
    if (snapshot) {
      const currentDraft = draftRef.current;
      const draftIsClean =
        currentDraft === null ||
        (previousSnapshot !== null && JSON.stringify(currentDraft) === JSON.stringify(previousSnapshot.root));
      if (draftIsClean) {
        const nextDraft = clone(snapshot.root);
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setSelectedId(snapshot.root.children?.[0]?.id ?? snapshot.root.id);
      }
    }
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const latestSnapshot = snapshotRef.current;
    if (!latestSnapshot) return;
    setDraft(clone(latestSnapshot.root));
    setSelectedId(latestSnapshot.root.children?.[0]?.id ?? latestSnapshot.root.id);
  }, [draftResetToken]);

  const dirty = useMemo(() => {
    if (!draft || !snapshot) return false;
    return JSON.stringify(draft) !== JSON.stringify(snapshot.root);
  }, [draft, snapshot]);

  const selectedSnippet = useMemo(() => {
    if (!draft || !selectedId) return null;
    const node = findNode(draft, selectedId);
    return node && node.kind === 'snippet' ? node : null;
  }, [draft, selectedId]);
  const hasRevisionConflict = conflict?.code === 'revision-conflict';

  const handleClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('Discard unsaved changes to the Code Repository?')) {
      return;
    }
    setDraft(null);
    setSelectedId(null);
    onClose();
  }, [dirty, onClose, saving]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await onSave(normalizeOrders(draft));
      if (result.ok) {
        toast.success('Code Repository saved');
        setDraft(null);
        setSelectedId(null);
        onClose();
      } else {
        toast.error(result.error.message || 'Failed to save Code Repository');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save Code Repository');
    } finally {
      setSaving(false);
    }
  }, [draft, onClose, onSave]);

  const handleRetryMigration = useCallback(async () => {
    if (!onRetry || retryingMigration) return;
    setRetryingMigration(true);
    try {
      await onRetry();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Code Repository migration retry failed');
    } finally {
      setRetryingMigration(false);
    }
  }, [onRetry, retryingMigration]);

  const updateDraft = useCallback((next: CodeRepositoryNode) => {
    setDraft(normalizeOrders(next));
  }, []);

  const handleRename = useCallback(
    (nodeId: string, name: string) => {
      if (!draft) return;
      const trimmed = name.trim();
      if (nodeId === CODE_REPOSITORY_ROOT_ID || trimmed.length === 0) return;
      updateDraft(mutateNode(draft, nodeId, (n) => ({ ...n, name: trimmed })));
    },
    [draft, updateDraft],
  );

  const handleMove = useCallback(
    (move: { dragIds: readonly string[]; parentId: string; index: number }) => {
      if (!draft) return;
      const dragId = move.dragIds[0];
      if (!dragId) return;
      if (dragId === CODE_REPOSITORY_ROOT_ID) return;
      const moved = findNode(draft, dragId);
      const parent = findNode(draft, move.parentId);
      if (!moved || !parent || parent.kind === 'snippet') return;
      const containsMoved = (node: CodeRepositoryNode): boolean =>
        node.id === dragId || (node.children ?? []).some(containsMoved);
      if (containsMoved(parent)) return;
      // Remove from old location, then insert at the new parent/index.
      const removed = removeNode(draft, dragId);
      const withInserted = mutateNode(removed, move.parentId, (parent) => {
        const kids = [...(parent.children ?? [])];
        const insertAt = Math.max(0, Math.min(move.index, kids.length));
        kids.splice(insertAt, 0, { ...moved, parentId: move.parentId });
        return { ...parent, children: kids };
      });
      updateDraft(withInserted);
    },
    [draft, updateDraft],
  );

  const handleAddGroup = useCallback(
    (parentId: string) => {
      if (!draft) return;
      const newGroup: CodeRepositoryNode = {
        id: createFreshNodeId(),
        kind: 'group',
        name: 'New Group',
        parentId,
        order: 0,
        children: [],
      };
      updateDraft(
        mutateNode(draft, parentId, (parent) => ({
          ...parent,
          children: [...(parent.children ?? []), newGroup],
        })),
      );
      setSelectedId(newGroup.id);
    },
    [draft, updateDraft],
  );

  const handleAddSnippet = useCallback(
    (parentId: string) => {
      if (!draft) return;
      const newSnippet: CodeRepositoryNode = {
        id: createFreshNodeId(),
        kind: 'snippet',
        name: 'New Snippet',
        parentId,
        order: 0,
        code: newSnippetCode,
      };
      updateDraft(
        mutateNode(draft, parentId, (parent) => ({
          ...parent,
          children: [...(parent.children ?? []), newSnippet],
        })),
      );
      setSelectedId(newSnippet.id);
    },
    [draft, newSnippetCode, updateDraft],
  );

  const handleDelete = useCallback(
    (nodeId: string) => {
      if (!draft || nodeId === CODE_REPOSITORY_ROOT_ID) return;
      updateDraft(removeNode(draft, nodeId));
      if (selectedId === nodeId) setSelectedId(null);
    },
    [draft, selectedId, updateDraft],
  );

  const handleSnippetCodeChange = useCallback(
    (code: string) => {
      if (!draft || !selectedId) return;
      updateDraft(mutateNode(draft, selectedId, (n) => ({ ...n, code })));
    },
    [draft, selectedId, updateDraft],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleClose],
  );

  if (!snapshot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="flex h-[75vh] w-[900px] max-w-[95vw] flex-col rounded-lg border border-app-border/40 bg-app-menu p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-repository-editor-title"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="code-repository-editor-title" className="text-role-title-2 font-bold text-app-text-bright">
            Code Repository Editor
          </h2>
          <button
            type="button"
            className="p-1 text-role-body text-app-text-muted hover:text-app-text-bright"
            onClick={handleClose}
            aria-label="Close"
            autoFocus
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {migrationDiagnostic && (
          <div
            className="mb-3 flex items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-role-callout text-app-text"
            role="status"
          >
            <span className="min-w-0 break-words">{migrationDiagnostic.message}</span>
            {onRetry && (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void handleRetryMigration()}
                disabled={retryingMigration}
              >
                {retryingMigration ? 'Retrying…' : 'Retry Migration'}
              </button>
            )}
          </div>
        )}
        {hasRevisionConflict && (
          <div
            className="mb-3 flex items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-role-callout text-app-text"
            role="alert"
          >
            <span>Your draft is preserved. Reload replaces it with the latest saved repository.</span>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={onReloadConflict}
              disabled={!onReloadConflict}
            >
              Reload saved tree
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 gap-3">
          <div className="flex w-[320px] flex-none flex-col rounded border border-app-border/30 bg-app-surface p-2">
            {draft && (
              <CodeRepositoryTree
                root={draft}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRename={handleRename}
                onMove={handleMove}
                onAddGroup={handleAddGroup}
                onAddSnippet={handleAddSnippet}
                onDelete={handleDelete}
              />
            )}
          </div>
          <div className="min-h-0 flex-1 rounded border border-app-border/30 bg-app-field p-2">
            {selectedSnippet ? (
              <CodeRepositorySnippetEditor
                name={selectedSnippet.name}
                code={selectedSnippet.code ?? ''}
                onChange={handleSnippetCodeChange}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-role-body text-app-text-muted">
                Select a snippet to edit its code.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void onImport?.()}
              disabled={!onImport}
            >
              Import…
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => onExport?.()} disabled={!onExport}>
              Export…
            </button>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-role-callout text-app-text-muted">Unsaved changes</span>}
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void handleSave()}
              disabled={!dirty || saving || hasRevisionConflict}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
