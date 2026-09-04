/**
 * Main-process host adapter for the workbench window registry (SPEC 055).
 *
 * Owns a single {@link WorkbenchWindowManager} instance, wires the
 * workbench-window IPC channels to it, and exposes a broadcast helper so
 * project/playback/layout events reach every registered workbench renderer
 * (main + floating) instead of only the main window.
 *
 * This module imports Electron directly and is main-process only. The pure,
 * testable registry logic lives in {@link ./workbench-window-manager}.
 */

import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import {
  PROJECT_DOCUMENT_UPDATED_CHANNEL,
  WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL,
  WORKBENCH_WINDOW_REGISTER_CHANNEL,
  WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL,
  WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL,
  WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL,
  type DockFloatingGroupRequest,
  type DockFloatingGroupResult,
  type WorkbenchRevealPanelRequest,
  type WorkbenchRevealPanelResult,
  type WorkbenchWindowCloseRequest,
  type WorkbenchWindowCloseResult,
  type WorkbenchWindowOwnershipUpdate,
  type WorkbenchWindowRegisterRequest,
  type WorkbenchWindowRegisterResponse,
} from '../shared/workbench-window-contract';
import { getPanel } from '../shared/workbench-menu';
import { WorkbenchWindowManager } from './workbench-window-manager';
import { registerIpcTransaction, type IpcMainLike } from './ipc/ipc-registration';

export const WORKBENCH_WINDOW_IPC_CHANNELS = [
  WORKBENCH_WINDOW_REGISTER_CHANNEL,
  WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL,
  WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL,
  WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL,
  WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL,
] as const;

let manager: WorkbenchWindowManager | null = null;
const webContentsByWindowId = new Map<string, WebContents>();
const pendingFloatingWindowCloses = new Set<string>();
let initialized = false;
let unregisterWorkbenchIpc: (() => void) | null = null;

function getManager(): WorkbenchWindowManager {
  if (!manager) {
    manager = new WorkbenchWindowManager();
  }
  return manager;
}

function panelClosePolicy(panelIds: string[]) {
  return {
    blockedPanelIds: panelIds.filter((panelId) => getPanel(panelId)?.isClosable === false),
    requiresPrompt: false,
  };
}

function attachFloatingWindowCloseHandler(
  browserWindow: BrowserWindow,
  windowId: string,
  m: WorkbenchWindowManager,
): void {
  browserWindow.on('close', (event) => {
    // A renderer-initiated Dock/Dock Group closes the native window after it
    // has moved or removed the panels. Allow that second close event through.
    if (pendingFloatingWindowCloses.delete(windowId)) {
      return;
    }

    const entry = m.getEntry(windowId);
    const panelIds = entry?.panelIds ?? [];
    const result = m.requestClose({
      windowId,
      panelIds,
      source: 'window-close',
      policy: panelClosePolicy,
    });
    if (!result.allowed) {
      event.preventDefault();
      return;
    }

    // Registration can race the first native close event. If ownership is not
    // known yet, there is no safe group command to route, so allow the window
    // to close normally. Once ownership is known, close the Dockview group in
    // the main renderer first so no empty splitter remains behind.
    const panelId = panelIds[0];
    if (!panelId) return;

    event.preventDefault();
    pendingFloatingWindowCloses.add(windowId);
    sendToMainWindow('native-menu-command', {
      type: 'close-floating-group',
      panelId,
    });

    // If the renderer is unavailable or the group was already stale, do not
    // leave an empty native window behind indefinitely.
    setTimeout(() => {
      if (!pendingFloatingWindowCloses.delete(windowId)) return;
      if (!browserWindow.isDestroyed()) {
        browserWindow.close();
      }
    }, 500);
  });
}

/**
 * Registers a main workbench window in the registry. Called from main.ts when
 * the main BrowserWindow is created so broadcast/reveal work immediately,
 * before the renderer sends its own registration message.
 */
export function registerMainWindow(browserWindow: BrowserWindow): string {
  const m = getManager();
  const existing = m.getMainWindowId();
  if (existing) {
    const entry = m.getEntry(existing);
    if (entry) return existing;
  }
  const windowId = m.register({
    role: 'main',
    browserWindowId: browserWindow.id,
    handle: {
      focus: () => {
        if (!browserWindow.isDestroyed()) {
          if (browserWindow.isMinimized()) browserWindow.restore();
          browserWindow.focus();
        }
      },
      isDestroyed: () => browserWindow.isDestroyed(),
    },
  });
  webContentsByWindowId.set(windowId, browserWindow.webContents);
  browserWindow.on('close', (event) => {
    const entry = m.getEntry(windowId);
    const result = m.requestClose({
      windowId,
      panelIds: entry?.panelIds ?? [],
      source: 'window-close',
      policy: panelClosePolicy,
    });
    if (!result.allowed) {
      event.preventDefault();
    }
  });
  browserWindow.webContents.once('destroyed', () => {
    m.dispose(windowId);
    webContentsByWindowId.delete(windowId);
  });
  return windowId;
}

