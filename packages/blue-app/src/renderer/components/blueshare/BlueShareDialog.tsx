import React, { useId, useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Download,
  Sparkles,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  type ResourceKind,
  type ResourceKey,
  type ResourceSummary,
  buildCategoryTree,
} from '../../../shared/blueshare';
import type { useBlueShare, BlueShareTab, ResourceDetailError } from './use-blueshare';
import { useDialogFocus } from '../dialogs/use-dialog-focus';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog';
import { cn } from '../../lib/cn';
import { BlueShareCategoryTree, BlueShareLibraryTree } from './BlueShareTrees';

export interface BlueShareDialogProps {
  readonly state: ReturnType<typeof useBlueShare>;
}

const GROUPS: readonly { readonly id: ResourceKind; readonly label: string }[] = [
  { id: 'instrument', label: 'Instruments' },
  { id: 'effect', label: 'Effects' },
  { id: 'soundObject', label: 'SoundObjects' },
];

const TABS: readonly { readonly id: BlueShareTab; readonly label: string }[] = [
  { id: 'import', label: 'Import' },
  { id: 'export', label: 'Export' },
  { id: 'manage', label: 'Manage' },
];

function getDetailErrorMessage(error: ResourceDetailError): string {
  if (error.status === 404) {
    return 'Resource not found (404). This resource may have been removed or does not exist.';
  }
  if (error.status === 410) {
    return 'Resource has been permanently removed (410).';
  }
  if (error.status === 429) {
    const retrySec = error.retryAfterSeconds;
    return retrySec && retrySec > 0
      ? `Rate limit exceeded (429). Please retry after ${retrySec} seconds.`
      : 'Rate limit exceeded (429). Please wait before retrying.';
  }
  if (error.status === 503) {
    return 'Service temporarily unavailable (503). Please retry later.';
  }
  if (error.status === 409) {
    return 'Conflict encountered (409). The resource may have been modified or superseded.';
  }
  return error.message || 'Failed to load resource details.';
}

