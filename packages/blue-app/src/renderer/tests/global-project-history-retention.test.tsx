// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog';
import { OversizeProposalDialog } from '../components/dialogs/OversizeProposalDialog';
import { useProjectStore } from '../stores/project-store';
import type { InAppConfirmationAction } from '../../shared/confirmation-dialog';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface OversizeProposalState {
  open: boolean;
  documentId: string;
  revision: number;
  proposalToken: string;
  explanation: string;
  patches: unknown[];
}

describe('global project history retention & oversize confirmation (T057, US5)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let cancelProposalSpy: ReturnType<typeof vi.fn>;
  let commitPatchesSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cancelProposalSpy = vi.fn();
    commitPatchesSpy = vi.fn();

    Object.defineProperty(window, 'blueAPI', {
      configurable: true,
      value: {
        cancelOversizeProposal: cancelProposalSpy,
        commitProjectDocumentPatches: commitPatchesSpy,
      },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function OversizeProposalContainer({
    proposal,
    currentDocumentId,
    currentRevision,
    onClose,
  }: {
    proposal: OversizeProposalState;
    currentDocumentId: string;
    currentRevision: number;
    onClose: () => void;
  }) {
    const handleDecision = async (actionId: string) => {
      if (actionId === 'confirm') {
        // Revalidate document and revision before committing
        if (proposal.documentId !== currentDocumentId || proposal.revision !== currentRevision) {
          // Stale proposal: cancel and dismiss
          window.blueAPI.cancelOversizeProposal({ proposalToken: proposal.proposalToken });
          onClose();
          return;
        }
        await window.blueAPI.commitProjectDocumentPatches(proposal.patches, {
          proposalToken: proposal.proposalToken,
        });
        onClose();
      } else {
        window.blueAPI.cancelOversizeProposal({ proposalToken: proposal.proposalToken });
        onClose();
      }
    };

    const actions: InAppConfirmationAction[] = [
      { id: 'cancel', label: 'Cancel', role: 'cancel' },
      { id: 'confirm', label: 'Reset History and Apply', intent: 'destructive' },
    ];

    return (
      <ConfirmationDialog
        open={proposal.open}
        title="Oversize Project Action"
        description={proposal.explanation}
        actions={actions}
        cancelActionId="cancel"
        onDecision={handleDecision}
      />
    );
  }

  it('renders confirmation dialog with accessible explanation and defaults focus to Cancel', async () => {
    const proposal: OversizeProposalState = {
      open: true,
      documentId: 'doc-123',
      revision: 4,
      proposalToken: 'oversize-token-1',
      explanation: 'Action of 70 MiB exceeds the 64 MiB history limit',
      patches: [{ type: 'large-patch' }],
    };

    await act(async () => {
      root.render(
        <OversizeProposalContainer
          proposal={proposal}
          currentDocumentId="doc-123"
          currentRevision={4}
          onClose={() => {}}
        />,
      );
    });

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Action of 70 MiB exceeds the 64 MiB history limit');

    // The destructive action causes default focus to land on Cancel
    const cancelBtn = document.querySelector('[data-action-id="cancel"]');
    expect(cancelBtn).not.toBeNull();
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('cancels oversize proposal safely when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const proposal: OversizeProposalState = {
      open: true,
      documentId: 'doc-123',
      revision: 4,
      proposalToken: 'oversize-token-1',
      explanation: 'Action of 70 MiB exceeds limit',
      patches: [{ type: 'large-patch' }],
    };

    await act(async () => {
      root.render(
        <OversizeProposalContainer
          proposal={proposal}
          currentDocumentId="doc-123"
          currentRevision={4}
          onClose={onClose}
        />,
      );
    });

    const cancelBtn = document.querySelector('[data-action-id="cancel"]') as HTMLButtonElement;
    await act(async () => {
      cancelBtn.click();
    });

    expect(cancelProposalSpy).toHaveBeenCalledWith({ proposalToken: 'oversize-token-1' });
    expect(commitPatchesSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('revalidates document and revision on confirm before submitting with token', async () => {
    const onClose = vi.fn();
    const proposal: OversizeProposalState = {
      open: true,
      documentId: 'doc-123',
      revision: 4,
      proposalToken: 'oversize-token-1',
      explanation: 'Action of 70 MiB exceeds limit',
      patches: [{ type: 'large-patch' }],
    };

    await act(async () => {
      root.render(
        <OversizeProposalContainer
          proposal={proposal}
          currentDocumentId="doc-123"
          currentRevision={4}
          onClose={onClose}
        />,
      );
    });

    const confirmBtn = document.querySelector('[data-action-id="confirm"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    expect(commitPatchesSpy).toHaveBeenCalledWith(proposal.patches, {
      proposalToken: 'oversize-token-1',
    });
    expect(cancelProposalSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels proposal if revision has changed while dialog was open (stale confirmation)', async () => {
    const onClose = vi.fn();
    const proposal: OversizeProposalState = {
      open: true,
      documentId: 'doc-123',
      revision: 4,
      proposalToken: 'oversize-token-1',
      explanation: 'Action of 70 MiB exceeds limit',
      patches: [{ type: 'large-patch' }],
    };

    // Note: currentRevision is now 5 (stale proposal!)
    await act(async () => {
      root.render(
        <OversizeProposalContainer
          proposal={proposal}
          currentDocumentId="doc-123"
          currentRevision={5}
          onClose={onClose}
        />,
      );
    });

    const confirmBtn = document.querySelector('[data-action-id="confirm"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    // Stale proposal is aborted and cancelled, not committed!
    expect(cancelProposalSpy).toHaveBeenCalledWith({ proposalToken: 'oversize-token-1' });
    expect(commitPatchesSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders OversizeProposalDialog from useProjectStore and handles store confirmation', async () => {
    useProjectStore.setState({
      documentId: 'doc-store-1',
      activeOversizeProposal: {
        token: 'token-store-abc',
        estimatedBytes: 70 * 1024 * 1024,
        limitBytes: 64 * 1024 * 1024,
        explanation: 'Action of 70 MiB exceeds the 64 MiB history limit',
        documentId: 'doc-store-1',
        revision: 0,
        patches: [{ projectProperties: { title: 'New Big Title' } }],
      },
    });

    await act(async () => {
      root.render(<OversizeProposalDialog />);
    });

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Action of 70 MiB exceeds the 64 MiB history limit');

    // Confirm button commits with proposalToken through store
    const confirmBtn = document.querySelector('[data-action-id="confirm"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    expect(commitPatchesSpy).toHaveBeenCalledWith(
      [{ projectProperties: { title: 'New Big Title' } }],
      { proposalToken: 'token-store-abc' },
    );
    expect(useProjectStore.getState().activeOversizeProposal).toBeNull();
  });

  it('handles cancellation in OversizeProposalDialog via cancel button', async () => {
    useProjectStore.setState({
      documentId: 'doc-store-2',
      activeOversizeProposal: {
        token: 'token-store-cancel',
        estimatedBytes: 75 * 1024 * 1024,
        limitBytes: 64 * 1024 * 1024,
        explanation: 'Action of 75 MiB exceeds limit',
        documentId: 'doc-store-2',
        revision: 0,
        patches: [{ projectProperties: { title: 'Cancelled' } }],
      },
    });

    await act(async () => {
      root.render(<OversizeProposalDialog />);
    });

    const cancelBtn = document.querySelector('[data-action-id="cancel"]') as HTMLButtonElement;
    await act(async () => {
      cancelBtn.click();
    });

    expect(cancelProposalSpy).toHaveBeenCalledWith({ proposalToken: 'token-store-cancel' });
    expect(commitPatchesSpy).not.toHaveBeenCalled();
    expect(useProjectStore.getState().activeOversizeProposal).toBeNull();
  });
});