/**
 * Returns the shared registry. Application menu / reveal routing use this to
 * resolve which window owns a panel.
 */
/**
 * Registers a floating workbench popout window. Called when Electron creates a
 * BrowserWindow for a Dockview popout group (SPEC 055 US1). Captures the window
 * so reveal/close/focus routing can target it.
 */
export function registerFloatingWindow(
  browserWindow: BrowserWindow,
  options: { popoutGroupId?: string; projectSessionId?: number } = {},
): string {
  const m = getManager();
  const existing = m.getAll().find((entry) => entry.browserWindowId === browserWindow.id);
  if (existing) {
    if (options.popoutGroupId !== undefined) {
      m.updateOwnership({
        windowId: existing.windowId,
        popoutGroupId: options.popoutGroupId,
      });
    }
    return existing.windowId;
  }

  const windowId = m.register({
    role: 'floating',
    popoutGroupId: options.popoutGroupId,
    projectSessionId: options.projectSessionId,
    browserWindowId: browserWindow.id,
    handle: {
      focus: () => {
        if (!browserWindow.isDestroyed()) {
          if (browserWindow.isMinimized()) browserWindow.restore();
          browserWindow.focus();
        }
      },
      isDestroyed: () => browserWindow.isDestroyed(),
    },
  });
  webContentsByWindowId.set(windowId, browserWindow.webContents);
  attachFloatingWindowCloseHandler(browserWindow, windowId, m);
  browserWindow.webContents.once('destroyed', () => {
    pendingFloatingWindowCloses.delete(windowId);
    m.dispose(windowId);
    webContentsByWindowId.delete(windowId);
  });
  return windowId;
}

/**
 * Routes a Window-menu "focus panel" command (SPEC 055 US6, FR-024/FR-025). If a
 * live floating workbench window owns the panel, that OS window is focused first;
 * the main workbench renderer is then asked to activate the panel in Dockview
 * (the popped-out group still lives in the main renderer's Dockview instance, so
 * activating it there selects the tab inside the focused floating window). This
 * prevents opening a duplicate of an already-floating panel.
 */
export function routeFocusPanel(panelId: string): void {
  const m = getManager();
  m.resolveReveal(panelId);
  sendToMainWindow('native-menu-command', { type: 'focus-panel', panelId });
}

export function getWorkbenchWindowManager(): WorkbenchWindowManager {
  return getManager();
}

/**
 * Sends a message to every live registered workbench renderer (main + floating).
 * Used to broadcast project, playback, and layout-reset events so floating
 * windows stay in sync with the main workbench session.
 */
export function broadcastToWorkbenchWindows(channel: string, payload: unknown): void {
  const m = getManager();
  m.pruneDestroyed();
  for (const entry of m.getAll()) {
    const contents = webContentsByWindowId.get(entry.windowId);
    if (contents && !contents.isDestroyed()) {
      contents.send(channel, payload);
    }
  }
}

/**
 * Sends a message to the main workbench renderer only. Used as a fallback for
 * reveal commands that have no floating owner.
 */
export function sendToMainWindow(channel: string, payload: unknown): void {
  const m = getManager();
  const mainId = m.getMainWindowId();
  if (!mainId) return;
  const contents = webContentsByWindowId.get(mainId);
  if (contents && !contents.isDestroyed()) {
    contents.send(channel, payload);
  }
}

/**
 * Wires the workbench-window IPC channels. Duplicate initialization fails
 * before side effects; handlers delegate to the registry.
 */