export function BlueShareDialog({ state }: BlueShareDialogProps): React.ReactElement | null {
  const {
    isOpen,
    group,
    tab,
    categories,
    selectedCategory,
    resources,
    nextBeforeId,
    selectedResourceKey,
    selectedDetail,
    loadingCategories,
    loadingResources,
    loadingMore,
    loadingDetail,
    isImporting,
    importReceipt,
    error,
    categoriesError,
    resourcesError,
    detailError,
    importError,
    ownedError,
    userLibraryError,
    account,
    isSigningIn,
    isSigningOut,
    ownedResources,
    ownedNextBeforeId,
    loadingOwned,
    loadingMoreOwned,
    selectedOwnedKey,
    // Manage Remove state & actions
    isRemoving,
    removeReceipt,
    removeUncertain,
    removeError,
    canRetryRemove,
    removeOwnedResource,
    clearRemoveReceipt,
    close,
    setGroup,
    setTab,
    selectCategory,
    loadMore,
    selectResource,
    importCurrentResource,
    retryCategories,
    retryResources,
    retryDetail,
    retryUserLibraryItems,
    signIn,
    signOut,
    fetchMine,
    loadMoreMine,
    selectOwnedResource,
    openWebsite,
    // Export state & actions
    userLibraryItems,
    userLibraryNodes,
    loadingLibraryItems,
    exportSourceSeed,
    exportReviewedName,
    resetExport,
    exportSelectedKey,
    exportCategoryId,
    exportDescription,
    isPreparingPublish,
    isPublishing,
    publishReceipt,
    publishUncertain,
    publishError,
    canRetryPublish,
    remoteRevocationConfirmed,
    selectLibraryItemForExport,
    setExportCategoryId,
    setExportDescription,
    publishExport,
    clearPublishReceipt,
  } = state;

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [confirmRemoveTarget, setConfirmRemoveTarget] = useState<ResourceSummary | null>(null);
  const handleModalClose = () => {
    if (confirmRemoveTarget) {
      setConfirmRemoveTarget(null);
      return;
    }
    close();
  };
  const dialogRef = useDialogFocus(isOpen, handleModalClose);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      setLoginEmail('');
      setLoginPassword('');
      setRememberMe(false);
    }
    setConfirmRemoveTarget(null);
  }, [isOpen, group, account, selectedOwnedKey]);

  const selectedOwnedItem = ownedResources.find(
    (res) => selectedOwnedKey?.kind === res.kind && selectedOwnedKey?.id === res.id,
  );

  const categoryTree = React.useMemo(() => {
    return buildCategoryTree(categories, group);
  }, [categories, group]);

  const isDetailValid = Boolean(
    selectedResourceKey && selectedDetail && !detailError && !loadingDetail,
  );
  const isAnyWritePending = state.isWritePending || isImporting || isPublishing || isRemoving;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        className="flex h-[85vh] w-[90vw] max-w-6xl flex-col rounded-lg border border-app-border bg-app-surface text-app-text shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <div className="flex items-center gap-6">
            <h2 id={titleId} className="text-role-title-2 font-semibold text-app-text-bright">
              Blue Share
            </h2>

            {/* Groups (Instruments, Effects, SoundObjects) */}
            <div
              className="flex rounded-md border border-app-border/40 bg-app-input p-0.5"
              role="tablist"
              aria-label="Resource Groups"
            >
              {GROUPS.map((g) => {
                const isSelected = group === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={cn(
                      'rounded px-3 py-1 text-role-body font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                      isSelected
                        ? 'bg-app-selection text-app-text-bright shadow-xs'
                        : 'text-app-text-muted hover:text-app-text',
                    )}
                    onClick={() => setGroup(g.id)}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>

            {/* Tabs (Import, Export, Manage) */}
            <div
              className="flex rounded-md border border-app-border/40 bg-app-input p-0.5"
              role="tablist"
              aria-label="Views"
            >
              {TABS.map((t) => {
                const isSelected = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={cn(
                      'rounded px-3 py-1 text-role-body font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                      isSelected
                        ? 'bg-app-selection text-app-text-bright shadow-xs'
                        : 'text-app-text-muted hover:text-app-text',
                    )}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="rounded p-1 text-app-text-muted hover:text-app-text-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={close}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {(account.persistenceWarning || account.state === 'unavailable') && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 border-b border-app-border bg-app-input px-4 py-2 text-role-callout text-app-text"
          >
            <span>{account.persistenceWarning ?? 'Checking saved sign-in…'}</span>
            {account.state === 'unavailable' && account.persistenceWarning && (
              <button
                type="button"
                className="shrink-0 rounded border border-app-border px-2 py-1 focus-visible:ring-2 focus-visible:ring-app-focus"
                onClick={() => void state.retryAccount()}
              >
                Retry verification
              </button>
            )}
            {(account.state === 'unavailable' || account.state === 'signedOut') && (
              <button
                type="button"
                disabled={state.isSigningOut}
                className="shrink-0 rounded border border-app-border px-2 py-1 focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-50"
                onClick={() => void signOut()}
              >
                Forget saved sign-in
              </button>
            )}
          </div>
        )}

        {error && (
          <div
            className="border-b border-app-error/40 bg-app-error/15 px-4 py-2 text-role-body text-app-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {state.pendingWriteKind && state.pendingWriteKind !== group && (
          <div role="status" className="px-4 py-2 text-role-body text-app-text-muted">
            A {state.pendingWriteKind} write is still pending. Other writes are disabled until it
            settles.
          </div>
        )}
        {state.recoveryKind && state.recoveryKind !== group && (
          <div role="status" className="px-4 py-2 text-role-body text-app-text-muted">
            Return to {state.recoveryKind} and refresh My submissions to review the unknown outcome
            before another write.
          </div>
        )}
        {state.isOpening && (
          <div
            role="status"
            className="flex items-center gap-2 p-4 text-role-body text-app-text-muted"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Opening Blue Share…
          </div>
        )}
        {state.initializationFailed && (
          <div className="p-4">
            <button
              type="button"
              onClick={state.retryOpen}
              className="rounded border border-app-border px-3 py-1 text-role-body focus-visible:ring-2 focus-visible:ring-app-focus"
            >
              Retry opening
            </button>
          </div>
        )}
        {/* Main Body */}
        {state.contextId && tab === 'import' && (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left Column: Categories & Latest */}
            <div className="flex w-64 flex-col border-r border-app-border bg-app-input">
              <div className="border-b border-app-border/40 px-3 py-2 text-role-callout font-semibold uppercase tracking-wider text-app-text-muted">
                Browse
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {/* Latest */}
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-role-body transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                    selectedCategory === 'latest'
                      ? 'bg-app-selection font-medium text-app-text-bright'
                      : 'text-app-text hover:bg-app-hover',
                  )}
                  onClick={() => selectCategory('latest')}
                >
                  <Sparkles className="h-4 w-4 text-app-accent" />
                  <span>Latest Submissions</span>
                </button>

                <div className="mt-3 border-t border-app-border/20 pt-2">
                  <div className="px-2.5 py-1 text-role-callout font-semibold uppercase tracking-wider text-app-text-muted">
                    Categories
                  </div>
                  {loadingCategories && (
                    <div
                      className="flex items-center gap-2 px-2.5 py-2 text-role-callout text-app-text-muted"
                      aria-live="polite"
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading categories…</span>
                    </div>
                  )}
                  {!loadingCategories && categoriesError && categoryTree.length === 0 && (
                    <div className="space-y-2 p-2.5 text-role-callout text-app-error" role="alert">
                      <div>{categoriesError}</div>
                      <button
                        type="button"
                        className="rounded border border-app-border/40 bg-app-surface px-2.5 py-1 text-role-callout text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                        onClick={retryCategories}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {state.hasLoadedCategories &&
                    !loadingCategories &&
                    !categoriesError &&
                    categoryTree.length === 0 && (
                      <div className="px-2.5 py-2 text-role-callout text-app-text-muted">
                        No categories available.
                      </div>
                    )}
                  {!loadingCategories && categoriesError && categoryTree.length > 0 && (
                    <div
                      className="mb-2 flex items-center justify-between rounded border border-app-error/40 bg-app-error/10 p-2 text-role-callout text-app-error"
                      role="alert"
                    >
                      <span className="truncate">{categoriesError}</span>
                      <button
                        type="button"
                        className="ml-2 shrink-0 rounded bg-app-error/20 px-2 py-0.5 text-role-callout font-medium hover:bg-app-error/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                        onClick={retryCategories}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {!loadingCategories && (
                    <BlueShareCategoryTree
                      key={`browse-${group}`}
                      label="Browse categories"
                      categories={categoryTree}
                      kind={group}
                      selectedId={selectedCategory === 'latest' ? null : selectedCategory}
                      onSelect={selectCategory}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column: Resource List */}
            <div className="flex min-w-0 flex-1 flex-col border-r border-app-border bg-app-input">
              <div className="flex items-center justify-between border-b border-app-border/40 px-4 py-2">
                <span className="text-role-callout font-semibold uppercase tracking-wider text-app-text-muted">
                  {selectedCategory === 'latest' ? 'Latest Submissions' : 'Submissions'}
                </span>
                <span className="text-role-callout text-app-text-muted">
                  {resources.length} {resources.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingResources && (
                  <div
                    className="flex h-32 items-center justify-center gap-2 text-role-body text-app-text-muted"
                    aria-live="polite"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading resources…</span>
                  </div>
                )}

                {!loadingResources && resourcesError && resources.length === 0 && (
                  <div
                    className="flex h-32 flex-col items-center justify-center gap-2 p-4 text-center text-role-body text-app-error"
                    role="alert"
                  >
                    <div>{resourcesError}</div>
                    <button
                      type="button"
                      className="rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-callout text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                      onClick={retryResources}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {state.hasLoadedResources &&
                  !loadingResources &&
                  !resourcesError &&
                  resources.length === 0 && (
                    <div className="flex h-32 items-center justify-center text-role-body text-app-text-muted">
                      No resources found in this category.
                    </div>
                  )}

                {!loadingResources && resourcesError && resources.length > 0 && (
                  <div
                    className="flex items-center justify-between border-b border-app-error/40 bg-app-error/10 px-4 py-2 text-role-callout text-app-error"
                    role="alert"
                  >
                    <span className="truncate">{resourcesError}</span>
                    <button
                      type="button"
                      className="ml-2 shrink-0 rounded bg-app-error/20 px-2 py-0.5 text-role-callout font-medium hover:bg-app-error/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                      onClick={retryResources}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!loadingResources && resources.length > 0 && (
                  <table className="w-full text-left text-role-body">
                    <thead className="sticky top-0 border-b border-app-border/30 bg-app-surface text-role-callout font-medium text-app-text-muted">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Author</th>
                        <th className="px-4 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border/20">
                      {resources.map((res) => {
                        const isSelected =
                          selectedResourceKey?.kind === res.kind &&
                          selectedResourceKey?.id === res.id;
                        return (
                          <tr
                            key={`${res.kind}-${res.id}`}
                            tabIndex={0}
                            role="button"
                            aria-selected={isSelected}
                            aria-label={`Select ${res.name}`}
                            className={cn(
                              'cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-inset',
                              isSelected
                                ? 'bg-app-selection text-app-text-bright'
                                : 'hover:bg-app-hover/50 text-app-text',
                            )}
                            onClick={() => selectResource({ kind: res.kind, id: res.id })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                selectResource({ kind: res.kind, id: res.id });
                              }
                            }}
                          >
                            <td className="px-4 py-2 font-medium">{res.name}</td>
                            <td className="px-4 py-2 text-app-text-muted">
                              {res.author.name || res.author.username}
                            </td>
                            <td className="px-4 py-2 text-role-callout text-app-text-muted">
                              {res.createdAt ? new Date(res.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Load More Button for category pages */}
                {selectedCategory !== 'latest' && nextBeforeId !== null && (
                  <div className="p-3 text-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      className="rounded border border-app-border/40 bg-app-surface px-4 py-1.5 text-role-body text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-50"
                      onClick={() => void loadMore()}
                    >
                      {loadingMore ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Loading more…</span>
                        </span>
                      ) : (
                        'Load More'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Details Pane */}
            <div className="flex w-80 flex-col bg-app-input p-4">
              <div className="border-b border-app-border/40 pb-2 text-role-callout font-semibold uppercase tracking-wider text-app-text-muted">
                Resource Details
              </div>

              <div className="flex-1 overflow-y-auto py-3">
                {loadingDetail && (
                  <div className="flex h-32 items-center justify-center gap-2 text-role-body text-app-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading details…</span>
                  </div>
                )}

                {!loadingDetail && selectedResourceKey && detailError && (
                  <div
                    role="alert"
                    className="space-y-4 rounded-lg border border-app-error/40 bg-app-error/10 p-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-app-error" />
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-app-text-bright">
                          {detailError.status === 404
                            ? 'Resource Not Found (404)'
                            : detailError.status === 410
                              ? 'Resource Permanently Removed (410)'
                              : detailError.status === 429
                                ? 'Rate Limit Exceeded (429)'
                                : detailError.status === 503
                                  ? 'Service Unavailable (503)'
                                  : detailError.status === 409
                                    ? 'Conflict Encountered (409)'
                                    : 'Resource Unavailable'}
                        </div>
                        <p className="text-role-callout text-app-error">
                          {getDetailErrorMessage(detailError)}
                        </p>
                      </div>
                    </div>

                    {/* Bounded diagnostics (severity, path, member, message, recovery) */}
                    {detailError.diagnostics && detailError.diagnostics.length > 0 && (
                      <div className="space-y-1.5 border-t border-app-error/20 pt-2 text-role-callout">
                        <div className="font-medium text-app-text-bright">Diagnostics:</div>
                        {detailError.diagnostics.slice(0, 5).map((diag, idx) => (
                          <div
                            key={idx}
                            className="rounded bg-app-surface/60 p-2 text-role-callout text-app-text"
                          >
                            <div className="flex items-center gap-1 font-semibold text-app-error">
                              <span>[{(diag.severity || 'error').toUpperCase()}]</span>
                              {diag.path && <span>{diag.path}</span>}
                              {diag.member && <span>({diag.member})</span>}
                            </div>
                            <div className="mt-0.5 text-app-text">{diag.message}</div>
                            {diag.recovery && (
                              <div className="mt-0.5 text-app-text-muted italic">
                                Recovery: {diag.recovery}
                              </div>
                            )}
                          </div>
                        ))}
                        {detailError.diagnostics.length > 5 && (
                          <div className="text-role-callout text-app-text-muted">
                            …and {detailError.diagnostics.length - 5} more diagnostic(s)
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-1">
                      <button
                        type="button"
                        className="rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-role-callout text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                        onClick={retryDetail}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {!loadingDetail && !selectedDetail && !detailError && (
                  <div className="flex h-32 items-center justify-center text-center text-role-body text-app-text-muted">
                    Select a resource to view its details.
                  </div>
                )}

                {!loadingDetail && selectedDetail && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-role-title-2 font-semibold text-app-text-bright">
                        {selectedDetail.name}
                      </h3>
                      <p className="text-role-callout text-app-text-muted">
                        Submitted by{' '}
                        <span className="font-medium text-app-text">
                          {selectedDetail.author.name || selectedDetail.author.username}
                        </span>{' '}
                        (@{selectedDetail.author.username})
                      </p>
                    </div>

                    <div className="space-y-1.5 text-role-callout text-app-text-muted">
                      <div>
                        <span className="font-medium text-app-text">Category:</span>{' '}
                        {selectedDetail.category.name}
                      </div>
                      {selectedDetail.blueType && (
                        <div>
                          <span className="font-medium text-app-text">Type:</span>{' '}
                          <code className="text-role-callout">{selectedDetail.blueType}</code>
                        </div>
                      )}
                      {selectedDetail.createdAt && (
                        <div>
                          <span className="font-medium text-app-text">Created:</span>{' '}
                          {new Date(selectedDetail.createdAt).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-role-callout font-medium text-app-text">
                        Description:
                      </span>
                      <p className="mt-1 whitespace-pre-wrap rounded bg-app-input p-2 text-role-body text-app-text">
                        {selectedDetail.description || 'No description provided.'}
                      </p>
                    </div>

                    {Boolean(importReceipt) && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="rounded bg-app-selection p-2 text-role-callout text-app-text-bright"
                      >
                        Resource successfully imported to your library!
                      </div>
                    )}

                    {importError && (
                      <div
                        role="alert"
                        aria-live="assertive"
                        className="space-y-2 rounded border border-app-error/40 bg-app-error/10 p-3 text-role-callout text-app-error"
                      >
                        <div className="font-semibold">{importError.message}</div>
                        {importError.diagnostics && importError.diagnostics.length > 0 && (
                          <div className="space-y-1 border-t border-app-error/20 pt-1.5">
                            <div className="font-medium text-app-text-bright">Diagnostics:</div>
                            {importError.diagnostics.slice(0, 5).map((diag, idx) => (
                              <div
                                key={idx}
                                className="rounded bg-app-surface/60 p-1.5 text-role-callout text-app-text"
                              >
                                <div className="flex items-center gap-1 font-semibold text-app-error">
                                  <span>[{(diag.severity || 'error').toUpperCase()}]</span>
                                  {diag.path && <span>{diag.path}</span>}
                                  {diag.member && <span>({diag.member})</span>}
                                </div>
                                <div className="mt-0.5 text-app-text">{diag.message}</div>
                                {diag.recovery && (
                                  <div className="mt-0.5 text-app-text-muted italic">
                                    Recovery: {diag.recovery}
                                  </div>
                                )}
                              </div>
                            ))}
                            {importError.diagnostics.length > 5 && (
                              <div className="text-role-callout text-app-text-muted">
                                …and {importError.diagnostics.length - 5} more diagnostic(s)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Import Action */}
              <div className="border-t border-app-border/40 pt-3">
                <button
                  type="button"
                  disabled={!isDetailValid || isAnyWritePending}
                  className="flex w-full items-center justify-center gap-2 rounded bg-app-accent/30 px-4 py-2 font-medium text-app-text-bright transition-colors hover:bg-app-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40"
                  onClick={() => void importCurrentResource()}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Importing…</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Import to Library</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Tab */}
        {state.contextId && tab === 'export' && account.state !== 'signedIn' && (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-4 rounded-lg border border-app-border bg-app-surface p-6 shadow-md">
              <h3 className="text-role-title-3 font-semibold text-app-text-bright">
                Sign in required
              </h3>
              <p className="text-role-body text-app-text-muted">
                Publishing library resources to Blue Share requires a signed-in account. Please sign
                in to export your resources.
              </p>
              <button
                type="button"
                className="rounded bg-app-accent px-4 py-2 text-role-body font-medium text-app-accent-contrast hover:bg-app-accent/90"
                onClick={() => setTab('manage')}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        )}

        {state.contextId && tab === 'export' && account.state === 'signedIn' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left Column: User Library Items */}
            <div className="flex w-72 flex-col border-r border-app-border bg-app-input">
              <div className="border-b border-app-border/40 px-4 py-2 text-role-callout font-semibold uppercase tracking-wider text-app-text-muted">
                Your{' '}
                {group === 'instrument'
                  ? 'Instruments'
                  : group === 'effect'
                    ? 'Effects'
                    : 'SoundObjects'}
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {loadingLibraryItems && (
                  <div className="flex h-32 items-center justify-center gap-2 text-role-body text-app-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading library…</span>
                  </div>
                )}
                {!loadingLibraryItems && userLibraryError && userLibraryItems.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 p-4 text-center text-role-body text-app-error">
                    <div>{userLibraryError}</div>
                    <button
                      type="button"
                      className="rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-callout text-app-text hover:bg-app-hover"
                      onClick={retryUserLibraryItems}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {state.hasLoadedLibraryItems &&
                  !loadingLibraryItems &&
                  !userLibraryError &&
                  userLibraryItems.length === 0 && (
                    <div className="p-4 text-center text-role-body text-app-text-muted">
                      No items found in your user library.
                    </div>
                  )}
                {!loadingLibraryItems && userLibraryNodes.length > 0 && (
                  <BlueShareLibraryTree
                    key={`source-${group}`}
                    label="Your library"
                    nodes={userLibraryNodes}
                    selectedNodeId={
                      exportSelectedKey?.scope === 'user' ? exportSelectedKey.nodeId : null
                    }
                    onSelect={(node) => {
                      if (node.nodeKind === 'item') void selectLibraryItemForExport(node);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Right Column: Export Preparation & Submission Form */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6">
              {publishReceipt && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div className="flex-1 text-role-body text-app-text-bright">
                      <span className="font-semibold">‘{publishReceipt.name}’</span> successfully
                      published to Blue Share!
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-role-callout text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                      onClick={clearPublishReceipt}
                    >
                      Export Another
                    </button>
                    <button
                      type="button"
                      className="rounded bg-app-accent px-3 py-1.5 text-role-callout font-medium text-app-accent-contrast hover:bg-app-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                      onClick={() => {
                        clearPublishReceipt();
                        setTab('manage');
                        void fetchMine();
                      }}
                    >
                      View in My Submissions
                    </button>
                  </div>
                </div>
              )}

              {publishUncertain && (
                <div
                  role="alert"
                  className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                    <div className="flex-1 space-y-2 text-role-body">
                      <div className="font-semibold text-app-text-bright">
                        {canRetryPublish
                          ? 'Submissions refreshed after uncertain publication'
                          : 'Publication outcome is uncertain'}
                      </div>
                      <p className="text-role-callout text-app-text-muted">
                        {canRetryPublish
                          ? 'Your submissions have been refreshed. If your item does not appear in My Submissions, you may now retry publication.'
                          : 'The server may have received and committed your submission, but the confirmation response was lost or timed out. Please check ‘My Submissions’ in the Manage tab before retrying to avoid creating a duplicate publication.'}
                      </p>
                      {state.uncertainPublishName && (
                        <p className="text-role-callout text-app-text-muted">
                          Submitted source: {state.uncertainPublishName}
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        {canRetryPublish && (
                          <button
                            type="button"
                            onClick={state.restoreUncertainPublishDraft}
                            className="rounded border border-app-border px-3 py-1.5 text-role-callout focus-visible:ring-2 focus-visible:ring-app-focus"
                          >
                            Restore submitted draft for review
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded bg-amber-500/20 px-3 py-1.5 text-role-callout font-medium text-amber-200 hover:bg-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                          onClick={() => {
                            setTab('manage');
                            void fetchMine();
                          }}
                        >
                          Check My Submissions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {publishError && !publishUncertain && (
                <div
                  role="alert"
                  className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-role-body text-red-400"
                >
                  {publishError}
                </div>
              )}

              <div className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-role-title-2 font-semibold text-app-text-bright">
                    Export to Blue Share
                  </h3>
                  <p className="text-role-callout text-app-text-muted">
                    Publish your library items to the Blue Share community. Review item metadata and
                    select a destination category.
                  </p>
                </div>

                {/* Resource Metadata Preview */}
                <div className="rounded-lg border border-app-border/40 bg-app-input p-4">
                  <div className="mb-2 text-role-callout font-semibold uppercase tracking-wider text-app-text-muted">
                    Selected Resource
                    <button
                      type="button"
                      className="ml-3 text-role-callout text-app-text-muted hover:text-app-text"
                      onClick={resetExport}
                    >
                      Reset export
                    </button>
                  </div>
                  {isPreparingPublish && (
                    <div className="flex items-center gap-2 py-4 text-role-body text-app-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Reading and verifying library source…</span>
                    </div>
                  )}
                  {!isPreparingPublish && !exportSourceSeed && (
                    <div className="py-4 text-center text-role-body text-app-text-muted">
                      {exportReviewedName
                        ? `${exportReviewedName} — select the item again to review it for this session. Your description and category are preserved.`
                        : 'Select an item from the left column to prepare it for export.'}
                    </div>
                  )}
                  {!isPreparingPublish && exportSourceSeed && (
                    <div className="grid grid-cols-2 gap-4 text-role-body">
                      <div>
                        <span className="text-role-callout font-medium text-app-text-muted">
                          Resource Name
                        </span>
                        <div className="font-semibold text-app-text-bright">
                          {exportSourceSeed.name}
                        </div>
                      </div>
                      <div>
                        <span className="text-role-callout font-medium text-app-text-muted">
                          Type
                        </span>
                        <div className="text-app-text">
                          {exportSourceSeed.blueType ? (
                            <code className="text-role-callout">{exportSourceSeed.blueType}</code>
                          ) : group === 'effect' ? (
                            'Effect'
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-role-callout font-medium text-app-text-muted">
                          Payload Size
                        </span>
                        <div className="text-app-text-muted">
                          {exportSourceSeed.byteLength} bytes
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {exportSourceSeed && !isPreparingPublish && (
                  <section aria-label="Source comments" className="space-y-1.5">
                    <h3 className="text-role-callout font-medium text-app-text">Source comments</h3>
                    <div className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-app-border bg-app-input p-3 text-role-body text-app-text">
                      {exportSourceSeed.descriptionSeed || 'No source comments provided.'}
                    </div>
                  </section>
                )}

                {/* Destination Category */}
                <div className="space-y-1.5">
                  <div className="text-role-callout font-medium text-app-text">
                    Destination Category <span className="text-red-400">*</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded border border-app-border bg-app-input p-1">
                    <BlueShareCategoryTree
                      key={`destination-${group}`}
                      label="Destination categories"
                      categories={categoryTree}
                      kind={group}
                      selectedId={exportCategoryId}
                      onSelect={setExportCategoryId}
                    />
                  </div>
                </div>

                {/* Public Description */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="export-description-textarea"
                      className="text-role-callout font-medium text-app-text"
                    >
                      Public Description
                    </label>
                    <span className="text-role-callout text-app-text-muted">
                      {new TextEncoder().encode(exportDescription).length} / 65536 bytes
                    </span>
                  </div>
                  <textarea
                    id="export-description-textarea"
                    rows={4}
                    className="w-full rounded border border-app-border bg-app-input p-3 text-role-body text-app-text focus:border-app-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                    placeholder="Enter a description for the community (instructions, parameters, credits)…"
                    value={exportDescription}
                    onChange={(e) => setExportDescription(e.target.value)}
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={
                      !exportSourceSeed ||
                      exportCategoryId === null ||
                      isAnyWritePending ||
                      (!!state.recoveryKind && state.recoveryKind !== group) ||
                      isPreparingPublish ||
                      (publishUncertain && !canRetryPublish)
                    }
                    className="flex items-center gap-2 rounded bg-app-accent px-5 py-2.5 text-role-body font-medium text-app-accent-contrast transition-colors hover:bg-app-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void publishExport()}
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Publishing…</span>
                      </>
                    ) : publishUncertain && canRetryPublish ? (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Retry Publication</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Publish to Blue Share</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manage Tab */}
        {state.contextId && tab === 'manage' && account.state !== 'signedIn' && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="w-full max-w-sm space-y-4 rounded-lg border border-app-border bg-app-surface p-6 shadow-md">
              <div className="space-y-1 text-center">
                <h3 className="text-role-title-3 font-semibold text-app-text-bright">
                  Sign in to Blue Share
                </h3>
                <p className="text-role-callout text-app-text-muted">
                  Access and manage your shared instruments, effects, and sound objects.
                </p>
              </div>

              {remoteRevocationConfirmed === false && (
                <div
                  data-testid="remote-revocation-warning"
                  className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-role-callout text-amber-200"
                >
                  Signed out locally, but remote session revocation could not be confirmed with the
                  server.
                </div>
              )}

              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const email = loginEmail;
                  const password = loginPassword;
                  setLoginEmail('');
                  setLoginPassword('');
                  setRememberMe(false);
                  await signIn(email, password, rememberMe);
                }}
              >
                <div>
                  <label
                    htmlFor="blueshare-login-email"
                    className="text-role-callout font-medium text-app-text"
                  >
                    Email
                  </label>
                  <input
                    id="blueshare-login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded border border-app-border bg-app-input px-3 py-1.5 text-role-body text-app-text focus:border-app-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                  />
                </div>

                <div>
                  <label
                    htmlFor="blueshare-login-password"
                    className="text-role-callout font-medium text-app-text"
                  >
                    Password
                  </label>
                  <input
                    id="blueshare-login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    className="mt-1 w-full rounded border border-app-border bg-app-input px-3 py-1.5 text-role-body text-app-text focus:border-app-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                  />
                </div>

                <label className="flex items-center gap-2 text-role-callout text-app-text">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    disabled={isSigningIn}
                    className="accent-app-accent focus-visible:ring-2 focus-visible:ring-app-focus"
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Stay signed in on this computer
                </label>

                <button
                  type="submit"
                  disabled={isSigningIn || !loginEmail || !loginPassword}
                  className="flex w-full items-center justify-center gap-2 rounded bg-app-accent px-4 py-2 font-medium text-app-text-bright transition-colors hover:bg-app-accent/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between border-t border-app-border/40 pt-3 text-role-callout">
                <button
                  type="button"
                  className="rounded px-1 text-app-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                  onClick={() => void openWebsite('register')}
                >
                  Create an account
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-app-text-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                  onClick={() => void openWebsite('recover')}
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </div>
        )}

        {state.contextId && tab === 'manage' && account.state === 'signedIn' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Account Bar */}
            <div className="flex items-center justify-between border-b border-app-border bg-app-input px-4 py-2 text-role-body">
              <div className="flex items-center gap-2">
                <span className="text-role-callout text-app-text-muted">Signed in as:</span>
                <span className="font-medium text-app-text-bright">
                  {account.user?.username || account.user?.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingOwned}
                  className="rounded border border-app-border px-3 py-1 text-role-callout text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40"
                  onClick={() => void fetchMine()}
                >
                  {loadingOwned ? 'Fetching…' : 'Fetch submissions'}
                </button>
                <button
                  type="button"
                  disabled={isSigningOut}
                  className="rounded border border-app-border px-3 py-1 text-role-callout text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40"
                  onClick={() => void signOut()}
                >
                  {isSigningOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>

            {/* Manage Remove Banners */}
            {removeUncertain && (
              <div
                role="alert"
                className="border-b border-amber-500/30 bg-amber-500/10 p-3 text-role-body"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-app-text-bright">
                      {canRetryRemove
                        ? 'Submissions refreshed after uncertain removal'
                        : 'Removal outcome is uncertain'}
                    </div>
                    <p className="text-role-callout text-app-text-muted">
                      {canRetryRemove
                        ? 'Submissions refreshed and item is still present. You may retry removal.'
                        : 'The server may have received and processed your deletion, but the confirmation response was lost or timed out. Please refresh your submissions to verify whether the item was removed before trying again.'}
                    </p>
                    <button
                      type="button"
                      className="mt-1 rounded bg-amber-500/20 px-2.5 py-1 text-role-callout font-medium text-amber-200 hover:bg-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                      onClick={() => void fetchMine()}
                    >
                      Refresh submissions
                    </button>
                  </div>
                </div>
              </div>
            )}

            {removeError && !removeUncertain && (
              <div
                role="alert"
                className="border-b border-red-500/30 bg-red-500/10 p-3 text-role-body text-red-400"
              >
                {removeError}
              </div>
            )}

            {removeReceipt && (
              <div
                role="status"
                aria-live="polite"
                className="border-b border-green-500/30 bg-green-500/10 p-3 text-role-body"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="text-role-callout">
                      {removeReceipt.alreadyRemoved
                        ? 'Resource was already removed from Blue Share.'
                        : 'Resource successfully removed from Blue Share.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rounded px-1 text-role-callout text-app-text-muted hover:text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                    onClick={clearRemoveReceipt}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Owned items table */}
              <div className="min-w-0 flex-1 overflow-y-auto bg-app-input">
                {loadingOwned && (
                  <div
                    aria-live="polite"
                    className="flex h-32 items-center justify-center gap-2 text-role-body text-app-text-muted"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading submissions…</span>
                  </div>
                )}

                {!loadingOwned && ownedError && ownedResources.length === 0 && (
                  <div
                    role="alert"
                    className="flex h-32 flex-col items-center justify-center gap-2 p-4 text-center text-role-body text-app-error"
                  >
                    <div>{ownedError}</div>
                    <button
                      type="button"
                      className="rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-callout text-app-text hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                      onClick={() => void fetchMine()}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {state.hasLoadedOwned &&
                  !loadingOwned &&
                  !ownedError &&
                  ownedResources.length === 0 && (
                    <div className="flex h-32 flex-col items-center justify-center gap-2 text-role-body text-app-text-muted">
                      <span>No submissions found for this kind.</span>
                      <button
                        type="button"
                        className="rounded px-1 text-role-callout text-app-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                        onClick={() => void fetchMine()}
                      >
                        Fetch again
                      </button>
                    </div>
                  )}

                {!loadingOwned && ownedError && ownedResources.length > 0 && (
                  <div
                    role="alert"
                    className="flex items-center justify-between border-b border-app-error/40 bg-app-error/10 px-4 py-2 text-role-callout text-app-error"
                  >
                    <span className="truncate">{ownedError}</span>
                    <button
                      type="button"
                      className="ml-2 shrink-0 rounded bg-app-error/20 px-2 py-0.5 text-role-callout font-medium hover:bg-app-error/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                      onClick={() => void fetchMine()}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!loadingOwned && ownedResources.length > 0 && (
                  <table className="w-full text-left text-role-body">
                    <thead className="sticky top-0 border-b border-app-border/30 bg-app-surface text-role-callout font-medium text-app-text-muted">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Category</th>
                        <th className="px-4 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border/20">
                      {ownedResources.map((res) => {
                        const isSelected =
                          selectedOwnedKey?.kind === res.kind && selectedOwnedKey?.id === res.id;
                        return (
                          <tr
                            key={`owned-${res.kind}-${res.id}`}
                            tabIndex={0}
                            role="button"
                            aria-selected={isSelected}
                            aria-label={`Select ${res.name}`}
                            className={cn(
                              'cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-inset',
                              isSelected
                                ? 'bg-app-selection text-app-text-bright'
                                : 'hover:bg-app-hover/50 text-app-text',
                            )}
                            onClick={() => selectOwnedResource({ kind: res.kind, id: res.id })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                selectOwnedResource({ kind: res.kind, id: res.id });
                              }
                            }}
                          >
                            <td className="px-4 py-2 font-medium">{res.name}</td>
                            <td className="px-4 py-2 text-app-text-muted">{res.category.name}</td>
                            <td className="px-4 py-2 text-role-callout text-app-text-muted">
                              {res.createdAt ? new Date(res.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {ownedNextBeforeId !== null && (
                  <div className="border-t border-app-border/30 p-2 text-center">
                    <button
                      type="button"
                      disabled={loadingMoreOwned}
                      className="rounded px-2 py-0.5 text-role-callout text-app-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40"
                      onClick={() => void loadMoreMine()}
                    >
                      {loadingMoreOwned ? 'Loading…' : 'Load More'}
                    </button>
                  </div>
                )}
              </div>

              <aside
                aria-label="Submission details"
                className="w-80 shrink-0 space-y-4 overflow-y-auto border-l border-app-border bg-app-input p-4 text-role-body text-app-text"
              >
                <h3 className="text-role-callout font-semibold uppercase tracking-wider text-app-text-muted">
                  Submission details
                </h3>
                {selectedOwnedItem ? (
                  <>
                    <h4 className="text-role-title-3 font-semibold text-app-text-bright">
                      {selectedOwnedItem.name}
                    </h4>
                    <div>Category: {selectedOwnedItem.category.name}</div>
                    <div className="break-words">
                      Type: <code>{selectedOwnedItem.blueType || group}</code>
                    </div>
                    <div>
                      Created:{' '}
                      {selectedOwnedItem.createdAt
                        ? new Date(selectedOwnedItem.createdAt).toLocaleString()
                        : '—'}
                    </div>
                    <div>
                      <h5 className="mb-2 font-medium">Description</h5>
                      <p className="whitespace-pre-wrap break-words">
                        {selectedOwnedItem.description || 'No description provided.'}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-app-text-muted">Select a submission to view its details.</p>
                )}
              </aside>
            </div>

            {/* Selected Owned Resource Action Bar */}
            {selectedOwnedItem && (
              <div className="flex items-center justify-between border-t border-app-border bg-app-surface px-4 py-2 text-role-body">
                <div className="flex items-center gap-2">
                  <span className="text-role-callout text-app-text-muted">Selected:</span>
                  <span className="font-medium text-app-text-bright">{selectedOwnedItem.name}</span>
                </div>
                <button
                  type="button"
                  data-testid="manage-remove-btn"
                  disabled={
                    isAnyWritePending ||
                    (removeUncertain && !canRetryRemove) ||
                    (!!state.recoveryKind && state.recoveryKind !== group)
                  }
                  className="flex items-center gap-1.5 rounded bg-app-danger px-3 py-1.5 text-role-callout font-medium text-app-danger-foreground transition-colors hover:bg-app-danger/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40"
                  onClick={() => {
                    if (selectedOwnedItem) {
                      setConfirmRemoveTarget(selectedOwnedItem);
                    }
                  }}
                >
                  {isRemoving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Removing…</span>
                    </>
                  ) : removeUncertain && canRetryRemove ? (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Retry Removal</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove Submission</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Remove Confirmation Dialog */}
            <ConfirmationDialog
              open={confirmRemoveTarget !== null}
              title="Remove Submission"
              description={
                confirmRemoveTarget
                  ? `Are you sure you want to remove "${confirmRemoveTarget.name}" from Blue Share? This will exclude it from public listing and download. Any local copies already imported will remain intact.`
                  : 'Are you sure you want to remove this submission from Blue Share?'
              }
              actions={[
                { id: 'cancel', label: 'Cancel', intent: 'cancel' },
                { id: 'remove', label: 'Remove', intent: 'destructive' },
              ]}
              cancelActionId="cancel"
              initialFocusActionId="cancel"
              onDecision={async (actionId) => {
                const target = confirmRemoveTarget;
                setConfirmRemoveTarget(null);
                if (
                  actionId === 'remove' &&
                  target &&
                  selectedOwnedKey &&
                  selectedOwnedKey.kind === target.kind &&
                  selectedOwnedKey.id === target.id
                ) {
                  await removeOwnedResource(selectedOwnedKey);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
