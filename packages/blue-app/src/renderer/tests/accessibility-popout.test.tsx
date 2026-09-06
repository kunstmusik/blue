// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createPortal } from 'react-dom';
import { HostDocumentContext, usePortalContainer } from '../hooks/use-host-document';
import { useDialogFocus } from '../components/dialogs/use-dialog-focus';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Create a secondary JSDOM realm simulating a popout window document.
const popout = new JSDOM('<!doctype html><html><body><div id="popout-root"></div></body></html>', {
  url: 'https://popout.test',
});
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;

describe('Accessibility Popout & Two-Document Behavior (T032)', () => {
  let mainHost: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mainHost = document.createElement('div');
    document.body.appendChild(mainHost);
    root = createRoot(mainHost);
    popoutDoc.body.innerHTML = '<div id="popout-root"></div>';
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    mainHost.remove();
    popoutDoc.body.innerHTML = '';
  });

  function renderUnderPopout(node: React.ReactElement): void {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>{node}</HostDocumentContext.Provider>,
      );
    });
  }

  interface TestPopoutModalProps {
    isOpen: boolean;
    onClose: () => void;
  }

  function TestPopoutModal({ isOpen, onClose }: TestPopoutModalProps) {
    const portalContainer = usePortalContainer() ?? document.body;
    const dialogRef = useDialogFocus(isOpen, onClose);

    if (!isOpen) return null;

    return createPortal(
      <div
        id="modal-backdrop"
        className="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Popout Dialog"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <h2>Popout Dialog</h2>
          <button id="modal-confirm">Confirm</button>
          <button id="modal-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>,
      portalContainer,
    );
  }

  it('renders modal inside the popout document instead of the main document', () => {
    renderUnderPopout(<TestPopoutModal isOpen={true} onClose={vi.fn()} />);

    expect(mainHost.querySelector('[role="dialog"]')).toBeNull();
    expect(popoutDoc.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('routes Escape dismissal through the hosting popout window only', async () => {
    const onClose = vi.fn();
    renderUnderPopout(<TestPopoutModal isOpen={true} onClose={onClose} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Escape in main window must NOT dismiss popout modal
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Escape in popout window or on dialog dismisses popout modal
    const dialog = popoutDoc.querySelector('[role="dialog"]')!;
    act(() => {
      dialog.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('retains open state when clicking inside the popout dialog', async () => {
    const onClose = vi.fn();
    renderUnderPopout(<TestPopoutModal isOpen={true} onClose={onClose} />);

    const confirmBtn = popoutDoc.querySelector<HTMLButtonElement>('#modal-confirm')!;
    expect(confirmBtn).not.toBeNull();

    act(() => {
      confirmBtn.dispatchEvent(new PopoutMouseEvent('click', { bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('dismisses when clicking outside the dialog on the backdrop in the popout document', async () => {
    const onClose = vi.fn();
    renderUnderPopout(<TestPopoutModal isOpen={true} onClose={onClose} />);

    const backdrop = popoutDoc.querySelector<HTMLDivElement>('#modal-backdrop')!;
    expect(backdrop).not.toBeNull();

    act(() => {
      backdrop.dispatchEvent(new PopoutMouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to opener element in the popout document when dialog closes', () => {
    const popoutOpener = popoutDoc.createElement('button');
    popoutOpener.id = 'popout-opener';
    popoutDoc.body.appendChild(popoutOpener);
    popoutOpener.focus();

    function PopoutModalHost() {
      const [isOpen, setIsOpen] = useState(true);
      return <TestPopoutModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
    }

    renderUnderPopout(<PopoutModalHost />);

    const dialog = popoutDoc.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();

    const cancelBtn = popoutDoc.querySelector<HTMLButtonElement>('#modal-cancel')!;
    act(() => {
      cancelBtn.click();
    });

    expect(popoutDoc.activeElement).toBe(popoutOpener);
    popoutOpener.remove();
  });

  it('traps Tab and Shift+Tab focus navigation within the modal in the popout document', async () => {
    renderUnderPopout(<TestPopoutModal isOpen={true} onClose={vi.fn()} />);

    const confirmBtn = popoutDoc.querySelector<HTMLButtonElement>('#modal-confirm')!;
    const cancelBtn = popoutDoc.querySelector<HTMLButtonElement>('#modal-cancel')!;

    expect(popoutDoc.activeElement).toBe(confirmBtn);

    // Tab from last element wraps to first element
    cancelBtn.focus();
    expect(popoutDoc.activeElement).toBe(cancelBtn);

    act(() => {
      const tabEvent = new PopoutKeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      cancelBtn.dispatchEvent(tabEvent);
    });
    expect(popoutDoc.activeElement).toBe(confirmBtn);

    // Shift+Tab from first element wraps to last element
    confirmBtn.focus();
    expect(popoutDoc.activeElement).toBe(confirmBtn);

    act(() => {
      const shiftTabEvent = new PopoutKeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      confirmBtn.dispatchEvent(shiftTabEvent);
    });
    expect(popoutDoc.activeElement).toBe(cancelBtn);
  });

  it('safely handles opener restoration when opener is detached from popout document before close', () => {
    const popoutOpener = popoutDoc.createElement('button');
    popoutOpener.id = 'ephemeral-opener';
    popoutDoc.body.appendChild(popoutOpener);
    popoutOpener.focus();

    function EphemeralHost() {
      const [isOpen, setIsOpen] = useState(true);
      return <TestPopoutModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
    }

    renderUnderPopout(<EphemeralHost />);

    // Detach opener while modal is open
    popoutOpener.remove();

    const cancelBtn = popoutDoc.querySelector<HTMLButtonElement>('#modal-cancel')!;
    expect(() => {
      act(() => {
        cancelBtn.click();
      });
    }).not.toThrow();
  });
});