export function initWorkbenchWindowHost(registrationTarget: IpcMainLike = ipcMain): void {
  if (initialized) {
    throw new Error('Workbench window IPC is already initialized.');
  }
  const m = getManager();
  unregisterWorkbenchIpc = registerIpcTransaction(
    registrationTarget,
    'workbench-window',
    (scope) => {
      scope.handle(
        WORKBENCH_WINDOW_REGISTER_CHANNEL,
        (event, request: WorkbenchWindowRegisterRequest): WorkbenchWindowRegisterResponse => {
          const senderContents = event.sender;
          const browserWindow = BrowserWindow.fromWebContents(senderContents);
          // If this sender is already the main window, keep the existing id.
          const existingMain = m.getMainWindowId();
          if (existingMain && webContentsByWindowId.get(existingMain) === senderContents) {
            return { windowId: existingMain };
          }

          // The browser-window-created hook registers a floating BrowserWindow as
          // soon as its popout page loads. The popout preload then reports the
          // actual Dockview group id; bind that report to the existing OS window
          // instead of creating a duplicate registry entry.
          const existingWindow = browserWindow
            ? m.getAll().find((entry) => entry.browserWindowId === browserWindow.id)
            : undefined;
          if (existingWindow) {
            m.updateOwnership({
              windowId: existingWindow.windowId,
              role: request.role,
              ...(request.popoutGroupId !== undefined
                ? { popoutGroupId: request.popoutGroupId }
                : {}),
              ...(request.projectSessionId !== undefined
                ? { projectSessionId: request.projectSessionId }
                : {}),
            });
            return { windowId: existingWindow.windowId };
          }

          const windowId = m.register({
            role: request.role,
            popoutGroupId: request.popoutGroupId,
            projectSessionId: request.projectSessionId,
            browserWindowId: browserWindow?.id,
            handle: browserWindow
              ? {
                  focus: () => {
                    if (!browserWindow.isDestroyed()) {
                      if (browserWindow.isMinimized()) browserWindow.restore();
                      browserWindow.focus();
                    }
                  },
                  isDestroyed: () => browserWindow.isDestroyed(),
                }
              : undefined,
          });
          webContentsByWindowId.set(windowId, senderContents);
          if (browserWindow && request.role === 'floating') {
            attachFloatingWindowCloseHandler(browserWindow, windowId, m);
          }
          senderContents.once('destroyed', () => {
            pendingFloatingWindowCloses.delete(windowId);
            m.dispose(windowId);
            webContentsByWindowId.delete(windowId);
          });
          return { windowId };
        },
      );

      scope.on(
        WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL,
        (_event, update: WorkbenchWindowOwnershipUpdate) => {
          // Floating ownership is reported by the main renderer because Dockview
          // popouts share that JS context. Resolve those updates by popout id so the
          // main window entry is not accidentally overwritten as a floating window.
          const entry =
            update.role === 'floating' && update.popoutGroupId
              ? m.getByPopoutGroup(update.popoutGroupId)
              : m.getEntry(update.windowId);
          if (entry) {
            m.updateOwnership({
              windowId: entry.windowId,
              role: update.role,
              popoutGroupId: update.popoutGroupId,
              panelIds: update.panelIds,
              activePanelId: update.activePanelId,
            });
            if (update.projectSessionId !== undefined) {
              entry.projectSessionId = update.projectSessionId;
            }
          }
        },
      );

      scope.handle(
        WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL,
        (_event, request: WorkbenchRevealPanelRequest): WorkbenchRevealPanelResult => {
          const result = m.resolveReveal(request.panelId);
          if (!result.handled) {
            sendToMainWindow('native-menu-command', {
              type: 'focus-panel',
              panelId: request.panelId,
            });
            return { handled: true, openedInDefaultMode: true };
          }
          return result;
        },
      );

      scope.handle(
        WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL,
        (_event, request: WorkbenchWindowCloseRequest): WorkbenchWindowCloseResult => {
          // Enforce the same panel close eligibility for floating window closes
          // that renderer tab-close commands use.
          const result = m.requestClose({
            windowId: request.windowId,
            panelIds: request.panelIds,
            source: request.source,
            policy: panelClosePolicy,
          });
          if (result.allowed && request.source === 'dock') {
            const entry = m.getEntry(request.windowId);
            if (entry?.role === 'floating') {
              // Renderer-side Dock/Dock Group is about to call window.close(). The
              // BrowserWindow close handler must distinguish that from an OS close
              // button so it does not route the operation back into the renderer.
              pendingFloatingWindowCloses.add(entry.windowId);
            }
          }
          return {
            allowed: result.allowed,
            blockedPanelIds: result.blockedPanelIds,
            requiresPrompt: result.requiresPrompt,
          };
        },
      );

      scope.handle(
        WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL,
        (_event, _request: DockFloatingGroupRequest): DockFloatingGroupResult => {
          // Dock is resolved renderer-side (the owning popout renderer performs the
          // layout move using its Dockview instance). Main acknowledges here.
          return { docked: false };
        },
      );
    },
  );
  initialized = true;
}

export function disposeWorkbenchWindowHost(): void {
  unregisterWorkbenchIpc?.();
  unregisterWorkbenchIpc = null;
  initialized = false;
}

export { PROJECT_DOCUMENT_UPDATED_CHANNEL };
