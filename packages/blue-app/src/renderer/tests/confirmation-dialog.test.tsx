// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog';
import type { InAppConfirmationAction } from '../../shared/confirmation-dialog';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ConfirmationDialog component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const defaultActions: InAppConfirmationAction[] = [
    { id: 'cancel', label: 'Cancel', intent: 'cancel' },
    { id: 'delete', label: 'Delete Item', intent: 'destructive' },
  ];

  it('renders with accessible role, title, and description', () => {
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Delete SoundObject?"
          description="This operation cannot be undone."
          actions={defaultActions}
          cancelActionId="cancel"
          onDecision={vi.fn()}
        />,
      );
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('Delete SoundObject?');
    expect(container.textContent).toContain('This operation cannot be undone.');
  });

  it('focuses the Cancel button initially when destructive action is present', () => {
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Delete Item"
          actions={defaultActions}
          cancelActionId="cancel"
          onDecision={vi.fn()}
        />,
      );
    });

    const cancelButton = container.querySelector<HTMLButtonElement>('[data-action-id="cancel"]');
    expect(cancelButton).not.toBeNull();
    expect(document.activeElement).toBe(cancelButton);
  });

  it('honors initialFocusActionId override when provided', () => {
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Delete Item"
          actions={defaultActions}
          cancelActionId="cancel"
          initialFocusActionId="delete"
          onDecision={vi.fn()}
        />,
      );
    });

    const deleteButton = container.querySelector<HTMLButtonElement>('[data-action-id="delete"]');
    expect(deleteButton).not.toBeNull();
    expect(document.activeElement).toBe(deleteButton);
  });

  it('traps Tab and Shift+Tab navigation within the dialog', () => {
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Test Trap"
          actions={[
            { id: 'cancel', label: 'Cancel', intent: 'cancel' },
            { id: 'save', label: 'Save', intent: 'primary' },
          ]}
          cancelActionId="cancel"
          onDecision={vi.fn()}
        />,
      );
    });

    const cancelButton = container.querySelector<HTMLButtonElement>('[data-action-id="cancel"]')!;
    const saveButton = container.querySelector<HTMLButtonElement>('[data-action-id="save"]')!;

    expect(document.activeElement).toBe(cancelButton);

    // Press Tab on saveButton (last control) -> wraps to cancelButton (first)
    saveButton.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialogElement()?.dispatchEvent(tabEvent);
    expect(document.activeElement).toBe(cancelButton);

    // Press Shift+Tab on cancelButton (first control) -> wraps to saveButton (last)
    cancelButton.focus();
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    dialogElement()?.dispatchEvent(shiftTabEvent);
    expect(document.activeElement).toBe(saveButton);
  });

  it('resolves cancel action on Escape key', () => {
    const onDecision = vi.fn();
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Escape Test"
          actions={defaultActions}
          cancelActionId="cancel"
          onDecision={onDecision}
        />,
      );
    });

    const dialog = dialogElement()!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith('cancel');
  });

  it('resolves cancel action on backdrop click', () => {
    const onDecision = vi.fn();
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Backdrop Test"
          actions={defaultActions}
          cancelActionId="cancel"
          onDecision={onDecision}
          data-testid="backdrop"
        />,
      );
    });

    const backdrop = container.querySelector<HTMLDivElement>('[data-testid="backdrop"]')!;
    act(() => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith('cancel');
  });

  it('restores focus to invoking opener element upon closing', () => {
    let setOpenState: (open: boolean) => void = () => {};

    function HostComponent() {
      const [open, setOpen] = useState(false);
      setOpenState = setOpen;
      return (
        <div>
          <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
            Open Dialog
          </button>
          <ConfirmationDialog
            open={open}
            title="Restore Test"
            actions={defaultActions}
            cancelActionId="cancel"
            onDecision={() => setOpen(false)}
          />
        </div>
      );
    }

    act(() => {
      root.render(<HostComponent />);
    });

    const opener = container.querySelector<HTMLButtonElement>('[data-testid="opener"]')!;
    opener.focus();
    expect(document.activeElement).toBe(opener);

    act(() => {
      opener.click();
    });
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    const cancelButton = container.querySelector<HTMLButtonElement>('[data-action-id="cancel"]')!;
    act(() => {
      cancelButton.click();
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('enforces at-most-once decision guard even if multiple trigger events occur', () => {
    const onDecision = vi.fn();
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Idempotence Test"
          actions={defaultActions}
          cancelActionId="cancel"
          onDecision={onDecision}
        />,
      );
    });

    const deleteButton = container.querySelector<HTMLButtonElement>('[data-action-id="delete"]')!;
    const cancelButton = container.querySelector<HTMLButtonElement>('[data-action-id="cancel"]')!;

    act(() => {
      deleteButton.click();
      cancelButton.click();
      dialogElement()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith('delete');
  });

  it('does not trigger onDecision for disabled actions', () => {
    const onDecision = vi.fn();
    act(() => {
      root.render(
        <ConfirmationDialog
          open={true}
          title="Disabled Test"
          actions={[
            { id: 'disabled-action', label: 'Disabled', intent: 'primary', disabled: true },
            { id: 'cancel', label: 'Cancel', intent: 'cancel' },
          ]}
          cancelActionId="cancel"
          onDecision={onDecision}
        />,
      );
    });

    const disabledBtn = container.querySelector<HTMLButtonElement>('[data-action-id="disabled-action"]')!;
    expect(disabledBtn.disabled).toBe(true);

    act(() => {
      disabledBtn.click();
    });
    expect(onDecision).not.toHaveBeenCalled();
  });

  function dialogElement(): HTMLElement | null {
    return container.querySelector('[role="dialog"], [role="alertdialog"]');
  }
});
