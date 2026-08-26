import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';
import type { CodeRepositoryNode } from '@blue/data';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';
import { createBasicTextEditorMenuItems } from '../editors/csound-editor-menu';
import { AppSelect } from '../../../AppSelect';

const PRIMARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-accent/20 px-4 py-1.5 text-role-body font-medium text-app-text hover:bg-app-accent/30 active:bg-app-accent/40 transition-colors disabled:opacity-40';
const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-role-body text-app-text transition-colors hover:bg-app-hover disabled:opacity-40';

interface AddToCodeRepositoryDialogProps {
  /** Canonical snapshot used to choose the destination group. */
  readonly root: CodeRepositoryNode | null;
  /** The selected editor text to save. */
  readonly initialText: string;
  readonly contentRevision: number;
  readonly onClose: () => void;
  readonly onCreate: (
    parentId: string,
    name: string,
    code: string,
    expectedRevision: number,
  ) => Promise<{ ok: true } | { ok: false; error: { message: string } }>;
  readonly onRetry?: () => void | Promise<void>;
}

interface GroupEntry {
  readonly id: string;
  readonly label: string;
}

function collectGroups(node: CodeRepositoryNode, depth: number, out: GroupEntry[]): void {
  for (const child of node.children ?? []) {
    if (child.kind === 'group') {
      out.push({ id: child.id, label: `${'  '.repeat(depth)}${child.name}` });
      collectGroups(child, depth + 1, out);
    }
  }
}

export default function AddToCodeRepositoryDialog({
  root,
  initialText,
  contentRevision,
  onClose,
  onCreate,
  onRetry,
}: AddToCodeRepositoryDialogProps): React.ReactElement | null {
  const [name, setName] = useState('New Snippet');
  const [code, setCode] = useState(initialText);
  const [parentId, setParentId] = useState<string>(CODE_REPOSITORY_ROOT_ID);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const groups = useMemo(() => {
    if (!root) return [] as GroupEntry[];
    const entries: GroupEntry[] = [{ id: CODE_REPOSITORY_ROOT_ID, label: 'Code Repository (root)' }];
    collectGroups(root, 1, entries);
    return entries;
  }, [root]);
  const editorContextMenuItems = useMemo(() => createBasicTextEditorMenuItems(), []);

  useEffect(() => {
    if (groups.length > 0 && !groups.some((g) => g.id === parentId)) {
      setParentId(groups[0].id);
    }
  }, [groups, parentId]);

  const requestClose = useCallback(() => {
    if (!submitting) onClose();
  }, [onClose, submitting]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    },
    [requestClose],
  );

  const handleAdd = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setValidationError('Enter a snippet name.');
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    try {
      const result = await onCreate(parentId, trimmed, code, contentRevision);
      if (result.ok) {
        toast.success('Added to Code Repository');
        onClose();
      } else {
        toast.error(result.error.message || 'Failed to add to Code Repository');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add to Code Repository');
    } finally {
      setSubmitting(false);
    }
  }, [code, name, parentId, contentRevision, onCreate, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={requestClose}>
      <div
        className="flex h-[72vh] min-h-[420px] max-h-[90vh] w-[760px] max-w-[94vw] flex-col rounded-lg border border-app-border/40 bg-app-menu p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-code-repository-title"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="add-code-repository-title" className="text-role-title-2 font-bold text-app-text-bright">
            Add to Code Repository
          </h2>
          <button
            type="button"
            className="p-1 text-role-body text-app-text-muted hover:text-app-text-bright"
            onClick={requestClose}
            aria-label="Close"
            autoFocus={!root}
            disabled={submitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!root ? (
          <>
            <p className="break-words text-role-body text-app-text-muted" role="status">
              The Code Repository is unavailable. Retry the repository service, then add the selection again.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={requestClose} disabled={submitting}>
                Close
              </button>
              {onRetry && (
                <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void onRetry()}>
                  Retry
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <label htmlFor="code-repository-snippet-name" className="mb-1 block text-role-body text-app-text-muted">
              Name
            </label>
            <input
              id="code-repository-snippet-name"
              name="codeRepositorySnippetName"
              autoComplete="off"
              className="mb-3 rounded border border-app-border/30 bg-app-field px-2 py-1 text-role-body text-app-text outline-none focus:border-app-border/60"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'code-repository-name-error' : undefined}
              autoFocus={Boolean(root)}
            />
            {validationError && (
              <p id="code-repository-name-error" className="-mt-2 mb-3 text-role-callout text-red-400" role="alert">
                {validationError}
              </p>
            )}

            <label htmlFor="code-repository-destination" className="mb-1 block text-role-body text-app-text-muted">
              Destination Group
            </label>
            <AppSelect
              id="code-repository-destination"
              name="codeRepositoryDestination"
              className="mb-3 rounded border border-app-border/30 bg-app-field px-2 py-1 text-role-body text-app-text outline-none focus:border-app-border/60"
              value={parentId}
              onValueChange={setParentId}
              options={groups.map((group) => ({ value: group.id, label: group.label }))}
            />

            <div className="mb-1 text-role-body text-app-text-muted">ORC Code</div>
            <div className="min-h-0 flex-1">
              <SelectedCodeEditor
                value={code}
                ariaLabel="Code Repository snippet ORC code"
                mode="orc"
                contextMenuItems={editorContextMenuItems}
                onChange={setCode}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={requestClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void handleAdd()}
                disabled={submitting}
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
